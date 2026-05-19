const ROLE_DASHBOARDS = {
  ADMIN: "/dashboard/admin",
  MANAGER: "/dashboard/manager",
  WORKER: "/dashboard/worker",
  SALES: "/dashboard/sales",
  FINANCE: "/dashboard/finance",
};

export function isRouteAllowedForRole(role, pathname) {
  const rules = {
    ADMIN: [
      "/dashboard/admin",
      "/api/users",
      "/api/audit-logs",
    ],
    MANAGER: [
      "/dashboard/manager",
      "/dashboard/production",
      "/api/production",
      "/api/inventory",
      "/api/machines",
      "/api/qc",
      "/api/attendance",
      "/api/visits",
      "/api/kpi",
    ],
    WORKER: [
      "/dashboard/worker",
      "/api/production",      // narrowed to own orders inside handler
      "/api/attendance",      // narrowed to own records inside handler
      "/api/machines/downtime",
      "/api/qc",              // workers submit QC per stage
    ],
    SALES: [
      "/dashboard/sales",
      "/api/customers",
      "/api/quotations",
      "/api/sales-orders",    // method check (GET only) enforced in handler
      "/api/visits",
    ],
    FINANCE: [
      "/dashboard/finance",
      "/api/invoices",
      "/api/costing",
      "/api/sales-orders",    // read only — enforced in handler
    ],
  };

  // Unknown role → deny (safe fallback)
  const prefixes = rules[role] || [];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export function getRoleDashboard(role) {
  return ROLE_DASHBOARDS[role] || "/login";
}

export { ROLE_DASHBOARDS };