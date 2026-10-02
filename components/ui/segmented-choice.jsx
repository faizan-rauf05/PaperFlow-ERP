"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented choice between a few options (e.g. Warehouse / Factory) — a
 * radio group styled as a toggle; the selected option uses the primary colour.
 * Same height as inputs so it lines up in form grids.
 */
export function SegmentedChoice({ options, value, onChange, className }) {
  return (
    <div role="radiogroup" className={cn("inline-flex h-9 items-stretch rounded-md border bg-muted/40 p-0.5", className)}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
