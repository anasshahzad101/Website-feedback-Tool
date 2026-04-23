"use client";

import { useState } from "react";
import { ReviewItemHeader } from "@/components/review-items/review-item-header";
import { ReviewViewer, type Annotation, type CommentThread } from "@/components/viewers/review-viewer";
import {
  ReviewItemType,
  ReviewMode,
  CommentStatus,
  ProjectRole,
  ScreenshotCaptureStatus,
} from "@prisma/client";

interface Revision {
  id: string;
  revisionLabel?: string | null;
  revisionDate: Date;
  sourceUrl?: string | null;
  uploadedFilePath?: string | null;
  snapshotPath?: string | null;
  screenshotStatus?: ScreenshotCaptureStatus;
  screenshotError?: string | null;
}

interface ReviewItemClientProps {
  reviewItem: {
    id: string;
    title: string;
    type: ReviewItemType;
    reviewMode: ReviewMode;
    sourceUrl: string | null;
    uploadedFilePath: string | null;
    width?: number | null;
    height?: number | null;
    durationSeconds?: number | null;
    guestCommentingEnabled: boolean;
    isPublicShareEnabled: boolean;
    project: {
      id: string;
      name: string;
      slug: string;
      guestCommentingEnabled?: boolean;
      client: { name: string };
    };
    revisions: Revision[];
    commentThreads: Array<{ status: CommentStatus }>;
  };
  currentRevision: Revision | null;
  annotations: Annotation[];
  commentThreads: CommentThread[];
  user: { id: string; role: string; firstName: string; lastName: string };
  userRole: ProjectRole | null;
}

export function ReviewItemClient({
  reviewItem,
  currentRevision,
  annotations,
  commentThreads,
  user,
  userRole,
}: ReviewItemClientProps) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    currentRevision?.id ?? ""
  );

  const displayRevision =
    reviewItem.revisions.find((r) => r.id === selectedRevisionId) ?? currentRevision;

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col">
      <ReviewItemHeader
        reviewItem={reviewItem}
        userRole={userRole}
        user={user}
        selectedRevisionId={selectedRevisionId}
        onRevisionChange={setSelectedRevisionId}
      />
      <div className="flex-1 overflow-hidden">
        <ReviewViewer
          reviewItem={reviewItem}
          annotations={annotations}
          commentThreads={commentThreads}
          currentRevision={displayRevision ?? null}
          selectedRevisionId={selectedRevisionId}
          revisions={reviewItem.revisions}
          user={user}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
