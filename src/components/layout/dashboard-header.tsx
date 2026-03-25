"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { LogOut, User, Settings } from "lucide-react";
import Link from "next/link";
import { useBranding } from "@/contexts/branding-context";
import { BrandMark } from "@/components/brand/brand-mark";

interface DashboardHeaderProps {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { brandName, tagline } = useBranding();
  const sub = (tagline?.trim() || "FEEDBACK TOOL").toUpperCase();

  return (
    <header className="border-b bg-card sticky top-0 z-40">
      <div className="flex h-16 items-center justify-between px-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BrandMark className="h-9 w-9" />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight">
                  {brandName}
                </span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
                  {sub}
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/10 text-slate-100">
                <Avatar className="h-9 w-9 ring-2 ring-white/20">
                  <AvatarFallback className="bg-white/20 text-white font-medium">
                    {getInitials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role.toLowerCase().replace("_", " ")}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/api/auth/signout?callbackUrl=/login"
                  className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive flex items-center"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
