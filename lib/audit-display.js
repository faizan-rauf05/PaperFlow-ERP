import { ACTIONS } from "@/lib/audit-actions";

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: ACTIONS.USER_LOGIN, label: "Sign in" },
  { value: ACTIONS.USER_CREATED, label: "User created" },
  { value: ACTIONS.USER_UPDATED, label: "User updated" },
  { value: ACTIONS.USER_ACTIVATED, label: "User activated" },
  { value: ACTIONS.USER_DEACTIVATED, label: "User deactivated" },
  { value: ACTIONS.USER_DELETED, label: "User deleted" },
  { value: ACTIONS.ROLE_CHANGED, label: "Role changed" },
  { value: ACTIONS.PASSWORD_RESET_REQUESTED, label: "Password reset requested" },
  { value: ACTIONS.PASSWORD_RESET_COMPLETED, label: "Password reset completed" },
];

export const ACTION_META = {
  [ACTIONS.USER_LOGIN]: {
    label: "Sign in",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  [ACTIONS.USER_CREATED]: {
    label: "User created",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  [ACTIONS.USER_UPDATED]: {
    label: "User updated",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  [ACTIONS.USER_ACTIVATED]: {
    label: "Activated",
    className: "bg-primary/15 text-primary",
  },
  [ACTIONS.USER_DEACTIVATED]: {
    label: "Deactivated",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  [ACTIONS.USER_DELETED]: {
    label: "User deleted",
    className: "bg-destructive/15 text-destructive",
  },
  [ACTIONS.ROLE_CHANGED]: {
    label: "Role changed",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  [ACTIONS.PASSWORD_RESET_REQUESTED]: {
    label: "Reset link sent",
    className: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  },
  [ACTIONS.PASSWORD_RESET_COMPLETED]: {
    label: "Password set",
    className: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
};

function formatFieldValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatChanges(oldValue, newValue) {
  if (!oldValue && !newValue) return [];

  const keys = new Set([
    ...Object.keys(oldValue || {}),
    ...Object.keys(newValue || {}),
  ]);

  const lines = [];
  for (const key of keys) {
    const before = oldValue?.[key];
    const after = newValue?.[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase());
    lines.push({
      label,
      before: formatFieldValue(before),
      after: formatFieldValue(after),
    });
  }
  return lines;
}

/** Human-readable summary for the activity feed. */
export function formatAuditMessage(log) {
  const actor = log.userName || "System";

  switch (log.action) {
    case ACTIONS.USER_LOGIN:
      return `${actor} signed in to the system`;
    case ACTIONS.USER_CREATED: {
      const name = log.newValue?.name;
      const email = log.newValue?.email;
      const role = log.newValue?.role;
      const parts = [];
      if (name) parts.push(name);
      if (email) parts.push(`<${email}>`);
      const who = parts.length ? parts.join(" ") : "a new user";
      return `${actor} created ${who}${role ? ` as ${role}` : ""}`;
    }
    case ACTIONS.USER_UPDATED:
      return `${actor} updated user record`;
    case ACTIONS.USER_ACTIVATED:
      return `${actor} reactivated a user account`;
    case ACTIONS.USER_DEACTIVATED:
      return `${actor} deactivated a user account`;
    case ACTIONS.USER_DELETED: {
      const name = log.oldValue?.name || log.oldValue?.email;
      return `${actor} permanently deleted${name ? ` ${name}` : " a user account"}`;
    }
    case ACTIONS.ROLE_CHANGED: {
      const from = log.oldValue?.role;
      const to = log.newValue?.role;
      if (from && to) return `${actor} changed role from ${from} to ${to}`;
      return `${actor} changed a user's role`;
    }
    case ACTIONS.PASSWORD_RESET_REQUESTED:
      return `${actor} generated a password setup link`;
    case ACTIONS.PASSWORD_RESET_COMPLETED:
      return `Password was set successfully`;
    default:
      return `${actor} performed ${log.action.replace(/_/g, " ").toLowerCase()} on ${log.model}`;
  }
}

export function getActionMeta(action) {
  return (
    ACTION_META[action] || {
      label: action.replace(/_/g, " "),
      className: "bg-muted text-muted-foreground",
    }
  );
}

export function getAuditChanges(log) {
  return formatChanges(log.oldValue, log.newValue);
}

export function getModelLabel(model) {
  const labels = { User: "User account" };
  return labels[model] || model;
}
