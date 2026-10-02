"use client";

import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/material-catalog";
import { LOCATION_STYLE, STOCK_LOCATION_LABELS } from "@/lib/stock-locations";

/** A stock quantity with its unit; negative stock is shown in red (it means movements were recorded without stock). */
export function StockQuantity({ quantity, unit, className, muted = false }) {
  const n = Number(quantity || 0);
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        n < 0 ? "text-destructive font-semibold" : n === 0 || muted ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {formatQuantity(n, unit)}
    </span>
  );
}

/** "Warehouse" / "Factory" in its location colour. */
export function LocationBadge({ location, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        LOCATION_STYLE[location]?.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", LOCATION_STYLE[location]?.dot)} />
      {STOCK_LOCATION_LABELS[location] || location}
    </span>
  );
}

/** A column header / label with its location's colour dot. */
export function LocationLabel({ location, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", LOCATION_STYLE[location]?.dot)} />
      {children || STOCK_LOCATION_LABELS[location]}
    </span>
  );
}

/** KWD money, 3 decimals for per-unit costs (e.g. 0.155 KWD/m). */
export function formatKwd(amount, decimals = 3) {
  if (amount == null) return "—";
  return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} KWD`;
}
