/**
 * Where the shared inventory screens live for each dashboard role, and what
 * each role may do there. The API enforces the same rules; this only decides
 * which links and buttons to show.
 */
export const INVENTORY_ROLE_CONFIG = {
  ADMIN: {
    stockHref: "/dashboard/admin/materials",
    movementsHref: "/dashboard/admin/inventory",
    receiveHref: "/dashboard/admin/inventory/receive",
    materialHref: (id) => `/dashboard/admin/materials/${id}`,
    receiptHref: (id) => `/dashboard/admin/inventory/receipts/${id}`,
    canSeeCost: true,
    canCorrect: true, // edit/delete receipts, adjust stock, edit/delete unused catalog materials
  },
  MANAGER: {
    stockHref: "/dashboard/manager/inventory",
    movementsHref: "/dashboard/manager/inventory?tab=movements",
    receiveHref: "/dashboard/manager/inventory/receive",
    materialHref: (id) => `/dashboard/manager/inventory/materials/${id}`,
    receiptHref: (id) => `/dashboard/manager/inventory/receipts/${id}`,
    canSeeCost: true,
    canCorrect: true,
  },
  WAREHOUSE: {
    stockHref: "/dashboard/warehouse/inventory",
    movementsHref: "/dashboard/warehouse/inventory?tab=movements",
    receiveHref: "/dashboard/warehouse/inventory/receive",
    materialHref: (id) => `/dashboard/warehouse/inventory/materials/${id}`,
    receiptHref: null,
    canSeeCost: false,
    canCorrect: false,
  },
};

export function inventoryConfigFor(role) {
  const config = INVENTORY_ROLE_CONFIG[role];
  if (!config) throw new Error(`No inventory screens for role ${role}`);
  return config;
}
