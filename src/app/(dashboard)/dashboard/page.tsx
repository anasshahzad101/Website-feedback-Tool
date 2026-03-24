import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  Plus,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const baseWhere = !Permissions.canAccessAdminPanel(session.user.role as UserRole)
    ? { members: { some: { userId: session.user.id } } }
    : {};

  const [activeProjects, recentProjects, totalReviewItems] = await Promise.all([
    db.project.count({
      where: { ...baseWhere, status: "ACTIVE" },
    }),
    db.project.findMany({
      where: { ...baseWhere, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        client: { select: { name: true, companyName: true } },
        _count: { select: { reviewItems: true } },
      },
    }),
    db.reviewItem.count({
      where: {
        project: { ...baseWhere, status: "ACTIVE" },
      },
    }),
  ]);

  const firstName = session.user.firstName?.split(" ")[0] || "there";

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 md:p-10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-slate-300 text-sm font-medium uppercase tracking-widest mb-1">
              Welcome back
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Hi, {firstName}
            </h1>
            <p className="mt-2 text-slate-300 max-w-md">
              Here’s what’s happening with your feedback and review projects.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            {Permissions.canCreateProject(session.user.role as UserRole) && (
              <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                <Link href="/projects/new">
                  <Plus className="mr-2 h-5 w-5" />
                  New Project
                </Link>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              className="shrink-0 rounded-lg border-2 border-white/40 bg-transparent text-white hover:bg-white/15 hover:border-white/60 focus-visible:ring-white/40"
            >
              <Link href="/projects" className="flex items-center gap-2">
                View all projects
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{activeProjects}</p>
              <p className="text-sm text-slate-500">Active projects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalReviewItems}</p>
              <p className="text-sm text-slate-500">Review items</p>
            </div>
          </CardContent>
        </Card>
        {Permissions.canAccessAdminPanel(session.user.role as UserRole) && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Team</p>
                <Button variant="link" className="p-0 h-auto text-slate-900 font-semibold" asChild>
                  <Link href="/team">Manage team</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent projects</h2>
          <Button variant="ghost" size="sm" asChild className="text-slate-600">
            <Link href="/projects">
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {recentProjects.length === 0 ? (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="py-16 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="text-slate-600 font-medium">No projects yet</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Create your first project to start collecting feedback and running website reviews.
              </p>
              {Permissions.canCreateProject(session.user.role as UserRole) && (
                <Button asChild className="mt-6">
                  <Link href="/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create project
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{project.name}</p>
                      <p className="text-sm text-slate-500 truncate">
                        {project.client.companyName || project.client.name}
                        {project._count.reviewItems > 0 && (
                          <span className="ml-2">
                            · {project._count.reviewItems} review{project._count.reviewItems !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-slate-400">{formatDate(project.updatedAt)}</span>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick tip */}
      <Card className="border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Collect feedback on live sites</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Add a website review item to any project, then open it to annotate and comment directly on the page. Pins and screenshots are saved with each comment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
