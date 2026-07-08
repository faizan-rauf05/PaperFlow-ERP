const ROLE_DASHBOARDS = {
  ADMIN: "/dashboard/admin",
  MANAGER: "/dashboard/manager",
  WORKER: "/dashboard/worker",
  SALES: "/dashboard/sales",
  FINANCE: "/dashboard/finance",
};

const M2_ADMIN_PREFIXES = [
  "/dashboard/admin",
  "/api/users",
  "/api/audit-logs",
  "/api/materials",
  "/api/rolls",
  "/api/inventory",
  "/api/machines",
  "/api/production",
  "/api/bag-specs",
  "/api/defect-types",
  "/api/defect-categories",
  "/api/uploads",
  "/api/units",
  "/api/kpi",
];

const M2_MANAGER_PREFIXES = [
  "/dashboard/manager",
  "/api/production",
  "/api/inventory",
  "/api/materials",
  "/api/rolls",
  "/api/machines",
  "/api/bag-specs",
  "/api/defect-types",
  "/api/uploads",
  "/api/units",
];

const M2_WORKER_PREFIXES = [
  "/dashboard/worker",
  "/api/production",
  "/api/rolls",
  "/api/machines",
  "/api/defect-types",
  "/api/uploads",
  "/api/units",
];

export function isRouteAllowedForRole(role, pathname) {
  const rules = {
    ADMIN: M2_ADMIN_PREFIXES,
    MANAGER: M2_MANAGER_PREFIXES,
    WORKER: M2_WORKER_PREFIXES,
    SALES: [
      "/dashboard/sales",
      "/api/customers",
      "/api/quotations",
      "/api/sales-orders",
      "/api/visits",
    ],
    FINANCE: [
      "/dashboard/finance",
      "/api/invoices",
      "/api/costing",
      "/api/sales-orders",
    ],
  };

  const prefixes = rules[role] || [];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export function getRoleDashboard(role) {
  return ROLE_DASHBOARDS[role] || "/login";
}

export { ROLE_DASHBOARDS };
