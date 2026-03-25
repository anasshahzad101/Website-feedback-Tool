"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";

export function BrandingSettingsForm() {
  const { refresh } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [appName, setAppName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app-settings");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBrandName(data.brandName ?? "");
      setAppName(data.appName ?? "");
      setTagline(data.tagline ?? "");
      setLogoUrl(data.logoUrl ?? null);
    } catch {
      toast.error("Could not load branding settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          appName,
          tagline: tagline.trim() || null,
          clearLogo: false,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Branding saved");
      await refresh();
    } catch {
      toast.error("Could not save branding");
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/app-settings/logo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }
      setLogoUrl(data.logoUrl ?? null);
      toast.success("Logo updated");
      await refresh();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClearLogo = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          appName,
          tagline: tagline.trim() || null,
          clearLogo: true,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setLogoUrl(null);
      toast.success("Logo removed");
      await refresh();
    } catch {
      toast.error("Could not remove logo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading branding…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          White-label branding
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Names and logo appear on login, dashboard, and guest review pages.
          Browser title uses the full app name.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="b-brand">Short name</Label>
        <Input
          id="b-brand"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          required
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the header and compact spaces.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="b-app">Full app name</Label>
        <Input
          id="b-app"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          required
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Used for the page title and emails.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="b-tag">Tagline</Label>
        <Input
          id="b-tag"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={80}
          placeholder="e.g. FEEDBACK TOOL"
        />
        <p className="text-xs text-muted-foreground">
          Subtitle under the brand in the sidebar (optional).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border bg-muted">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                fill
                className="object-contain p-1"
                sizes="64px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                None
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById("logo-file")?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Upload image"
              )}
            </Button>
            <input
              id="logo-file"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogo}
            />
            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleClearLogo()}
                disabled={saving}
              >
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, GIF, WebP, or SVG. Max 2MB.
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save branding"
        )}
      </Button>
    </form>
  );
}
