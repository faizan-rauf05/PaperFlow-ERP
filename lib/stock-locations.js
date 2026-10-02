/** Where stock is physically kept. Client-safe (see lib/services/stock.service.js for the ledger). */
export const STOCK_LOCATIONS = ["WAREHOUSE", "FACTORY"];

export const STOCK_LOCATION_LABELS = {
  WAREHOUSE: "Warehouse",
  FACTORY: "Factory",
};

export const STOCK_LOCATION_OPTIONS = STOCK_LOCATIONS.map((value) => ({
  value,
  label: STOCK_LOCATION_LABELS[value],
}));

export const MOVEMENT_TYPE_LABELS = {
  RECEIPT: "Received",
  ISSUE: "Used in production",
  RESTOCK: "Production leftover",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
};

/**
 * One colour per location, used everywhere stock is shown (cards, badges,
 * column headers) so Warehouse vs Factory reads at a glance. Literal class
 * strings so Tailwind picks them up.
 */
export const LOCATION_STYLE = {
  WAREHOUSE: {
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    accent: "border-l-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  FACTORY: {
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    accent: "border-l-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
};

/** One colour per movement type in the history. */
export const MOVEMENT_TYPE_STYLE = {
  RECEIPT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ISSUE: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  RESTOCK: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  TRANSFER: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ADJUSTMENT: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

/** An empty per-location stock record. */
export const emptyStock = () => ({ WAREHOUSE: 0, FACTORY: 0, total: 0 });
