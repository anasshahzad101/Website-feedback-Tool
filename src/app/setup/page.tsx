import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const count = await db.user.count();
  if (count > 0) {
    redirect("/login");
  }

  return <SetupForm />;
}
