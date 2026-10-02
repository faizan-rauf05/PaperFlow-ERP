"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatKWD } from "@/lib/currency";
import { ORDER_MATERIAL_ROLE_LABELS } from "@/lib/material-constants";
import { bagWeightLabel, formatWeight, matchedRollBagWeight } from "@/lib/paper-sizing";

// Cold/core glue are costed per bag rather than taken from a stock item.
const PER_BAG_COST_ROLES = ["COLD_GLUE", "CORE_GLUE"];

function materialLabel(sm) {
  if (sm.material) return sm.material.name;
  return PER_BAG_COST_ROLES.includes(sm.role) ? "Total cost" : "No matching stock";
}

function quantityLabel(sm) {
  const qty = Number(sm.suggestedQty);
  if (sm.unit === "BAG") return `${qty.toLocaleString()} bags`;
  return `${qty.toFixed(2)} ${sm.unit}`;
}

/** Shows the full "best match" material breakdown (with reasoning) for one order line. */
export function OrderLineMaterialsDialog({ line, onOpenChange }) {
  const materials = line?.suggestedMaterials || [];
  const total = materials.reduce((sum, sm) => sum + Number(sm.suggestedCost || 0), 0);
  // Ink is costed at a fixed rate, so its cost is included even with no stock to pick
  const hasShortfall = materials.some(
    (sm) => !sm.material && !PER_BAG_COST_ROLES.includes(sm.role) && !(Number(sm.suggestedCost) > 0),
  );
  const bagWeight = line ? matchedRollBagWeight(line) : null;

  return (
    <Dialog open={!!line} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Recommended Materials — Line #{line?.lineNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 -mx-6 px-6 overflow-y-auto min-h-0">
          {materials.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recommendations for this line yet.
            </p>
          )}

          {materials.map((sm) => (
            <div key={sm.id} className="rounded-md border p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  <Badge variant="outline" className="mr-1.5 text-[10px]">
                    {ORDER_MATERIAL_ROLE_LABELS[sm.role] || sm.role}
                  </Badge>
                  <span className={sm.material || PER_BAG_COST_ROLES.includes(sm.role) ? "" : "text-destructive"}>
                    {materialLabel(sm)}
                  </span>
                </span>
                <span className="font-mono font-semibold">{formatKWD(sm.suggestedCost)}</span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                {sm.material?.barCode && <span>Barcode: {sm.material.barCode}</span>}
                <span>Qty: {quantityLabel(sm)}</span>
                {sm.role === "ROLL" && bagWeight && (
                  <span>
                    Bag weight: {bagWeightLabel(bagWeight)} · {formatWeight(bagWeight.totalKg, "kg")} for{" "}
                    {Number(line.quantity ?? line.plannedQty).toLocaleString()} bags
                  </span>
                )}
                {sm.source && (
                  <span>
                    {sm.source === "FACTORY"
                      ? "From factory stock"
                      : Number(sm.pickedQty || 0) >= Number(sm.suggestedQty)
                        ? "Picked from warehouse"
                        : "To pick from warehouse"}
                  </span>
                )}
              </div>
              {sm.reason && <p className="text-xs text-muted-foreground italic">{sm.reason}</p>}
            </div>
          ))}

          {materials.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <div className="flex items-center justify-between font-semibold text-sm">
                <span>Total Material Cost</span>
                <span className="font-mono">{formatKWD(total)}</span>
              </div>
              {hasShortfall && (
                <p className="text-xs text-destructive">
                  Excludes materials with no matching stock — the real cost will be higher.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
