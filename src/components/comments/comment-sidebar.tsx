"use client";

import { useState } from "react";
import { CommentStatus, ProjectRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { MessageCircle, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface CommentMessage {
  id: string;
  body: string;
  createdAt: Date;
  createdByUser?: { firstName: string; lastName: string } | null;
  createdByGuest?: { name: string } | null;
  isSystemMessage: boolean;
}

export interface CommentThread {
  id: string;
  status: CommentStatus;
  rootAnnotationId?: string | null;
  messages: CommentMessage[];
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}

interface CommentSidebarProps {
  reviewItemId: string;
  revisionId: string | null;
  threads: CommentThread[];
  selectedThreadId: string | null;
  pendingAnnotationId: string | null;
  onThreadSelected: (threadId: string | null) => void;
  onThreadsUpdated: (threads: CommentThread[]) => void;
  onThreadCreated: (thread: CommentThread) => void;
  onPendingCancelled: () => void;
  user: { id: string; firstName: string; lastName: string };
  userRole: ProjectRole | null;
}

const statusOptions: { value: CommentStatus; label: string; color: string }[] = [
  { value: "OPEN", label: "Open", color: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-amber-500" },
  { value: "RESOLVED", label: "Resolved", color: "bg-emerald-500" },
  { value: "CLOSED", label: "Closed", color: "bg-slate-500" },
  { value: "IGNORED", label: "Ignored", color: "bg-slate-400" },
];

export function CommentSidebar({
  reviewItemId,
  revisionId,
  threads,
  selectedThreadId,
  pendingAnnotationId,
  onThreadSelected,
  onThreadsUpdated,
  onThreadCreated,
  onPendingCancelled,
  user,
  userRole,
}: CommentSidebarProps) {
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadText, setNewThreadText] = useState("");
  const [pendingText, setPendingText] = useState("");

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const handleReplySubmit = async (threadId: string) => {
    const text = replyText[threadId]?.trim();
    if (!text) return;

    setIsSubmitting((prev) => ({ ...prev, [threadId]: true }));

    try {
      const res = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ threadId, body: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reply");
      }

      const { thread: updated } = await res.json();
      const updatedThreads = threads.map((t) =>
        t.id === threadId
          ? {
              id: updated.id,
              status: updated.status,
              rootAnnotationId: updated.rootAnnotationId ?? t.rootAnnotationId,
              messages: (updated.messages ?? []).map(
                (m: {
                  id: string;
                  body: string;
                  createdAt: string;
                  createdByUser?: { firstName: string; lastName: string } | null;
                  createdByGuest?: { name: string } | null;
                  isSystemMessage: boolean;
                }) => ({
                  id: m.id,
                  body: m.body,
                  createdAt: new Date(m.createdAt),
                  createdByUser: m.createdByUser,
                  createdByGuest: m.createdByGuest,
                  isSystemMessage: m.isSystemMessage,
                })
              ),
              assignedTo: updated.assignedTo ?? null,
            }
          : t
      );
      onThreadsUpdated(updatedThreads);
      setReplyText((prev) => ({ ...prev, [threadId]: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [threadId]: false }));
    }
  };

  const handleStatusChange = async (threadId: string, newStatus: CommentStatus) => {
    try {
      const res = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ threadId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }

      const { thread: updated } = await res.json();
      const updatedThreads = threads.map((t) =>
        t.id === threadId
          ? {
              id: updated.id,
              status: updated.status,
              rootAnnotationId: updated.rootAnnotationId ?? t.rootAnnotationId,
              messages: (updated.messages ?? []).map(
                (m: {
                  id: string;
                  body: string;
                  createdAt: string;
                  createdByUser?: { firstName: string; lastName: string } | null;
                  createdByGuest?: { name: string } | null;
                  isSystemMessage: boolean;
                }) => ({
                  id: m.id,
                  body: m.body,
                  createdAt: new Date(m.createdAt),
                  createdByUser: m.createdByUser,
                  createdByGuest: m.createdByGuest,
                  isSystemMessage: m.isSystemMessage,
                })
              ),
              assignedTo: updated.assignedTo ?? null,
            }
          : t
      );
      onThreadsUpdated(updatedThreads);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleNewThreadSubmit = async () => {
    const text = newThreadText.trim();
    if (!text) return;

    setIsSubmitting((prev) => ({ ...prev, _new: true }));

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          reviewItemId,
          reviewRevisionId: revisionId,
          initialMessage: text,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create comment");
      }

      const { thread } = await res.json();

      const newThread: CommentThread = {
        id: thread.id,
        status: thread.status,
        rootAnnotationId: thread.rootAnnotationId ?? null,
        messages: (thread.messages ?? []).map(
          (m: {
            id: string;
            body: string;
            createdAt: string;
            createdByUser?: { firstName: string; lastName: string } | null;
            createdByGuest?: { name: string } | null;
            isSystemMessage: boolean;
          }) => ({
            id: m.id,
            body: m.body,
            createdAt: new Date(m.createdAt),
            createdByUser: m.createdByUser,
            createdByGuest: m.createdByGuest,
            isSystemMessage: m.isSystemMessage,
          })
        ),
        assignedTo: thread.assignedTo ?? null,
      };

      onThreadCreated(newThread);
      setNewThreadText("");
      setShowNewThread(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create comment");
    } finally {
      setIsSubmitting((prev) => ({ ...prev, _new: false }));
    }
  };

  const handlePendingAnnotationSubmit = async () => {
    const text = pendingText.trim();
    if (!text || !pendingAnnotationId) return;

    setIsSubmitting((prev) => ({ ...prev, _pending: true }));

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          reviewItemId,
          reviewRevisionId: revisionId,
          rootAnnotationId: pendingAnnotationId,
          initialMessage: text,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create comment");
      }

      const { thread } = await res.json();

      const newThread: CommentThread = {
        id: thread.id,
        status: thread.status,
        rootAnnotationId: thread.rootAnnotationId ?? pendingAnnotationId,
        messages: (thread.messages ?? []).map(
          (m: {
            id: string;
            body: string;
            createdAt: string;
            createdByUser?: { firstName: string; lastName: string } | null;
            createdByGuest?: { name: string } | null;
            isSystemMessage: boolean;
          }) => ({
            id: m.id,
            body: m.body,
            createdAt: new Date(m.createdAt),
            createdByUser: m.createdByUser,
            createdByGuest: m.createdByGuest,
            isSystemMessage: m.isSystemMessage,
          })
        ),
        assignedTo: thread.assignedTo ?? null,
      };

      onThreadCreated(newThread);
      setPendingText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create comment");
    } finally {
      setIsSubmitting((prev) => ({ ...prev, _pending: false }));
    }
  };

  // If there's a pending annotation, show the new-comment input for it
  if (pendingAnnotationId) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Annotation placed — add a comment</span>
          </div>
          <Textarea
            placeholder="Describe your feedback..."
            value={pendingText}
            onChange={(e) => setPendingText(e.target.value)}
            className="min-h-[100px] mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPendingText("");
                onPendingCancelled();
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePendingAnnotationSubmit}
              disabled={!pendingText.trim() || isSubmitting._pending}
            >
              {isSubmitting._pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Post Comment
                </>
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threads.length > 0 ? (
            <div className="divide-y">
              {threads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} onSelect={() => onThreadSelected(thread.id)} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No other comments yet
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  if (selectedThread) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => onThreadSelected(null)} className="mb-2">
            ← Back to all comments
          </Button>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Thread</h3>
            <Select
              value={selectedThread.status}
              onValueChange={(v) => handleStatusChange(selectedThread.id, v as CommentStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedThread.assignedTo && (
            <p className="text-xs text-muted-foreground mt-1">
              Assigned to: {selectedThread.assignedTo.firstName} {selectedThread.assignedTo.lastName}
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {selectedThread.messages.map((message, index) => (
              <div key={message.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {message.isSystemMessage ? (
                      <AvatarFallback className="bg-slate-100 text-slate-500 text-xs">S</AvatarFallback>
                    ) : message.createdByUser ? (
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(message.createdByUser.firstName, message.createdByUser.lastName)}
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-xs">G</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {message.isSystemMessage
                          ? "System"
                          : message.createdByUser
                          ? `${message.createdByUser.firstName} ${message.createdByUser.lastName}`
                          : message.createdByGuest
                          ? `${message.createdByGuest.name} (Guest)`
                          : "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(message.createdAt)}
                      </span>
                      {message.isSystemMessage && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Textarea
            placeholder="Write a reply..."
            value={replyText[selectedThread.id] || ""}
            onChange={(e) => setReplyText((prev) => ({ ...prev, [selectedThread.id]: e.target.value }))}
            className="min-h-[80px] mb-2"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => handleReplySubmit(selectedThread.id)}
              disabled={!replyText[selectedThread.id]?.trim() || isSubmitting[selectedThread.id]}
              size="sm"
            >
              {isSubmitting[selectedThread.id] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button
          onClick={() => setShowNewThread(!showNewThread)}
          className="w-full"
          variant={showNewThread ? "secondary" : "default"}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          {showNewThread ? "Cancel" : "New Comment"}
        </Button>
        {showNewThread && (
          <div className="mt-3">
            <Textarea
              placeholder="Start a new comment thread..."
              value={newThreadText}
              onChange={(e) => setNewThreadText(e.target.value)}
              className="min-h-[80px] mb-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewThread(false);
                  setNewThreadText("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNewThreadSubmit}
                disabled={!newThreadText.trim() || isSubmitting._new}
              >
                {isSubmitting._new ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Post Comment"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {threads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm mt-1">Click a tool to place an annotation, then add a comment</p>
          </div>
        ) : (
          <div className="divide-y">
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                onSelect={() => onThreadSelected(thread.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ThreadRow({
  thread,
  onSelect,
}: {
  thread: CommentThread;
  onSelect: () => void;
}) {
  const firstMessage = thread.messages.find((m) => !m.isSystemMessage);
  const statusOption = statusOptions.find((s) => s.value === thread.status);

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${statusOption?.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {statusOption?.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {thread.messages.length} {thread.messages.length === 1 ? "message" : "messages"}
            </span>
            {thread.rootAnnotationId && (
              <span title="Has annotation">
                <MapPin className="w-3 h-3 text-muted-foreground" />
              </span>
            )}
          </div>
          {firstMessage && (
            <p className="text-sm line-clamp-2">{firstMessage.body}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            {firstMessage?.createdByUser ? (
              `${firstMessage.createdByUser.firstName} ${firstMessage.createdByUser.lastName}`
            ) : firstMessage?.createdByGuest ? (
              `${firstMessage.createdByGuest.name} (Guest)`
            ) : (
              "System"
            )}
            {firstMessage && (
              <>
                <span>·</span>
                <span>{formatRelativeTime(firstMessage.createdAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

