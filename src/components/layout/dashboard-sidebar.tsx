"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { UserRole } from "@prisma/client";
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
import { useBranding } from "@/contexts/branding-context";
import { BrandMark } from "@/components/brand/brand-mark";

interface DashboardSidebarProps {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  userRole: string;
}

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.REVIEWER],
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.REVIEWER],
  },
  {
    title: "Team",
    href: "/team",
    icon: UserCog,
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.REVIEWER],
  },
];

export function DashboardSidebar({ user, userRole }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { brandName, tagline } = useBranding();
  const sub = tagline?.trim() || "Feedback tool";

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole as UserRole)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col min-h-screen w-full transition-[width] duration-200 ease-out shrink-0",
        "bg-slate-900 border-r border-slate-800",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      {/* Branding – no separator line, same surface */}
      <div
        className={cn(
          "shrink-0",
          collapsed ? "px-0 pt-5 pb-2 flex justify-center" : "px-4 pt-5 pb-4"
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
            collapsed ? "justify-center px-0" : ""
          )}
        >
          <BrandMark className="h-9 w-9" />
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold tracking-tight text-white truncate">
                {brandName}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">
                {sub}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav – no top border, continuous with branding */}
      <nav
        className={cn(
          "flex-1 flex flex-col py-2",
          collapsed ? "px-3" : "px-4"
        )}
      >
        {filteredNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-white/15 text-white" : "text-slate-400"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {!collapsed && (
                <span className="font-medium truncate">{item.title}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: collapse + user – subtle divider (slate-800, not white) */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-800",
          collapsed ? "p-2 space-y-2" : "p-3 space-y-2"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 rounded-lg w-full text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
            collapsed ? "h-9 justify-center p-0" : "px-3 py-2"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>

        {/* User block */}
        <div className={cn(collapsed ? "flex justify-center" : "")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full rounded-lg text-slate-300 hover:bg-white/5 hover:text-white h-auto p-0 border-0",
                  collapsed ? "flex justify-center px-0 py-2" : "px-3 py-2.5"
                )}
              >
                <div className={cn("flex items-center gap-3 w-full", collapsed && "justify-center")}>
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-slate-600">
                    <AvatarFallback className="bg-white/10 text-white text-sm font-medium">
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                    </>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={collapsed ? "center" : "start"}
              side="right"
              className="w-56"
            >
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
    </aside>
  );
}
