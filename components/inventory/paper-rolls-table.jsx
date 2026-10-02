"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAPER_COLORS, PAPER_TYPES } from "@/lib/material-constants";
import { enteredPriceLabel, formatQuantity, stockGroupLabel } from "@/lib/material-catalog";
import { CostPerUnit, SortableHeader, StockRowMenu, nextSort } from "./table-parts";
import { LocationLabel, StockQuantity } from "./stock-figures";

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value;

/** Full = untouched since received; partly used; or empty (nothing left anywhere). */
function rollStatus(roll) {
  const left = roll.stock.total;
  if (left <= 0) return "EMPTY";
  return left >= Number(roll.paperLengthM) - 0.01 ? "FULL" : "PARTIAL";
}

const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "FULL", label: "Full rolls" },
  { value: "PARTIAL", label: "Partly used" },
  { value: "EMPTY", label: "Used up" },
  { value: "ALL", label: "All rolls" },
];

const LOCATION_OPTIONS = [
  { value: "ALL", label: "Any location" },
  { value: "WAREHOUSE", label: "In warehouse" },
  { value: "FACTORY", label: "In factory" },
];

const SORT_VALUE = {
  barCode: (r) => r.barCode || "",
  paper: (r) => `${r.paperType} ${r.paperColor}`,
  width: (r) => Number(r.paperWidthCm),
  supplier: (r) => r.supplier?.name || "",
  received: (r) => new Date(r.lastReceivedAt || r.createdAt).getTime(),
  warehouse: (r) => r.stock.WAREHOUSE,
  factory: (r) => r.stock.FACTORY,
  total: (r) => r.stock.total,
  cost: (r) => Number(r.averageCostKwd ?? -1),
};

/** Default FIFO order: narrowest width first, and within a width the oldest roll first (the order rolls should be used). */
function fifoCompare(a, b) {
  return SORT_VALUE.width(a) - SORT_VALUE.width(b) || SORT_VALUE.received(a) - SORT_VALUE.received(b);
}

function FilterSelect({ value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full sm:w-auto sm:min-w-32", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const EMPTY_FILTERS = { search: "", group: null, paperType: "ALL", paperColor: "ALL", width: "ALL", gsm: "ALL", supplier: "ALL", location: "ALL", status: "IN_STOCK" };

/**
 * Paper rolls, one row per physical roll, with filters for every spec, a
 * per-spec summary strip, FIFO default order, click-to-sort columns, and
 * multi-select to move rolls between the warehouse and the factory.
 */
export function PaperRollsTable({ rolls, loading, config, onOpen, onMove, onAdjust }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: null, dir: "asc" }); // key null = FIFO
  const [selected, setSelected] = useState(() => new Set());
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const options = useMemo(() => {
    const uniq = (values) => [...new Set(values)].sort((a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b))));
    return {
      width: uniq(rolls.map((r) => Number(r.paperWidthCm))),
      gsm: uniq(rolls.map((r) => Number(r.gsm))),
      supplier: uniq(rolls.map((r) => r.supplier?.name).filter(Boolean)),
    };
  }, [rolls]);

  // Every filter except the spec group — the summary strip shows what each group would add up to.
  const baseFiltered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rolls.filter((r) => {
      if (q && ![r.barCode, r.supplier?.name].some((v) => v?.toLowerCase().includes(q))) return false;
      if (filters.paperType !== "ALL" && r.paperType !== filters.paperType) return false;
      if (filters.paperColor !== "ALL" && r.paperColor !== filters.paperColor) return false;
      if (filters.width !== "ALL" && Number(r.paperWidthCm) !== Number(filters.width)) return false;
      if (filters.gsm !== "ALL" && Number(r.gsm) !== Number(filters.gsm)) return false;
      if (filters.supplier !== "ALL" && r.supplier?.name !== filters.supplier) return false;
      if (filters.location !== "ALL" && !(r.stock[filters.location] > 0)) return false;
      const status = rollStatus(r);
      if (filters.status === "IN_STOCK" && status === "EMPTY") return false;
      if (["FULL", "PARTIAL", "EMPTY"].includes(filters.status) && status !== filters.status) return false;
      return true;
    });
  }, [rolls, filters]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of baseFiltered) {
      const g = map.get(r.stockGroup) || { key: r.stockGroup, count: 0, meters: 0, width: Number(r.paperWidthCm) };
      g.count += 1;
      g.meters += r.stock.total;
      map.set(r.stockGroup, g);
    }
    return [...map.values()].sort((a, b) => a.width - b.width || a.key.localeCompare(b.key));
  }, [baseFiltered]);

  const visible = useMemo(() => {
    const list = filters.group ? baseFiltered.filter((r) => r.stockGroup === filters.group) : [...baseFiltered];
    if (!sort.key) return list.sort(fifoCompare);
    const value = SORT_VALUE[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return cmp * dir || fifoCompare(a, b);
    });
  }, [baseFiltered, filters.group, sort]);

  const selectedRolls = rolls.filter((r) => selected.has(r.id));
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const header = (label, key, align) => (
    <SortableHeader label={label} sortKey={key} sort={sort} onSort={(k) => setSort((s) => nextSort(s, k))} align={align} />
  );
  const colCount = config.canSeeCost ? 12 : 10;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Barcode or supplier…" className="pl-9" />
        </div>
        <FilterSelect value={filters.paperType} onChange={(v) => setFilter("paperType", v)} options={[{ value: "ALL", label: "Any type" }, ...PAPER_TYPES]} />
        <FilterSelect value={filters.paperColor} onChange={(v) => setFilter("paperColor", v)} options={[{ value: "ALL", label: "Any color" }, ...PAPER_COLORS]} />
        <FilterSelect value={String(filters.width)} onChange={(v) => setFilter("width", v)} options={[{ value: "ALL", label: "Any width" }, ...options.width.map((w) => ({ value: w, label: `${w} cm` }))]} />
        <FilterSelect value={String(filters.gsm)} onChange={(v) => setFilter("gsm", v)} options={[{ value: "ALL", label: "Any GSM" }, ...options.gsm.map((g) => ({ value: g, label: `${g} gsm` }))]} />
        <FilterSelect value={filters.supplier} onChange={(v) => setFilter("supplier", v)} options={[{ value: "ALL", label: "Any supplier" }, ...options.supplier.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect value={filters.location} onChange={(v) => setFilter("location", v)} options={LOCATION_OPTIONS} />
        <FilterSelect value={filters.status} onChange={(v) => setFilter("status", v)} options={STATUS_OPTIONS} />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const active = filters.group === g.key;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setFilter("group", active ? null : g.key)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-left text-xs transition-colors",
                  active ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/50",
                )}
              >
                <span className="font-semibold">{stockGroupLabel(g.key)}</span>
                <span className="ml-2 text-muted-foreground">
                  {g.count} roll{g.count === 1 ? "" : "s"} · {formatQuantity(g.meters, "METER")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} roll{selected.size === 1 ? "" : "s"} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onMove(selectedRolls, "WAREHOUSE", () => setSelected(new Set()))}>
              <ArrowLeftRight className="h-4 w-4" /> Move to factory
            </Button>
            <Button size="sm" variant="secondary" className="border" onClick={() => onMove(selectedRolls, "FACTORY", () => setSelected(new Set()))}>
              <ArrowLeftRight className="h-4 w-4" /> Return to warehouse
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">
          <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all shown rolls" />
              </th>
              {header("Barcode", "barCode")}
              {header("Paper", "paper")}
              {header("Width · GSM", "width", "right")}
              {header("Supplier", "supplier")}
              {header("Received", "received")}
              {header(<LocationLabel location="WAREHOUSE" />, "warehouse", "right")}
              {header(<LocationLabel location="FACTORY" />, "factory", "right")}
              {header("Remaining", "total", "right")}
              {config.canSeeCost && <th className="py-2.5 text-right">Price entered</th>}
              {config.canSeeCost && header("Avg. cost", "cost", "right")}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-10 text-center text-muted-foreground">
                  {rolls.length === 0 ? "No paper rolls yet — receive one to get started." : "No rolls match these filters."}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const status = rollStatus(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => onOpen(r)}
                    className={cn("cursor-pointer border-b last:border-b-0 hover:bg-muted/30", selected.has(r.id) && "bg-primary/5")}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select roll ${r.barCode}`} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.barCode}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {labelOf(PAPER_TYPES, r.paperType)} · {labelOf(PAPER_COLORS, r.paperColor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {Number(r.paperWidthCm)} cm
                      <p className="text-[11px] text-muted-foreground">{r.gsm} gsm</p>
                    </td>
                    <td className="max-w-36 truncate px-4 py-2" title={r.supplier?.name}>{r.supplier?.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {new Date(r.lastReceivedAt || r.createdAt).toLocaleDateString()}
                      {r.parentRollId && <p className="text-[11px]">Recycled</p>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StockQuantity quantity={r.stock.WAREHOUSE} unit={r.unit} muted />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StockQuantity quantity={r.stock.FACTORY} unit={r.unit} muted />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StockQuantity quantity={r.stock.total} unit={r.unit} />
                      <p className="text-[11px] text-muted-foreground">
                        {status === "FULL" ? "Full roll" : status === "EMPTY" ? "Used up" : `of ${formatQuantity(r.paperLengthM, "METER")}`}
                      </p>
                    </td>
                    {config.canSeeCost && (
                      <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs tabular-nums">
                        {enteredPriceLabel(r.lastPriceEntered, r.materialType, r.unit)}
                      </td>
                    )}
                    {config.canSeeCost && (
                      <td className="px-4 py-2 text-right text-xs">
                        <CostPerUnit amount={r.averageCostKwd} unit={r.unit} />
                      </td>
                    )}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <StockRowMenu material={r} config={config} onMove={(m) => onMove([m])} onAdjust={onAdjust} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && visible.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {visible.length} roll{visible.length === 1 ? "" : "s"} · {formatQuantity(visible.reduce((s, r) => s + r.stock.total, 0), "METER")} remaining
          {!sort.key && " · oldest first within each width (use order)"}
        </p>
      )}
    </div>
  );
}
