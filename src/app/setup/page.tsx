import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { isDatabaseEnvConfigured } from "@/lib/db/database-env";
import { SetupForm } from "./setup-form";
import { SetupBlocked } from "./setup-blocked";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!isDatabaseEnvConfigured()) {
    return <SetupBlocked reason="missing-database-url" />;
  }

  let userCount = 0;
  try {
    userCount = await db.user.count();
  } catch {
    return <SetupBlocked reason="database-error" />;
  }

  if (userCount > 0) {
    redirect("/login");
  }

  return <SetupForm />;
}
