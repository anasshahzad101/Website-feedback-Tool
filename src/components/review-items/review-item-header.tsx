"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReviewItemType, ReviewMode, CommentStatus } from "@prisma/client";
import { ArrowLeft, Share2, GitBranch, Globe, Image, FileText, Video, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { ShareModal } from "@/components/review-items/share-modal";

interface ReviewItemHeaderProps {
  reviewItem: {
    id: string;
    title: string;
    type: ReviewItemType;
    reviewMode: ReviewMode;
    sourceUrl: string | null;
    guestCommentingEnabled: boolean;
    isPublicShareEnabled: boolean;
    project: {
      id: string;
      name: string;
      slug: string;
      client: { name: string };
    };
    revisions: Array<{
      id: string;
      revisionLabel?: string | null;
      revisionDate: Date;
    }>;
    commentThreads: Array<{
      status: CommentStatus;
    }>;
  };
  userRole: string | null;
  user: { id: string; role: string };
  selectedRevisionId?: string | null;
  onRevisionChange?: (revisionId: string) => void;
}

const typeIcons: Record<ReviewItemType, typeof Globe> = {
  WEBSITE: Globe,
  IMAGE: Image,
  PDF: FileText,
  VIDEO: Video,
};

const statusCounts = (threads: Array<{ status: CommentStatus }>) => {
  const counts: Record<CommentStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
    IGNORED: 0,
  };
  threads.forEach((t) => counts[t.status]++);
  return counts;
};

export function ReviewItemHeader({
  reviewItem,
  userRole,
  user,
  selectedRevisionId,
  onRevisionChange,
}: ReviewItemHeaderProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Delete "${reviewItem.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/review-items/${reviewItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Review item deleted");
      router.push(`/projects/${reviewItem.project.id}`);
    } catch {
      toast.error("Failed to delete review item");
    }
  };
  const TypeIcon = typeIcons[reviewItem.type];
  const counts = statusCounts(reviewItem.commentThreads);

  return (
    <>
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/review-items">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TypeIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{reviewItem.title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link href={`/projects/${reviewItem.project.id}`} className="hover:underline">
                    {reviewItem.project.name}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {reviewItem.revisions.length > 1 && (
              <Select
                value={selectedRevisionId ?? ""}
                onValueChange={onRevisionChange}
              >
                <SelectTrigger className="w-[200px]">
                  <GitBranch className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {reviewItem.revisions.map((rev) => (
                    <SelectItem key={rev.id} value={rev.id}>
                      {rev.revisionLabel || new Date(rev.revisionDate).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-1">
              {counts.OPEN > 0 && (
                <Badge variant="outline" className="status-badge open">
                  {counts.OPEN} open
                </Badge>
              )}
              {counts.IN_PROGRESS > 0 && (
                <Badge variant="outline" className="status-badge in-progress">
                  {counts.IN_PROGRESS} in progress
                </Badge>
              )}
              {counts.RESOLVED > 0 && (
                <Badge variant="outline" className="status-badge resolved">
                  {counts.RESOLVED} resolved
                </Badge>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        reviewItemId={reviewItem.id}
        reviewItemTitle={reviewItem.title}
      />
    </>
  );
}
