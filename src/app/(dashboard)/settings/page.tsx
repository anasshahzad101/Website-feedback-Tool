import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsProfileForm } from "@/components/forms/settings-profile-form";
import { SettingsPasswordForm } from "@/components/forms/settings-password-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-8 max-w-2xl">
        <SettingsProfileForm />
        <SettingsPasswordForm />
      </div>
    </div>
  );
}
