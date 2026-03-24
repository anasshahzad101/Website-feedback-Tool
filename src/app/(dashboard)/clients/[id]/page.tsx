import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, Building2, FolderKanban, Pencil } from "lucide-react";

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!Permissions.canManageClients(session.user.role as UserRole)) {
    redirect("/dashboard");
  }

  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { reviewItems: true, members: true },
          },
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Clients
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{client.name}</CardTitle>
                {client.companyName && (
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Building2 className="h-3 w-3" />
                    {client.companyName}
                  </CardDescription>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/clients/${client.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${client.email}`} className="text-sm hover:underline">
                    {client.email}
                  </a>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${client.phone}`} className="text-sm hover:underline">
                      {client.phone}
                    </a>
                  </div>
                )}
              </div>
              {client.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {client.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projects</CardTitle>
              <Button size="sm" asChild>
                <Link href={`/projects/new?clientId=${client.id}`}>
                  New Project
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {client.projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No projects yet</p>
                  <p className="text-sm mt-1">Create your first project for this client</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {client.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {project._count.reviewItems} review items • {project._count.members} members
                        </p>
                      </div>
                      <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                        {project.status.toLowerCase()}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Projects</span>
                <span className="font-medium">{client.projects.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Projects</span>
                <span className="font-medium">
                  {client.projects.filter((p) => p.status === "ACTIVE").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Review Items</span>
                <span className="font-medium">
                  {client.projects.reduce((sum, p) => sum + p._count.reviewItems, 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href={`/projects/new?clientId=${client.id}`}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Create Project
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href={`/clients/${client.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Client
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
