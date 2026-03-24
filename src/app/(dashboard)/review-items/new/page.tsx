import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { CreateReviewItemForm } from "@/components/forms/create-review-item-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewReviewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get accessible projects
  let projects;
  if (Permissions.canAccessAdminPanel(session.user.role as UserRole)) {
    projects = await db.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: {
        client: { select: { name: true } },
        members: { select: { userId: true, roleInProject: true } },
      },
    });
  } else {
    projects = await db.project.findMany({
      where: {
        status: "ACTIVE",
        members: { some: { userId: session.user.id } },
      },
      orderBy: { name: "asc" },
      include: {
        client: { select: { name: true } },
        members: { select: { userId: true, roleInProject: true } },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/review-items">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Review Items
          </Link>
        </Button>
      </div>

      <div className="max-w-2xl">
        <CreateReviewItemForm
          projects={projects}
          defaultProjectId={projectId}
          user={session.user}
        />
      </div>
    </div>
  );
}
