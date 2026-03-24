"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Globe, Image, FileText, Video } from "lucide-react";
import { ReviewItemType, ReviewMode, ProjectRole, ProjectStatus } from "@prisma/client";
import { Permissions } from "@/lib/auth/permissions";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  client: { name: string };
  members: Array<{ userId: string | null; roleInProject: ProjectRole }>;
}

interface CreateReviewItemFormProps {
  projects: Project[];
  defaultProjectId?: string;
  user: { id: string; role: string };
}

const typeOptions: { value: ReviewItemType; label: string; icon: typeof Globe }[] = [
  { value: "WEBSITE", label: "Website", icon: Globe },
  { value: "IMAGE", label: "Image", icon: Image },
  { value: "PDF", label: "PDF Document", icon: FileText },
  { value: "VIDEO", label: "Video", icon: Video },
];

export function CreateReviewItemForm({
  projects,
  defaultProjectId,
  user,
}: CreateReviewItemFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"website" | "upload">("website");
  const [formData, setFormData] = useState({
    projectId: defaultProjectId || "",
    title: "",
    type: "WEBSITE" as ReviewItemType,
    sourceUrl: "",
    reviewMode: "SCREENSHOT_CAPTURE" as ReviewMode,
    guestCommentingEnabled: true,
    file: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("projectId", formData.projectId);
      submitData.append("title", formData.title);
      submitData.append("type", formData.type);
      submitData.append("reviewMode", formData.reviewMode);
      submitData.append("guestCommentingEnabled", String(formData.guestCommentingEnabled));

      if (formData.type === "WEBSITE") {
        submitData.append("sourceUrl", formData.sourceUrl);
      } else if (formData.file) {
        submitData.append("file", formData.file);
      }

      const response = await fetch("/api/review-items", {
        method: "POST",
        body: submitData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Review item created successfully");
        router.push(`/review-items/${data.reviewItem.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create review item");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === formData.projectId);
  const canManageGuestSettings = selectedProject
    ? Permissions.canManageProjectMembers(
        user.role as import("@prisma/client").UserRole,
        selectedProject.members.find((m) => m.userId === user.id)?.roleInProject ?? null
      )
    : false;

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No projects available. Please{" "}
            <a href="/projects/new" className="text-primary hover:underline">
              create a project
            </a>{" "}
            first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>New Review Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select
              value={formData.projectId}
              onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} ({project.client.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter a descriptive title"
              required
            />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="website">Website URL</TabsTrigger>
              <TabsTrigger value="upload">File Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="website" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sourceUrl">Website URL *</Label>
                <Input
                  id="sourceUrl"
                  type="url"
                  value={formData.sourceUrl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sourceUrl: e.target.value,
                      type: "WEBSITE",
                    })
                  }
                  placeholder="https://example.com"
                  required={activeTab === "website"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewMode">Review Mode</Label>
                <Select
                  value={formData.reviewMode}
                  onValueChange={(value) =>
                    setFormData({ ...formData, reviewMode: value as ReviewMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCREENSHOT_CAPTURE">Screenshot (Recommended)</SelectItem>
                    <SelectItem value="IFRAME_EMBED">Live Preview (may be blocked)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Screenshot mode is more reliable for commenting. Live preview may not work with all websites.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    const type: ReviewItemType = file?.type.startsWith("image/")
                      ? "IMAGE"
                      : file?.type === "application/pdf"
                      ? "PDF"
                      : file?.type.startsWith("video/")
                      ? "VIDEO"
                      : "IMAGE";
                    setFormData({ ...formData, file, type });
                  }}
                  required={activeTab === "upload"}
                />
                <p className="text-xs text-muted-foreground">
                  Supported: Images (JPG, PNG, GIF, WebP), PDFs, Videos (MP4, WebM)
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {canManageGuestSettings && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="guestComments">Allow Guest Comments</Label>
                <p className="text-sm text-muted-foreground">
                  Guests with share links can leave comments
                </p>
              </div>
              <Switch
                id="guestComments"
                checked={formData.guestCommentingEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, guestCommentingEnabled: checked })
                }
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isLoading ||
              !formData.projectId ||
              !formData.title ||
              (activeTab === "website" && !formData.sourceUrl) ||
              (activeTab === "upload" && !formData.file)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Review Item"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
