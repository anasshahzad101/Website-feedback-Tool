import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Permissions } from "@/lib/auth/permissions";
import { SettingsProfileForm } from "@/components/forms/settings-profile-form";
import { SettingsPasswordForm } from "@/components/forms/settings-password-form";
import { BrandingSettingsForm } from "@/components/forms/branding-settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canManageBranding = Permissions.canAccessAdminPanel(
    session.user.role as UserRole
  );

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

      <div className="space-y-10 max-w-2xl">
        {canManageBranding ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <BrandingSettingsForm />
          </div>
        ) : null}
        <SettingsProfileForm />
        <SettingsPasswordForm />
      </div>
    </div>
  );
}
