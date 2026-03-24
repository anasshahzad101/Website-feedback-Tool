"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Loader2, Trash2, Link, ExternalLink, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ShareLink {
  id: string;
  token: string;
  allowGuestView: boolean;
  allowGuestComments: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string } | null;
}

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewItemId: string;
  reviewItemTitle: string;
}

const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "";

export function ShareModal({
  open,
  onOpenChange,
  reviewItemId,
  reviewItemTitle,
}: ShareModalProps) {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New link config
  const [allowGuestView, setAllowGuestView] = useState(true);
  const [allowGuestComments, setAllowGuestComments] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shares?reviewItemId=${reviewItemId}`);
      if (res.ok) {
        const data = await res.json();
        setShareLinks(data.shareLinks ?? []);
      }
    } catch {
      toast.error("Failed to load share links");
    } finally {
      setLoading(false);
    }
  }, [reviewItemId]);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItemId,
          allowGuestView,
          allowGuestComments,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create link");
      }

      const { shareLink } = await res.json();
      setShareLinks((prev) => [shareLink, ...prev]);
      toast.success("Share link created");
      setExpiresAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const revokeLink = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/shares/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke link");
      setShareLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = (token: string) => {
    const url = `${APP_URL}/review/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Share "{reviewItemTitle}"
          </DialogTitle>
        </DialogHeader>

        {/* Create new link */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
          <h3 className="font-medium text-sm">Create new share link</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="guest-view" className="font-normal">Allow guests to view</Label>
                <p className="text-xs text-muted-foreground">Anyone with the link can view</p>
              </div>
              <Switch
                id="guest-view"
                checked={allowGuestView}
                onCheckedChange={setAllowGuestView}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="guest-comments" className="font-normal">Allow guest comments</Label>
                <p className="text-xs text-muted-foreground">Guests can leave feedback</p>
              </div>
              <Switch
                id="guest-comments"
                checked={allowGuestComments}
                onCheckedChange={setAllowGuestComments}
              />
            </div>

            <div>
              <Label htmlFor="expires" className="text-sm font-normal">Expiry date (optional)</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <Button onClick={createLink} disabled={creating} className="w-full" size="sm">
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Create Share Link</>
            )}
          </Button>
        </div>

        <Separator />

        {/* Existing links */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Existing links</h3>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shareLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No share links yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shareLinks.map((link) => {
                const url = `${APP_URL}/review/${link.token}`;
                const isExpired = link.expiresAt ? new Date(link.expiresAt) < new Date() : false;
                return (
                  <div
                    key={link.id}
                    className={`rounded-lg border p-3 space-y-2 ${isExpired ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={url}
                        readOnly
                        className="text-xs h-8 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={() => copyLink(link.token)}
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                        title="Open in new tab"
                      >
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        {link.allowGuestView && (
                          <Badge variant="outline" className="text-xs py-0">View</Badge>
                        )}
                        {link.allowGuestComments && (
                          <Badge variant="outline" className="text-xs py-0">Comments</Badge>
                        )}
                        {isExpired && (
                          <Badge variant="destructive" className="text-xs py-0">Expired</Badge>
                        )}
                        {link.expiresAt && !isExpired && (
                          <span>Expires {formatDate(new Date(link.expiresAt))}</span>
                        )}
                        {link.createdBy && (
                          <>
                            <span>
                              by {link.createdBy.firstName} {link.createdBy.lastName}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span>{formatDate(new Date(link.createdAt))}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive ml-1"
                        onClick={() => revokeLink(link.id)}
                        disabled={deletingId === link.id}
                        title="Revoke link"
                      >
                        {deletingId === link.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
