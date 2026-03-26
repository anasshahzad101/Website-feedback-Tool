"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommentThreadDetailDialog } from "@/components/comments/comment-thread-detail-dialog";
import { ContextScreenshotWithPin } from "@/components/comments/context-screenshot-with-pin";
import { uploadCommentFiles, messageHasAttachments } from "@/lib/comment-attachments";
import { CommentStatus, ProjectRole, ReviewItemType, ReviewMode } from "@prisma/client";
import { AnnotationLayer, type NewAnnotation, type Annotation } from "@/components/annotations/annotation-layer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
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
  Paperclip,
  Mic,
  Square,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  captureIframeViewport,
  captureImageAroundPin,
  freezeIframeViewport,
} from "@/lib/capture-annotation-context";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => resolve(v))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

async function postJsonWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<Response | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function patchJsonWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<Response | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
    attachments?: unknown;
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

/** Pin-centered client crops are stored as `/screenshots/context-*`; full-page Microlink shots use `screenshot-*`. */
function contextPinMarkerPercents(
  screenshotContextPath: string | null | undefined,
  xPercent: number | undefined,
  yPercent: number | undefined
): { left: number; top: number } {
  const path = (screenshotContextPath ?? "").trim();
  const isPinCenteredCrop = /\/screenshots\/context-/i.test(path);
  if (isPinCenteredCrop) return { left: 50, top: 50 };
  const x = (xPercent ?? 0.5) * 100;
  const y = (yPercent ?? 0.5) * 100;
  return { left: x, top: y };
}

const statusConfig: Record<CommentStatus, { label: string; icon: typeof CheckCircle2 }> = {
  OPEN: { label: "Open", icon: MessageSquare },
  IN_PROGRESS: { label: "In Progress", icon: Clock },
  RESOLVED: { label: "Resolved", icon: CheckCircle2 },
  CLOSED: { label: "Closed", icon: X },
  IGNORED: { label: "Ignored", icon: X },
};

const COMPLETED_THREAD_STATUSES: CommentStatus[] = [
  CommentStatus.RESOLVED,
  CommentStatus.CLOSED,
];

const statusDotClass: Record<CommentStatus, string> = {
  OPEN: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-slate-400",
  IGNORED: "bg-slate-300",
};

function threadMatchesCommentSearch(thread: CommentThread, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  for (const m of thread.messages) {
    if (m.isSystemMessage) continue;
    if (m.body.toLowerCase().includes(q)) return true;
    const u = m.createdByUser;
    if (u && `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)) return true;
    if (m.createdByGuest?.name?.toLowerCase().includes(q)) return true;
  }
  return false;
}

function authorInitialsFromFirstMessage(
  m: CommentThread["messages"][number] | undefined
): string {
  if (!m || m.isSystemMessage) return "?";
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

export function ReviewViewer({
  reviewItem,
  annotations: initialAnnotations,
  commentThreads: initialThreads,
  currentRevision,
  selectedRevisionId,
  revisions,
  user,
}: ReviewViewerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [threads, setThreads] = useState<CommentThread[]>(initialThreads);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pendingAnnotationId, setPendingAnnotationId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [detailThreadId, setDetailThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  type StagedAttachment = {
    id: string;
    file: File;
    previewUrl?: string;
  };
  const [composeStaged, setComposeStaged] = useState<StagedAttachment[]>([]);
  const [replyStaged, setReplyStaged] = useState<StagedAttachment[]>([]);
  const [contextLightbox, setContextLightbox] = useState<{
    src: string;
    pinNumber: number;
    pinColor: string;
    markerLeftPercent?: number;
    markerTopPercent?: number;
  } | null>(null);
  const [recordingFor, setRecordingFor] = useState<"compose" | "reply" | null>(
    null
  );
  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const stagedForCleanupRef = useRef<StagedAttachment[]>([]);
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
  const [websiteViewMode, setWebsiteViewMode] = useState<"live" | "screenshot">(() => {
    if (reviewItem.type !== "WEBSITE") return "live";
    return reviewItem.reviewMode === ReviewMode.SCREENSHOT_CAPTURE ? "screenshot" : "live";
  });
  // Pending pin (not saved until comment is submitted); cleared on cancel or when placing another pin.
  const [pendingAnnotation, setPendingAnnotation] = useState<NewAnnotation | null>(null);
  /** Markup-style sidebar: filter + search */
  const [commentSidebarFilter, setCommentSidebarFilter] = useState<
    "all" | "open" | "resolved"
  >("all");
  const [commentSearchQuery, setCommentSearchQuery] = useState("");
  const [resolvedCommentsExpanded, setResolvedCommentsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Live website: viewport capture started when the pin is placed; await on submit. */
  const liveContextInFlightRef = useRef<{
    pinClientId: string;
    promise: Promise<string | null>;
  } | null>(null);

  const displayRevision = selectedRevisionId
    ? revisions.find((r) => r.id === selectedRevisionId) ?? currentRevision
    : currentRevision;

  const effectiveSourceUrl = displayRevision?.sourceUrl || reviewItem.sourceUrl;
  // Only apply local "Capture" override in website screenshot mode — never let
  // that path replace the main asset for IMAGE/PDF/VIDEO reviews.
  const effectiveFilePath =
    (reviewItem.type === "WEBSITE" && websiteViewMode === "screenshot"
      ? capturedPath
      : null) ||
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

  const canUploadAttachments = user.role !== "GUEST";

  const clearComposeStaged = useCallback(() => {
    setComposeStaged((prev) => {
      prev.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      return [];
    });
  }, []);

  const clearReplyStaged = useCallback(() => {
    setReplyStaged((prev) => {
      prev.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      return [];
    });
  }, []);

  const addComposeFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    setComposeStaged((prev) => {
      const room = Math.max(0, 8 - prev.length);
      const take = arr.slice(0, room);
      if (take.length === 0) return prev;
      return [
        ...prev,
        ...take.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        })),
      ];
    });
  }, []);

  const addReplyFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    setReplyStaged((prev) => {
      const room = Math.max(0, 8 - prev.length);
      const take = arr.slice(0, room);
      if (take.length === 0) return prev;
      return [
        ...prev,
        ...take.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        })),
      ];
    });
  }, []);

  const removeComposeStaged = useCallback((id: string) => {
    setComposeStaged((prev) => {
      const cur = prev.find((s) => s.id === id);
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const removeReplyStaged = useCallback((id: string) => {
    setReplyStaged((prev) => {
      const cur = prev.find((s) => s.id === id);
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const stopVoiceRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startVoiceRecording = useCallback(
    async (target: "compose" | "reply") => {
      if (!canUploadAttachments) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Recording is not supported in this browser");
        return;
      }
      if (mediaRecorderRef.current?.state === "recording") {
        toast.error("Stop the current recording first");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaStreamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
        const rec = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        voiceChunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) voiceChunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          const blob = new Blob(voiceChunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          voiceChunksRef.current = [];
          if (blob.size > 200) {
            const ext = blob.type.includes("webm") ? "webm" : "ogg";
            const file = new File(
              [blob],
              `voice-${Date.now()}.${ext}`,
              { type: blob.type || "audio/webm" }
            );
            if (target === "compose") {
              setComposeStaged((prev) => {
                if (prev.length >= 8) return prev;
                return [...prev, { id: crypto.randomUUID(), file }];
              });
            } else {
              setReplyStaged((prev) => {
                if (prev.length >= 8) return prev;
                return [...prev, { id: crypto.randomUUID(), file }];
              });
            }
          }
          setRecordingFor(null);
        };
        rec.start();
        mediaRecorderRef.current = rec;
        setRecordingFor(target);
      } catch {
        toast.error("Could not access microphone");
      }
    },
    [canUploadAttachments]
  );

  useEffect(() => {
    stagedForCleanupRef.current = [...composeStaged, ...replyStaged];
  }, [composeStaged, replyStaged]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      stagedForCleanupRef.current.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
    };
  }, []);

  const handleCommentClick = useCallback(
    (thread: CommentThread) => {
      setDetailThreadId(thread.id);
      if (thread.rootAnnotationId) {
        setSelectedAnnotationId(thread.rootAnnotationId);
        setPendingAnnotationId(null);
      }
      if (user.role === "GUEST") return;
      void (async () => {
        try {
          const res = await fetch(
            `/api/comments?reviewItemId=${encodeURIComponent(reviewItem.id)}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as { threads?: CommentThread[] };
          const fresh = data.threads?.find((t) => t.id === thread.id);
          if (fresh) {
            setThreads((prev) =>
              prev.map((t) => (t.id === fresh.id ? fresh : t))
            );
          }
        } catch {
          /* keep existing client state */
        }
      })();
    },
    [reviewItem.id, user.role]
  );

  const handleAnnotationCreated = useCallback(
    (annotation: NewAnnotation) => {
      // Show pin only in UI; it is saved when the user submits a comment. Replacing any previous pending pin.
      setPendingAnnotation(annotation);
      setPendingAnnotationId(annotation.id);
      setNewComment("");
      setSelectedAnnotationId(annotation.id);

      // Capture iframe context as soon as the pin is dropped — same scroll/viewport as the click.
      // Waiting until after comment submit often loses scroll or fails silently; we await this on submit.
      liveContextInFlightRef.current = null;
      if (
        reviewItem.type === "WEBSITE" &&
        websiteViewMode === "live" &&
        effectiveSourceUrl
      ) {
        const pinId = annotation.id;
        const pinFocus = { x: annotation.x, y: annotation.y };
        const promise = new Promise<string | null>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
              try {
                const iframe = contentRef.current?.querySelector("iframe");
                if (!iframe?.contentDocument?.body) {
                  resolve(null);
                  return;
                }
                const frozen = freezeIframeViewport(iframe);
                const url = await captureIframeViewport(iframe, pinFocus, {
                  allowHeavyFallback: true,
                  preferAccuracy: true,
                  frozen,
                });
                resolve(url);
              } catch {
                resolve(null);
              }
            });
          });
        });
        liveContextInFlightRef.current = { pinClientId: pinId, promise };
      }
    },
    [reviewItem.type, websiteViewMode, effectiveSourceUrl]
  );

  const handleAnnotationSelected = useCallback(
    (annotationId: string | null) => {
      setSelectedAnnotationId(annotationId);
      if (annotationId && annotationId !== pendingAnnotationId) {
        setPendingAnnotation(null);
        setPendingAnnotationId(null);
        liveContextInFlightRef.current = null;
      }
    },
    [pendingAnnotationId]
  );

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() && composeStaged.length === 0) return;
    if (!pendingAnnotation && !pendingAnnotationId) return;

    // Freeze iframe scroll/viewport before any await — async capture runs after
    // submit and would otherwise read a reset (e.g. top-of-page) scroll.
    let frozenWebsiteViewport: ReturnType<typeof freezeIframeViewport> = null;
    if (
      pendingAnnotation &&
      reviewItem.type === "WEBSITE" &&
      websiteViewMode === "live" &&
      effectiveSourceUrl
    ) {
      const iframe = contentRef.current?.querySelector("iframe");
      if (iframe) {
        frozenWebsiteViewport = freezeIframeViewport(iframe);
      }
    }

    setSubmittingComment(true);
    if (pendingAnnotation) setSavingAnnotation(true);
    try {
      let annotationId = pendingAnnotationId;
      const annotationForContext = pendingAnnotation
        ? { ...pendingAnnotation }
        : null;
      // If we have a pending (unsaved) pin, save it first, then create the comment.
      if (pendingAnnotation) {
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

      let uploaded: Awaited<ReturnType<typeof uploadCommentFiles>> = [];
      if (composeStaged.length > 0 && canUploadAttachments) {
        uploaded = await uploadCommentFiles(composeStaged.map((s) => s.file));
      }

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItemId: reviewItem.id,
          reviewRevisionId: displayRevision?.id,
          rootAnnotationId: annotationId,
          initialMessage: newComment.trim(),
          ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
        }),
      });

      const commentPayload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = commentPayload as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[] | undefined> };
        };
        let msg = d.error || "Failed to submit comment";
        const fe = d.details?.fieldErrors;
        if (fe) {
          for (const vals of Object.values(fe)) {
            const first = Array.isArray(vals) ? vals[0] : undefined;
            if (first) {
              msg = `${msg}: ${first}`;
              break;
            }
          }
        }
        throw new Error(msg);
      }
      const { thread } = commentPayload as { thread: CommentThread };
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
      clearComposeStaged();
      setSelectedAnnotationId(null);
      toast.success("Comment posted");

      // Save screenshot context in background so UI never blocks on heavy pages.
      if (annotationId && annotationForContext) {
        void (async () => {
          try {
            let screenshotContextPath: string | undefined;

            if (reviewItem.type === "WEBSITE" && effectiveSourceUrl) {
              if (websiteViewMode === "live") {
                // Capture the viewport around the placed pin (not top-of-page remote shot).
                const root = contentRef.current;
                const iframe = root?.querySelector("iframe");
                if (iframe) {
                  let dataUrl: string | null = null;
                  const inFlight = liveContextInFlightRef.current;
                  if (inFlight?.pinClientId === annotationForContext.id) {
                    dataUrl = await withTimeout(inFlight.promise, 35000);
                  }
                  liveContextInFlightRef.current = null;
                  if (!dataUrl) {
                    dataUrl = await withTimeout(
                      captureIframeViewport(
                        iframe,
                        {
                          x: annotationForContext.x,
                          y: annotationForContext.y,
                        },
                        {
                          allowHeavyFallback: true,
                          preferAccuracy: true,
                          frozen: frozenWebsiteViewport,
                        }
                      ),
                      25000
                    );
                  }
                  if (dataUrl) {
                    const shotRes = await postJsonWithTimeout(
                      "/api/screenshot",
                      { imageBase64: dataUrl, contextOnly: true },
                      20000
                    );
                    if (shotRes?.ok) {
                      const data = await shotRes.json();
                      screenshotContextPath = (data as { screenshotPath?: string })
                        .screenshotPath;
                    }
                  }
                }
                // Do not fall back to URL-only Microlink here: it always captures the
                // top of the page and looks like a broken pin snapshot when the user
                // commented lower on the page.
              } else {
                const root = contentRef.current;
                const img = root?.querySelector(
                  'img[alt="Website screenshot"]'
                ) as HTMLImageElement | null;
                if (img) {
                  const dataUrl = captureImageAroundPin(
                    img,
                    annotationForContext.xPercent,
                    annotationForContext.yPercent
                  );
                  if (dataUrl) {
                    const shotRes = await postJsonWithTimeout(
                      "/api/screenshot",
                      { imageBase64: dataUrl, contextOnly: true },
                      9000
                    );
                    if (shotRes?.ok) {
                      const data = await shotRes.json();
                      screenshotContextPath = (data as { screenshotPath?: string })
                        .screenshotPath;
                    }
                  }
                }
              }
            } else if (reviewItem.type === "IMAGE" && effectiveFilePath) {
              const root = contentRef.current;
              const img = root?.querySelector(
                'img[alt="Review image"]'
              ) as HTMLImageElement | null;
              if (img) {
                const dataUrl = captureImageAroundPin(
                  img,
                  annotationForContext.xPercent,
                  annotationForContext.yPercent
                );
                if (dataUrl) {
                  const shotRes = await postJsonWithTimeout(
                    "/api/screenshot",
                    { imageBase64: dataUrl, contextOnly: true },
                    9000
                  );
                  if (shotRes?.ok) {
                    const data = await shotRes.json();
                    screenshotContextPath = (data as { screenshotPath?: string })
                      .screenshotPath;
                  }
                }
              }
            }

            if (screenshotContextPath) {
              const patchRes = await patchJsonWithTimeout(
                `/api/annotations/${annotationId}`,
                { screenshotContextPath },
                8000
              );
              if (patchRes?.ok) {
                setAnnotations((prev) =>
                  prev.map((a) =>
                    a.id === annotationId ? { ...a, screenshotContextPath } : a
                  )
                );
              } else {
                console.error("Annotation context PATCH failed");
              }
            }
          } catch (e) {
            console.error("Background context screenshot failed:", e);
          }
        })();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit comment");
    } finally {
      setSubmittingComment(false);
      setSavingAnnotation(false);
    }
  }, [
    newComment,
    composeStaged,
    canUploadAttachments,
    clearComposeStaged,
    pendingAnnotation,
    pendingAnnotationId,
    reviewItem.id,
    reviewItem.type,
    displayRevision,
    effectiveSourceUrl,
    effectiveFilePath,
    websiteViewMode,
    annotations,
  ]);

  const handleCancelPending = useCallback(() => {
    mediaRecorderRef.current?.stop();
    // Pin was not saved yet; just remove it from UI. No API call.
    setPendingAnnotation(null);
    setPendingAnnotationId(null);
    liveContextInFlightRef.current = null;
    setSelectedAnnotationId(null);
    setNewComment("");
    clearComposeStaged();
  }, [clearComposeStaged]);

  const handleReply = useCallback(
    async (threadId: string) => {
      if (!replyText.trim() && replyStaged.length === 0) return;
      setSubmittingComment(true);
      try {
        let uploaded: Awaited<ReturnType<typeof uploadCommentFiles>> = [];
        if (replyStaged.length > 0 && canUploadAttachments) {
          uploaded = await uploadCommentFiles(replyStaged.map((s) => s.file));
        }
        const res = await fetch("/api/comments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            body: replyText.trim(),
            ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
          }),
        });
        const replyPayload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const d = replyPayload as {
            error?: string;
            details?: { fieldErrors?: Record<string, string[] | undefined> };
          };
          let msg = d.error || "Failed to submit reply";
          const fe = d.details?.fieldErrors;
          if (fe) {
            for (const vals of Object.values(fe)) {
              const first = Array.isArray(vals) ? vals[0] : undefined;
              if (first) {
                msg = `${msg}: ${first}`;
                break;
              }
            }
          }
          throw new Error(msg);
        }
        const { thread } = replyPayload as { thread: CommentThread };
        setThreads((prev) => prev.map((t) => (t.id === threadId ? thread : t)));
        setReplyText("");
        clearReplyStaged();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to submit reply"
        );
      } finally {
        setSubmittingComment(false);
      }
    },
    [replyText, replyStaged, canUploadAttachments, clearReplyStaged]
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

  const { activeThreads, completedThreads } = useMemo(() => {
    const active = threads.filter(
      (t) => !COMPLETED_THREAD_STATUSES.includes(t.status)
    );
    const done = threads.filter((t) =>
      COMPLETED_THREAD_STATUSES.includes(t.status)
    );
    return { activeThreads: active, completedThreads: done };
  }, [threads]);

  useEffect(() => {
    if (activeThreads.length === 0 && completedThreads.length > 0) {
      setResolvedCommentsExpanded(true);
    }
  }, [activeThreads.length, completedThreads.length]);

  const filteredOpenThreads = useMemo(() => {
    if (!commentSearchQuery.trim()) return activeThreads;
    return activeThreads.filter((t) =>
      threadMatchesCommentSearch(t, commentSearchQuery)
    );
  }, [activeThreads, commentSearchQuery]);

  const filteredCompletedThreads = useMemo(() => {
    if (!commentSearchQuery.trim()) return completedThreads;
    return completedThreads.filter((t) =>
      threadMatchesCommentSearch(t, commentSearchQuery)
    );
  }, [completedThreads, commentSearchQuery]);

  const detailThread = useMemo(
    () =>
      detailThreadId
        ? (threads.find((t) => t.id === detailThreadId) ?? null)
        : null,
    [threads, detailThreadId]
  );

  useEffect(() => {
    if (detailThreadId && !threads.some((t) => t.id === detailThreadId)) {
      setDetailThreadId(null);
    }
  }, [threads, detailThreadId]);

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setDetailThreadId(null);
        mediaRecorderRef.current?.stop();
        clearReplyStaged();
        setReplyText("");
      }
    },
    [clearReplyStaged]
  );

  const renderThreadCard = useCallback(
    (thread: CommentThread) => {
      const annotation = annotations.find(
        (a) =>
          a.commentThreadId === thread.id || a.id === thread.rootAnnotationId
      );
      const pinNumber = annotation
        ? annotations.indexOf(annotation) + 1
        : threads.findIndex((x) => x.id === thread.id) + 1;
      const isSelected = annotation?.id === selectedAnnotationId;
      const firstMessage = thread.messages.filter((m) => !m.isSystemMessage)[0];
      const author = firstMessage?.createdByUser
        ? `${firstMessage.createdByUser.firstName} ${firstMessage.createdByUser.lastName}`
        : firstMessage?.createdByGuest?.name ?? "Unknown";
      const attachmentMsgCount = thread.messages.reduce(
        (n, m) => n + (messageHasAttachments(m.attachments) ? 1 : 0),
        0
      );
      const nonSystem = thread.messages.filter((m) => !m.isSystemMessage);
      const replyCount = Math.max(0, nonSystem.length - 1);

      const initials = authorInitialsFromFirstMessage(firstMessage);

      return (
        <div
          key={thread.id}
          className={cn(
            "rounded-xl border p-3 cursor-pointer transition-all duration-150",
            isSelected
              ? "border-primary/50 bg-primary/[0.06] shadow-md ring-1 ring-primary/20"
              : "border-border/70 bg-card shadow-sm hover:shadow-md hover:border-border"
          )}
          onClick={() => handleCommentClick(thread)}
        >
          <div className="flex items-start gap-2.5">
            <span
              className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0 shadow-sm"
              style={{
                backgroundColor: annotation?.color || "#3b82f6",
              }}
            >
              {pinNumber}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Avatar className="h-7 w-7 shrink-0 border border-border/50">
                  <AvatarFallback className="text-[10px] font-semibold bg-muted">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {author}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        statusDotClass[thread.status]
                      )}
                      title={statusConfig[thread.status].label}
                    />
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
                      className="text-[11px] border-0 bg-transparent p-0 pr-3 cursor-pointer focus:outline-none text-muted-foreground max-w-[100px]"
                    >
                      {(Object.keys(statusConfig) as CommentStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {statusConfig[s].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-md hover:bg-muted/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(thread.id);
                      }}
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {firstMessage?.body.trim() ? (
                <p className="text-[13px] text-foreground/90 leading-snug line-clamp-3 pl-9">
                  {firstMessage.body}
                </p>
              ) : attachmentMsgCount > 0 ? (
                <p className="text-[13px] text-muted-foreground italic pl-9">
                  Attachments only
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 mt-2 pl-9">
                {attachmentMsgCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/70 rounded-md px-2 py-0.5">
                    <Paperclip className="h-3 w-3" />
                    {attachmentMsgCount} file
                    {attachmentMsgCount === 1 ? "" : "s"}
                  </span>
                )}
                {replyCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {replyCount} repl{replyCount === 1 ? "y" : "ies"}
                  </span>
                )}
                <span className="text-[10px] font-medium text-primary ml-auto">
                  View thread
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    },
    [
      annotations,
      threads,
      selectedAnnotationId,
      handleCommentClick,
      handleStatusChange,
      handleDeleteThread,
    ]
  );

  const detailAnnotation = detailThread
    ? annotations.find(
        (a) =>
          a.commentThreadId === detailThread.id ||
          a.id === detailThread.rootAnnotationId
      )
    : undefined;

  const detailContextMarkers = useMemo(() => {
    if (!detailAnnotation) return { left: 50, top: 50 };
    return contextPinMarkerPercents(
      detailAnnotation.screenshotContextPath,
      detailAnnotation.xPercent,
      detailAnnotation.yPercent
    );
  }, [
    detailAnnotation?.screenshotContextPath,
    detailAnnotation?.xPercent,
    detailAnnotation?.yPercent,
  ]);

  const detailPinNumber = detailAnnotation
    ? annotations.indexOf(detailAnnotation) + 1
    : detailThread
      ? threads.findIndex((x) => x.id === detailThread.id) + 1
      : 0;

  // In "browse" mode on an iframe, disable the annotation layer so the site is clickable.
  // Allow pin placement in both live and screenshot mode for websites.
  const annotationLayerActive = interactionMode === "annotate";

  return (
    <>
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

      {/* Comment sidebar — Markup.io-style: filters, search, open / resolved */}
      <div className="w-[min(100vw,22rem)] sm:w-96 border-l bg-muted/20 flex flex-col shrink-0">
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
              placeholder="What's your feedback here? (Text optional if you add files or a voice note.)"
              className="text-sm min-h-[80px] resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmitComment();
              }}
            />
            {canUploadAttachments && (
              <>
                <input
                  ref={composeFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list?.length) addComposeFiles(list);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => composeFileInputRef.current?.click()}
                    disabled={composeStaged.length >= 8 || submittingComment}
                  >
                    <Paperclip className="h-3.5 w-3.5 mr-1" />
                    Files
                  </Button>
                  <Button
                    type="button"
                    variant={recordingFor === "compose" ? "destructive" : "outline"}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() =>
                      recordingFor === "compose"
                        ? stopVoiceRecording()
                        : startVoiceRecording("compose")
                    }
                    disabled={composeStaged.length >= 8 || submittingComment}
                  >
                    {recordingFor === "compose" ? (
                      <>
                        <Square className="h-3 w-3 mr-1 fill-current" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 mr-1" />
                        Voice
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
            {composeStaged.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {composeStaged.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 text-[10px] bg-background border rounded px-1.5 py-0.5 max-w-full"
                  >
                    {s.previewUrl ? (
                      <img
                        src={s.previewUrl}
                        alt=""
                        className="h-6 w-6 object-cover rounded"
                      />
                    ) : null}
                    <span className="truncate max-w-[120px]">{s.file.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => removeComposeStaged(s.id)}
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">⌘↵ to submit</span>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={
                  (!newComment.trim() && composeStaged.length === 0) ||
                  submittingComment
                }
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

        <div className="px-3 pt-3 pb-2 border-b bg-card/80 space-y-2 shrink-0">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Comments
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Drop a pin on the content, then add text, files, or voice — same
              idea as tools like Markup.io: contextual feedback in one place.
            </p>
          </div>
          <div className="flex rounded-lg bg-muted/80 p-0.5 gap-0.5">
            {(
              [
                { key: "all" as const, label: "All" },
                { key: "open" as const, label: "Open" },
                { key: "resolved" as const, label: "Resolved" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCommentSidebarFilter(key)}
                className={cn(
                  "flex-1 text-[11px] font-medium py-1.5 rounded-md transition-colors",
                  commentSidebarFilter === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search comments…"
              value={commentSearchQuery}
              onChange={(e) => setCommentSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
              aria-label="Search comments"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {activeThreads.length} open · {completedThreads.length} resolved / closed
          </p>
        </div>

        <ScrollArea className="flex-1 bg-muted/10">
          <div className="p-3 space-y-3">
            {threads.length === 0 && !pendingAnnotationId && (
              <div className="text-center py-10 px-2 text-muted-foreground rounded-xl border border-dashed border-border/60 bg-card/50">
                <MessageSquare className="h-9 w-9 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium text-foreground/80">
                  No comments yet
                </p>
                <p className="text-xs mt-1.5 leading-relaxed">
                  Click anywhere on the content to place a pin, then describe your
                  feedback. Optional files and voice notes are supported.
                </p>
              </div>
            )}

            {threads.length > 0 && (
              <>
                {(commentSidebarFilter === "all" ||
                  commentSidebarFilter === "open") && (
                  <section>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
                      Open
                    </h3>
                    <div className="space-y-2">
                      {filteredOpenThreads.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 px-1">
                          {commentSearchQuery.trim()
                            ? "No open comments match your search."
                            : "No open comments. Resolve items to move them below."}
                        </p>
                      ) : (
                        filteredOpenThreads.map((t) => renderThreadCard(t))
                      )}
                    </div>
                  </section>
                )}

                {(commentSidebarFilter === "resolved" ||
                  (commentSidebarFilter === "all" &&
                    completedThreads.length > 0)) && (
                  <section
                    className={cn(
                      commentSidebarFilter === "all" &&
                        activeThreads.length > 0 &&
                        "pt-1"
                    )}
                  >
                    {commentSidebarFilter === "all" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setResolvedCommentsExpanded((e) => !e)
                        }
                        className="flex items-center gap-1.5 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5 py-1 rounded-md hover:bg-muted/60 transition-colors"
                      >
                        {resolvedCommentsExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Resolved & closed ({completedThreads.length})
                      </button>
                    ) : (
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5 pt-1">
                        Resolved & closed
                      </h3>
                    )}
                    {(commentSidebarFilter === "resolved" ||
                      resolvedCommentsExpanded) && (
                      <div className="space-y-2">
                        {filteredCompletedThreads.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 px-1">
                            {commentSearchQuery.trim()
                              ? "No resolved comments match your search."
                              : "Nothing resolved yet."}
                          </p>
                        ) : (
                          filteredCompletedThreads.map((t) =>
                            renderThreadCard(t)
                          )
                        )}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>

    <CommentThreadDetailDialog
      open={!!detailThreadId && !!detailThread}
      onOpenChange={handleDetailOpenChange}
      thread={detailThread}
      pinNumber={detailPinNumber}
      pinColor={detailAnnotation?.color ?? "#3b82f6"}
      screenshotContextPath={detailAnnotation?.screenshotContextPath ?? null}
      contextMarkerLeftPercent={detailContextMarkers.left}
      contextMarkerTopPercent={detailContextMarkers.top}
      onOpenScreenshot={(url) =>
        setContextLightbox({
          src: url,
          pinNumber: detailPinNumber,
          pinColor: detailAnnotation?.color ?? "#3b82f6",
          markerLeftPercent: detailContextMarkers.left,
          markerTopPercent: detailContextMarkers.top,
        })
      }
      onStatusChange={handleStatusChange}
      onDeleteThread={handleDeleteThread}
      replyArea={
        detailThread ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Reply… (optional if you attach files or voice)"
              className="text-sm min-h-[72px] resize-none"
            />
            {canUploadAttachments && (
              <>
                <input
                  ref={replyFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list?.length) addReplyFiles(list);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => replyFileInputRef.current?.click()}
                    disabled={replyStaged.length >= 8 || submittingComment}
                  >
                    <Paperclip className="h-3.5 w-3.5 mr-1" />
                    Files
                  </Button>
                  <Button
                    type="button"
                    variant={
                      recordingFor === "reply" ? "destructive" : "outline"
                    }
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() =>
                      recordingFor === "reply"
                        ? stopVoiceRecording()
                        : startVoiceRecording("reply")
                    }
                    disabled={replyStaged.length >= 8 || submittingComment}
                  >
                    {recordingFor === "reply" ? (
                      <>
                        <Square className="h-3 w-3 mr-1 fill-current" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 mr-1" />
                        Voice
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
            {replyStaged.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-1">
                {replyStaged.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 text-xs bg-background border rounded px-2 py-1"
                  >
                    {s.previewUrl ? (
                      <img
                        src={s.previewUrl}
                        alt=""
                        className="h-6 w-6 object-cover rounded"
                      />
                    ) : null}
                    <span className="truncate max-w-[140px]">{s.file.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeReplyStaged(s.id)}
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              className="mt-1"
              onClick={() => void handleReply(detailThread.id)}
              disabled={
                (!replyText.trim() && replyStaged.length === 0) ||
                submittingComment
              }
            >
              {submittingComment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send reply
                </>
              )}
            </Button>
          </div>
        ) : null
      }
    />

    <Dialog
      open={!!contextLightbox}
      onOpenChange={(open) => {
        if (!open) setContextLightbox(null);
      }}
    >
      <DialogContent className="max-w-[min(96vw,1200px)] w-auto max-h-[96vh] overflow-auto p-2 sm:p-3 border bg-background">
        <DialogTitle className="sr-only">Page context screenshot</DialogTitle>
        {contextLightbox ? (
          <ContextScreenshotWithPin
            src={contextLightbox.src}
            alt="Full page context"
            pinNumber={contextLightbox.pinNumber}
            pinColor={contextLightbox.pinColor}
            markerLeftPercent={contextLightbox.markerLeftPercent ?? 50}
            markerTopPercent={contextLightbox.markerTopPercent ?? 50}
            imgClassName="max-h-[min(90vh,900px)] w-full object-contain rounded-md mx-auto"
          />
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}

function normalizeWebsiteUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.startsWith("//") ? `https:${candidate}` : `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
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
  // Set iframe src only after mount so the request runs in the browser (avoids SSR issues).
  const [iframeSrc, setIframeSrc] = useState<string>("");

  useEffect(() => {
    setIframeLoaded(false);
    setIframeSrc("");
  }, [sourceUrl]);

  // Load through /api/proxy so target X-Frame-Options / CSP frame-ancestors do not block the iframe.
  useEffect(() => {
    if (type !== "WEBSITE" || !sourceUrl) return;
    const normalized = normalizeWebsiteUrl(sourceUrl);
    if (!normalized) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin) return;
    setIframeSrc(`${origin}/api/proxy?url=${encodeURIComponent(normalized)}`);
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
              href={normalizeWebsiteUrl(sourceUrl) ?? sourceUrl}
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
           * iframe loads /api/proxy?url=… (same-origin) so remote X-Frame-Options / CSP do not block embed.
           * In annotate mode the SVG layer above captures pointer events.
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
