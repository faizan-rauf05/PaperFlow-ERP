"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatKWD } from "@/lib/currency";

/** Shows the full "best match" material breakdown (with reasoning) for one order line. */
export function OrderLineMaterialsDialog({ line, onOpenChange }) {
  const materials = line?.suggestedMaterials || [];
  const total = materials.reduce((sum, sm) => sum + Number(sm.suggestedCost || 0), 0);

  return (
    <Dialog open={!!line} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Recommended Materials — Line #{line?.lineNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {materials.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matching stock found for this line yet.
            </p>
          )}

          {materials.map((sm) => (
            <div key={sm.id} className="rounded-md border p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  <Badge variant="outline" className="mr-1.5 text-[10px]">
                    {sm.role}
                  </Badge>
                  {sm.material?.name}
                </span>
                <span className="font-mono font-semibold">{formatKWD(sm.suggestedCost)}</span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                {sm.material?.barCode && <span>Barcode: {sm.material.barCode}</span>}
                <span>
                  Qty: {Number(sm.suggestedQty).toFixed(2)} {sm.unit}
                </span>
              </div>
              {sm.reason && <p className="text-xs text-muted-foreground italic">{sm.reason}</p>}
            </div>
          ))}

          {materials.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t font-semibold text-sm">
              <span>Total Material Cost</span>
              <span className="font-mono">{formatKWD(total)}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
