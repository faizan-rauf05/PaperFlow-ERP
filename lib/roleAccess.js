const ROLE_DASHBOARDS = {
  ADMIN: "/dashboard/admin",
  MANAGER: "/dashboard/manager",
  WORKER: "/dashboard/worker",
  SALES: "/dashboard/sales",
  FINANCE: "/dashboard/finance",
  WAREHOUSE: "/dashboard/warehouse",
};

const M2_ADMIN_PREFIXES = [
  "/dashboard/admin",
  "/api/users",
  "/api/audit-logs",
  "/api/materials",
  "/api/customers",
  "/api/suppliers",
  "/api/inventory",
  "/api/machines",
  "/api/production",
  "/api/orders",
  "/api/order-lines",
  "/api/cliches",
  "/api/bag-specs",
  "/api/workers",
  "/api/defect-types",
  "/api/defect-categories",
  "/api/uploads",
  "/api/units",
  "/api/kpi",
  "/api/notifications",
  "/api/exchange-rate",
];

const M2_MANAGER_PREFIXES = [
  "/dashboard/manager",
  "/api/production",
  "/api/orders",
  "/api/order-lines",
  "/api/cliches",
  "/api/users",
  "/api/inventory",
  "/api/materials",
  "/api/customers",
  "/api/suppliers",
  "/api/machines",
  "/api/bag-specs",
  "/api/workers",
  "/api/defect-types",
  "/api/uploads",
  "/api/units",
  "/api/notifications",
  "/api/exchange-rate",
];

const M2_WORKER_PREFIXES = [
  "/dashboard/worker",
  "/api/production",
  "/api/orders",
  "/api/materials",
  "/api/inventory/current-stock",
  "/api/machines",
  "/api/defect-types",
  "/api/uploads",
  "/api/units",
  "/api/notifications",
];

const M2_SALES_PREFIXES = [
  "/dashboard/sales",
  "/api/customers",
  "/api/orders",
  "/api/order-lines",
  "/api/cliches",
  "/api/users",
  "/api/quotations",
  "/api/sales-orders",
  "/api/visits",
  "/api/uploads",
  "/api/units",
  "/api/notifications",
];

const M2_FINANCE_PREFIXES = [
      "/dashboard/finance",
      "/api/invoices",
      "/api/costing",
      "/api/orders",
      "/api/sales-orders",
      "/api/quotations",
      "/api/customers",
      "/api/suppliers",
      "/api/units",
      "/api/notifications",
    ]

const M2_WAREHOUSE_PREFIXES = [
  "/dashboard/warehouse",
  "/api/materials",
  "/api/inventory",
  "/api/suppliers",
  "/api/orders",
  "/api/order-lines",
  "/api/uploads",
  "/api/units",
  "/api/notifications",
];

export function isRouteAllowedForRole(role, pathname) {
  const rules = {
    ADMIN: M2_ADMIN_PREFIXES,
    MANAGER: M2_MANAGER_PREFIXES,
    WORKER: M2_WORKER_PREFIXES,
    SALES: M2_SALES_PREFIXES,
    FINANCE: M2_FINANCE_PREFIXES,
    WAREHOUSE: M2_WAREHOUSE_PREFIXES,
  };

  const prefixes = rules[role] || [];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export function getRoleDashboard(role) {
  return ROLE_DASHBOARDS[role] || "/login";
}

export { ROLE_DASHBOARDS };
