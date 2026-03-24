import { auth } from "@/lib/auth";
import { UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { CreateClientForm } from "@/components/forms/create-client-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewClientPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!Permissions.canManageClients(session.user.role as UserRole)) {
    redirect("/dashboard");
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

      <div className="max-w-2xl">
        <CreateClientForm />
      </div>
    </div>
  );
}
