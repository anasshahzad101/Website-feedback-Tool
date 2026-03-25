import nodemailer from "nodemailer";
import { db, NotificationType, NotificationStatus } from "@/lib/db/client";
import { publicBrandName } from "@/lib/brand";
import { getPublicBranding, type PublicBranding } from "@/lib/app-settings";

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface NotificationPayload {
  recipientEmail: string;
  recipientUserId?: string;
  type: NotificationType;
  data: Record<string, unknown>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor() {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASSWORD || "",
      from:
        process.env.SMTP_FROM ||
        `${publicBrandName()} <noreply@example.com>`,
    };

    this.from = config.from;

    if (config.user && config.password) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });
    }
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    if (!this.transporter) {
      console.warn("Email transporter not configured");
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async queueNotification(payload: NotificationPayload): Promise<void> {
    await db.emailNotification.create({
      data: {
        recipientEmail: payload.recipientEmail,
        recipientUserId: payload.recipientUserId,
        type: payload.type,
        payloadJson: JSON.stringify(payload.data),
        status: NotificationStatus.PENDING,
      },
    });
  }

  async processPendingNotifications(): Promise<void> {
    const pending = await db.emailNotification.findMany({
      where: { status: NotificationStatus.PENDING },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    for (const notification of pending) {
      try {
        const payload = JSON.parse(notification.payloadJson);
        const emailPayload = await this.buildEmailPayload(
          notification.type,
          payload
        );

        if (emailPayload) {
          const sent = await this.sendEmail({
            to: notification.recipientEmail,
            ...emailPayload,
          });

          if (sent) {
            await db.emailNotification.update({
              where: { id: notification.id },
              data: { status: NotificationStatus.SENT, sentAt: new Date() },
            });
          } else {
            throw new Error("Failed to send email");
          }
        }
      } catch (error) {
        await db.emailNotification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
  }

  private async buildEmailPayload(
    type: NotificationType,
    data: Record<string, unknown>
  ): Promise<{ subject: string; html: string } | null> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const branding = await getPublicBranding();

    switch (type) {
      case NotificationType.NEW_COMMENT:
        return {
          subject: `New comment on "${data.reviewItemTitle}"`,
          html: this.renderNewCommentEmail(data, appUrl, branding),
        };

      case NotificationType.NEW_REPLY:
        return {
          subject: `New reply to your comment`,
          html: this.renderNewReplyEmail(data, appUrl, branding),
        };

      case NotificationType.STATUS_CHANGED:
        return {
          subject: `Comment status changed to ${data.newStatus}`,
          html: this.renderStatusChangedEmail(data, appUrl, branding),
        };

      case NotificationType.GUEST_COMMENT:
        return {
          subject: `New guest comment on "${data.reviewItemTitle}"`,
          html: this.renderGuestCommentEmail(data, appUrl, branding),
        };

      case NotificationType.REVIEW_ITEM_SHARED:
        return {
          subject: `New review item shared: "${data.reviewItemTitle}"`,
          html: this.renderReviewItemSharedEmail(data, appUrl, branding),
        };

      case NotificationType.CLIENT_INVITED:
        return {
          subject: `You've been invited to review "${data.projectName}"`,
          html: this.renderClientInvitedEmail(data, appUrl, branding),
        };

      case NotificationType.PASSWORD_RESET:
        return {
          subject: "Password reset request",
          html: this.renderPasswordResetEmail(data, appUrl, branding),
        };

      case NotificationType.ACCOUNT_SETUP:
        return {
          subject: `Your ${branding.brandName} account`,
          html: this.renderAccountSetupEmail(data, appUrl, branding),
        };

      default:
        return null;
    }
  }

  private renderBaseEmail(content: string, branding: PublicBranding): string {
    const brand = branding.brandName;
    const app = branding.appName;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${brand}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${brand}</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>This is an automated message from ${app}.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private renderNewCommentEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>New Comment</h2>
      <p><strong>${data.authorName}</strong> left a comment on <strong>"${data.reviewItemTitle}"</strong>:</p>
      <blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #64748b;">
        ${data.message}
      </blockquote>
      <a href="${appUrl}/review/${data.reviewItemId}" class="button">View Comment</a>
    `, branding);
  }

  private renderNewReplyEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>New Reply</h2>
      <p><strong>${data.authorName}</strong> replied to your comment:</p>
      <blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #64748b;">
        ${data.message}
      </blockquote>
      <a href="${appUrl}/review/${data.reviewItemId}?thread=${data.threadId}" class="button">View Reply</a>
    `, branding);
  }

  private renderStatusChangedEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>Status Changed</h2>
      <p>A comment on <strong>"${data.reviewItemTitle}"</strong> has been updated:</p>
      <p><strong>From:</strong> ${data.oldStatus} → <strong>To:</strong> ${data.newStatus}</p>
      <a href="${appUrl}/review/${data.reviewItemId}?thread=${data.threadId}" class="button">View Comment</a>
    `, branding);
  }

  private renderGuestCommentEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>New Guest Comment</h2>
      <p><strong>${data.guestName}</strong> (${data.guestEmail || "no email"}) left a comment on <strong>"${data.reviewItemTitle}"</strong>:</p>
      <blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #64748b;">
        ${data.message}
      </blockquote>
      <a href="${appUrl}/review/${data.reviewItemId}?thread=${data.threadId}" class="button">View Comment</a>
    `, branding);
  }

  private renderReviewItemSharedEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>New Review Item</h2>
      <p><strong>${data.sharedBy}</strong> shared a new item with you for review:</p>
      <p style="font-size: 18px; font-weight: 600; margin: 20px 0;">${data.reviewItemTitle}</p>
      <p>Project: ${data.projectName}</p>
      <a href="${appUrl}/review/${data.reviewItemId}" class="button">Start Review</a>
    `, branding);
  }

  private renderClientInvitedEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>You're Invited</h2>
      <p>You've been invited to collaborate on the project <strong>"${data.projectName}"</strong>.</p>
      <p>Click the button below to access your reviews and provide feedback.</p>
      <a href="${appUrl}/login" class="button">Access Feedback Tool</a>
      <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
        If you don't have an account yet, please contact your project manager for setup instructions.
      </p>
    `, branding);
  }

  private renderPasswordResetEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>Password Reset</h2>
      <p>You requested a password reset for your ${branding.appName} account.</p>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${appUrl}/reset-password?token=${data.token}" class="button">Reset Password</a>
      <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
        If you didn't request this reset, please ignore this email.
      </p>
    `, branding);
  }

  private renderAccountSetupEmail(
    data: Record<string, unknown>,
    appUrl: string,
    branding: PublicBranding
  ): string {
    return this.renderBaseEmail(`
      <h2>Your Account is Ready</h2>
      <p>An account has been created for you on ${branding.appName}.</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p>Click the button below to set your password and get started.</p>
      <a href="${appUrl}/reset-password?token=${data.token}" class="button">Set Password</a>
    `, branding);
  }
}

export const emailService = new EmailService();
