"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  scrollToFirstError,
  useUnsavedChangesGuard,
} from "@/components/unsaved-changes-guard";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  COST_CURRENCIES,
  MATERIAL_TYPE_LABELS,
  PAPER_COLORS,
  PAPER_TYPES,
  PAPER_WIDTH_CM_PRESETS,
} from "@/lib/material-constants";
import {
  MATERIAL_TYPE_CONFIG,
  UNIT_LABELS,
  formatQuantity,
  resolveInkColor,
} from "@/lib/material-catalog";
import {
  STOCK_LOCATION_LABELS,
  STOCK_LOCATION_OPTIONS,
} from "@/lib/stock-locations";
import { inventoryConfigFor } from "@/lib/inventory-routes";
import {
  clearFieldError,
  firstErrorMessage,
  validateForm,
} from "@/lib/validations/form-utils";
import { stockReceiptSchema } from "@/lib/validations/inventory";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { CatalogMaterialDialog } from "./catalog-material-dialog";
import { ImageLightbox } from "./image-lightbox";
import { NewSupplierDialog } from "./new-supplier-dialog";
import { ScanLabelDialog } from "./scan-label-dialog";
import { formatKwd } from "./stock-figures";

const RECEIVABLE_TYPES = [
  "PAPER_ROLL",
  "GLUE",
  "INK",
  "ROPE",
  "KAPTON",
  "SPONGE",
  "CARTON",
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const blankForm = (materialType = "") => ({
  materialType,
  materialId: "",
  packSize:
    materialType === "INK"
      ? String(MATERIAL_TYPE_CONFIG.INK.pack.defaultSize)
      : "",
  packCount: "",
  quantity: "",
  supplierId: "",
  paperType: "",
  paperColor: "",
  paperWidthCm: "",
  paperLengthM: "",
  gsm: "",
  weightKg: "",
  barCode: "",
  location: "WAREHOUSE",
  receivedAt: today(),
  batchNo: "",
  batchDate: "",
  costAmount: "",
  costCurrency: "KWD",
  costEntryBasis: "PER_PACK",
  labelImageUrl: "",
  notes: "",
});

const ymd = (iso) => (iso ? String(iso).slice(0, 10) : "");
const num = (v) => (v == null ? "" : String(Number(v)));

/** A saved receipt -> the form's raw values. */
function receiptToForm(r) {
  const m = r.material;
  return {
    ...blankForm(m.materialType),
    materialId: m.materialType === "PAPER_ROLL" ? "" : m.id,
    packSize: num(r.packSize),
    packCount: num(r.packCount),
    quantity: num(r.quantity),
    supplierId: m.supplier?.id || m.supplierId || "",
    paperType: m.paperType || "",
    paperColor: m.paperColor || "",
    paperWidthCm: num(m.paperWidthCm),
    paperLengthM: num(m.paperLengthM),
    gsm: num(m.gsm),
    weightKg: num(m.weightKg),
    barCode: m.barCode || "",
    location: r.location,
    receivedAt: ymd(r.receivedAt),
    batchNo: r.batchNo || "",
    batchDate: ymd(r.batchDate),
    costAmount: num(r.costAmount),
    costCurrency: r.costCurrency,
    costEntryBasis: r.costEntryBasis,
    labelImageUrl: r.labelImageUrl || "",
    notes: r.notes || "",
  };
}

/** Scanner field paths -> form fields, for the "check this" hints on low-confidence reads. */
const SCAN_FIELD_MAP = {
  "supplier.name": "supplierId",
  "paperRoll.paperType": "paperType",
  "paperRoll.paperColor": "paperColor",
  "paperRoll.paperWidthCm": "paperWidthCm",
  "paperRoll.paperLengthM": "paperLengthM",
  "paperRoll.weightKg": "weightKg",
  "paperRoll.gsm": "gsm",
  "paperRoll.barCode": "barCode",
  "glue.weightKg": "packSize",
  "glue.gluePacks": "packCount",
  "glue.batchNo": "batchNo",
  "ink.weightKg": "packSize",
  "ink.inkDrums": "packCount",
  "ink.batchNo": "batchNo",
  "rope.ropeLengthM": "packSize",
  "rope.ropeRolls": "packCount",
  "rope.batchNo": "batchNo",
};

/** The fields a scan fills in, plus the catalog subtype it identified. */
function scanToForm(extracted) {
  const type = extracted.materialType;
  const s = (v) => (v == null || v === "" ? "" : String(v));
  if (type === "PAPER_ROLL") {
    const p = extracted.paperRoll || {};
    return {
      patch: {
        paperType: s(p.paperType),
        paperColor: s(p.paperColor),
        paperWidthCm: s(p.paperWidthCm),
        paperLengthM: s(p.paperLengthM),
        gsm: s(p.gsm),
        weightKg: s(p.weightKg),
        barCode: s(p.barCode),
        ...(p.receivingDate ? { receivedAt: ymd(p.receivingDate) } : {}),
      },
      subtype: null,
    };
  }
  const section =
    { GLUE: extracted.glue, INK: extracted.ink, ROPE: extracted.rope }[type] ||
    {};
  const packs =
    {
      GLUE: [section.weightKg, section.gluePacks],
      INK: [section.weightKg, section.inkDrums],
      ROPE: [section.ropeLengthM, section.ropeRolls],
    }[type] || [];
  return {
    patch: {
      packSize: s(packs[0]),
      packCount: s(packs[1]),
      batchNo: s(section.batchNo),
      batchDate: section.receivingDate ? ymd(section.receivingDate) : "",
    },
    subtype:
      {
        GLUE: { glueType: section.glueType },
        INK: {
          inkColor: section.inkColor,
          inkColorCustom: section.inkColorCustom,
        },
        ROPE: { ropeColor: section.ropeColor },
      }[type] || {},
  };
}

function findSupplier(suppliers, name) {
  const target = String(name || "")
    .trim()
    .toLowerCase();
  if (!target) return null;
  return (
    suppliers.find((s) => s.name.toLowerCase() === target) ||
    suppliers.find(
      (s) =>
        s.name.toLowerCase().includes(target) ||
        target.includes(s.name.toLowerCase()),
    )
  );
}

function matchesSubtype(material, subtype) {
  if (material.materialType === "GLUE")
    return material.glueType === subtype.glueType;
  if (material.materialType === "INK") {
    return (
      material.inkColor ===
      resolveInkColor(subtype.inkColor, subtype.inkColorCustom)
    );
  }
  if (material.materialType === "ROPE")
    return material.ropeColor === subtype.ropeColor;
  return false;
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-4 px-4 py-5 sm:px-6">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const LOW_CONFIDENCE_WARNING =
  "Read from the label with low confidence — please check";

/**
 * Receive Stock (create) and Edit Receipt (Admin/Manager) — shared by every
 * dashboard role. `receipt` is the saved receipt when editing; `preset`
 * ({ materialType, materialId }) pre-selects what's being received (e.g.
 * "Receive more" from a material's page).
 */
export function ReceiveStockForm({ role, receipt = null, preset = null }) {
  const config = inventoryConfigFor(role);
  const isEdit = Boolean(receipt);
  const [initialForm] = useState(() =>
    isEdit
      ? receiptToForm(receipt)
      : {
          ...blankForm(preset?.materialType || ""),
          materialId: preset?.materialId || "",
        },
  );
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [lowConfidence, setLowConfidence] = useState([]);
  const [saving, setSaving] = useState(null); // null | "save" | "another"
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [rate, setRate] = useState({
    currency: null,
    value: null,
    date: null,
    loading: false,
    error: null,
  });
  const [scanOpen, setScanOpen] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState({
    open: false,
    name: "",
  });
  const [materialDialog, setMaterialDialog] = useState({
    open: false,
    initialValues: null,
  });
  const [pendingSubtype, setPendingSubtype] = useState(null); // scan waiting for its supplier to be added
  const [previewUrl, setPreviewUrl] = useState(null);
  const formRef = useRef(null);
  const labelInputRef = useRef(null);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );
  const {
    leaveTo,
    requestLeave,
    dialog: leaveDialog,
  } = useUnsavedChangesGuard(isDirty, { noun: "this delivery" });
  const backHref = config.stockHref;

  useEffect(() => {
    Promise.all([
      api.get("/materials", { params: { kind: "catalog" } }),
      api.get("/suppliers"),
    ])
      .then(([m, s]) => {
        setMaterials(m.data.materials || []);
        setSuppliers(s.data.suppliers || []);
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setLookupsLoading(false));
  }, []);

  // Live KWD conversion for USD/EUR prices (the server re-fetches the rate itself on save).
  useEffect(() => {
    const currency = form.costCurrency;
    if (currency === "KWD") return;
    let cancelled = false;
    setRate({ currency, value: null, date: null, loading: true, error: null });
    api
      .get("/exchange-rate", { params: { currency } })
      .then(
        ({ data }) =>
          !cancelled &&
          setRate({
            currency,
            value: data.rate,
            date: data.date,
            loading: false,
            error: null,
          }),
      )
      .catch(
        (e) =>
          !cancelled &&
          setRate({
            currency,
            value: null,
            date: null,
            loading: false,
            error: getApiErrorMessage(
              e,
              "Exchange rate unavailable — enter the price in KWD.",
            ),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [form.costCurrency]);

  const type = form.materialType;
  const isPaper = type === "PAPER_ROLL";
  const typeConfig = MATERIAL_TYPE_CONFIG[type];
  const pack = typeConfig?.pack || null;
  const selectedMaterial =
    materials.find((m) => m.id === form.materialId) ||
    (isEdit && !isPaper ? receipt.material : null);
  const unit = isPaper
    ? "METER"
    : selectedMaterial?.unit || typeConfig?.unit || null;
  const unitLabel = unit ? UNIT_LABELS[unit] : "units";

  const quantity = isPaper
    ? Number(form.paperLengthM) || 0
    : pack
      ? (Number(form.packSize) || 0) * (Number(form.packCount) || 0)
      : Number(form.quantity) || 0;
  const unitsPerPack = isPaper
    ? Number(form.paperLengthM)
    : pack
      ? Number(form.packSize)
      : null;
  const canPricePerPack = isPaper || Boolean(pack);
  const packName = isPaper ? "roll" : pack?.name;

  const costPreview = useMemo(() => {
    const amount = Number(form.costAmount);
    if (!(amount > 0)) return null;
    const fx =
      form.costCurrency === "KWD"
        ? 1
        : rate.currency === form.costCurrency
          ? rate.value
          : null;
    if (!fx) return null;
    const amountKwd = amount * fx;
    const rollKg = Number(form.weightKg);
    const unitCost =
      form.costEntryBasis === "PER_PACK"
        ? unitsPerPack > 0
          ? amountKwd / unitsPerPack
          : null
        : form.costEntryBasis === "PER_KG"
          ? rollKg > 0 && quantity > 0
            ? (amountKwd * rollKg) / quantity
            : null
          : amountKwd;
    if (unitCost == null) return null;
    const total = unitCost * quantity;
    // A paper roll's price per kg, whichever way it was entered
    const perKg = isPaper && rollKg > 0 && quantity > 0 ? total / rollKg : null;
    return { unitCost, total, perKg };
  }, [
    form.costAmount,
    form.costCurrency,
    form.costEntryBasis,
    form.weightKg,
    isPaper,
    rate,
    unitsPerPack,
    quantity,
  ]);

  function patch(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
    setLowConfidence((prev) => prev.filter((f) => f !== field));
  }

  function bind(field) {
    return {
      value: form[field],
      onChange: (e) => patch(field, e?.target ? e.target.value : e),
      error: errors[field],
      warning: lowConfidence.includes(field) ? LOW_CONFIDENCE_WARNING : undefined,
    };
  }

  function changeType(nextType) {
    setForm({
      ...blankForm(nextType),
      location: form.location,
      receivedAt: form.receivedAt,
    });
    setErrors({});
    setLowConfidence([]);
  }

  function onMaterialCreated(material) {
    setMaterials((prev) => [
      ...prev,
      { ...material, stock: { WAREHOUSE: 0, FACTORY: 0, total: 0 } },
    ]);
    patch("materialId", material.id);
  }

  function onSupplierCreated(supplier) {
    setSuppliers((prev) => [...prev, supplier]);
    if (isPaper) {
      patch("supplierId", supplier.id);
    } else if (pendingSubtype) {
      setMaterialDialog({
        open: true,
        initialValues: { ...pendingSubtype, supplierId: supplier.id },
      });
      setPendingSubtype(null);
    }
  }

  function applyScan({ extracted, imageDataUrl }) {
    const scannedType = extracted.materialType;
    if (!RECEIVABLE_TYPES.includes(scannedType)) {
      toast.error("The scanned label isn't a material this form can receive");
      return;
    }
    const { patch: scanned, subtype } = scanToForm(extracted);
    const supplier = findSupplier(suppliers, extracted.supplier?.name);
    const next = {
      ...blankForm(scannedType),
      location: form.location,
      ...scanned,
      labelImageUrl: imageDataUrl,
      ...(scannedType === "PAPER_ROLL" && supplier
        ? { supplierId: supplier.id }
        : {}),
    };
    if (scannedType !== "PAPER_ROLL" && supplier) {
      const match = materials.find(
        (m) =>
          m.materialType === scannedType &&
          m.supplierId === supplier.id &&
          matchesSubtype(m, subtype),
      );
      if (match) next.materialId = match.id;
      else
        setMaterialDialog({
          open: true,
          initialValues: {
            materialType: scannedType,
            supplierId: supplier.id,
            ...subtype,
          },
        });
    }
    setForm(next);
    setErrors({});
    setLowConfidence(
      (Array.isArray(extracted.lowConfidenceFields)
        ? extracted.lowConfidenceFields
        : []
      )
        .map((p) => SCAN_FIELD_MAP[p])
        .filter(Boolean),
    );
    toast.success("Label read — please check the details");

    if (!supplier && extracted.supplier?.name) {
      toast.info(
        `"${extracted.supplier.name}" isn't a registered supplier yet — add it to continue`,
      );
      if (scannedType !== "PAPER_ROLL")
        setPendingSubtype({ materialType: scannedType, ...subtype });
      setSupplierDialog({ open: true, name: extracted.supplier.name });
    }
  }

  function attachLabel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => patch("labelImageUrl", evt.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSave({ another = false } = {}) {
    const payload = { ...form };
    if (!isPaper) {
      for (const f of [
        "supplierId",
        "paperType",
        "paperColor",
        "paperWidthCm",
        "paperLengthM",
        "gsm",
        "weightKg",
        "barCode",
      ])
        delete payload[f];
      if (pack) delete payload.quantity;
      else {
        delete payload.packSize;
        delete payload.packCount;
      }
    } else {
      for (const f of [
        "materialId",
        "packSize",
        "packCount",
        "quantity",
        "batchNo",
        "batchDate",
      ])
        delete payload[f];
    }
    const result = validateForm(stockReceiptSchema, payload);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      scrollToFirstError(formRef.current);
      return;
    }

    setSaving(another ? "another" : "save");
    try {
      if (isEdit) {
        await api.put(`/inventory/receipts/${receipt.id}`, payload);
        toast.success("Receipt updated");
      } else {
        await api.post("/inventory/receipts", payload);
        toast.success(
          `Received ${formatQuantity(quantity, unit)} into the ${STOCK_LOCATION_LABELS[form.location].toLowerCase()}`,
        );
      }
      if (another) {
        const next = blankForm(type);
        setForm(next);
        setBaseline(next);
        setErrors({});
        setLowConfidence([]);
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        leaveTo(isEdit ? config.materialHref(receipt.materialId) : backHref);
      }
    } catch (e) {
      const message = getApiErrorMessage(e);
      toast.error(message);
      const field = /barcode/i.test(message)
        ? "barCode"
        : /batch/i.test(message)
          ? "batchNo"
          : /exchange rate/i.test(message)
            ? "costAmount"
            : null;
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: message }));
        scrollToFirstError(formRef.current);
      }
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/inventory/receipts/${receipt.id}`);
      toast.success("Receipt deleted");
      leaveTo(isPaper ? backHref : config.materialHref(receipt.materialId));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const materialOptions = materials
    .filter((m) => m.materialType === type)
    .map((m) => ({
      value: m.id,
      label: `${m.name} · ${m.supplier?.name}`,
      description: `Warehouse ${formatQuantity(m.stock?.WAREHOUSE, m.unit)} · Factory ${formatQuantity(m.stock?.FACTORY, m.unit)}`,
    }));

  return (
    <div ref={formRef} className="mx-auto max-w-3xl scroll-mt-6 space-y-4">
      <div className="space-y-3">
        <Button variant="secondary" size="sm" asChild className="border">
          <Link
            href={isEdit ? config.materialHref(receipt.materialId) : backHref}
          >
            <ArrowLeft className="h-4 w-4" />{" "}
            {isEdit ? "Back to Material" : "Back to Inventory"}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? "Edit Receipt" : "Receive Stock"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Correct a delivery that was entered wrongly. Stock and average cost update to match."
                : "Record a delivery into the warehouse or the factory."}
            </p>
          </div>
          {!isEdit && (
            <Button
              variant="secondary"
              className="shrink-0 border"
              onClick={() => setScanOpen(true)}
            >
              <Sparkles className="h-4 w-4" /> Scan Label
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y rounded-lg border bg-card">
        <Section
          title="Material"
          description={
            isPaper
              ? "Each paper roll is received on its own, with its own barcode."
              : undefined
          }
        >
          <FormField label="Material Type" required error={errors.materialType}>
            <Select value={type} onValueChange={changeType} disabled={isEdit}>
              <SelectTrigger
                className={cn(
                  "w-full",
                  errors.materialType && "border-destructive",
                )}
              >
                <SelectValue placeholder="What's being received?" />
              </SelectTrigger>
              <SelectContent>
                {RECEIVABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MATERIAL_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {type && !isPaper && (
            <FormField
              label="Material"
              required
              error={errors.materialId}
              className="sm:col-span-2"
            >
              {isEdit ? (
                <Input
                  value={`${receipt.material.name} · ${receipt.material.supplier?.name}`}
                  disabled
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchableSelect
                      value={form.materialId}
                      onValueChange={(v) => patch("materialId", v)}
                      loading={lookupsLoading}
                      options={materialOptions}
                      placeholder={`Select ${MATERIAL_TYPE_LABELS[type].toLowerCase()} and supplier…`}
                      searchPlaceholder="Search material or supplier…"
                      emptyText="Not in the catalog yet — add it with New."
                      error={!!errors.materialId}
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 border"
                    onClick={() =>
                      setMaterialDialog({ open: true, initialValues: null })
                    }
                  >
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </div>
              )}
            </FormField>
          )}

          {isPaper && (
            <>
              <FormField
                label="Supplier"
                required
                error={errors.supplierId}
                warning={bind("supplierId").warning}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchableSelect
                      value={form.supplierId}
                      onValueChange={(v) => patch("supplierId", v)}
                      loading={lookupsLoading}
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      placeholder="Select supplier…"
                      searchPlaceholder="Search supplier…"
                      error={!!errors.supplierId}
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 border"
                    onClick={() => setSupplierDialog({ open: true, name: "" })}
                  >
                    <Plus className="h-4 w-4" /> New
                  </Button>
                </div>
              </FormField>
              <OptionField
                label="Paper Type"
                options={PAPER_TYPES}
                {...bind("paperType")}
              />
              <OptionField
                label="Paper Color"
                options={PAPER_COLORS}
                {...bind("paperColor")}
              />
              <TextField
                label="Width (cm)"
                type="number"
                min="1"
                step="0.1"
                list="paper-width-presets"
                placeholder="e.g. 90"
                {...bind("paperWidthCm")}
              />
              <datalist id="paper-width-presets">
                {PAPER_WIDTH_CM_PRESETS.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
              <TextField
                label="GSM"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 80"
                {...bind("gsm")}
              />
              <TextField
                label="Length (m)"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 5000"
                {...bind("paperLengthM")}
              />
              <TextField
                label="Roll Weight (kg)"
                type="number"
                min="0.1"
                step="0.1"
                placeholder="e.g. 473"
                {...bind("weightKg")}
              />
              <TextField
                label="Barcode"
                inputClassName="font-mono"
                placeholder="Scan or type the roll's barcode"
                {...bind("barCode")}
              />
            </>
          )}
        </Section>

        {type && !isPaper && (
          <Section title="Quantity">
            {pack ? (
              <>
                <TextField
                  label={pack.sizeLabel}
                  type="number"
                  min="0"
                  step="any"
                  list={pack.presets ? `${type}-pack-presets` : undefined}
                  {...bind("packSize")}
                />
                {pack.presets && (
                  <datalist id={`${type}-pack-presets`}>
                    {pack.presets.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
                <TextField
                  label={pack.countLabel}
                  type="number"
                  min="1"
                  step="1"
                  {...bind("packCount")}
                />
              </>
            ) : (
              <TextField
                label={`${typeConfig.quantityLabel || "Quantity"}${unit ? ` (${unitLabel})` : ""}`}
                type="number"
                min="0"
                step="any"
                {...bind("quantity")}
              />
            )}
            {quantity > 0 && unit && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Total received:{" "}
                <span className="font-medium text-foreground">
                  {formatQuantity(quantity, unit)}
                </span>
              </p>
            )}
          </Section>
        )}

        {type && (
          <Section title="Delivery">
            <TextField
              label="Received Date"
              type="date"
              {...bind("receivedAt")}
            />
            <FormField label="Received Into" required error={errors.location}>
              <SegmentedChoice
                options={STOCK_LOCATION_OPTIONS}
                value={form.location}
                onChange={(v) => patch("location", v)}
              />
            </FormField>

            {!isPaper && (
              <>
                <TextField
                  label="Batch Number"
                  required={false}
                  placeholder="Optional — from the label"
                  {...bind("batchNo")}
                />
                <TextField
                  label="Batch / Production Date"
                  type="date"
                  required={Boolean(form.batchNo)}
                  {...bind("batchDate")}
                />
              </>
            )}
          </Section>
        )}

        {type && (
          <Section
            title="Price"
            description="Price of this delivery. Stock is valued at the weighted average of all deliveries."
          >
            <FormField
              label={`Price (per ${form.costEntryBasis === "PER_PACK" ? packName : form.costEntryBasis === "PER_KG" ? "kg" : isPaper ? "meter" : unitLabel.replace(/s$/, "")})`}
              required
              error={errors.costAmount}
            >
              <InputGroup>
                <InputGroupInput
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 45.50"
                  aria-invalid={!!errors.costAmount}
                  value={form.costAmount}
                  onChange={(e) => patch("costAmount", e.target.value)}
                />
                <InputGroupAddon align="inline-end" className="py-0 pr-0">
                  <Select
                    value={form.costCurrency}
                    onValueChange={(v) => patch("costCurrency", v)}
                  >
                    <SelectTrigger
                      aria-label="Currency"
                      className="h-8.5 w-21 rounded-l-none border-0 border-l bg-muted/50 font-medium shadow-none focus-visible:ring-0 data-[size=default]:h-8.5 dark:bg-muted/50"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {COST_CURRENCIES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </InputGroupAddon>
              </InputGroup>
            </FormField>
            {canPricePerPack && (
              <FormField label="Priced Per" error={errors.costEntryBasis}>
                <SegmentedChoice
                  options={[
                    {
                      value: "PER_PACK",
                      label: packName.replace(/^./, (c) => c.toUpperCase()),
                    },
                    {
                      value: "PER_UNIT",
                      label: isPaper
                        ? "Meter"
                        : `${unitLabel.replace(/s$/, "")}`.replace(/^./, (c) =>
                            c.toUpperCase(),
                          ),
                    },
                    ...(isPaper ? [{ value: "PER_KG", label: "Kg" }] : []),
                  ]}
                  value={form.costEntryBasis}
                  onChange={(v) => patch("costEntryBasis", v)}
                />
              </FormField>
            )}
            <div className="space-y-0.5 text-xs text-muted-foreground sm:col-span-2">
              {form.costCurrency !== "KWD" &&
                (rate.loading ? (
                  <p>Fetching exchange rate…</p>
                ) : rate.value && rate.currency === form.costCurrency ? (
                  <p>
                    1 {form.costCurrency} = {Number(rate.value).toFixed(5)} KWD
                    (rate as of {rate.date})
                  </p>
                ) : rate.error ? (
                  <p className="text-amber-600 dark:text-amber-400">
                    {rate.error}
                  </p>
                ) : null)}
              {costPreview && (
                <p>
                  ≈{" "}
                  <span className="font-medium text-foreground">
                    {formatKwd(costPreview.unitCost, 4)}
                  </span>{" "}
                  per {isPaper ? "m" : unitLabel.replace(/s$/, "")}
                  {costPreview.perKg != null && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-foreground">
                        {formatKwd(costPreview.perKg, 4)}
                      </span>{" "}
                      per kg
                    </>
                  )}
                  {quantity > 0 && (
                    <>
                      {" "}
                      · {isPaper ? "per roll" : "total"}{" "}
                      <span className="font-medium text-foreground">
                        {formatKwd(costPreview.total, 3)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </Section>
        )}

        {type && (
          <Section title="Label & Notes">
            <FormField label="Label Photo" className="sm:col-span-2">
              <input
                ref={labelInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={attachLabel}
              />
              {form.labelImageUrl ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(form.labelImageUrl)}
                    className="group relative shrink-0"
                    title="Open zoomable preview"
                  >
                    <img
                      src={form.labelImageUrl}
                      alt="Delivery label"
                      className="h-14 w-14 rounded border object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-4 w-4" />
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => patch("labelImageUrl", "")}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit border"
                  onClick={() => labelInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" /> Attach photo
                </Button>
              )}
            </FormField>
            <FormField
              label="Notes"
              error={errors.notes}
              className="sm:col-span-2"
            >
              <textarea
                rows={2}
                maxLength={500}
                value={form.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="e.g. delivery note number, damaged packaging"
                className={fieldClassName(
                  "w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
                  !!errors.notes,
                )}
              />
            </FormField>
          </Section>
        )}

        {!type && (
          <p className="px-4 py-5 text-sm text-muted-foreground sm:px-6">
            Choose what&apos;s being received — or use Scan Label to fill the
            form from the label.
          </p>
        )}
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        {isEdit && config.canCorrect ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={!!saving}
          >
            <Trash2 className="h-4 w-4" /> Delete Receipt
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Required
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              requestLeave(
                isEdit ? config.materialHref(receipt.materialId) : backHref,
              )
            }
            disabled={!!saving}
          >
            Cancel
          </Button>
          {!isEdit && (
            <Button
              variant="outline"
              onClick={() => handleSave({ another: true })}
              disabled={!!saving || !type}
            >
              {saving === "another" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save & Receive Another
            </Button>
          )}
          <Button
            onClick={() => handleSave()}
            disabled={!!saving || !type || (isEdit && !isDirty)}
          >
            {saving === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Save Receipt"}
          </Button>
        </div>
      </div>

      <ScanLabelDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onExtracted={applyScan}
      />
      <NewSupplierDialog
        open={supplierDialog.open}
        initialName={supplierDialog.name}
        onOpenChange={(open) => {
          setSupplierDialog((prev) => ({ ...prev, open }));
          if (!open) setPendingSubtype(null);
        }}
        onSaved={onSupplierCreated}
      />
      <CatalogMaterialDialog
        open={materialDialog.open}
        onOpenChange={(open) =>
          setMaterialDialog((prev) => ({ ...prev, open }))
        }
        materialType={type || materialDialog.initialValues?.materialType}
        initialValues={materialDialog.initialValues}
        onSaved={onMaterialCreated}
        onUseExisting={(existing) => patch("materialId", existing.id)}
      />
      <ImageLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPaper
                ? "The roll is removed from stock and from the catalog. Only possible while it hasn't been picked, moved or used."
                : "Its quantity is taken back out of stock. Only possible while none of it has been used or moved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {leaveDialog}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  warning,
  inputClassName,
  className,
  required = true,
  ...inputProps
}) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
      warning={warning}
      className={className}
    >
      <Input
        value={value ?? ""}
        onChange={onChange}
        className={fieldClassName(inputClassName, !!error)}
        {...inputProps}
      />
    </FormField>
  );
}

function OptionField({ label, options, value, onChange, error, warning }) {
  return (
    <FormField label={label} required error={error} warning={warning}>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full", error && "border-destructive")}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
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
