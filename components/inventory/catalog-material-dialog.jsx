"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Plus, Sparkles } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  CARTON_SIZES,
  GLUE_TYPES,
  INK_COLORS,
  KAPTON_TYPES,
  MATERIAL_TYPE_LABELS,
  ROPE_COLORS,
} from "@/lib/material-constants";
import {
  CATALOG_MATERIAL_TYPES,
  TAPE_UNITS,
  catalogKeyFor,
  materialName,
  resolveInkColor,
} from "@/lib/material-catalog";
import { firstErrorMessage, validateForm } from "@/lib/validations/form-utils";
import { catalogMaterialSchema } from "@/lib/validations/inventory";
import { NewSupplierDialog } from "./new-supplier-dialog";
import { ScanLabelDialog } from "./scan-label-dialog";

const EMPTY = {
  materialType: "",
  supplierId: "",
  glueType: "",
  inkColor: "",
  inkColorCustom: "",
  ropeColor: "",
  tapeType: "",
  tapeSize: "",
  unit: "ROLL",
  cartonSize: "",
};

const INK_PRESETS = INK_COLORS.filter((c) => c.value !== "CUSTOM").map((c) => c.value);

/** Label types the AI scanner reads that are catalog materials (paper rolls are received, not created here). */
const SCANNABLE_CATALOG_TYPES = ["GLUE", "INK", "ROPE"];

/** A saved material -> this form's values. */
function materialToForm(m) {
  const isPresetInk = INK_PRESETS.includes(m.inkColor);
  return {
    ...EMPTY,
    materialType: m.materialType,
    supplierId: m.supplierId || m.supplier?.id || "",
    glueType: m.glueType || "",
    inkColor: m.inkColor ? (isPresetInk ? m.inkColor : "CUSTOM") : "",
    inkColorCustom: m.inkColor && !isPresetInk ? m.inkColor : "",
    ropeColor: m.ropeColor || "",
    tapeType: m.tapeType || "",
    tapeSize: m.tapeSize || "",
    unit: m.materialType === "KAPTON" ? m.unit : "ROLL",
    cartonSize: m.cartonSize || "",
  };
}

/** The catalog subtype fields a scan identified. */
function scanSubtype(extracted) {
  const type = extracted.materialType;
  if (type === "GLUE") return { glueType: extracted.glue?.glueType || "" };
  if (type === "INK") {
    const color = extracted.ink?.inkColor || "";
    return INK_PRESETS.includes(color)
      ? { inkColor: color, inkColorCustom: "" }
      : { inkColor: color ? "CUSTOM" : "", inkColorCustom: extracted.ink?.inkColorCustom || color };
  }
  if (type === "ROPE") return { ropeColor: extracted.rope?.ropeColor || "" };
  return {};
}

function findSupplier(suppliers, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;
  return (
    suppliers.find((s) => s.name.toLowerCase() === target) ||
    suppliers.find((s) => s.name.toLowerCase().includes(target) || target.includes(s.name.toLowerCase()))
  );
}

function SelectField({ label, value, onChange, options, error, placeholder }) {
  return (
    <FormField label={label} required error={error}>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full", error && "border-destructive")}>
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/**
 * Creates (or, before it has any history, edits) a catalog material: one
 * supplier + type + subtype. With `materialType` the type is fixed (e.g.
 * opened from Receive Stock for glue); `initialValues` pre-fills from a scan.
 *
 * When the supplier + subtype already exist in the catalog it says so
 * instead of letting a duplicate be created; `onUseExisting(material)` lets
 * the caller use that material instead (select it, or open it).
 */
export function CatalogMaterialDialog({
  open,
  onOpenChange,
  materialType = null,
  material = null,
  initialValues = null,
  onSaved,
  onUseExisting,
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState({ open: false, name: "" });
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(material);

  useEffect(() => {
    if (!open) return;
    setForm(
      material
        ? materialToForm(material)
        : { ...EMPTY, ...initialValues, materialType: materialType || initialValues?.materialType || "" },
    );
    setErrors({});
    setLoading(true);
    Promise.all([api.get("/suppliers"), api.get("/materials", { params: { kind: "catalog" } })])
      .then(([s, m]) => {
        setSuppliers(s.data.suppliers || []);
        setCatalog(m.data.materials || []);
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [open, material, materialType, initialValues]);

  const patch = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };
  const bind = (field) => ({ value: form[field], onChange: (value) => patch(field, value), error: errors[field] });

  const type = form.materialType;
  const resolved = { ...form, inkColor: resolveInkColor(form.inkColor, form.inkColorCustom) };
  const preview = type && materialName(type, resolved);
  const supplierName = suppliers.find((s) => s.id === form.supplierId)?.name;

  // The same supplier + subtype already in the catalog (a new one would be a duplicate).
  const catalogKey = type ? catalogKeyFor(type, resolved) : null;
  const editingId = material?.id;
  const existing = useMemo(() => {
    if (!catalogKey || !form.supplierId || /undefined|^\||\|$/.test(catalogKey)) return null;
    return (
      catalog.find(
        (m) => m.id !== editingId && m.materialType === type && m.supplierId === form.supplierId && m.catalogKey === catalogKey,
      ) || null
    );
  }, [catalog, type, form.supplierId, catalogKey, editingId]);

  function applyScan({ extracted }) {
    const scannedType = extracted.materialType;
    if (scannedType === "PAPER_ROLL") {
      toast.info("That's a paper roll label — paper rolls are added with Receive Stock.");
      return;
    }
    if (!SCANNABLE_CATALOG_TYPES.includes(scannedType)) {
      toast.error("Couldn't identify a glue, ink or rope label in that photo.");
      return;
    }
    if (materialType && scannedType !== materialType) {
      toast.error(`That label is ${MATERIAL_TYPE_LABELS[scannedType].toLowerCase()}, not ${MATERIAL_TYPE_LABELS[materialType].toLowerCase()}.`);
      return;
    }
    const supplier = findSupplier(suppliers, extracted.supplier?.name);
    setForm({ ...EMPTY, materialType: scannedType, supplierId: supplier?.id || "", ...scanSubtype(extracted) });
    setErrors({});
    if (!supplier && extracted.supplier?.name) {
      toast.info(`"${extracted.supplier.name}" isn't a registered supplier yet — add it to continue`);
      setSupplierDialog({ open: true, name: extracted.supplier.name });
    } else {
      toast.success("Label read — please check the details");
    }
  }

  async function handleSave() {
    const result = validateForm(catalogMaterialSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSaving(true);
    try {
      const { data } = isEdit ? await api.put(`/materials/${material.id}`, form) : await api.post("/materials", form);
      toast.success(isEdit ? "Material updated" : `"${data.material.name}" added to the catalog`);
      onSaved?.(data.material);
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <DialogTitle>{isEdit ? "Edit Material" : "New Material"}</DialogTitle>
              {!isEdit && (
                <Button type="button" variant="secondary" size="sm" className="shrink-0 border" onClick={() => setScanOpen(true)} disabled={loading}>
                  <Sparkles className="h-4 w-4" /> Scan Label
                </Button>
              )}
            </div>
            <DialogDescription>
              One material per supplier and type — e.g. Core Glue from one supplier. Each delivery is then received against it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!materialType && !isEdit && (
              <SelectField
                label="Material Type"
                options={CATALOG_MATERIAL_TYPES.map((t) => ({ value: t, label: MATERIAL_TYPE_LABELS[t] }))}
                {...bind("materialType")}
              />
            )}

            <FormField label="Supplier" required error={errors.supplierId}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={form.supplierId}
                    onValueChange={(v) => patch("supplierId", v)}
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="Select supplier…"
                    searchPlaceholder="Search supplier…"
                    emptyText="No suppliers found."
                    error={!!errors.supplierId}
                    loading={loading}
                    className="h-9"
                  />
                </div>
                <Button type="button" variant="secondary" className="shrink-0 border" onClick={() => setSupplierDialog({ open: true, name: "" })}>
                  <Plus className="h-4 w-4" /> New
                </Button>
              </div>
            </FormField>

            {type === "GLUE" && <SelectField label="Glue Type" options={GLUE_TYPES} {...bind("glueType")} />}
            {type === "INK" && (
              <>
                <SelectField label="Ink Color" options={INK_COLORS} {...bind("inkColor")} />
                {form.inkColor === "CUSTOM" && (
                  <FormField label="Color Name" required error={errors.inkColorCustom}>
                    <Input
                      value={form.inkColorCustom}
                      onChange={(e) => patch("inkColorCustom", e.target.value)}
                      placeholder="e.g. Pantone 185 Red"
                      className={fieldClassName("", !!errors.inkColorCustom)}
                    />
                  </FormField>
                )}
              </>
            )}
            {type === "ROPE" && <SelectField label="Rope Color" options={ROPE_COLORS} {...bind("ropeColor")} />}
            {type === "KAPTON" && (
              <>
                <SelectField label="Tape Type" options={KAPTON_TYPES} {...bind("tapeType")} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Size" required error={errors.tapeSize}>
                    <Input
                      value={form.tapeSize}
                      onChange={(e) => patch("tapeSize", e.target.value)}
                      placeholder="e.g. 25mm"
                      className={fieldClassName("", !!errors.tapeSize)}
                    />
                  </FormField>
                  <SelectField label="Counted In" options={TAPE_UNITS} {...bind("unit")} />
                </div>
              </>
            )}
            {type === "CARTON" && <SelectField label="Carton Size" options={CARTON_SIZES} {...bind("cartonSize")} />}

            {existing ? (
              <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Already in the catalog</p>
                  <p className="text-xs text-muted-foreground">
                    {existing.name} · {existing.supplier?.name}. Receive deliveries against it instead of adding it again.
                  </p>
                </div>
                {onUseExisting && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onUseExisting(existing);
                      onOpenChange(false);
                    }}
                  >
                    Use it
                  </Button>
                )}
              </div>
            ) : (
              preview && (
                <p className="text-xs text-muted-foreground">
                  Will appear as <span className="font-medium text-foreground">{preview}</span>
                  {supplierName && ` · ${supplierName}`}
                </p>
              )
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || Boolean(existing)}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScanLabelDialog open={scanOpen} onOpenChange={setScanOpen} onExtracted={applyScan} />
      <NewSupplierDialog
        open={supplierDialog.open}
        initialName={supplierDialog.name}
        onOpenChange={(next) => setSupplierDialog((prev) => ({ ...prev, open: next }))}
        onSaved={(supplier) => {
          setSuppliers((prev) => [...prev, supplier]);
          patch("supplierId", supplier.id);
        }}
      />
    </>
  );
}
