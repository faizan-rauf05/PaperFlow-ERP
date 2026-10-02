"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { QuantityInput } from "./quantity-input";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/material-catalog";
import { STOCK_LOCATION_OPTIONS } from "@/lib/stock-locations";
import { validateForm } from "@/lib/validations/form-utils";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";

const EMPTY = { materialId: "", location: "WAREHOUSE", direction: "REMOVE", quantity: "", remarks: "" };

/**
 * Stock-count correction at one location (Admin/Manager). With `material`
 * the material is fixed; otherwise the user picks one.
 */
export function AdjustStockDialog({ open, onOpenChange, material = null, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, materialId: material?.id || "" });
    setErrors({});
    if (!material) {
      setMaterialsLoading(true);
      api
        .get("/materials")
        .then(({ data }) => setMaterials(data.materials || []))
        .catch((e) => toast.error(getApiErrorMessage(e)))
        .finally(() => setMaterialsLoading(false));
    }
  }, [open, material]);

  const selected = material || materials.find((m) => m.id === form.materialId);
  const patch = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  async function handleSave() {
    const qty = Number(form.quantity);
    const payload = {
      materialId: form.materialId,
      location: form.location,
      quantity: form.quantity === "" ? "" : String(form.direction === "REMOVE" ? -qty : qty),
      remarks: form.remarks,
    };
    const result = validateForm(stockAdjustmentSchema, payload);
    if (!result.success || !(qty > 0)) {
      setErrors({ ...(result.errors || {}), ...(qty > 0 ? {} : { quantity: "Enter a quantity greater than 0" }) });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/inventory/adjustments", payload);
      toast.success("Stock adjusted");
      if (data.warning) toast.warning(data.warning);
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const current = selected?.stock?.[form.location];
  const after =
    current != null && Number(form.quantity) > 0
      ? current + (form.direction === "REMOVE" ? -1 : 1) * Number(form.quantity)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>Correct the stock count at one location, e.g. after a physical count or damage.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {material ? (
            <p className="text-sm font-medium">
              {material.name} <span className="text-muted-foreground">· {material.supplier?.name}</span>
            </p>
          ) : (
            <FormField label="Material" required error={errors.materialId}>
              <SearchableSelect
                value={form.materialId}
                onValueChange={(v) => patch("materialId", v)}
                loading={materialsLoading}
                options={materials.map((m) => ({
                  value: m.id,
                  label: m.materialType === "PAPER_ROLL" ? `${m.barCode} · ${m.name}` : `${m.name} · ${m.supplier?.name}`,
                }))}
                placeholder="Select material…"
                searchPlaceholder="Search material…"
                error={!!errors.materialId}
                className="h-9"
              />
            </FormField>
          )}

          <FormField label="Location">
            <SegmentedChoice options={STOCK_LOCATION_OPTIONS} value={form.location} onChange={(v) => patch("location", v)} />
          </FormField>

          <FormField label="Change">
            <SegmentedChoice
              options={[
                { value: "REMOVE", label: "Remove" },
                { value: "ADD", label: "Add" },
              ]}
              value={form.direction}
              onChange={(v) => patch("direction", v)}
            />
          </FormField>
          {selected ? (
            <QuantityInput
              key={selected.id}
              material={selected}
              value={form.quantity}
              onChange={(v) => patch("quantity", v)}
              error={errors.quantity}
            />
          ) : (
            <FormField label="Quantity" required error={errors.quantity}>
              <Input disabled placeholder="Select a material first" />
            </FormField>
          )}
          {current != null && (
            <p className="text-xs text-muted-foreground">
              Now {formatQuantity(current, selected.unit)}
              {after != null && (
                <>
                  {" "}
                  → <span className={cn("font-medium", after < 0 ? "text-destructive" : "text-foreground")}>{formatQuantity(after, selected.unit)}</span>
                </>
              )}
            </p>
          )}

          <FormField label="Reason" required error={errors.remarks}>
            <Input
              value={form.remarks}
              onChange={(e) => patch("remarks", e.target.value)}
              placeholder="e.g. Physical count 29 Sep, 2 packs damaged"
              className={fieldClassName("", !!errors.remarks)}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
