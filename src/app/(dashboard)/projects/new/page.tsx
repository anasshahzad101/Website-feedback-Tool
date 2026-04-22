import { auth } from "@/lib/auth";
import { Permissions } from "@/lib/auth/permissions";
import { coerceSessionRole } from "@/lib/auth/session-role";
import { redirect } from "next/navigation";
import { CreateProjectForm } from "@/components/forms/create-project-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userRole = coerceSessionRole(session.user.role);
  if (!Permissions.canCreateProject(userRole)) redirect("/projects");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Link>
        </Button>
      </div>
      <div className="max-w-2xl">
        <CreateProjectForm />
      </div>
    </div>
  );
}
