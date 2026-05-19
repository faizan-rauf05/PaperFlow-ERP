export const RESET_LINK_EXPIRY_MINUTES = 30;
export const RESET_LINK_EXPIRY_LABEL = `${RESET_LINK_EXPIRY_MINUTES} minutes`;

export const ROLE_OPTIONS = [
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full access — users, settings, and all modules",
  },
  {
    value: "MANAGER",
    label: "Manager",
    description: "Production oversight, orders, and team coordination",
  },
  {
    value: "WORKER",
    label: "Worker",
    description: "Shop floor tasks, production logging, and assignments",
  },
  {
    value: "SALES",
    label: "Sales",
    description: "Customer orders, quotes, and sales pipeline",
  },
  {
    value: "FINANCE",
    label: "Finance",
    description: "Invoicing, payments, and financial reports",
  },
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
