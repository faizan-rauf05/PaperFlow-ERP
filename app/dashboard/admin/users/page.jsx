"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Key,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import {
  RESET_LINK_EXPIRY_LABEL,
  ROLE_BADGE_CLASS,
  ROLE_OPTIONS,
  getRoleLabel,
} from "@/lib/user-constants";
import { userCreateSchema, userEditSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

const emptyForm = { name: "", email: "", role: "WORKER", isActive: true };

function getConfirmConfig(type, user) {
  switch (type) {
    case "toggle":
      return {
        title: user.isActive ? "Deactivate user?" : "Activate user?",
        description: user.isActive
          ? `${user.name} will no longer be able to sign in until reactivated.`
          : `${user.name} will be able to sign in again.`,
        actionLabel: user.isActive ? "Deactivate" : "Activate",
        destructive: user.isActive,
      };
    case "reset":
      return {
        title: "Send password reset link?",
        description: `A new setup link will be generated for ${user.name} (${user.email}). It expires in ${RESET_LINK_EXPIRY_LABEL}.`,
        actionLabel: "Send reset link",
        destructive: false,
      };
    case "delete":
      return {
        title: "Delete user?",
        description: `Permanently delete ${user.name} (${user.email})? This action cannot be undone.`,
        actionLabel: "Delete user",
        destructive: true,
      };
    default:
      return null;
  }
}

function RoleSelect({ value, onValueChange, id = "role", hasError }) {
  const selected = ROLE_OPTIONS.find((r) => r.value === value);

  return (
    <div className="space-y-3 min-w-0">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={cn("w-full", hasError && "border-destructive")}>
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(20rem,70vh)] w-(--radix-select-trigger-width)">
          {ROLE_OPTIONS.map((role) => (
            <SelectItem
              key={role.value}
              value={role.value}
              textValue={role.label}
              className="py-2.5"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    ROLE_BADGE_CLASS[role.value],
                  )}
                >
                  {role.label}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {role.description}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Role preview
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
                ROLE_BADGE_CLASS[selected.value],
              )}
            >
              {selected.label}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {selected.value}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {selected.description}
          </p>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchUsers = useCallback(async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const params = search ? { search } : {};
      const { data } = await api.get("/users", { params });
      setUsers(data.users || []);
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to load users");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    api
      .get("/auth/session")
      .then(({ data }) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => {});
  }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchUsers]);

  function patchFormData(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => clearFieldError(prev, field));
  }

  const openAddModal = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setFormErrors({});
    setInviteLink(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setFormErrors({});
    setInviteLink(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const schema = editingUser ? userEditSchema : userCreateSchema;
    const result = validateForm(schema, formData);
    if (!result.success) {
      setFormErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingUser) {
        const { data } = await api.put(`/users/${editingUser.id}`, result.data);
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data.user : u)),
        );
        setIsModalOpen(false);
        toast.success("User updated", {
          description: `${data.user.name} is now ${getRoleLabel(data.user.role)}.`,
        });
      } else {
        const { data } = await api.post("/users", result.data);
        setUsers((prev) => [data.user, ...prev]);
        setInviteLink(data.inviteLink || null);
        toast.success("User created", {
          description: `Invite link generated (expires in ${RESET_LINK_EXPIRY_LABEL}).`,
        });
      }
      await fetchUsers(searchQuery.trim());
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to save user");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const { data } = await api.put(`/users/${user.id}`, {
      isActive: !user.isActive,
    });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
  };

  const handleResetPassword = async (user) => {
    const { data } = await api.post(`/users/${user.id}/reset-password`);
    setInviteLink(data.resetLink || null);
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user) => {
    await api.delete(`/users/${user.id}`);
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    await fetchUsers(searchQuery.trim());
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmLoading(true);
    setError("");
    try {
      if (type === "toggle") {
        await toggleUserStatus(user);
        toast.success(user.isActive ? "User deactivated" : "User activated", {
          description: user.name,
        });
      } else if (type === "reset") {
        await handleResetPassword(user);
        toast.success("Password reset link generated", {
          description: `Link expires in ${RESET_LINK_EXPIRY_LABEL}.`,
        });
      } else if (type === "delete") {
        await handleDeleteUser(user);
        toast.success("User deleted", { description: user.name });
      }
      setConfirmAction(null);
    } catch (err) {
      const message = getApiErrorMessage(err, "Action failed");
      setError(message);
      toast.error(message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmConfig = confirmAction
    ? getConfirmConfig(confirmAction.type, confirmAction.user)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage factory accounts and access roles
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="dashboard-panel p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="auth-input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            ROLE_BADGE_CLASS[user.role] ||
                              "bg-muted text-foreground",
                          )}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            user.isActive
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(user.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isSelf}
                            onClick={() =>
                              setConfirmAction({ type: "toggle", user })
                            }
                            title={
                              isSelf
                                ? "You cannot change your own status"
                                : user.isActive
                                  ? "Deactivate"
                                  : "Activate"
                            }
                          >
                            {user.isActive ? (
                              <ToggleRight className="h-4 w-4 text-primary" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setConfirmAction({ type: "reset", user })
                            }
                            title="Reset password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isSelf}
                            onClick={() =>
                              setConfirmAction({ type: "delete", user })
                            }
                            title={
                              isSelf
                                ? "You cannot delete your own account"
                                : "Delete user"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && users.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No users found.
          </p>
        )}
      </div>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !confirmLoading) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmLoading}
              className={cn(
                confirmConfig?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {confirmLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                confirmConfig?.actionLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setInviteLink(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[464px] w-full">
          <DialogHeader>
            <DialogTitle>
              {inviteLink
                ? editingUser
                  ? "Password reset link"
                  : "User created"
                : editingUser
                  ? "Edit user"
                  : "Add new user"}
            </DialogTitle>
            {inviteLink && (
              <DialogDescription>
                Share this link so they can set their password (expires in{" "}
                {RESET_LINK_EXPIRY_LABEL}).
              </DialogDescription>
            )}
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyInviteLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsModalOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-2 min-w-0">
                <FormField label="Full name" required error={formErrors.name}>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => patchFormData("name", e.target.value)}
                    className={fieldClassName("w-full", !!formErrors.name)}
                  />
                </FormField>
                <FormField label="Email" required error={formErrors.email}>
                  <Input
                    id="email"
                    type="email"
                    disabled={Boolean(editingUser)}
                    value={formData.email}
                    onChange={(e) => patchFormData("email", e.target.value)}
                    className={fieldClassName("", !!formErrors.email)}
                  />
                </FormField>
                <FormField label="Role" required error={formErrors.role}>
                  <RoleSelect
                    id="role"
                    value={formData.role}
                    hasError={!!formErrors.role}
                    onValueChange={(value) => patchFormData("role", value)}
                  />
                </FormField>
                {editingUser && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="status">Active</Label>
                    <Switch
                      id="status"
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isActive: checked })
                      }
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
