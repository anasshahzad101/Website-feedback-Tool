import { auth } from "@/lib/auth";
import { db, UserRole } from "@/lib/db/client";
import { Permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TeamTable } from "@/components/team/team-table";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!Permissions.canManageUsers(session.user.role as UserRole)) {
    redirect("/dashboard");
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: { projectMemberships: true },
      },
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Team
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your team members, roles, and access
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">Team Members</CardTitle>
          <CardDescription className="text-slate-500">
            {users.filter((u) => u.isActive).length} active members
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TeamTable
            users={users}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
          />
        </CardContent>
      </Card>
    </div>
  );
}
