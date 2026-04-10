"use client";

import type { ReactNode } from "react";
import { CommentStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageAttachments } from "@/components/comments/message-attachments";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Trash2, ZoomIn } from "lucide-react";
import { attachmentPublicUrl } from "@/lib/comment-attachments";
import { ContextScreenshotWithPin } from "@/components/comments/context-screenshot-with-pin";

export type CommentThreadDetailModel = {
  id: string;
  status: CommentStatus;
  messages: Array<{
    id: string;
    body: string;
    createdAt: Date | string;
    createdByUser?: { firstName: string; lastName: string } | null;
    createdByGuest?: { name: string } | null;
    isSystemMessage: boolean;
    attachments?: unknown;
  }>;
};

const COMPLETED: CommentStatus[] = [CommentStatus.RESOLVED, CommentStatus.CLOSED];

function messageInitials(m: CommentThreadDetailModel["messages"][number]): string {
  if (m.isSystemMessage) return "•";
  if (m.createdByUser) {
    return getInitials(
      m.createdByUser.firstName || "?",
      m.createdByUser.lastName || ""
    );
  }
  const gn = m.createdByGuest?.name?.trim();
  if (!gn) return "G";
  const parts = gn.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return getInitials(parts[0]!, parts[1]!);
  return parts[0]!.slice(0, 2).toUpperCase();
}

function statusLabel(s: CommentStatus): string {
  const labels: Record<CommentStatus, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    IGNORED: "Ignored",
  };
  return labels[s] ?? s;
}

export function CommentThreadDetailDialog({
  open,
  onOpenChange,
  thread,
  pinNumber,
  pinColor,
  screenshotContextPath,
  contextMarkerLeftPercent = 50,
  contextMarkerTopPercent = 50,
  onOpenScreenshot,
  onStatusChange,
  onDeleteThread,
  replyArea,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: CommentThreadDetailModel | null;
  pinNumber: number;
  pinColor: string;
  screenshotContextPath?: string | null;
  /** Pin position on the context image (percent). Pin-centered crops use ~50/50. */
  contextMarkerLeftPercent?: number;
  contextMarkerTopPercent?: number;
  onOpenScreenshot: (fullUrl: string) => void;
  onStatusChange: (threadId: string, status: CommentStatus) => void;
  onDeleteThread: (threadId: string) => void;
  replyArea: ReactNode;
}) {
  const isCompleted = thread ? COMPLETED.includes(thread.status) : false;
  const shotUrl = screenshotContextPath?.trim()
    ? attachmentPublicUrl(screenshotContextPath.trim())
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {thread ? (
      <DialogContent className="max-w-3xl w-[min(100vw-2rem,42rem)] max-h-[min(90vh,800px)] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="p-4 pb-3 border-b shrink-0 space-y-3 text-left">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-8 h-8 rounded-full text-white text-sm flex items-center justify-center font-bold shrink-0"
                style={{ backgroundColor: pinColor }}
              >
                {pinNumber}
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">
                  Comment
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCompleted ? "Completed" : "Active"} · Pin {pinNumber}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
              {!isCompleted && (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-8"
                  onClick={() => onStatusChange(thread.id, CommentStatus.RESOLVED)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Mark complete
                </Button>
              )}
              <select
                value={thread.status}
                onChange={(e) =>
                  onStatusChange(thread.id, e.target.value as CommentStatus)
                }
                className="text-xs border rounded-md bg-background px-2 py-1.5 h-8 max-w-[140px]"
              >
                {(
                  [
                    CommentStatus.OPEN,
                    CommentStatus.IN_PROGRESS,
                    CommentStatus.RESOLVED,
                    CommentStatus.CLOSED,
                    CommentStatus.IGNORED,
                  ] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => onDeleteThread(thread.id)}
                aria-label="Delete thread"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-6">
            {shotUrl ? (
              <div className="rounded-xl border border-primary/25 bg-primary/[0.06] dark:bg-primary/10 dark:border-primary/35 p-3 shadow-sm">
                <p className="text-xs font-semibold text-foreground tracking-tight mb-0.5">
                  Pin location snapshot
                </p>
                <p className="text-[11px] text-muted-foreground mb-2.5 leading-snug">
                  Cropped view where this pin was placed — separate from any files
                  attached below.
                </p>
                <button
                  type="button"
                  className="group relative flex w-full justify-center rounded-lg overflow-hidden cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-1 ring-border/80 shadow-md hover:ring-primary/35 hover:shadow-lg transition-shadow p-0 bg-muted/20 dark:bg-muted/30"
                  onClick={() => onOpenScreenshot(shotUrl)}
                >
                  <ContextScreenshotWithPin
                    src={shotUrl}
                    alt="Pin location snapshot"
                    pinNumber={pinNumber}
                    pinColor={pinColor}
                    className="max-w-full rounded-lg"
                    imgClassName="max-w-full max-h-[min(20rem,52vh)] w-auto h-auto pointer-events-none rounded-lg"
                    markerLeftPercent={contextMarkerLeftPercent}
                    markerTopPercent={contextMarkerTopPercent}
                  />
                  <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-background/95 px-2 py-1 text-[10px] font-medium shadow-md border border-border/60 pointer-events-none backdrop-blur-[2px]">
                    <ZoomIn className="h-3 w-3" />
                    Larger view
                  </span>
                </button>
              </div>
            ) : null}

            <div className={shotUrl ? "border-t pt-4 space-y-5" : "space-y-5"}>
              <p className="text-xs font-semibold text-foreground">
                Comment thread
              </p>
              <p className="text-[11px] text-muted-foreground -mt-3 mb-1">
                Text and uploaded files (images, PDFs, audio) belong here only.
              </p>
              {thread.messages.map((m) => {
                const who = m.isSystemMessage
                  ? "System"
                  : m.createdByUser
                    ? `${m.createdByUser.firstName} ${m.createdByUser.lastName}`
                    : m.createdByGuest?.name ?? "Guest";
                const when = formatRelativeTime(m.createdAt);

                return (
                  <div
                    key={m.id}
                    className={
                      m.isSystemMessage
                        ? "text-xs text-muted-foreground italic border-l-2 border-muted pl-3"
                        : "flex gap-3"
                    }
                  >
                    {!m.isSystemMessage && (
                      <Avatar className="h-8 w-8 shrink-0 border border-border/60 mt-0.5">
                        <AvatarFallback className="text-[11px] font-semibold bg-muted">
                          {messageInitials(m)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{who}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {when}
                        </span>
                      </div>
                      {m.body.trim() ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {m.body}
                        </p>
                      ) : null}
                      {!m.isSystemMessage && (
                        <MessageAttachments raw={m.attachments} variant="full" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t shrink-0 bg-muted/20">{replyArea}</div>
      </DialogContent>
      ) : null}
    </Dialog>
  );
}
