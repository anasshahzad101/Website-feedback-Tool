import { redirect } from "next/navigation";
import { needsInitialSetup } from "@/lib/app-settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await needsInitialSetup()) {
    redirect("/setup");
  }

  return <LoginForm />;
}
