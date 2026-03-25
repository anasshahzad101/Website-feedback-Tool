"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function SetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    brandName: "",
    appName: "",
    tagline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          ...(form.brandName.trim()
            ? { brandName: form.brandName.trim() }
            : {}),
          ...(form.appName.trim() ? { appName: form.appName.trim() } : {}),
          ...(form.tagline.trim() ? { tagline: form.tagline.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Setup failed. Check your database connection and try again.";
        toast.error(msg);
        setLoading(false);
        return;
      }
      toast.success("Account created. Sign in with your email and password.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-50">
            Welcome — let&apos;s get started
          </CardTitle>
          <CardDescription className="text-slate-300">
            Create the owner account for this deployment. You can change branding
            later in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fn" className="text-slate-100">
                  First name
                </Label>
                <Input
                  id="fn"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln" className="text-slate-100">
                  Last name
                </Label>
                <Input
                  id="ln"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="em" className="text-slate-100">
                Email
              </Label>
              <Input
                id="em"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw" className="text-slate-100">
                Password
              </Label>
              <Input
                id="pw"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                disabled={loading}
              />
              <p className="text-xs text-slate-500">At least 8 characters.</p>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-3">
              <p className="text-sm font-medium text-slate-200">
                Branding (optional)
              </p>
              <div className="space-y-2">
                <Label htmlFor="bn" className="text-slate-100">
                  Short name / logo text
                </Label>
                <Input
                  id="bn"
                  placeholder="e.g. Acme Studio"
                  value={form.brandName}
                  onChange={(e) =>
                    setForm({ ...form, brandName: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="an" className="text-slate-100">
                  Full app name
                </Label>
                <Input
                  id="an"
                  placeholder="e.g. Acme Review Portal"
                  value={form.appName}
                  onChange={(e) => setForm({ ...form, appName: e.target.value })}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg" className="text-slate-100">
                  Tagline (sidebar subtitle)
                </Label>
                <Input
                  id="tg"
                  placeholder="e.g. FEEDBACK TOOL"
                  value={form.tagline}
                  onChange={(e) =>
                    setForm({ ...form, tagline: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create owner account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
