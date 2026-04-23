import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ProjectRole, type ShareLink } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { coerceSessionRole } from "@/lib/auth/session-role";

export type CaptureAuthInput = {
  reviewRevisionId: string;
  reviewItemIdLog?: string;
  guestToken: string | null;
  shareToken: string | null;
};

export function loadRevisionWithItem(reviewRevisionId: string) {
  return db.reviewRevision.findUnique({
    where: { id: reviewRevisionId },
    include: {
      reviewItem: {
        include: {
          project: {
            include: { members: true },
          },
        },
      },
    },
  });
}

/** Same rules as comment creation: session or guest (share + guest tokens). */
export async function loadAuthorizedRevisionForCapture(
  input: CaptureAuthInput
): Promise<
  | {
      ok: true;
      revision: NonNullable<Awaited<ReturnType<typeof loadRevisionWithItem>>>;
    }
  | { ok: false; response: NextResponse }
> {
  const { reviewRevisionId, reviewItemIdLog, guestToken, shareToken } = input;

  const session = await auth();
  let guestMode = false;
  let actorId: string | null = null;
  let shareLinkForGuest: ShareLink | null = null;

  if (session?.user?.id) {
    const actor = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });
    if (!actor?.isActive) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Your session is out of date (user not found). Sign out and sign in again.",
          },
          { status: 401 }
        ),
      };
    }
    actorId = actor.id;
  } else {
    if (!guestToken || !shareToken) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    guestMode = true;

    const shareLink = await db.shareLink.findUnique({
      where: { token: shareToken },
    });
    if (!shareLink) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid share link" }, { status: 404 }),
      };
    }
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Share link has expired" }, { status: 410 }),
      };
    }
    if (!shareLink.allowGuestComments) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Guest commenting is not enabled for this link" },
          { status: 403 }
        ),
      };
    }

    const guest = await db.guestIdentity.findUnique({
      where: { accessToken: guestToken },
    });
    if (!guest) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid guest token" }, { status: 401 }),
      };
    }
    shareLinkForGuest = shareLink;
  }

  const revision = await loadRevisionWithItem(reviewRevisionId);

  if (!revision) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Review revision not found" }, { status: 404 }),
    };
  }

  if (reviewItemIdLog && reviewItemIdLog !== revision.reviewItemId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "reviewItemId does not match this revision" },
        { status: 400 }
      ),
    };
  }

  if (guestMode) {
    const shareLink = shareLinkForGuest!;
    if (shareLink.reviewItemId && shareLink.reviewItemId !== revision.reviewItemId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Review item not accessible via this link" },
          { status: 403 }
        ),
      };
    }
    if (shareLink.projectId) {
      if (revision.reviewItem.projectId !== shareLink.projectId) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Review item not accessible via this link" },
            { status: 403 }
          ),
        };
      }
    }
    if (
      !Permissions.canCreateComment(
        null,
        null,
        revision.reviewItem.guestCommentingEnabled,
        true
      )
    ) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  } else {
    const userMembership = revision.reviewItem.project.members.find(
      (m) => m.userId === actorId
    );
    const userRole = coerceSessionRole(session!.user!.role);
    if (
      !Permissions.canCreateComment(
        userRole,
        userMembership?.roleInProject as ProjectRole | null,
        revision.reviewItem.guestCommentingEnabled,
        false
      )
    ) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true, revision };
}
