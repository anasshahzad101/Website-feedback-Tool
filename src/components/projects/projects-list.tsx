"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Archive, Trash2, MoreHorizontal, Globe, ImageIcon, FileText as PdfIcon, Video } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { ProjectStatus } from "@prisma/client";
import { toast } from "sonner";

type ReviewItemType = "WEBSITE" | "IMAGE" | "PDF" | "VIDEO";

interface PreviewItem {
  type: ReviewItemType;
  thumbnailPath: string | null;
  uploadedFilePath: string | null;
  sourceUrl: string | null;
  currentRevision: {
    snapshotPath: string | null;
    uploadedFilePath: string | null;
  } | null;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string; companyName: string | null };
  _count: { reviewItems: number; members: number };
  reviewItems?: PreviewItem[];
}

interface ProjectsListProps {
  projects: Project[];
  isArchived?: boolean;
}

/** Resolve image URL for card preview. Paths in DB are like /screenshots/x or /images/x; we serve at /uploads + path. */
function getPreviewImageUrl(item: PreviewItem | undefined): string | null {
  if (!item) return null;
  const path =
    item.thumbnailPath ||
    item.currentRevision?.snapshotPath ||
    item.currentRevision?.uploadedFilePath ||
    item.uploadedFilePath;
  if (!path) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/uploads${normalized}`;
}

export function ProjectsList({ projects: initial, isArchived }: ProjectsListProps) {
  const [projects, setProjects] = useState(initial);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent, projectId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleArchive = async (e: React.MouseEvent, projectId: string, archive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: archive ? "archive" : "unarchive" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(archive ? "Project archived" : "Project restored");
      router.refresh();
    } catch {
      toast.error("Failed to update project");
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        {isArchived ? "No archived projects" : (
          <>
            <p className="font-medium text-slate-700">No projects yet.</p>
            <p className="text-sm mt-1">Create your first project to get started.</p>
          </>
        )}
      </div>
    );
  }

  const typeIcons: Record<ReviewItemType, React.ComponentType<{ className?: string }>> = {
    WEBSITE: Globe,
    IMAGE: ImageIcon,
    PDF: PdfIcon,
    VIDEO: Video,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const previewItem = project.reviewItems?.[0];
        const previewUrl = getPreviewImageUrl(previewItem);
        const previewType = (previewItem?.type ?? "WEBSITE") as ReviewItemType;
        const TypeIcon = typeIcons[previewType];

        return (
          <div key={project.id} className="relative group">
            <Link href={`/projects/${project.id}`}>
              <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full overflow-hidden">
                {/* Preview image or placeholder */}
                <div className="relative h-36 w-full bg-slate-100 shrink-0">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      unoptimized={previewUrl.startsWith("/uploads")}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-slate-500 shadow-sm">
                        <TypeIcon className="h-7 w-7" />
                      </div>
                    </div>
                  )}
                  {isArchived && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="shadow-sm">
                        <Archive className="h-3 w-3 mr-1" />
                        Archived
                      </Badge>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-8">
                      <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                      {project.client.id !== "system-default-client" && (
                        <CardDescription className="mt-1">
                          {project.client.companyName || project.client.name}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {project._count.reviewItems} items
                    </span>
                    <span>{formatDate(project.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Action menu */}
            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 bg-white/80 hover:bg-white shadow-sm border"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>Open</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => handleArchive(e, project.id, !isArchived)}>
                    <Archive className="h-4 w-4 mr-2" />
                    {isArchived ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => handleDelete(e, project.id, project.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
