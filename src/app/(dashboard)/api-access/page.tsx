import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ApiAccessPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Ensure user exists and has an API token (use raw SQL so we don't depend on generated client having apiToken)
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;
  type TokenRow = { api_token: string | null };
  const tokenRows = await db.$queryRaw<TokenRow[]>`SELECT api_token FROM users WHERE id = ${userId}`;
  let apiToken: string | null = tokenRows[0]?.api_token ?? null;

  if (!apiToken) {
    apiToken = crypto.randomUUID();
    await db.$executeRaw`UPDATE users SET api_token = ${apiToken} WHERE id = ${userId}`;
  }

  // Fetch projects where user is a member or owner
  const projects = await db.project.findMany({
    where: {
      OR: [
        { createdById: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          API Access
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Use this information to configure the Chrome extension for website feedback.
        </p>
      </div>

      <Card className="max-w-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">API Token</CardTitle>
          <CardDescription className="text-slate-500">
            Paste this token into the extension popup. Keep it secret – it acts like a password.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <input
            readOnly
            value={apiToken ?? ""}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-700"
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">Projects</CardTitle>
          <CardDescription className="text-slate-500">
            Use the Project ID below when configuring the extension.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-2">
          {projects.length === 0 && (
            <p className="text-sm text-slate-500 py-4">
              You don&apos;t have access to any projects yet.
            </p>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium text-slate-900">{project.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ID: <span className="font-mono">{project.id}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

