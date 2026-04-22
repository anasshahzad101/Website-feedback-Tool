import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { needsInitialSetup } from "@/lib/app-settings";
import { isDatabaseEnvConfigured } from "@/lib/db/database-env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  if (!isDatabaseEnvConfigured()) {
    redirect("/setup");
  }

  if (await needsInitialSetup()) {
    redirect("/setup");
  }

  redirect("/login");
}
