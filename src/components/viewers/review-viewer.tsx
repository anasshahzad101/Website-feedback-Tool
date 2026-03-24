"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CommentStatus, ProjectRole, ReviewItemType, ReviewMode } from "@prisma/client";
import { AnnotationLayer, type NewAnnotation, type Annotation } from "@/components/annotations/annotation-layer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Clock,
  X,
  Trash2,
  Send,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Hand,
} from "lucide-react";

export type { Annotation };

export interface CommentThread {
  id: string;
  status: CommentStatus;
  rootAnnotationId?: string | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: Date;
    createdByUser?: { firstName: string; lastName: string } | null;
    createdByGuest?: { name: string } | null;
    isSystemMessage: boolean;
  }>;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}

interface ReviewViewerProps {
  reviewItem: {
    id: string;
    title: string;
    type: ReviewItemType;
    reviewMode: ReviewMode;
    sourceUrl: string | null;
    uploadedFilePath: string | null;
    width?: number | null;
    height?: number | null;
    project: { id: string; name: string };
  };
  annotations: Annotation[];
  commentThreads: CommentThread[];
  currentRevision: {
    id: string;
    sourceUrl?: string | null;
    uploadedFilePath?: string | null;
    snapshotPath?: string | null;
    revisionLabel?: string | null;
    revisionDate: Date;
  } | null;
  selectedRevisionId?: string | null;
  revisions: Array<{
    id: string;
    revisionLabel?: string | null;
    revisionDate: Date;
    sourceUrl?: string | null;
    uploadedFilePath?: string | null;
    snapshotPath?: string | null;
  }>;
  user: { id: string; role: string; firstName: string; lastName: string };
  userRole: ProjectRole | null;
}

const statusConfig: Record<CommentStatus, { label: string; icon: typeof CheckCircle2 }> = {
  OPEN: { label: "Open", icon: MessageSquare },
  IN_PROGRESS: { label: "In Progress", icon: Clock },
  RESOLVED: { label: "Resolved", icon: CheckCircle2 },
  CLOSED: { label: "Closed", icon: X },
  IGNORED: { label: "Ignored", icon: X },
};

export function ReviewViewer({
  reviewItem,
  annotations: initialAnnotations,
  commentThreads: initialThreads,
  currentRevision,
  selectedRevisionId,
  revisions,
}: ReviewViewerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [threads, setThreads] = useState<CommentThread[]>(initialThreads);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pendingAnnotationId, setPendingAnnotationId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToThreadId, setReplyingToThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  // Zoom controls are currently disabled for website feedback to avoid layout issues.
  // Keep internal zoom at 1 so content always renders at natural size.
  const [zoom] = useState(1);
  // Responsive preview mode for website feedback
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [contentDimensions, setContentDimensions] = useState({ width: 1280, height: 900 });
  const [capturing, setCapturing] = useState(false);
  const [capturedPath, setCapturedPath] = useState<string | null>(null);
  // "annotate" = SVG intercepts all clicks (pointer-events:none on iframe)
  // "browse"   = iframe is interactive (can scroll/click the live site)
  const [interactionMode, setInteractionMode] = useState<"annotate" | "browse">("annotate");
  // For website review items, track whether the user is in live or screenshot mode.
  const [websiteViewMode, setWebsiteViewMode] = useState<"live" | "screenshot">("live");
  // Pending pin (not saved until comment is submitted); cleared on cancel or when placing another pin.
  const [pendingAnnotation, setPendingAnnotation] = useState<NewAnnotation | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const displayRevision = selectedRevisionId
    ? revisions.find((r) => r.id === selectedRevisionId) ?? currentRevision
    : currentRevision;

  const effectiveSourceUrl = displayRevision?.sourceUrl || reviewItem.sourceUrl;
  const effectiveFilePath =
    capturedPath ||
    displayRevision?.snapshotPath ||
    displayRevision?.uploadedFilePath ||
    reviewItem.uploadedFilePath;

  const isWebsite = reviewItem.type === "WEBSITE";
  // For websites, show an "annotate / browse" mode toggle
  const showModeToggle = isWebsite && !!effectiveSourceUrl;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const child = el.firstElementChild as HTMLElement | null;
      if (child) {
        const rect = child.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContentDimensions({
            width: rect.width / zoom,
            height: rect.height / zoom,
          });
        }
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [zoom, displayRevision]);

  const handleCommentClick = useCallback((thread: CommentThread) => {
    if (thread.rootAnnotationId) {
      setSelectedAnnotationId(thread.rootAnnotationId);
      setPendingAnnotationId(null);
    }
  }, []);

  const handleAnnotationCreated = useCallback((annotation: NewAnnotation) => {
    // Show pin only in UI; it is saved when the user submits a comment. Replacing any previous pending pin.
    setPendingAnnotation(annotation);
    setPendingAnnotationId(annotation.id);
    setNewComment("");
    setSelectedAnnotationId(annotation.id);
  }, []);

  const handleAnnotationSelected = useCallback(
    (annotationId: string | null) => {
      setSelectedAnnotationId(annotationId);
      if (annotationId && annotationId !== pendingAnnotationId) {
        setPendingAnnotation(null);
        setPendingAnnotationId(null);
      }
    },
    [pendingAnnotationId]
  );

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;
    if (!pendingAnnotation && !pendingAnnotationId) return;
    setSubmittingComment(true);
    if (pendingAnnotation) setSavingAnnotation(true);
    try {
      let annotationId = pendingAnnotationId;
      // If we have a pending (unsaved) pin, save it first, then create the comment.
      if (pendingAnnotation) {
        let screenshotContextPath: string | undefined;

        // For website live annotations, capture a screenshot for context.
        if (reviewItem.type === "WEBSITE" && effectiveSourceUrl) {
          try {
            const shotRes = await fetch("/api/screenshot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: effectiveSourceUrl,
                reviewItemId: reviewItem.id,
                revisionId: displayRevision?.id,
              }),
            });
            if (shotRes.ok) {
              const data = await shotRes.json();
              screenshotContextPath = (data as { screenshotPath?: string }).screenshotPath;
            } else {
              const d = await shotRes.json().catch(() => ({}));
              console.error("Screenshot capture failed:", d);
            }
          } catch (err) {
            console.error("Screenshot capture error:", err);
          }
        }

        const res = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewItemId: reviewItem.id,
            reviewRevisionId: displayRevision?.id,
            annotationType: pendingAnnotation.annotationType,
            x: pendingAnnotation.x,
            y: pendingAnnotation.y,
            xPercent: pendingAnnotation.xPercent,
            yPercent: pendingAnnotation.yPercent,
            screenshotContextPath,
            color: pendingAnnotation.color,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to save pin");
        }
        const { annotation: saved } = await res.json();
        setAnnotations((prev) => [...prev, { ...saved, commentThread: null }]);
        annotationId = saved.id;
        setPendingAnnotation(null);
      }

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItemId: reviewItem.id,
          reviewRevisionId: displayRevision?.id,
          rootAnnotationId: annotationId,
          initialMessage: newComment.trim(),
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to submit comment");
      }
      const { thread } = await res.json();
      setThreads((prev) => [thread, ...prev]);
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? {
                ...a,
                commentThreadId: thread.id,
                commentThread: { id: thread.id, status: thread.status },
              }
            : a
        )
      );
      setPendingAnnotationId(null);
      setNewComment("");
      setSelectedAnnotationId(null);
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit comment");
    } finally {
      setSubmittingComment(false);
      setSavingAnnotation(false);
    }
  }, [newComment, pendingAnnotation, pendingAnnotationId, reviewItem.id, displayRevision]);

  const handleCancelPending = useCallback(() => {
    // Pin was not saved yet; just remove it from UI. No API call.
    setPendingAnnotation(null);
    setPendingAnnotationId(null);
    setSelectedAnnotationId(null);
    setNewComment("");
  }, []);

  const handleReply = useCallback(
    async (threadId: string) => {
      if (!replyText.trim()) return;
      setSubmittingComment(true);
      try {
        const res = await fetch("/api/comments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, body: replyText.trim() }),
        });
        if (!res.ok) throw new Error("Failed to submit reply");
        const { thread } = await res.json();
        setThreads((prev) => prev.map((t) => (t.id === threadId ? thread : t)));
        setReplyText("");
        setReplyingToThreadId(null);
      } catch {
        toast.error("Failed to submit reply");
      } finally {
        setSubmittingComment(false);
      }
    },
    [replyText]
  );

  const handleStatusChange = useCallback(
    async (threadId: string, status: CommentStatus) => {
      try {
        const res = await fetch("/api/comments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, status }),
        });
        if (!res.ok) throw new Error("Failed to update status");
        const { thread } = await res.json();
        setThreads((prev) => prev.map((t) => (t.id === threadId ? thread : t)));
        setAnnotations((prev) =>
          prev.map((a) =>
            a.commentThreadId === threadId
              ? { ...a, commentThread: { id: threadId, status: thread.status } }
              : a
          )
        );
      } catch {
        toast.error("Failed to update status");
      }
    },
    []
  );

  const handleDeleteThread = useCallback(async (threadId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/comments?threadId=${threadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setAnnotations((prev) =>
        prev.map((a) =>
          a.commentThreadId === threadId
            ? { ...a, commentThreadId: null, commentThread: null }
            : a
        )
      );
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  }, []);

  const captureScreenshot = async () => {
    if (!effectiveSourceUrl) return;
    setCapturing(true);
    try {
      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: effectiveSourceUrl,
          reviewItemId: reviewItem.id,
          revisionId: displayRevision?.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.screenshotPath) {
        setCapturedPath(data.screenshotPath);
        toast.success("Screenshot captured");
      } else {
        toast.error(data.error || "Failed to capture screenshot");
      }
    } catch {
      toast.error("Failed to capture screenshot");
    } finally {
      setCapturing(false);
    }
  };

  // Combined list for display on the canvas:
  // - For websites, hide saved pins after a comment is submitted so the page stays clean.
  //   We still keep full context in the sidebar screenshots.
  // - For images/PDFs/etc, show all saved pins as before.
  const baseAnnotationsForCanvas: Annotation[] = isWebsite ? [] : annotations;

  const pendingAsAnnotation: Annotation | null = pendingAnnotation
    ? {
        id: pendingAnnotation.id,
        annotationType: pendingAnnotation.annotationType,
        x: pendingAnnotation.x,
        y: pendingAnnotation.y,
        xPercent: pendingAnnotation.xPercent,
        yPercent: pendingAnnotation.yPercent,
        color: pendingAnnotation.color,
        commentThreadId: null,
        commentThread: null,
      }
    : null;

  const annotationsToShow = pendingAsAnnotation
    ? [...baseAnnotationsForCanvas, pendingAsAnnotation]
    : baseAnnotationsForCanvas;
  const pendingAnnotationForForm = pendingAnnotation ?? annotations.find((a) => a.id === pendingAnnotationId);

  // In "browse" mode on an iframe, disable the annotation layer so the site is clickable.
  // Allow pin placement in both live and screenshot mode for websites.
  const annotationLayerActive = interactionMode === "annotate";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {savingAnnotation ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Placing pin…
              </span>
            ) : interactionMode === "annotate" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Click anywhere to add a comment
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Browse mode — switch to Annotate to add comments
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Annotate / Browse toggle for iframes */}
            {showModeToggle && (
              <div className="flex items-center rounded-md border overflow-hidden text-xs">
                <button
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                    interactionMode === "annotate"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setInteractionMode("annotate")}
                >
                  <MousePointer className="h-3 w-3" />
                  Annotate
                </button>
                <button
                  className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${
                    interactionMode === "browse"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setInteractionMode("browse")}
                >
                  <Hand className="h-3 w-3" />
                  Browse
                </button>
              </div>
            )}

            {/* Device mode toggle (desktop / mobile preview) */}
            <div className="flex items-center gap-1 text-xs rounded-md border overflow-hidden">
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1.5 flex items-center gap-1 transition-colors",
                  deviceMode === "desktop"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setDeviceMode("desktop")}
              >
                <span className="hidden sm:inline">Desktop</span>
                <span className="sm:hidden">D</span>
              </button>
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1.5 flex items-center gap-1 border-l transition-colors",
                  deviceMode === "mobile"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setDeviceMode("mobile")}
              >
                <span className="hidden sm:inline">Mobile</span>
                <span className="sm:hidden">M</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/20">
          <div className="flex justify-center items-start">
            <div
              ref={contentRef}
              className={cn(
                "relative w-full",
                deviceMode === "desktop"
                  ? "max-w-none" // desktop: let iframe be fully responsive to available width
                  : "max-w-xs sm:max-w-sm md:max-w-md" // mobile preview: narrower width
              )}
            >
              <ContentDisplay
                type={reviewItem.type}
                sourceUrl={effectiveSourceUrl}
                filePath={effectiveFilePath}
                onCapture={captureScreenshot}
                capturing={capturing}
                annotateMode={annotationLayerActive}
                websiteViewMode={websiteViewMode}
                onWebsiteViewModeChange={setWebsiteViewMode}
              />
              {/* Annotation layer — only active in annotate mode */}
              {annotationLayerActive && (
                <AnnotationLayer
                  annotations={annotationsToShow}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationCreated={handleAnnotationCreated}
                  onAnnotationSelected={handleAnnotationSelected}
                  zoom={1}
                  contentWidth={contentDimensions.width}
                  contentHeight={contentDimensions.height}
                />
              )}
              {/* Show existing pins even in browse mode (read-only, non-interactive so iframe receives clicks) */}
              {!annotationLayerActive && annotationsToShow.length > 0 && (
                <AnnotationLayer
                  annotations={annotationsToShow}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationCreated={() => {}}
                  onAnnotationSelected={handleAnnotationSelected}
                  zoom={1}
                  contentWidth={contentDimensions.width}
                  contentHeight={contentDimensions.height}
                  interactive={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comment sidebar */}
      <div className="w-80 border-l bg-card flex flex-col shrink-0">
        {/* Pending comment input — show when user has placed a pin but not yet submitted a comment */}
        {pendingAnnotationId && pendingAnnotationForForm && (
          <div className="border-b p-4 bg-blue-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {annotationsToShow.findIndex((a) => a.id === pendingAnnotationId) + 1}
                </span>
                Add a comment
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                onClick={handleCancelPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="What's your feedback here?"
              className="text-sm min-h-[80px] resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmitComment();
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">⌘↵ to submit</span>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
                className="h-7"
              >
                {submittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Comments ({threads.length})</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {threads.length === 0 && !pendingAnnotationId && (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click on the content to add a comment</p>
              </div>
            )}

            {threads.map((thread, index) => {
              const annotation = annotations.find(
                (a) =>
                  a.commentThreadId === thread.id ||
                  a.id === thread.rootAnnotationId
              );
              const pinNumber = annotation
                ? annotations.indexOf(annotation) + 1
                : index + 1;
              const isSelected = annotation?.id === selectedAnnotationId;
              const firstMessage = thread.messages.filter(
                (m) => !m.isSystemMessage
              )[0];
              const author = firstMessage?.createdByUser
                ? `${firstMessage.createdByUser.firstName} ${firstMessage.createdByUser.lastName}`
                : firstMessage?.createdByGuest?.name ?? "Unknown";
              const replies = thread.messages
                .filter((m) => !m.isSystemMessage)
                .slice(1);

              return (
                <div
                  key={thread.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-blue-400 bg-blue-50/50 shadow-sm"
                      : "border-transparent bg-background hover:border-border"
                  }`}
                  onClick={() => handleCommentClick(thread)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5"
                      style={{
                        backgroundColor: annotation?.color || "#3b82f6",
                      }}
                    >
                      {pinNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-medium truncate">
                          {author}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            value={thread.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(
                                thread.id,
                                e.target.value as CommentStatus
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border-0 bg-transparent p-0 pr-4 cursor-pointer focus:outline-none"
                          >
                            {(Object.keys(statusConfig) as CommentStatus[]).map(
                              (s) => (
                                <option key={s} value={s}>
                                  {statusConfig[s].label}
                                </option>
                              )
                            )}
                          </select>
                          <button
                            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(thread.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {firstMessage && (
                        <>
                          <p className="text-sm text-foreground leading-snug line-clamp-3">
                            {firstMessage.body}
                          </p>
                          {annotation?.screenshotContextPath && (
                            <div className="mt-2">
                              <div className="relative w-full rounded border border-muted bg-black/5 overflow-hidden max-h-48">
                                <img
                                  src={`/uploads${annotation.screenshotContextPath}`}
                                  alt="Screenshot context"
                                  className="w-full h-auto object-contain"
                                  loading="lazy"
                                />
                                {/* Pin rendered on top of the screenshot using stored percentages */}
                                {typeof annotation.xPercent === "number" &&
                                  typeof annotation.yPercent === "number" && (
                                    <div
                                      className="absolute flex items-center justify-center"
                                      style={{
                                        left: `${annotation.xPercent * 100}%`,
                                        top: `${annotation.yPercent * 100}%`,
                                        transform: "translate(-50%, -50%)",
                                      }}
                                    >
                                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold shadow">
                                        {pinNumber}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {replies.length > 0 && (
                        <div className="mt-2 space-y-1.5 border-l-2 border-muted pl-2">
                          {replies.map((r) => (
                            <div key={r.id}>
                              <span className="text-xs font-medium text-muted-foreground">
                                {r.createdByUser
                                  ? `${r.createdByUser.firstName} ${r.createdByUser.lastName}`
                                  : r.createdByGuest?.name}
                                :
                              </span>
                              <p className="text-xs text-foreground">{r.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {replyingToThreadId === thread.id ? (
                        <div
                          className="mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Reply…"
                            className="text-xs min-h-[60px] resize-none"
                            autoFocus
                          />
                          <div className="flex gap-1 mt-1">
                            <Button
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleReply(thread.id)}
                              disabled={!replyText.trim() || submittingComment}
                            >
                              Reply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setReplyingToThreadId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground mt-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingToThreadId(thread.id);
                          }}
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentDisplay — renders the actual content to review
// ---------------------------------------------------------------------------
function ContentDisplay({
  type,
  sourceUrl,
  filePath,
  onCapture,
  capturing,
  annotateMode,
  websiteViewMode = "live",
  onWebsiteViewModeChange,
}: {
  type: ReviewItemType;
  sourceUrl: string | null;
  filePath: string | null;
  onCapture: () => void;
  capturing: boolean;
  annotateMode: boolean;
  websiteViewMode?: "live" | "screenshot";
  onWebsiteViewModeChange?: (mode: "live" | "screenshot") => void;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  // Set iframe src only after mount so the request runs in the browser (avoids proxy/SSR issues).
  const [iframeSrc, setIframeSrc] = useState<string>("");

  useEffect(() => {
    setIframeLoaded(false);
    setIframeSrc("");
  }, [sourceUrl]);

  // Set iframe src after mount. Use direct URL so the browser loads the site (proxy often fails or renders blank).
  useEffect(() => {
    if (type === "WEBSITE" && sourceUrl && typeof sourceUrl === "string" && sourceUrl.startsWith("http")) {
      setIframeSrc(sourceUrl);
    }
  }, [type, sourceUrl]);

  // If iframe onLoad never fires (e.g. slow or heavy page), stop showing loader after 10s
  useEffect(() => {
    if (type !== "WEBSITE" || !sourceUrl) return;
    const t = setTimeout(() => setIframeLoaded(true), 10000);
    return () => clearTimeout(t);
  }, [type, sourceUrl]);

  // ── WEBSITE ──────────────────────────────────────────────────────────────
  if (type === "WEBSITE" && sourceUrl) {
    const viewMode = websiteViewMode ?? "live";

    if (viewMode === "live") {
      return (
        <div className="relative w-full min-h-[900px] bg-white" style={{ height: "max(900px, 100vh)" }}>
          {/* Top-right controls */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
            <button
              onClick={() => onWebsiteViewModeChange?.("screenshot")}
              className="text-xs bg-white/95 border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground shadow-sm flex items-center gap-1"
            >
              <Camera className="w-3 h-3" />
              Screenshot mode
            </button>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-white/95 border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground shadow-sm flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open site
            </a>
          </div>

          {/* Loading overlay — minimal, clears once iframe loads */}
          {!iframeLoaded && iframeSrc && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-medium">Loading preview…</span>
              </div>
            </div>
          )}

          {/*
           * iframe src is set in useEffect (client-only). Direct URL so browser loads the site.
           * When in annotate mode, pointer-events:none on iframe so clicks hit the SVG.
           */}
          {iframeSrc ? (
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            className="relative z-0 w-full border-0 block min-h-[900px]"
            title={sourceUrl}
            style={{
              // Always allow scrolling and interaction with the website itself.
              // The annotation layer sits above this iframe to capture clicks for pins.
              pointerEvents: "auto",
              height: "max(900px, 100vh)",
            }}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeLoaded(true)}
          />
          ) : (
            <div
              className="relative z-0 w-full border-0 block min-h-[900px] bg-muted/30 flex items-center justify-center"
              style={{ height: "max(900px, 100vh)" }}
            >
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-medium">Preparing preview…</span>
                <span className="text-xs max-w-xs text-center truncate" title={sourceUrl}>{sourceUrl}</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Screenshot mode
    return (
      <div className="relative w-full min-h-[900px] bg-white">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
          <button
            onClick={() => onWebsiteViewModeChange?.("live")}
            className="text-xs bg-white/95 border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground shadow-sm flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Live mode
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onCapture}
            disabled={capturing}
            className="h-7 text-xs shadow-sm"
          >
            {capturing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Capturing…
              </>
            ) : (
              <>
                <Camera className="w-3 h-3 mr-1" />
                Capture
              </>
            )}
          </Button>
        </div>
        {filePath ? (
          <img
            src={`/uploads${filePath}`}
            alt="Website screenshot"
            className="w-full h-auto block"
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[600px]">
            <div className="text-center space-y-4">
              <Camera className="w-10 h-10 mx-auto opacity-30" />
              <div>
                <p className="font-medium">No screenshot yet</p>
                <p className="text-sm text-muted-foreground mt-1">{sourceUrl}</p>
              </div>
              <Button onClick={onCapture} disabled={capturing}>
                {capturing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Capturing…
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Capture Screenshot
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── IMAGE ─────────────────────────────────────────────────────────────────
  if (type === "IMAGE" && filePath) {
    return (
      <img
        src={`/uploads${filePath}`}
        alt="Review image"
        className="max-w-none block"
        draggable={false}
        style={{ display: "block" }}
      />
    );
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (type === "PDF" && filePath) {
    const pdfUrl = `/uploads${filePath}`;
    return (
      <div className="w-[960px] h-[1100px] bg-white relative">
        <object
          data={pdfUrl}
          type="application/pdf"
          className="w-full h-full block"
          aria-label="PDF viewer"
          style={{ pointerEvents: "auto" }}
        >
          {/* Fallback if browser can't display PDF inline */}
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center space-y-3 p-8">
              <div className="text-4xl">📄</div>
              <p className="font-medium">PDF Preview</p>
              <p className="text-muted-foreground text-sm">
                Your browser may not support inline PDF viewing.
              </p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open PDF in new tab
              </a>
            </div>
          </div>
        </object>
      </div>
    );
  }

  // ── VIDEO ─────────────────────────────────────────────────────────────────
  if (type === "VIDEO" && filePath) {
    return (
      <video
        src={`/uploads${filePath}`}
        controls
        className="max-w-[1024px] block"
      />
    );
  }

  // ── EMPTY STATE ───────────────────────────────────────────────────────────
  return (
    <div className="w-[1024px] h-[600px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded">
      <div className="text-center">
        <p className="text-sm">No content to display</p>
        {!filePath && !sourceUrl && (
          <p className="text-xs mt-1">
            Upload a file or add a URL to get started
          </p>
        )}
      </div>
    </div>
  );
}
