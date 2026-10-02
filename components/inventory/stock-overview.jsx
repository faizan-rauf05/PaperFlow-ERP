"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { MATERIAL_TYPE_LABELS } from "@/lib/material-constants";
import { CATALOG_MATERIAL_TYPES, stockGroupLabel } from "@/lib/material-catalog";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { PaperRollsTable } from "./paper-rolls-table";
import { LocationLabel, StockQuantity } from "./stock-figures";
import { CostPerUnit, SortableHeader, StockRowMenu, nextSort } from "./table-parts";
import { TransferDialog } from "./transfer-dialog";

const VIEWS = [
  { value: "rolls", label: "Paper Rolls" },
  { value: "other", label: "Other Materials" },
];

function sumStock(materials) {
  return materials.reduce(
    (acc, m) => ({
      WAREHOUSE: acc.WAREHOUSE + m.stock.WAREHOUSE,
      FACTORY: acc.FACTORY + m.stock.FACTORY,
      total: acc.total + m.stock.total,
    }),
    { WAREHOUSE: 0, FACTORY: 0, total: 0 },
  );
}

/** Group cost: each supplier's average weighted by the stock it holds (plain mean when nothing is in stock). */
function groupAverageCost(materials) {
  const priced = materials.filter((m) => m.averageCostKwd != null);
  if (priced.length === 0) return null;
  const stocked = priced.filter((m) => m.stock.total > 0);
  if (stocked.length === 0) return priced.reduce((sum, m) => sum + Number(m.averageCostKwd), 0) / priced.length;
  const qty = stocked.reduce((sum, m) => sum + m.stock.total, 0);
  return stocked.reduce((sum, m) => sum + Number(m.averageCostKwd) * m.stock.total, 0) / qty;
}

/**
 * Stock by material and location, in two views: Paper Rolls (one row per
 * roll, filterable by every spec) and Other Materials (grouped by kind
 * across suppliers). Shared by the Admin, Manager and Warehouse screens.
 */
export function StockOverview({ role, reloadKey = 0 }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = inventoryConfigFor(role);
  const view = searchParams.get("view") === "other" ? "other" : "rolls";

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localReload, setLocalReload] = useState(0);
  const [transfer, setTransfer] = useState({ open: false, materials: [], from: "WAREHOUSE", onDone: null });
  const [adjust, setAdjust] = useState({ open: false, material: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/materials")
      .then(({ data }) => !cancelled && setMaterials(data.materials || []))
      .catch((e) => !cancelled && toast.error(getApiErrorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey, localReload]);

  const rolls = useMemo(() => materials.filter((m) => m.materialType === "PAPER_ROLL"), [materials]);
  const others = useMemo(() => materials.filter((m) => m.materialType !== "PAPER_ROLL"), [materials]);

  function setView(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const openMaterial = (m) => router.push(config.materialHref(m.id));
  // A single row moves from wherever it has stock (warehouse first); a selection uses the chosen direction.
  const openMove = (list, from, onDone) =>
    setTransfer({
      open: true,
      materials: list,
      from: from || (list[0]?.stock.WAREHOUSE > 0 || !(list[0]?.stock.FACTORY > 0) ? "WAREHOUSE" : "FACTORY"),
      onDone,
    });
  const openAdjust = (m) => setAdjust({ open: true, material: m });
  const refresh = () => setLocalReload((k) => k + 1);

  return (
    <div className="space-y-3">
      <SegmentedChoice options={VIEWS} value={view} onChange={setView} />

      {view === "rolls" ? (
        <PaperRollsTable rolls={rolls} loading={loading} config={config} onOpen={openMaterial} onMove={openMove} onAdjust={openAdjust} />
      ) : (
        <OtherMaterialsTable materials={others} loading={loading} config={config} onOpen={openMaterial} onMove={openMove} onAdjust={openAdjust} />
      )}

      <TransferDialog
        open={transfer.open}
        onOpenChange={(open) => setTransfer((prev) => ({ ...prev, open }))}
        materials={transfer.materials}
        defaultFrom={transfer.from}
        onDone={() => {
          transfer.onDone?.();
          refresh();
        }}
      />
      <AdjustStockDialog
        open={adjust.open}
        onOpenChange={(open) => setAdjust((prev) => ({ ...prev, open }))}
        material={adjust.material}
        onDone={refresh}
      />
    </div>
  );
}

const OTHER_SORT_VALUE = {
  name: (x) => x.label,
  warehouse: (x) => x.stock.WAREHOUSE,
  factory: (x) => x.stock.FACTORY,
  total: (x) => x.stock.total,
  cost: (x) => Number(x.cost ?? -1),
};

/** Glue, ink, rope, tape, sponge and cartons — grouped by kind across suppliers. */
function OtherMaterialsTable({ materials, loading, config, onOpen, onMove, onAdjust }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [supplier, setSupplier] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sort, setSort] = useState({ key: null, dir: "asc" }); // key null = type, then name
  const [collapsed, setCollapsed] = useState({});

  const suppliers = useMemo(() => [...new Set(materials.map((m) => m.supplier?.name).filter(Boolean))].sort(), [materials]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = materials.filter(
      (m) =>
        (type === "ALL" || m.materialType === type) &&
        (supplier === "ALL" || m.supplier?.name === supplier) &&
        (location === "ALL" || m.stock[location] > 0) &&
        (!hideEmpty || m.stock.total !== 0) &&
        (!q || [m.name, m.supplier?.name].some((v) => v?.toLowerCase().includes(q))),
    );
    const byGroup = new Map();
    for (const m of visible) {
      if (!byGroup.has(m.stockGroup)) {
        byGroup.set(m.stockGroup, { key: m.stockGroup, label: stockGroupLabel(m.stockGroup), materialType: m.materialType, unit: m.unit, materials: [] });
      }
      byGroup.get(m.stockGroup).materials.push(m);
    }
    const list = [...byGroup.values()].map((g) => ({
      ...g,
      stock: sumStock(g.materials),
      cost: groupAverageCost(g.materials),
      mixedUnits: new Set(g.materials.map((m) => m.unit)).size > 1,
      materials: [...g.materials].sort((a, b) => (a.supplier?.name || "").localeCompare(b.supplier?.name || "")),
    }));
    const byTypeThenName = (a, b) =>
      CATALOG_MATERIAL_TYPES.indexOf(a.materialType) - CATALOG_MATERIAL_TYPES.indexOf(b.materialType) ||
      a.label.localeCompare(b.label, undefined, { numeric: true });
    if (!sort.key) return list.sort(byTypeThenName);
    const value = OTHER_SORT_VALUE[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * dir || byTypeThenName(a, b);
    });
  }, [materials, search, type, supplier, location, hideEmpty, sort]);

  const filtersActive = search || type !== "ALL" || supplier !== "ALL" || location !== "ALL" || !hideEmpty;
  const header = (label, key, align) => (
    <SortableHeader label={label} sortKey={key} sort={sort} onSort={(k) => setSort((s) => nextSort(s, k))} align={align} />
  );
  const columnCount = config.canSeeCost ? 6 : 5;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Material or supplier…" className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any type</SelectItem>
            {CATALOG_MATERIAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {MATERIAL_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any supplier</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any location</SelectItem>
            <SelectItem value="WAREHOUSE">In warehouse</SelectItem>
            <SelectItem value="FACTORY">In factory</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-primary" />
          Hide empty
        </label>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setType("ALL");
              setSupplier("ALL");
              setLocation("ALL");
              setHideEmpty(true);
            }}
          >
            <X className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              {header("Material", "name")}
              {header(<LocationLabel location="WAREHOUSE" />, "warehouse", "right")}
              {header(<LocationLabel location="FACTORY" />, "factory", "right")}
              {header("Total", "total", "right")}
              {config.canSeeCost && header("Avg. cost", "cost", "right")}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columnCount} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="py-10 text-center text-muted-foreground">
                  {materials.length === 0 ? "No materials yet — receive a delivery to get started." : "No materials match these filters."}
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <GroupRows
                  key={g.key}
                  group={g}
                  isCollapsed={collapsed[g.key]}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                  onOpen={onOpen}
                  onMove={onMove}
                  onAdjust={onAdjust}
                  config={config}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ group: g, isCollapsed, onToggle, onOpen, onMove, onAdjust, config }) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  return (
    <>
      {/* Group header: tinted band with a coloured edge, bold totals */}
      <tr
        className="cursor-pointer border-b border-t-2 border-t-border bg-muted/60 hover:bg-muted/80 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-primary"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-semibold">{g.label}</span>
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {MATERIAL_TYPE_LABELS[g.materialType]} · {g.materials.length} supplier{g.materials.length === 1 ? "" : "s"}
            </span>
          </div>
        </td>
        {g.mixedUnits ? (
          <td colSpan={3} className="px-4 py-3 text-right text-xs text-muted-foreground">
            Mixed units — see rows below
          </td>
        ) : (
          ["WAREHOUSE", "FACTORY", "total"].map((loc) => (
            <td key={loc} className="px-4 py-3 text-right font-semibold">
              <StockQuantity quantity={g.stock[loc]} unit={g.unit} />
            </td>
          ))
        )}
        {config.canSeeCost && (
          <td className="px-4 py-3 text-right text-xs font-semibold">
            {g.mixedUnits ? null : <CostPerUnit amount={g.cost} unit={g.unit} />}
          </td>
        )}
        <td />
      </tr>
      {/* Entries: indented under a connector line, lighter text */}
      {!isCollapsed &&
        g.materials.map((m) => (
          <tr key={m.id} className="cursor-pointer border-b text-[13px] last:border-b-0 hover:bg-muted/30" onClick={() => onOpen(m)}>
            <td className="py-2 pr-4 pl-6">
              <div className="flex min-w-0 items-stretch gap-3">
                <span aria-hidden className="w-3 shrink-0 border-b border-l border-muted-foreground/30" style={{ height: "0.9rem" }} />
                <div className="min-w-0">
                  <p className="truncate">{m.supplier?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.name}
                    {m.lastReceivedAt && ` · last received ${new Date(m.lastReceivedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </td>
            {["WAREHOUSE", "FACTORY", "total"].map((loc) => (
              <td key={loc} className="px-4 py-2 text-right">
                <StockQuantity quantity={m.stock[loc]} unit={m.unit} muted={loc !== "total"} />
              </td>
            ))}
            {config.canSeeCost && (
              <td className="px-4 py-2 text-right text-xs">
                <CostPerUnit amount={m.averageCostKwd} unit={m.unit} />
              </td>
            )}
            <td className={cn("px-2 py-2")} onClick={(e) => e.stopPropagation()}>
              <StockRowMenu material={m} config={config} onMove={(x) => onMove([x])} onAdjust={onAdjust} />
            </td>
          </tr>
        ))}
    </>
  );
}
