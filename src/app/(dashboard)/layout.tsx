import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user;
  const sidebarUser = {
    id: u.id,
    email: u.email ?? "",
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    role: u.role ?? "REVIEWER",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <DashboardSidebar user={sidebarUser} userRole={sidebarUser.role} />
      <main className="flex-1 p-6 md:p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
