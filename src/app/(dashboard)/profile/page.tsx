import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View your account information
        </p>
      </div>

      <Card className="max-w-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">
            {session.user.firstName} {session.user.lastName}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {session.user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div className="flex justify-between items-center text-sm py-2 px-3 rounded-lg bg-slate-50">
            <span className="text-slate-500">Role</span>
            <span className="font-medium text-slate-900 capitalize">
              {session.user.role.toLowerCase().replace("_", " ")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="border-slate-200">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Edit profile & settings
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-slate-200">
              <Link href="/api-access">
                API access for Chrome extension
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
