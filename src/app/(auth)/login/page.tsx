import { redirect } from "next/navigation";
import { needsInitialSetup } from "@/lib/app-settings";
import { isDatabaseEnvConfigured } from "@/lib/db/database-env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isDatabaseEnvConfigured()) {
    redirect("/setup");
  }

  if (await needsInitialSetup()) {
    redirect("/setup");
  }

  return <LoginForm />;
}
