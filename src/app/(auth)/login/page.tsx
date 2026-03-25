"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { publicBrandName } from "@/lib/brand";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  // Show error from URL params (set by NextAuth on failed credential sign-in)
  useEffect(() => {
    if (error) {
      toast.error("Invalid email or password. Please try again.");
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Fetch the CSRF token first (required by NextAuth)
      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to get CSRF token");
      const { csrfToken } = await csrfRes.json();

      // Submit credentials as a native form POST so the browser handles the redirect
      // naturally. This avoids the next-auth/react signIn() proxy compatibility issue
      // where 302+JSON responses are followed before the JSON body can be read.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/callback/credentials";

      const fields: Record<string, string> = {
        email: formData.email,
        password: formData.password,
        csrfToken,
        callbackUrl,
      };

      for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      // Browser will follow the redirect:
      //  - Success → /dashboard
      //  - Failure → /login?error=CredentialsSignin
    } catch {
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/40">
              <span className="text-2xl font-black leading-none">W</span>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight text-slate-50">
                {publicBrandName()}
              </CardTitle>
              <CardDescription className="text-slate-300">
                Sign in to review and collect website feedback.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-100">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-100">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            <p>Contact your administrator if you need access.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
