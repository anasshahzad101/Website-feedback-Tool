import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect, notFound } from "next/navigation";
import { ReviewItemClient } from "@/components/review-items/review-item-client";
import { CommentStatus } from "@prisma/client";

interface ReviewItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewItemPage({ params }: ReviewItemPageProps) {
  const { id: paramsId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const reviewItem = await db.reviewItem.findUnique({
    where: { id: paramsId },
    include: {
      project: {
        include: {
          client: true,
          members: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      },
      currentRevision: true,
      revisions: {
        orderBy: { revisionDate: "desc" },
      },
      commentThreads: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              createdByUser: { select: { firstName: true, lastName: true } },
              createdByGuest: true,
            },
          },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!reviewItem) {
    notFound();
  }

  // Check access
  const userMembership = reviewItem.project.members.find(
    (m) => m.user?.id === session.user.id
  );

  if (
    !Permissions.canAccessAdminPanel(session.user.role as UserRole) &&
    !userMembership
  ) {
    redirect("/dashboard");
  }

  // Fetch annotations with thread info
  const annotations = await db.annotation.findMany({
    where: { reviewItemId: paramsId },
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
      screenshotContextPath: true,
      pinInCropX: true,
      pinInCropY: true,
      color: true,
      commentThreadId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const annotationsWithStatus = annotations.map((ann) => {
    const thread = ann.commentThreadId
      ? reviewItem.commentThreads.find((t) => t.id === ann.commentThreadId)
      : null;
    return {
      ...ann,
      commentThread: thread
        ? { id: thread.id, status: thread.status as CommentStatus }
        : null,
    };
  });

  return (
    <ReviewItemClient
      reviewItem={{
        ...reviewItem,
        project: {
          ...reviewItem.project,
          client: reviewItem.project.client,
        },
      }}
      currentRevision={reviewItem.currentRevision}
      annotations={annotationsWithStatus}
      commentThreads={reviewItem.commentThreads}
      user={session.user}
      userRole={userMembership?.roleInProject ?? null}
    />
  );
}
