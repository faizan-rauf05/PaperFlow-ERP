/**
 * Material cost figures are Admin/Manager-only. Workers and warehouse staff
 * see materials, stock and receipts without any cost/price fields (warehouse
 * enters a delivery's price when receiving it, but doesn't browse costs).
 */
const COST_HIDDEN_ROLES = ["WORKER", "WAREHOUSE", "SALES", "FINANCE"];

export function canSeeCost(role) {
  return !COST_HIDDEN_ROLES.includes(role);
}

export function withoutMaterialCost(material) {
  if (!material) return material;
  const { averageCostKwd, lastPriceEntered, ...rest } = material;
  return rest;
}

/** An order with its lines' suggested-material costs (and the materials' cost) removed. */
export function withoutOrderMaterialCost(order) {
  if (!order?.lines) return order;
  return {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      suggestedMaterials: (line.suggestedMaterials || []).map(({ suggestedCost, material, ...rest }) => ({
        ...rest,
        material: withoutMaterialCost(material),
      })),
    })),
  };
}

export function withoutReceiptCost(receipt) {
  if (!receipt) return receipt;
  const { costAmount, costCurrency, costEntryBasis, exchangeRate, rateDate, unitCostKwd, totalCostKwd, ...rest } = receipt;
  return { ...rest, material: withoutMaterialCost(rest.material) };
}
