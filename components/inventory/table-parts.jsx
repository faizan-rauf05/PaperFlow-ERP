"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowLeftRight, Eye, MoreHorizontal, PackagePlus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { UNIT_SINGULAR } from "@/lib/material-catalog";
import { formatKwd } from "./stock-figures";

/** Click-to-sort column header: first click sorts ascending, second descending. */
export function SortableHeader({ label, sortKey, sort, onSort, align = "left", className }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-2.5", align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

/** Next sort state for a header click. */
export function nextSort(sort, key) {
  return sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

/** "1.6667 KWD/kg" — a cost is meaningless without the unit it's per. */
export function CostPerUnit({ amount, unit }) {
  if (amount == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap font-mono tabular-nums">
      {formatKwd(amount, 4)}
      <span className="text-muted-foreground">/{UNIT_SINGULAR[unit] || unit}</span>
    </span>
  );
}

/**
 * Per-row actions (⋯): Open, Receive more (catalog materials), Move between
 * locations, and Adjust stock (roles that can correct stock).
 */
export function StockRowMenu({ material, config, onMove, onAdjust }) {
  const isPaper = material.materialType === "PAPER_ROLL";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={config.materialHref(material.id)}>
            <Eye className="h-4 w-4" /> Open
          </Link>
        </DropdownMenuItem>
        {!isPaper && (
          <DropdownMenuItem asChild>
            <Link href={`${config.receiveHref}?type=${material.materialType}&materialId=${material.id}`}>
              <PackagePlus className="h-4 w-4" /> Receive more
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onMove(material)}>
          <ArrowLeftRight className="h-4 w-4" /> Move stock
        </DropdownMenuItem>
        {config.canCorrect && (
          <DropdownMenuItem onSelect={() => onAdjust(material)}>
            <SlidersHorizontal className="h-4 w-4" /> Adjust stock
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
