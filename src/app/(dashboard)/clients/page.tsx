import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ClientsTable } from "@/components/clients/clients-table";
import { Plus } from "lucide-react";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!Permissions.canManageClients(session.user.role as UserRole)) {
    redirect("/dashboard");
  }

  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { projects: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client accounts and their projects
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientsTable clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
