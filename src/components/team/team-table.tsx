"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, MoreHorizontal, UserPlus, Loader2, ShieldCheck, UserX, UserCheck, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface TeamUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: { projectMemberships: number };
}

interface TeamTableProps {
  users: TeamUser[];
  currentUserId: string;
  currentUserRole: string;
}

const roleOptions = [
  { value: "REVIEWER", label: "Reviewer" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "ADMIN", label: "Admin" },
  { value: "OWNER", label: "Owner" },
];

const roleLabel = (role: string) =>
  roleOptions.find((r) => r.value === role)?.label ??
  role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function TeamTable({ users: initialUsers, currentUserId, currentUserRole }: TeamTableProps) {
  const [users, setUsers] = useState<TeamUser[]>(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "REVIEWER",
    password: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const inviteUser = async () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "Required";
    if (!form.lastName.trim()) errors.lastName = "Required";
    if (!form.email.trim()) errors.email = "Required";
    if (!form.password || form.password.length < 8) errors.password = "Min 8 characters";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create user");
      }

      const { user } = await res.json();
      setUsers((prev) => [{ ...user, lastLoginAt: null }, ...prev]);
      setInviteOpen(false);
      setForm({ firstName: "", lastName: "", email: "", role: "REVIEWER", password: "" });
      setFormErrors({});
      toast.success(`${user.firstName} ${user.lastName} has been added to the team`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to change role");
      }

      const { user } = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: user.role } : u)));
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setChangingRole(null);
    }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (!confirm(`Delete ${name}? This will permanently remove their account.`)) return;
    setTogglingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete user");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(`${name} has been removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setTogglingId(null);
    }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    setTogglingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
      );
      toast.success(currentActive ? "User deactivated" : "User activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No team members yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                  {user.id === currentUserId && (
                    <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </span>
                </TableCell>
                <TableCell>
                  {canManage && user.id !== currentUserId ? (
                    <Select
                      value={user.role}
                      onValueChange={(v) => changeRole(user.id, v)}
                      disabled={changingRole === user.id}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        {changingRole === user.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.value === "OWNER" && currentUserRole !== "OWNER"}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{roleLabel(user.role)}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user._count.projectMemberships}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </TableCell>
                {canManage && (
                  <TableCell>
                    {user.id !== currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {togglingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toggleActive(user.id, user.isActive)}
                          >
                            {user.isActive ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Reactivate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteUser(user.id, `${user.firstName} ${user.lastName}`)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Team Member
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={formErrors.firstName ? "border-destructive" : ""}
                />
                {formErrors.firstName && (
                  <p className="text-destructive text-xs mt-1">{formErrors.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className={formErrors.lastName ? "border-destructive" : ""}
                />
                {formErrors.lastName && (
                  <p className="text-destructive text-xs mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={formErrors.email ? "border-destructive" : ""}
              />
              {formErrors.email && (
                <p className="text-destructive text-xs mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.value === "OWNER" && currentUserRole !== "OWNER"}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="password">Temporary password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className={formErrors.password ? "border-destructive" : ""}
              />
              {formErrors.password && (
                <p className="text-destructive text-xs mt-1">{formErrors.password}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The user will log in with this password and should change it in their settings.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={inviteUser} disabled={inviting}>
              {inviting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
