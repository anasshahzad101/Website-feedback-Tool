import { redirect } from "next/navigation";
import { needsInitialSetup } from "@/lib/app-settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    redirect("/setup");
  }

  if (await needsInitialSetup()) {
    redirect("/setup");
  }

  return <LoginForm />;
}
