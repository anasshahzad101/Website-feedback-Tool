import { auth } from "@/lib/auth";
import { db, UserRole, ProjectStatus, Prisma } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { coerceSessionRole } from "@/lib/auth/session-role";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProjectsPageTabs } from "@/components/projects/projects-page-tabs";
import { Plus } from "lucide-react";
import { serializeProjectsForList } from "@/lib/projects/serialize-project-list";

function parseStatusQueryParam(raw: string | undefined): ProjectStatus | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const u = raw.trim().toUpperCase();
  if (u === ProjectStatus.ACTIVE || u === ProjectStatus.ARCHIVED) return u;
  return undefined;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string } | undefined>;
}) {
  const sp = await searchParams;
  const rawStatus = sp && typeof sp === "object" ? sp.status : undefined;
  const statusParam = typeof rawStatus === "string" ? rawStatus : undefined;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userRole = coerceSessionRole(session.user.role);
  const statusFilter = parseStatusQueryParam(statusParam);

  const baseWhere: Prisma.ProjectWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(!Permissions.canAccessAdminPanel(userRole)
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
    Permissions.canAccessAdminPanel(userRole)
      ? db.project.findMany({
          where: { status: ProjectStatus.ARCHIVED },
          // Use updatedAt — some production DBs lack archived_at (never migrated).
          orderBy: { updatedAt: "desc" },
          include: projectInclude,
        })
      : Promise.resolve([]),
  ]);

  const activeSerialized = serializeProjectsForList(activeProjects);
  const archivedSerialized = serializeProjectsForList(archivedProjects);
  const activePlain = JSON.parse(
    JSON.stringify(activeSerialized)
  ) as typeof activeSerialized;
  const archivedPlain = JSON.parse(
    JSON.stringify(archivedSerialized)
  ) as typeof archivedSerialized;

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
        {Permissions.canCreateProject(userRole) && (
          <Button asChild className="shrink-0">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      <ProjectsPageTabs
        activeSerialized={activePlain}
        archivedSerialized={archivedPlain}
      />
    </div>
  );
}
