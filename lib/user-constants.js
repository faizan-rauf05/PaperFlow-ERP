export const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "WORKER", label: "Worker" },
  { value: "SALES", label: "Sales" },
  { value: "FINANCE", label: "Finance" },
];

export const ROLE_BADGE_CLASS = {
  ADMIN: "bg-primary text-primary-foreground",
  MANAGER: "bg-blue-500/90 text-white",
  WORKER: "bg-teal-500/90 text-white",
  SALES: "bg-amber-500/90 text-white",
  FINANCE: "bg-violet-500/90 text-white",
};

export function getRoleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}
