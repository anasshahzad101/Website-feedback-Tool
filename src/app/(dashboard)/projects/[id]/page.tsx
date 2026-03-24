import { auth } from "@/lib/auth";
import { db, UserRole, ProjectRole, ReviewItemType } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, FileText, Users, FolderKanban, Globe, Image, FileText as FileIcon, Video } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

const typeIcons: Record<ReviewItemType, typeof Globe> = {
  WEBSITE: Globe,
  IMAGE: Image,
  PDF: FileIcon,
  VIDEO: Video,
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      members: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
          client: {
            select: { id: true, name: true, companyName: true, email: true },
          },
        },
      },
      reviewItems: {
        orderBy: { updatedAt: "desc" },
        include: {
          currentRevision: true,
          _count: {
            select: { commentThreads: true },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const userMembership = project.members.find((m: { user?: { id: string } | null; roleInProject: string }) => m.user?.id === session.user.id);

  if (
    !Permissions.canAccessAdminPanel(session.user.role as UserRole) &&
    !userMembership
  ) {
    redirect("/dashboard");
  }

  const canEdit = Permissions.canEditProject(
    session.user.role as UserRole,
    userMembership?.roleInProject as ProjectRole | null,
    project.createdById === session.user.id
  );

  const canManageMembers = Permissions.canManageProjectMembers(
    session.user.role as UserRole,
    userMembership?.roleInProject as ProjectRole | null
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="text-slate-600 -ml-2">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Projects
          </Link>
        </Button>
      </div>

      {/* Header card */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {project.name}
                </h1>
                <Badge
                  variant={project.status === "ACTIVE" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {project.status.toLowerCase()}
                </Badge>
              </div>
              <p className="text-slate-500 mt-1">
                {project.client.name}
                {project.client.companyName && ` · ${project.client.companyName}`}
              </p>
              {project.description && (
                <p className="mt-2 text-sm text-slate-600 max-w-2xl">{project.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <Button variant="outline" size="sm" asChild className="border-slate-200">
                  <Link href={`/projects/${project.id}/edit`}>Edit project</Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href={`/review-items/new?projectId=${project.id}`}>
                  <Plus className="h-4 w-4 mr-1" />
                  New review
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger
            value="reviews"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Review items ({project.reviewItems.length})
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
          >
            <Users className="h-4 w-4" />
            Members ({project.members.length})
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="mt-4">
          {project.reviewItems.length === 0 ? (
            <Card className="border-slate-200 shadow-sm border-dashed">
              <CardContent className="py-16 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="text-slate-600 font-medium">No review items yet</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Add a website, image, or PDF to start collecting feedback.
                </p>
                <Button asChild className="mt-6">
                  <Link href={`/review-items/new?projectId=${project.id}`}>
                    Create first review item
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {project.reviewItems.map((item) => {
                const TypeIcon = typeIcons[item.type];
                return (
                  <Link key={item.id} href={`/review-items/${item.id}`}>
                    <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base text-slate-900 truncate">
                              {item.title}
                            </CardTitle>
                            <CardDescription className="capitalize text-slate-500">
                              {item.type.toLowerCase()}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>{item._count.commentThreads} comments</span>
                          <span>{formatDate(item.updatedAt)}</span>
                        </div>
                        {item.currentRevision?.revisionLabel && (
                          <Badge variant="outline" className="mt-2 border-slate-200">
                            {item.currentRevision.revisionLabel}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-slate-900">Team members</CardTitle>
              {canManageMembers && (
                <Button size="sm" variant="outline" className="border-slate-200">
                  Add member
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-700">
                        {member.user
                          ? `${member.user.firstName[0]}${member.user.lastName[0]}`
                          : member.client
                          ? member.client.name[0]
                          : "?"}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {member.user
                            ? `${member.user.firstName} ${member.user.lastName}`
                            : member.client?.name || "Unknown"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {member.user?.email || member.client?.email || ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-slate-200 capitalize">
                      {member.roleInProject.toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg text-slate-900">Project activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-slate-500">
                <p>Activity feed coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
