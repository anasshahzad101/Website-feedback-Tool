import { db } from "@/lib/db/client";
import { notFound, redirect } from "next/navigation";
import { GuestReviewPage } from "@/components/guest/guest-review-page";

interface GuestReviewRouteProps {
  params: Promise<{ token: string }>;
}

export default async function GuestReviewRoute({ params }: GuestReviewRouteProps) {
  const { token } = await params;
  // Find and validate share link
  const shareLink = await db.shareLink.findUnique({
    where: { token },
    include: {
      reviewItem: {
        include: {
          project: {
            include: {
              client: true,
            },
          },
          currentRevision: true,
          revisions: {
            orderBy: { revisionDate: "desc" },
          },
          annotations: {
            select: {
              id: true,
              annotationType: true,
              x: true,
              y: true,
              xPercent: true,
              yPercent: true,
              width: true,
              height: true,
              widthPercent: true,
              heightPercent: true,
              pointsJson: true,
              targetTimestampMs: true,
              color: true,
              commentThreadId: true,
              screenshotContextPath: true,
            },
          },
          commentThreads: {
            include: {
              rootAnnotation: true,
              messages: {
                orderBy: { createdAt: "asc" },
                include: {
                  createdByUser: {
                    select: { firstName: true, lastName: true },
                  },
                  createdByGuest: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      project: {
        include: {
          client: true,
          reviewItems: {
            orderBy: { createdAt: "desc" },
            include: {
              currentRevision: true,
            },
          },
        },
      },
    },
  });

  if (!shareLink) {
    notFound();
  }

  // Check if link has expired
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
          <p className="text-muted-foreground">
            This review link has expired. Please contact the project owner for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Check if guest viewing is allowed
  if (!shareLink.allowGuestView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            This link does not allow guest viewing.
          </p>
        </div>
      </div>
    );
  }

  const rawReviewItem = shareLink.reviewItem;
  // Only use shareLink.project (which includes reviewItems); if it came from reviewItem.project it won't have reviewItems
  const project = shareLink.project ?? null;

  // Attach thread status to annotations
  const reviewItem = rawReviewItem
    ? {
        ...rawReviewItem,
        annotations: rawReviewItem.annotations.map((ann) => {
          const thread = ann.commentThreadId
            ? rawReviewItem.commentThreads.find((t) => t.id === ann.commentThreadId)
            : null;
          return {
            ...ann,
            commentThread: thread ? { id: thread.id, status: thread.status } : null,
          };
        }),
      }
    : null;

  if (!reviewItem && !project) {
    notFound();
  }

  return (
    <GuestReviewPage
      shareLink={shareLink}
      reviewItem={reviewItem as Parameters<typeof GuestReviewPage>[0]["reviewItem"]}
      project={project ?? null}
      allowGuestComments={shareLink.allowGuestComments}
    />
  );
}
