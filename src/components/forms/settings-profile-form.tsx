"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export function SettingsProfileForm() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "" });

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setFormData({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
          });
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("Profile updated. Changes will appear after you log in again.");
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update profile");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-8 text-center text-slate-500">
          Could not load profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <form onSubmit={handleSubmit}>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg text-slate-900">Profile</CardTitle>
          <CardDescription className="text-slate-500">Update your name. Email cannot be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              disabled
              className="bg-muted"
            />
          </div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
