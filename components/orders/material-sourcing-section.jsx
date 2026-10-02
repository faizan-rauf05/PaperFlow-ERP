"use client";

import { useEffect, useState } from "react";
import { Factory, Loader2, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatQuantity } from "@/lib/material-catalog";
import { ORDER_MATERIAL_ROLE_LABELS } from "@/lib/material-constants";

const SOURCE_OPTIONS = [
  { value: "FACTORY", label: "Available in factory" },
  { value: "WAREHOUSE", label: "Pick from warehouse" },
];

/**
 * Where each suggested material will come from, checked live against free
 * factory stock (factory stock minus what other open orders still need from
 * it). Materials the factory covers default to the factory; the approver can
 * send any of them to a warehouse pick instead. `value`/`onChange` hold the
 * choices as { suggestionId: "FACTORY" | "WAREHOUSE" }, sent with the approval.
 */
export function MaterialSourcingSection({ orderId, value, onChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/orders/${orderId}/material-sourcing`);
        if (cancelled) return;
        const materials = data.materials || [];
        setRows(materials);
        onChange(Object.fromEntries(materials.map((m) => [m.id, m.source])));
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per order
  }, [orderId]);

  const fromFactory = rows.filter((r) => value[r.id] === "FACTORY").length;

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Factory className="h-4 w-4 text-sky-600" /> Material Sourcing
        </h4>
        {!loading && rows.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {fromFactory} of {rows.length} from factory stock
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Checked against factory stock not already needed by other orders. Factory items are reserved for this order on
        approval and checked again when it&apos;s sent to production. If everything is in the factory, workers can start
        right away; otherwise the warehouse picks first.
      </p>

      {loading && (
        <div className="flex items-center text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking stock...
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No stock materials are suggested for this order.</p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-md border p-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">
                <Badge variant="outline" className="mr-1.5 text-[10px]">
                  {ORDER_MATERIAL_ROLE_LABELS[r.role] || r.role}
                </Badge>
                {r.material.name}
                <span className="text-xs font-normal text-muted-foreground"> · Line #{r.lineNo}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Need {formatQuantity(r.suggestedQty, r.material.unit)} · Factory free{" "}
                {formatQuantity(r.factoryFree, r.material.unit)} · Warehouse{" "}
                {formatQuantity(r.warehouseStock, r.material.unit)}
              </p>
            </div>
            {r.factoryCovers ? (
              <SegmentedChoice
                options={SOURCE_OPTIONS}
                value={value[r.id] || "FACTORY"}
                onChange={(v) => onChange({ ...value, [r.id]: v })}
                className="h-8 shrink-0 [&>button]:px-2 [&>button]:text-xs"
              />
            ) : (
              <Badge variant="outline" className="gap-1 shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-300">
                <Warehouse className="h-3 w-3" /> Pick from warehouse — not enough in factory
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
