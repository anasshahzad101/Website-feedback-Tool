import { auth } from "@/lib/auth";
import { db, UserRole, ProjectStatus, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ProjectsList } from "@/components/projects/projects-list";
import { Plus } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const statusFilter = statusParam as ProjectStatus | undefined;

  const baseWhere: Prisma.ProjectWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(!Permissions.canAccessAdminPanel(session.user.role as UserRole)
      ? { members: { some: { userId: session.user.id } } }
      : {}),
  };

  const projectInclude = {
    client: {
      select: { id: true, name: true, companyName: true },
    },
    _count: {
      select: { reviewItems: true, members: true },
    },
    reviewItems: {
      orderBy: { updatedAt: "desc" as const },
      take: 1,
      select: {
        type: true,
        thumbnailPath: true,
        uploadedFilePath: true,
        sourceUrl: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            snapshotPath: true,
            uploadedFilePath: true,
          },
        },
      },
    },
  };

  const [activeProjects, archivedProjects] = await Promise.all([
    db.project.findMany({
      where: { ...baseWhere, status: ProjectStatus.ACTIVE },
      orderBy: { updatedAt: "desc" },
      include: projectInclude,
    }),
    Permissions.canAccessAdminPanel(session.user.role as UserRole)
      ? db.project.findMany({
          where: { status: ProjectStatus.ARCHIVED },
          orderBy: { archivedAt: "desc" },
          include: projectInclude,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your projects and client reviews
          </p>
        </div>
        {Permissions.canCreateProject(session.user.role as UserRole) && (
          <Button asChild className="shrink-0">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="active" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Active ({activeProjects.length})
          </TabsTrigger>
          {archivedProjects.length > 0 && (
            <TabsTrigger value="archived" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Archived ({archivedProjects.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white/80">
              <CardTitle className="text-base font-medium text-slate-900">
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectsList projects={activeProjects} />
            </CardContent>
          </Card>
        </TabsContent>

        {archivedProjects.length > 0 && (
          <TabsContent value="archived" className="mt-4">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-white/80">
                <CardTitle className="text-base font-medium text-slate-900">
                  Archived Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ProjectsList projects={archivedProjects} isArchived />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
