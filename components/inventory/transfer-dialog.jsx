"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatQuantity } from "@/lib/material-catalog";
import { STOCK_LOCATION_LABELS, STOCK_LOCATION_OPTIONS } from "@/lib/stock-locations";
import { QuantityInput } from "./quantity-input";

const other = (loc) => (loc === "WAREHOUSE" ? "FACTORY" : "WAREHOUSE");

/**
 * Moves stock between the warehouse and the factory.
 * - One material: choose direction and quantity (defaults to all of it).
 * - Several materials (`materials` has more than one, e.g. selected paper
 *   rolls): moves everything each has at the source location.
 */
export function TransferDialog({ open, onOpenChange, materials = [], defaultFrom = "WAREHOUSE", onDone }) {
  const [from, setFrom] = useState(defaultFrom);
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const single = materials.length === 1 ? materials[0] : null;

  useEffect(() => {
    if (!open) return;
    setFrom(defaultFrom);
    setRemarks("");
    setError(null);
    setQuantity(single ? String(Math.max(single.stock?.[defaultFrom] ?? 0, 0)) : "");
  }, [open, defaultFrom, single]);

  const to = other(from);
  // Bulk: only materials that actually have stock at the source move.
  const movable = single ? materials : materials.filter((m) => (m.stock?.[from] ?? 0) > 0);

  function changeFrom(next) {
    setFrom(next);
    if (single) setQuantity(String(Math.max(single.stock?.[next] ?? 0, 0)));
    setError(null);
  }

  async function handleMove() {
    const transfers = single
      ? [{ materialId: single.id, from, to, quantity, remarks }]
      : movable.map((m) => ({ materialId: m.id, from, to, quantity: m.stock[from], remarks }));
    if (single && !(Number(quantity) > 0)) {
      setError("Enter a quantity greater than 0");
      return;
    }
    if (transfers.length === 0) {
      setError(`None of the selected items have stock at the ${STOCK_LOCATION_LABELS[from].toLowerCase()}.`);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/inventory/transfers", { transfers });
      toast.success(
        single
          ? `Moved ${formatQuantity(quantity, single.unit)} to the ${STOCK_LOCATION_LABELS[to].toLowerCase()}`
          : `Moved ${data.transferred} item${data.transferred === 1 ? "" : "s"} to the ${STOCK_LOCATION_LABELS[to].toLowerCase()}`,
      );
      for (const w of data.warnings || []) toast.warning(w);
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const available = single?.stock?.[from] ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Stock</DialogTitle>
          <DialogDescription>
            {single
              ? `${single.materialType === "PAPER_ROLL" ? single.barCode : single.name} · ${single.supplier?.name || ""}`
              : `${materials.length} selected — each moves everything it has at the source.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="From">
            <div className="flex items-center gap-3">
              <SegmentedChoice options={STOCK_LOCATION_OPTIONS} value={from} onChange={changeFrom} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{STOCK_LOCATION_LABELS[to]}</span>
            </div>
          </FormField>

          {single ? (
            // Remounts per source location so its default (all available there) resets cleanly.
            <QuantityInput
              key={`${single.id}-${from}`}
              material={single}
              value={quantity}
              onChange={(v) => {
                setQuantity(v);
                setError(null);
              }}
              error={error}
              available={available}
            />
          ) : (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{movable.length}</span> of {materials.length} will move
                {movable.length < materials.length && (
                  <span className="text-muted-foreground"> — the rest have nothing at the {STOCK_LOCATION_LABELS[from].toLowerCase()}</span>
                )}
                .
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          <FormField label="Note">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional — e.g. for order PO-2026-0015" />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Move to {STOCK_LOCATION_LABELS[to]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
