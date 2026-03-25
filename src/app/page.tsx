import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { needsInitialSetup } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    redirect("/setup");
  }

  if (await needsInitialSetup()) {
    redirect("/setup");
  }

  redirect("/login");
}
