import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export const maxDuration = 60;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <DashboardSidebar user={session.user} userRole={session.user.role} />
      <main className="flex-1 p-6 md:p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
