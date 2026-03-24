"use client";

import { ActivityActionType } from "@prisma/client";
import { formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Activity {
  id: string;
  actionType: ActivityActionType;
  entityType: string;
  metaJson: string | null;
  createdAt: Date;
  actorUser: { firstName: string; lastName: string } | null;
}

interface RecentActivityProps {
  activities: Activity[];
}

const actionLabels: Record<ActivityActionType, string> = {
  [ActivityActionType.CLIENT_CREATED]: "created a new client",
  [ActivityActionType.PROJECT_CREATED]: "created a project",
  [ActivityActionType.PROJECT_UPDATED]: "updated a project",
  [ActivityActionType.PROJECT_ARCHIVED]: "archived a project",
  [ActivityActionType.REVIEW_ITEM_CREATED]: "added a review item",
  [ActivityActionType.REVIEW_ITEM_UPDATED]: "updated a review item",
  [ActivityActionType.REVIEW_ITEM_ARCHIVED]: "removed a review item",
  [ActivityActionType.REVIEW_REVISION_CREATED]: "added a new revision",
  [ActivityActionType.COMMENT_THREAD_CREATED]: "started a comment thread",
  [ActivityActionType.COMMENT_REPLY_ADDED]: "replied to a comment",
  [ActivityActionType.STATUS_CHANGED]: "changed comment status",
  [ActivityActionType.ANNOTATION_CREATED]: "added an annotation",
  [ActivityActionType.ANNOTATION_UPDATED]: "updated an annotation",
  [ActivityActionType.ANNOTATION_DELETED]: "deleted an annotation",
  [ActivityActionType.SHARE_LINK_CREATED]: "created a share link",
  [ActivityActionType.SHARE_LINK_REVOKED]: "revoked a share link",
  [ActivityActionType.GUEST_COMMENT_SUBMITTED]: "received a guest comment",
  [ActivityActionType.MEMBER_ASSIGNED]: "assigned a team member",
  [ActivityActionType.GUEST_COMMENTING_CHANGED]: "changed guest commenting settings",
  [ActivityActionType.PASSWORD_RESET_REQUESTED]: "requested a password reset",
};

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const meta = activity.metaJson ? JSON.parse(activity.metaJson) : {};
        const actorName = activity.actorUser
          ? `${activity.actorUser.firstName} ${activity.actorUser.lastName}`
          : "System";

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{actorName}</span>{" "}
                {actionLabels[activity.actionType]}
                {meta.name && (
                  <span className="text-muted-foreground"> "{meta.name}"</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(activity.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-2 h-2 mt-2 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
