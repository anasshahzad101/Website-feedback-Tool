import { auth } from "@/lib/auth";
import { UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditClientForm } from "@/components/forms/edit-client-form";
import { ArrowLeft } from "lucide-react";

interface EditClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
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
  });

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clients/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Client
          </Link>
        </Button>
      </div>

      <div className="max-w-2xl">
        <EditClientForm clientId={id} />
      </div>
    </div>
  );
}
