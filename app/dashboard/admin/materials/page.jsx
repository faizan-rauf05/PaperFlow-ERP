"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Search,
  X,
  Filter,
  Camera,
  Sparkles,
  Image as ImageIcon,
  Building2,
  Check,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { MaterialsTable } from "./materials-table";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { materialSchema, supplierSchema } from "@/lib/validations/admin-forms";
import {
  validateForm,
  clearFieldError,
  firstErrorMessage,
} from "@/lib/validations/form-utils";
import {
  createCodeSuffix,
  materialToFormValues,
} from "@/lib/material-code";
import {
  CARTON_SIZES,
  COST_CURRENCIES,
  COST_PACK_DIVISOR_FIELD_BY_TYPE,
  COST_PACK_UNIT_LABEL_BY_TYPE,
  GLUE_TYPES,
  GLUE_WEIGHT_PRESETS,
  INK_COLORS,
  KAPTON_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPES,
  MATERIAL_UNIT_BY_TYPE,
  PAPER_COLORS,
  PAPER_TYPES,
  PAPER_WIDTH_CM_PRESETS,
  ROPE_COLORS,
  ROPE_LENGTH_PRESETS,
} from "@/lib/material-constants";
import { cn } from "@/lib/utils";

function selectTriggerClass(hasError) {
  return cn("w-full truncate", hasError && "border-destructive");
}

const SORT_SELECT_OPTIONS = [
  { value: "createdAt:desc", label: "Created Date (Newest first)" },
  { value: "createdAt:asc", label: "Created Date (Oldest first)" },
  { value: "name:asc", label: "Name (A–Z)" },
  { value: "name:desc", label: "Name (Z–A)" },
  { value: "materialType:asc", label: "Type (A–Z)" },
  { value: "materialType:desc", label: "Type (Z–A)" },
  { value: "supplier:asc", label: "Supplier (A–Z)" },
  { value: "supplier:desc", label: "Supplier (Z–A)" },
];

function sortSelectLabel(sortBy, sortDir) {
  return (
    SORT_SELECT_OPTIONS.find((o) => o.value === `${sortBy}:${sortDir}`)
      ?.label || `${sortBy} (${sortDir === "desc" ? "desc" : "asc"})`
  );
}

const GROUP_OPTIONS = [
  { value: "materialType", label: "Material Type" },
  { value: "supplier", label: "Supplier" },
  { value: "none", label: "None (Flat List)" },
];

/** AI scan dot-path -> {form field, friendly label} — drives the low-confidence toast + field highlight. */
const CONFIDENCE_FIELD_MAP = {
  "supplier.name": { field: "supplier", label: "Supplier" },
  "paperRoll.paperType": { field: "paperType", label: "Paper Type" },
  "paperRoll.paperColor": { field: "paperColor", label: "Paper Color" },
  "paperRoll.paperWidthCm": { field: "paperWidthCm", label: "Width" },
  "paperRoll.paperLengthM": { field: "paperLengthM", label: "Length" },
  "paperRoll.weightKg": { field: "weightKg", label: "Weight" },
  "paperRoll.gsm": { field: "gsm", label: "GSM" },
  "paperRoll.barCode": { field: "barCode", label: "Barcode" },
  "paperRoll.receivingDate": { field: "receivingDate", label: "Receiving Date" },
  "glue.glueType": { field: "glueType", label: "Glue Type" },
  "glue.weightKg": { field: "weightKg", label: "Weight per Pack" },
  "glue.gluePacks": { field: "gluePacks", label: "Number of Packs" },
  "glue.batchNo": { field: "batchNo", label: "Batch Number" },
  "ink.inkColor": { field: "inkColor", label: "Ink Color" },
  "ink.weightKg": { field: "weightKg", label: "Weight per Drum" },
  "ink.inkDrums": { field: "inkDrums", label: "Number of Drums" },
  "ink.batchNo": { field: "batchNo", label: "Batch Number" },
  "rope.ropeColor": { field: "ropeColor", label: "Rope Color" },
  "rope.ropeLengthM": { field: "ropeLengthM", label: "Roll Length" },
  "rope.ropeRolls": { field: "ropeRolls", label: "Rope Rolls" },
  "rope.batchNo": { field: "batchNo", label: "Batch Number" },
};

/**
 * Downscale a camera photo client-side before it's uploaded — phone photos
 * are often several MB, and the server resizes to 1568px for Claude anyway,
 * so sending the full original just wastes upload time. Uses createImageBitmap
 * with imageOrientation:"from-image" so EXIF rotation is respected (unlike
 * plain <img>+canvas, which can silently drop it in some browsers). Falls back
 * to the original file untouched if compression isn't supported or fails —
 * never blocks the scan over an optimization.
 */
async function compressImageForUpload(file, maxDimension = 1600, quality = 0.85) {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name || "label.jpg", { type: "image/jpeg" });
  } catch (error) {
    console.warn("Client-side image compression skipped:", error);
    return file;
  }
}

function compareMaterials(a, b, sortBy) {
  if (sortBy === "createdAt") {
    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  }
  if (sortBy === "updatedAt") {
    return (
      new Date(a.updatedAt || a.createdAt || 0).getTime() -
      new Date(b.updatedAt || b.createdAt || 0).getTime()
    );
  }
  if (sortBy === "materialType") {
    const av = (
      MATERIAL_TYPE_LABELS[a.materialType] ??
      a.materialType ??
      ""
    ).toString();
    const bv = (
      MATERIAL_TYPE_LABELS[b.materialType] ??
      b.materialType ??
      ""
    ).toString();
    return av.localeCompare(bv, undefined, { sensitivity: "base" });
  }
  if (sortBy === "identifier") {
    const av = (a.barCode || a.batchNo || "").toString();
    const bv = (b.barCode || b.batchNo || "").toString();
    return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
  }
  const av = (a[sortBy] ?? "").toString();
  const bv = (b[sortBy] ?? "").toString();
  return av.localeCompare(bv, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

const emptyForm = {
  materialType: "",
  name: "",
  supplier: "",
  code: "",
  codeSuffix: "",
  unit: "",
  size: "",
  paperType: "",
  paperColor: "",
  paperLengthM: "",
  paperWidthCm: "",
  gsm: "",
  receivingDate: "",
  barCode: "",
  batchNo: "",
  glueType: "",
  gluePacks: "",
  inkColor: "",
  inkColorCustom: "",
  weightKg: "",
  inkDrums: "",
  ropeColor: "",
  ropeLengthM: "",
  ropeLengthMCustom: "",
  ropeRolls: "",
  tapeType: "",
  sheetCount: "",
  cartonSize: "",
  cartonsPerBundle: "",
  bundleQty: "",
  imageUrl: "",
  costPriceAmount: "",
  costPriceCurrency: "KWD",
  costPriceEntryBasis: "PER_UNIT",
};

function LowConfidenceHint() {
  return (
    <span className="text-amber-600 dark:text-amber-400 font-medium">
      ⚠ AI wasn't fully confident here — please verify
    </span>
  );
}

function TypeSpecificFields({ form, errors, patchForm, lowConfidenceFields = [] }) {
  const isLow = (field) => lowConfidenceFields.includes(field);

  const [isCustomWidth, setIsCustomWidth] = useState(
    form.paperWidthCm &&
      !PAPER_WIDTH_CM_PRESETS.includes(Number(form.paperWidthCm)),
  );

  const [isCustomGlueWeight, setIsCustomGlueWeight] = useState(
    form.weightKg && !GLUE_WEIGHT_PRESETS.includes(Number(form.weightKg)),
  );

  useEffect(() => {
    setIsCustomWidth(
      Boolean(
        form.paperWidthCm &&
          !PAPER_WIDTH_CM_PRESETS.includes(Number(form.paperWidthCm)),
      ),
    );
  }, [form.paperWidthCm]);

  useEffect(() => {
    setIsCustomGlueWeight(
      Boolean(
        form.weightKg && !GLUE_WEIGHT_PRESETS.includes(Number(form.weightKg)),
      ),
    );
  }, [form.weightKg]);

  switch (form.materialType) {
    case "PAPER_ROLL":
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Paper Type" required error={errors.paperType} hint={isLow("paperType") && <LowConfidenceHint />}>
              <Select
                value={form.paperType}
                onValueChange={(v) => patchForm("paperType", v)}
              >
                <SelectTrigger
                  className={selectTriggerClass(!!errors.paperType)}
                >
                  <SelectValue placeholder="Select paper type" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Paper Color" required error={errors.paperColor} hint={isLow("paperColor") && <LowConfidenceHint />}>
              <Select
                value={form.paperColor}
                onValueChange={(v) => patchForm("paperColor", v)}
              >
                <SelectTrigger
                  className={selectTriggerClass(!!errors.paperColor)}
                >
                  <SelectValue placeholder="Select paper color" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_COLORS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Paper Width (cm)"
              required
              error={errors.paperWidthCm}
            >
              <Select
                value={
                  isCustomWidth
                    ? "custom"
                    : form.paperWidthCm
                      ? String(form.paperWidthCm)
                      : ""
                }
                onValueChange={(v) => {
                  if (v === "custom") {
                    setIsCustomWidth(true);
                  } else {
                    setIsCustomWidth(false);
                    patchForm("paperWidthCm", v);
                  }
                }}
              >
                <SelectTrigger
                  className={selectTriggerClass(!!errors.paperWidthCm)}
                >
                  <SelectValue placeholder="Select width" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_WIDTH_CM_PRESETS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w} cm
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {isCustomWidth && (
              <FormField
                label="Custom Width (cm)"
                required
                error={errors.paperWidthCm}
              >
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={fieldClassName("", !!errors.paperWidthCm)}
                  value={form.paperWidthCm}
                  onChange={(e) => patchForm("paperWidthCm", e.target.value)}
                  placeholder="Enter custom width in cm"
                />
              </FormField>
            )}

            <FormField
              label="Paper Length (m)"
              required
              error={errors.paperLengthM}
              hint={isLow("paperLengthM") && <LowConfidenceHint />}
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                className={fieldClassName("", !!errors.paperLengthM)}
                value={form.paperLengthM}
                onChange={(e) => patchForm("paperLengthM", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="GSM" required error={errors.gsm} hint={isLow("gsm") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.gsm)}
                value={form.gsm}
                onChange={(e) => patchForm("gsm", e.target.value)}
              />
            </FormField>

            <FormField label="Roll Weight (kg)" required error={errors.weightKg} hint={isLow("weightKg") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                className={fieldClassName("", !!errors.weightKg)}
                value={form.weightKg}
                onChange={(e) => patchForm("weightKg", e.target.value)}
                placeholder="e.g. 473"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Receiving Date" error={errors.receivingDate} hint={isLow("receivingDate") && <LowConfidenceHint />}>
              <Input
                type="date"
                className={fieldClassName("", !!errors.receivingDate)}
                value={form.receivingDate || ""}
                onChange={(e) => patchForm("receivingDate", e.target.value)}
              />
            </FormField>

            <FormField label="Barcode" required error={errors.barCode} hint={isLow("barCode") && <LowConfidenceHint />}>
              <Input
                className={fieldClassName(
                  "font-mono text-xs",
                  !!errors.barCode,
                )}
                value={form.barCode || ""}
                onChange={(e) => patchForm("barCode", e.target.value)}
                placeholder="Scan or type this roll's barcode"
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Each physical roll needs its own barcode — this is how it's tracked and consumed individually.
          </p>
        </>
      );
    case "GLUE":
      return (
        <>
          <FormField label="Glue Type" required error={errors.glueType} hint={isLow("glueType") && <LowConfidenceHint />}>
            <Select
              value={form.glueType}
              onValueChange={(v) => patchForm("glueType", v)}
            >
              <SelectTrigger className={selectTriggerClass(!!errors.glueType)}>
                <SelectValue placeholder="Select glue type" />
              </SelectTrigger>
              <SelectContent>
                {GLUE_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Weight per Pack (kg)" required error={errors.weightKg} hint={isLow("weightKg") && <LowConfidenceHint />}>
              <Select
                value={
                  isCustomGlueWeight
                    ? "custom"
                    : form.weightKg
                      ? String(form.weightKg)
                      : ""
                }
                onValueChange={(v) => {
                  if (v === "custom") {
                    setIsCustomGlueWeight(true);
                  } else {
                    setIsCustomGlueWeight(false);
                    patchForm("weightKg", v);
                  }
                }}
              >
                <SelectTrigger className={selectTriggerClass(!!errors.weightKg)}>
                  <SelectValue placeholder="Select weight" />
                </SelectTrigger>
                <SelectContent>
                  {GLUE_WEIGHT_PRESETS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w} kg
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {isCustomGlueWeight && (
              <FormField label="Custom Weight per Pack (kg)" required error={errors.weightKg}>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={fieldClassName("", !!errors.weightKg)}
                  value={form.weightKg}
                  onChange={(e) => patchForm("weightKg", e.target.value)}
                  placeholder="Enter custom weight"
                />
              </FormField>
            )}

            <FormField label="Number of Packs" required error={errors.gluePacks} hint={isLow("gluePacks") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.gluePacks)}
                value={form.gluePacks}
                onChange={(e) => patchForm("gluePacks", e.target.value)}
                placeholder="e.g. 15"
              />
            </FormField>
          </div>

          {form.weightKg && form.gluePacks ? (
            <p className="text-xs text-muted-foreground -mt-2">
              Total stock added: {(Number(form.weightKg) * Number(form.gluePacks)) || 0} kg
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Batch Number" error={errors.batchNo} hint={isLow("batchNo") && <LowConfidenceHint />}>
              <Input
                className={fieldClassName("", !!errors.batchNo)}
                value={form.batchNo || ""}
                onChange={(e) => patchForm("batchNo", e.target.value)}
                placeholder="Optional — from the label"
              />
            </FormField>
            <FormField
              label="Batch / Production Date"
              required={!!form.batchNo}
              error={errors.receivingDate}
            >
              <Input
                type="date"
                className={fieldClassName("", !!errors.receivingDate)}
                value={form.receivingDate || ""}
                onChange={(e) => patchForm("receivingDate", e.target.value)}
              />
            </FormField>
          </div>
          {form.batchNo && (
            <p className="text-xs text-muted-foreground -mt-2">
              Batch number + date together identify this batch, since batch numbers alone aren't guaranteed unique.
            </p>
          )}
        </>
      );
    case "INK":
      return (
        <>
          <FormField label="Ink Color" required error={errors.inkColor} hint={isLow("inkColor") && <LowConfidenceHint />}>
            <Select
              value={form.inkColor}
              onValueChange={(v) => patchForm("inkColor", v)}
            >
              <SelectTrigger className={selectTriggerClass(!!errors.inkColor)}>
                <SelectValue placeholder="Select ink color" />
              </SelectTrigger>
              <SelectContent>
                {INK_COLORS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {form.inkColor === "CUSTOM" && (
            <FormField
              label="Custom Color"
              required
              error={errors.inkColorCustom}
            >
              <Input
                className={fieldClassName("", !!errors.inkColorCustom)}
                value={form.inkColorCustom}
                onChange={(e) => patchForm("inkColorCustom", e.target.value)}
                placeholder="Enter color name"
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Weight per Drum (kg)" required error={errors.weightKg} hint={isLow("weightKg") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                className={fieldClassName("", !!errors.weightKg)}
                value={form.weightKg}
                onChange={(e) => patchForm("weightKg", e.target.value)}
                placeholder="e.g. 18"
              />
            </FormField>
            <FormField label="Number of Drums" required error={errors.inkDrums} hint={isLow("inkDrums") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.inkDrums)}
                value={form.inkDrums}
                onChange={(e) => patchForm("inkDrums", e.target.value)}
                placeholder="e.g. 5"
              />
            </FormField>
          </div>

          {form.weightKg && form.inkDrums ? (
            <p className="text-xs text-muted-foreground -mt-2">
              Total stock added: {(Number(form.weightKg) * Number(form.inkDrums)) || 0} kg
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Batch Number" error={errors.batchNo} hint={isLow("batchNo") && <LowConfidenceHint />}>
              <Input
                className={fieldClassName("", !!errors.batchNo)}
                value={form.batchNo || ""}
                onChange={(e) => patchForm("batchNo", e.target.value)}
                placeholder="Optional — from the label"
              />
            </FormField>
            <FormField
              label="Batch / Production Date"
              required={!!form.batchNo}
              error={errors.receivingDate}
            >
              <Input
                type="date"
                className={fieldClassName("", !!errors.receivingDate)}
                value={form.receivingDate || ""}
                onChange={(e) => patchForm("receivingDate", e.target.value)}
              />
            </FormField>
          </div>
          {form.batchNo && (
            <p className="text-xs text-muted-foreground -mt-2">
              Batch number + date together identify this batch, since batch numbers alone aren't guaranteed unique.
            </p>
          )}
        </>
      );
    case "ROPE":
      return (
        <>
          <FormField label="Rope Color" required error={errors.ropeColor} hint={isLow("ropeColor") && <LowConfidenceHint />}>
            <Select
              value={form.ropeColor}
              onValueChange={(v) => patchForm("ropeColor", v)}
            >
              <SelectTrigger className={selectTriggerClass(!!errors.ropeColor)}>
                <SelectValue placeholder="Select rope color" />
              </SelectTrigger>
              <SelectContent>
                {ROPE_COLORS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Roll Length (m)" required error={errors.ropeLengthM} hint={isLow("ropeLengthM") && <LowConfidenceHint />}>
              <Select
                value={form.ropeLengthM}
                onValueChange={(v) => patchForm("ropeLengthM", v)}
              >
                <SelectTrigger className={selectTriggerClass(!!errors.ropeLengthM)}>
                  <SelectValue placeholder="Select roll length" />
                </SelectTrigger>
                <SelectContent>
                  {ROPE_LENGTH_PRESETS.map((len) => (
                    <SelectItem key={len} value={String(len)}>
                      {len} m
                    </SelectItem>
                  ))}
                  <SelectItem value="CUSTOM">Custom Number…</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {form.ropeLengthM === "CUSTOM" && (
              <FormField label="Custom Length (m)" required error={errors.ropeLengthMCustom}>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className={fieldClassName("", !!errors.ropeLengthMCustom)}
                  value={form.ropeLengthMCustom}
                  onChange={(e) => patchForm("ropeLengthMCustom", e.target.value)}
                  placeholder="Length in meters"
                />
              </FormField>
            )}

            <FormField label="Rope Rolls" required error={errors.ropeRolls} hint={isLow("ropeRolls") && <LowConfidenceHint />}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.ropeRolls)}
                value={form.ropeRolls}
                onChange={(e) => patchForm("ropeRolls", e.target.value)}
                placeholder="No. of rolls"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Batch Number" error={errors.batchNo} hint={isLow("batchNo") && <LowConfidenceHint />}>
              <Input
                className={fieldClassName("", !!errors.batchNo)}
                value={form.batchNo || ""}
                onChange={(e) => patchForm("batchNo", e.target.value)}
                placeholder="Optional — from the label"
              />
            </FormField>
            <FormField
              label="Batch / Production Date"
              required={!!form.batchNo}
              error={errors.receivingDate}
            >
              <Input
                type="date"
                className={fieldClassName("", !!errors.receivingDate)}
                value={form.receivingDate || ""}
                onChange={(e) => patchForm("receivingDate", e.target.value)}
              />
            </FormField>
          </div>
          {form.batchNo && (
            <p className="text-xs text-muted-foreground -mt-2">
              Batch number + date together identify this batch, since batch numbers alone aren't guaranteed unique.
            </p>
          )}
        </>
      );
    case "KAPTON":
      return (
        <>
          <FormField label="Tape Type" required error={errors.tapeType}>
            <Select
              value={form.tapeType}
              onValueChange={(v) => patchForm("tapeType", v)}
            >
              <SelectTrigger className={selectTriggerClass(!!errors.tapeType)}>
                <SelectValue placeholder="Select Tape type" />
              </SelectTrigger>
              <SelectContent>
                {KAPTON_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Size" required error={errors.size}>
            <Input
              className={fieldClassName("", !!errors.size)}
              value={form.size}
              onChange={(e) => patchForm("size", e.target.value)}
              placeholder="e.g. 25mm, Large"
            />
          </FormField>
          <FormField label="Unit" required error={errors.unit}>
            <Input
              className={fieldClassName("", !!errors.unit)}
              value={form.unit}
              onChange={(e) => patchForm("unit", e.target.value)}
              placeholder="e.g. Roll, PCS, Meter"
            />
          </FormField>
        </>
      );
    case "SPONGE":
      return (
        <FormField
          label="Sheets (No. of Sheets)"
          required
          error={errors.sheetCount}
        >
          <Input
            type="number"
            min="1"
            step="1"
            className={fieldClassName("", !!errors.sheetCount)}
            value={form.sheetCount}
            onChange={(e) => patchForm("sheetCount", e.target.value)}
          />
        </FormField>
      );
    case "CARTON":
      return (
        <>
          <FormField label="Carton Size" required error={errors.cartonSize}>
            <Select
              value={form.cartonSize}
              onValueChange={(v) => patchForm("cartonSize", v)}
            >
              <SelectTrigger className={selectTriggerClass(!!errors.cartonSize)}>
                <SelectValue placeholder="Select carton size" />
              </SelectTrigger>
              <SelectContent>
                {CARTON_SIZES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Cartons per Bundle" required error={errors.cartonsPerBundle}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.cartonsPerBundle)}
                value={form.cartonsPerBundle}
                onChange={(e) => patchForm("cartonsPerBundle", e.target.value)}
                placeholder="e.g. 15"
              />
            </FormField>
            <FormField label="Number of Bundles" required error={errors.bundleQty}>
              <Input
                type="number"
                min="1"
                step="1"
                className={fieldClassName("", !!errors.bundleQty)}
                value={form.bundleQty}
                onChange={(e) => patchForm("bundleQty", e.target.value)}
                placeholder="e.g. 10"
              />
            </FormField>
          </div>
          {form.cartonsPerBundle && form.bundleQty ? (
            <p className="text-xs text-muted-foreground -mt-2">
              = {(Number(form.cartonsPerBundle) * Number(form.bundleQty)) || 0} cartons total
            </p>
          ) : null}
        </>
      );
    default:
      return null;
  }
}

/**
 * Shown for every material type, right below the type-specific fields.
 * Cost is always stored per Material.unit in KWD; USD entry converts using
 * a server-fetched rate (never trusted from the client), and pack-priced
 * types (glue/ink/rope/carton) can be entered as "price per pack" since
 * that's how they're actually purchased — see lib/cost-price.js.
 */
function CostPriceFields({ form, errors, patchForm, rate }) {
  const materialType = form.materialType;
  const packSupported = Boolean(COST_PACK_DIVISOR_FIELD_BY_TYPE[materialType]);
  const packLabel = COST_PACK_UNIT_LABEL_BY_TYPE[materialType] || "Pack";
  const unitLabel = (MATERIAL_UNIT_BY_TYPE[materialType] || "unit").toLowerCase();
  const entryBasis = packSupported ? form.costPriceEntryBasis || "PER_UNIT" : "PER_UNIT";
  const currency = form.costPriceCurrency || "KWD";

  const amountNum = Number(form.costPriceAmount);
  let derivedPerUnitKwd = null;
  if (amountNum > 0) {
    const amountKwd = currency === "USD" ? (rate.value ? amountNum * rate.value : null) : amountNum;
    if (amountKwd != null) {
      if (entryBasis === "PER_PACK") {
        const divisorField = COST_PACK_DIVISOR_FIELD_BY_TYPE[materialType];
        const divisor = Number(form[divisorField]);
        derivedPerUnitKwd = divisor > 0 ? amountKwd / divisor : null;
      } else {
        derivedPerUnitKwd = amountKwd;
      }
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Cost Price</p>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Currency">
          <Select
            value={currency}
            onValueChange={(v) => patchForm("costPriceCurrency", v)}
          >
            <SelectTrigger className={selectTriggerClass(false)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COST_CURRENCIES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {packSupported && (
          <FormField label="Priced Per">
            <Select
              value={entryBasis}
              onValueChange={(v) => patchForm("costPriceEntryBasis", v)}
            >
              <SelectTrigger className={selectTriggerClass(false)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_UNIT">Per {unitLabel}</SelectItem>
                <SelectItem value="PER_PACK">Per {packLabel}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}
      </div>

      <FormField
        label={`Cost Price (${currency} per ${entryBasis === "PER_PACK" ? packLabel.toLowerCase() : unitLabel})`}
        error={errors.costPriceAmount}
      >
        <Input
          type="number"
          min="0.01"
          step="0.01"
          className={fieldClassName("", !!errors.costPriceAmount)}
          value={form.costPriceAmount}
          onChange={(e) => patchForm("costPriceAmount", e.target.value)}
          placeholder="e.g. 45.50"
        />
      </FormField>

      {(currency === "USD" || derivedPerUnitKwd != null) && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {currency === "USD" &&
            (rate.loading ? (
              <p>Fetching current exchange rate…</p>
            ) : rate.error ? (
              <p className="text-amber-600 dark:text-amber-400">{rate.error}</p>
            ) : rate.value ? (
              <p>
                1 USD = {rate.value.toFixed(5)} KWD (rate as of {rate.date})
              </p>
            ) : null)}
          {derivedPerUnitKwd != null && (
            <p>≈ {derivedPerUnitKwd.toFixed(2)} KWD per {unitLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState({
    value: null,
    date: null,
    loading: false,
    error: null,
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [groupBy, setGroupBy] = useState("materialType");
  const [searchQuery, setSearchQuery] = useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = useState("all");
  const [supplierSearchFilter, setSupplierSearchFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Lightbox Image Preview Modal with Zoom / Rotate Controls
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotationDegree, setRotationDegree] = useState(0);

  // Gemini / OpenRouter AI Scanner States
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepText, setScanStepText] = useState("");
  const [lowConfidenceFields, setLowConfidenceFields] = useState([]);
  const fileInputRef = useRef(null);

  // Supplier Creation Dialog State (from scan or inline "+ New")
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    companyName: "",
    contactPerson: "",
    contactNumber: "",
    address: "",
    notes: "",
  });
  const [supplierErrors, setSupplierErrors] = useState({});
  const [savingSupplier, setSavingSupplier] = useState(false);

  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const filteredMaterials = useMemo(() => {
    let list = materials;

    if (materialTypeFilter !== "all") {
      list = list.filter((m) => m.materialType === materialTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((m) => {
        const name = (m.name || "").toLowerCase();
        const barCode = (m.barCode || "").toLowerCase();
        const batchNo = (m.batchNo || "").toLowerCase();
        const supplier = (m.supplier || "").toLowerCase();
        const typeLabel = (
          MATERIAL_TYPE_LABELS[m.materialType] ||
          m.materialType ||
          ""
        ).toLowerCase();
        return (
          name.includes(q) ||
          barCode.includes(q) ||
          batchNo.includes(q) ||
          supplier.includes(q) ||
          typeLabel.includes(q)
        );
      });
    }
    return list;
  }, [materials, searchQuery, materialTypeFilter]);

  const sortedMaterials = useMemo(() => {
    const list = [...filteredMaterials];
    list.sort((a, b) => {
      const result = compareMaterials(a, b, sortBy);
      return sortDir === "asc" ? result : -result;
    });
    return list;
  }, [filteredMaterials, sortBy, sortDir]);

  const groupedMaterials = useMemo(() => {
    if (groupBy === "none") {
      return null;
    }

    const groups = new Map();

    if (groupBy === "materialType") {
      for (const m of sortedMaterials) {
        const key = m.materialType || "OTHER";
        const label = MATERIAL_TYPE_LABELS[key] || key;
        if (!groups.has(key)) {
          groups.set(key, { key, label, items: [] });
        }
        groups.get(key).items.push(m);
      }
    } else if (groupBy === "supplier") {
      for (const m of sortedMaterials) {
        const rawSupplier = (m.supplier || "").trim();
        const key = rawSupplier ? rawSupplier.toLowerCase() : "__none__";
        const label = rawSupplier || "Unspecified Supplier";
        if (!groups.has(key)) {
          groups.set(key, { key, label, items: [] });
        }
        groups.get(key).items.push(m);
      }
    }

    return Array.from(groups.values());
  }, [sortedMaterials, groupBy]);

  const filteredSuppliersForSelect = useMemo(() => {
    if (!supplierSearchFilter.trim()) return suppliers;
    const q = supplierSearchFilter.trim().toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.companyName && s.companyName.toLowerCase().includes(q)),
    );
  }, [suppliers, supplierSearchFilter]);

  const handleSort = useCallback(
    (column) => {
      if (sortBy === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortDir(column === "createdAt" ? "desc" : "asc");
      }
    },
    [sortBy],
  );

  function handleSortSelect(value) {
    const [field, dir] = value.split(":");
    setSortBy(field);
    setSortDir(dir === "asc" ? "asc" : "desc");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: matData }, { data: supData }] = await Promise.all([
        api.get("/materials"),
        api.get("/suppliers").catch(() => ({ data: { suppliers: [] } })),
      ]);
      setMaterials(matData.materials || []);
      setSuppliers(supData.suppliers || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Drop selected ids that no longer exist after a reload (e.g. deleted elsewhere).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(materials.map((m) => m.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [materials]);

  // Fetch the live USD->KWD rate once per dialog open, not per keystroke —
  // it's cached server-side too, so switching currency mid-session is instant.
  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    setExchangeRate((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get("/exchange-rate")
      .then(({ data }) => {
        if (cancelled) return;
        setExchangeRate({
          value: data.rate,
          date: data.date,
          loading: false,
          error: data.stale
            ? "Showing a recently cached rate — live rate temporarily unavailable."
            : null,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setExchangeRate({
          value: null,
          date: null,
          loading: false,
          error: getApiErrorMessage(e, "Exchange rate unavailable — enter cost in KWD."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function patchMaterialType(value) {
    const defaultWeight = value === "INK" ? "18" : "";
    setForm({
      ...emptyForm,
      materialType: value,
      weightKg: defaultWeight,
      name: form.name,
      supplier: form.supplier,
      imageUrl: form.imageUrl,
      codeSuffix: form.codeSuffix || createCodeSuffix(),
    });
    setErrors({});
    setLowConfidenceFields([]);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, codeSuffix: createCodeSuffix() });
    setErrors({});
    setSupplierSearchFilter("");
    setLowConfidenceFields([]);
    setDialogOpen(true);
  }

  const openEdit = useCallback((m) => {
    setEditing(m);
    setForm(materialToFormValues(m));
    setErrors({});
    setSupplierSearchFilter("");
    setLowConfidenceFields([]);
    setDialogOpen(true);
  }, []);

  function openNewSupplierDialog(initialValues = {}) {
    setSupplierForm({
      name: initialValues.name || "",
      companyName: initialValues.companyName || "",
      contactPerson: initialValues.contactPerson || "",
      contactNumber: initialValues.contactNumber || "",
      address: initialValues.address || "",
      notes: initialValues.notes || "",
    });
    setSupplierErrors({});
    setSupplierDialogOpen(true);
  }

  const openImagePreview = useCallback((url) => {
    setPreviewImageUrl(url);
    setZoomScale(1);
    setRotationDegree(0);
  }, []);

  async function handleSaveSupplier() {
    const result = validateForm(supplierSchema, supplierForm);
    if (!result.success) {
      setSupplierErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSavingSupplier(true);
    try {
      const { data } = await api.post("/suppliers", result.data);
      toast.success("Supplier registered successfully");
      const newSup = data.supplier;
      setSuppliers((prev) => [...prev, newSup]);
      patchForm("supplier", newSup.name);
      setSupplierDialogOpen(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageForUpload(file);
    setSelectedFile(compressed);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImagePreview(evt.target.result);
    };
    reader.readAsDataURL(compressed);
  }

  // Trigger AI scan with progress indicator
  async function handleScanWithAI() {
    if (!imagePreview) {
      toast.error("Please upload or capture a label image first");
      return;
    }
    setScanning(true);
    setScanProgress(5);
    setScanStepText("Optimizing label image...");

    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += currentProgress < 30 ? 6 : currentProgress < 75 ? 4 : 1;
      if (currentProgress > 94) currentProgress = 94;
      setScanProgress(currentProgress);

      if (currentProgress < 30) {
        setScanStepText("Optimizing label image...");
      } else if (currentProgress < 75) {
        setScanStepText("Analyzing label with AI...");
      } else {
        setScanStepText("Extracting specifications...");
      }
    }, 100);

    try {
      const mimeType = selectedFile?.type || "image/jpeg";
      const { data } = await api.post("/materials/scan-label", {
        imageBase64: imagePreview,
        mimeType,
      });

      clearInterval(interval);
      setScanProgress(100);
      setScanStepText("Extracted!");

      const ext = data.extracted || {};
      toast.success("Label analyzed successfully!");

      // Pre-fill form from scanned info
      const mType = ext.materialType || "PAPER_ROLL";
      const paperData = ext.paperRoll || {};
      const glueData = ext.glue || {};
      const inkData = ext.ink || {};
      const ropeData = ext.rope || {};
      const cartonData = ext.carton || {};

      const lowConfidencePaths = Array.isArray(ext.lowConfidenceFields) ? ext.lowConfidenceFields : [];
      const lowConfidenceEntries = lowConfidencePaths
        .map((path) => CONFIDENCE_FIELD_MAP[path])
        .filter(Boolean);
      setLowConfidenceFields(lowConfidenceEntries.map((e) => e.field));

      if (lowConfidenceEntries.length > 0) {
        toast.warning(
          `Please double-check: ${lowConfidenceEntries.map((e) => e.label).join(", ")}`,
          { description: "These were inferred or ambiguous on the label, not clearly stated.", duration: 8000 },
        );
      }

      let selectedSupplierName = "";
      if (ext.supplier?.name) {
        const rawSupName = String(ext.supplier.name || "").trim();
        if (rawSupName) {
          const targetName = rawSupName.toLowerCase();
          const match = Array.isArray(suppliers)
            ? suppliers.find((s) => {
                const sName = String(s?.name || "").toLowerCase();
                const sComp = String(s?.companyName || "").toLowerCase();
                return (
                  (sName && (sName.includes(targetName) || targetName.includes(sName))) ||
                  (sComp && sComp.includes(targetName))
                );
              })
            : null;

          if (match?.name) {
            selectedSupplierName = match.name;
            toast.info(`Supplier matched: ${match.name}`);
          } else {
            try {
              const newSupRes = await api.post("/suppliers", {
                name: rawSupName,
                companyName: ext.supplier.companyName || rawSupName,
                contactNumber: ext.supplier.contactNumber || "",
                address: ext.supplier.address || "",
              });
              const newSup = newSupRes.data?.supplier;
              if (newSup?.name) {
                setSuppliers((prev) => [...(Array.isArray(prev) ? prev : []), newSup]);
                selectedSupplierName = newSup.name;
                toast.success(`Registered new supplier: ${newSup.name}`);
              } else {
                selectedSupplierName = rawSupName;
              }
            } catch (supErr) {
              console.warn("Auto supplier creation warning (continuing scan):", supErr);
              selectedSupplierName = rawSupName;
            }
          }
        }
      }

      const todayDate = new Date().toISOString().split("T")[0];
      const recDate = paperData.receivingDate || todayDate;

      setEditing(null);
      setForm({
        ...emptyForm,
        materialType: mType,
        supplier: selectedSupplierName,
        imageUrl: imagePreview,
        codeSuffix: createCodeSuffix(),
        paperType: paperData.paperType || "VIRGIN",
        paperColor: paperData.paperColor || "WHITE",
        paperWidthCm: paperData.paperWidthCm ? String(paperData.paperWidthCm) : "",
        paperLengthM: paperData.paperLengthM ? String(paperData.paperLengthM) : "",
        weightKg: paperData.weightKg || glueData.weightKg || inkData.weightKg || "",
        gsm: paperData.gsm ? String(paperData.gsm) : "",
        barCode: paperData.barCode || "",
        receivingDate: recDate,
        glueType: glueData.glueType || "",
        gluePacks: glueData.gluePacks || "",
        batchNo: glueData.batchNo || inkData.batchNo || ropeData.batchNo || "",
        inkColor: inkData.inkColor || "",
        inkColorCustom: inkData.inkColorCustom || "",
        inkDrums: inkData.inkDrums || "",
        ropeColor: ropeData.ropeColor || "",
        ropeLengthM: ropeData.ropeLengthM ? String(ropeData.ropeLengthM) : "",
        ropeRolls: ropeData.ropeRolls || "",
        cartonSize: cartonData.cartonSize || "",
        cartonsPerBundle: cartonData.cartonsPerBundle || "",
        bundleQty: cartonData.bundleQty || "",
      });
      setErrors({});

      setTimeout(() => {
        setScanDialogOpen(false);
        setDialogOpen(true);
      }, 200);
    } catch (e) {
      clearInterval(interval);
      toast.error(getApiErrorMessage(e));
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  }

  async function handleSave() {
    const result = validateForm(materialSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/materials/${editing.id}`, result.data);
        toast.success("Material updated");
      } else {
        await api.post("/materials", result.data);
        toast.success("Material created");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/materials/${deleteId}`);
      toast.success("Material deleted");
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visibleIds = sortedMaterials.map((m) => m.id);
    setSelectedIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [sortedMaterials]);

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.delete(`/materials/${id}`)),
      );
      const failed = results.filter((r) => r.status === "rejected");
      const succeeded = results.length - failed.length;
      if (succeeded > 0) {
        toast.success(`${succeeded} material${succeeded === 1 ? "" : "s"} deleted`);
      }
      if (failed.length > 0) {
        toast.error(
          `${failed.length} material${failed.length === 1 ? "" : "s"} couldn't be deleted — likely still has inventory transactions`,
        );
      }
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      load();
    } finally {
      setBulkDeleting(false);
    }
  }

  const hasType = Boolean(form.materialType);
  const visibleIds = sortedMaterials.map((m) => m.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selectedIds.has(id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials</h1>
          <p className="text-muted-foreground">
            Define raw materials and supplies by type
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Controls Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, barcode, batch, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 pr-8 transition-all",
                searchQuery &&
                  "border-primary ring-1 ring-primary/30 bg-primary/5 font-medium",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Grouping, Filters & Sort Controls */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {/* Material Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Material Type:
              </span>
              <Select
                value={materialTypeFilter}
                onValueChange={setMaterialTypeFilter}
              >
                <SelectTrigger
                  className={cn(
                    "w-[170px] h-9 text-xs transition-all",
                    materialTypeFilter !== "all" &&
                      "border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/30",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Material Types</SelectItem>
                  {MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {MATERIAL_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group By */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Group by:
              </span>
              <Select
                value={groupBy}
                onValueChange={(val) => {
                  setGroupBy(val);
                  setCollapsedGroups({});
                }}
              >
                <SelectTrigger
                  className={cn(
                    "w-[155px] h-9 text-xs transition-all",
                    groupBy !== "none" &&
                      "border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/30",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Sort:
              </span>
              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={handleSortSelect}
              >
                <SelectTrigger className="w-[220px] h-9 text-xs border-primary/50 bg-primary/5 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_SELECT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Options Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-md border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" /> Active Views:
            </span>
            <Badge
              variant="outline"
              className="border-primary/50 bg-primary/10 text-primary gap-1 font-normal"
            >
              <span className="font-semibold">Grouped:</span>{" "}
              {GROUP_OPTIONS.find((o) => o.value === groupBy)?.label}
            </Badge>
            <Badge
              variant="outline"
              className="border-primary/50 bg-primary/10 text-primary gap-1 font-normal"
            >
              <span className="font-semibold">Sorted:</span>{" "}
              {sortSelectLabel(sortBy, sortDir)}
            </Badge>
            {materialTypeFilter !== "all" && (
              <Badge
                variant="outline"
                className="border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300 gap-1 font-normal"
              >
                <span className="font-semibold">Type:</span>{" "}
                {MATERIAL_TYPE_LABELS[materialTypeFilter] || materialTypeFilter}
                <button
                  type="button"
                  onClick={() => setMaterialTypeFilter("all")}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {searchQuery && (
              <Badge
                variant="outline"
                className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1 font-normal"
              >
                <span className="font-semibold">Search:</span> "{searchQuery}"
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-xs font-mono">
            Showing{" "}
            <strong className="text-foreground">
              {sortedMaterials.length}
            </strong>{" "}
            of {materials.length} items
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} material{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <MaterialsTable
        loading={loading}
        sortedMaterials={sortedMaterials}
        groupedMaterials={groupedMaterials}
        groupBy={groupBy}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        onToggleSelectAll={toggleSelectAllVisible}
        onToggleSelected={toggleSelected}
        onEdit={openEdit}
        onDeleteRequest={setDeleteId}
        onImagePreview={openImagePreview}
      />

      {/* Main Material Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-4">
              <DialogTitle>
                {editing ? "Edit Material" : "New Material"}
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setImagePreview("");
                  setScanDialogOpen(true);
                }}
                className="border-primary/50 text-primary hover:bg-primary/10 shrink-0 text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Scan Material Label
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField
              label="Material Type"
              required
              error={errors.materialType}
            >
              <Select
                value={form.materialType}
                onValueChange={patchMaterialType}
              >
                <SelectTrigger
                  className={selectTriggerClass(!!errors.materialType)}
                >
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {MATERIAL_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {hasType && (
              <>
                <FormField label="Supplier" required error={errors.supplier} hint={lowConfidenceFields.includes("supplier") && <LowConfidenceHint />}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 max-w-[280px] sm:max-w-[320px]">
                      <Select
                        value={form.supplier}
                        onValueChange={(v) => patchForm("supplier", v)}
                      >
                        <SelectTrigger className={selectTriggerClass(!!errors.supplier)}>
                          <SelectValue placeholder="Select supplier..." />
                        </SelectTrigger>
                        <SelectContent className="max-w-[320px]">
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Search supplier..."
                              value={supplierSearchFilter}
                              onChange={(e) => setSupplierSearchFilter(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          {filteredSuppliersForSelect.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">
                              No suppliers found
                            </div>
                          ) : (
                            filteredSuppliersForSelect.map((s) => (
                              <SelectItem key={s.id} value={s.name}>
                                <span className="truncate block max-w-[250px]">{s.name}</span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openNewSupplierDialog()}
                      className="shrink-0 text-xs"
                      title="Add new supplier"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> New
                    </Button>
                  </div>
                </FormField>

                {form.imageUrl && (
                  <div className="p-3 border rounded-md bg-muted/30 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openImagePreview(form.imageUrl)}
                      className="relative group shrink-0"
                    >
                      <img src={form.imageUrl} alt="Reference Label" className="h-14 w-14 object-cover rounded border group-hover:opacity-80 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <Eye className="h-4 w-4" />
                      </div>
                    </button>
                    <div className="text-xs space-y-1 flex-1 min-w-0">
                      <p className="font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Scanned Label Attached
                      </p>
                      <p className="text-muted-foreground text-xs">Click image to open zoomable preview</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => patchForm("imageUrl", "")}
                      className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <TypeSpecificFields
                  form={form}
                  errors={errors}
                  patchForm={patchForm}
                  lowConfidenceFields={lowConfidenceFields}
                />

                <CostPriceFields
                  form={form}
                  errors={errors}
                  patchForm={patchForm}
                  rate={exchangeRate}
                />
              </>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-end w-full">
            {/* <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                setImagePreview("");
                setScanDialogOpen(true);
              }}
              className="border-primary/50 text-primary hover:bg-primary/10 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Scan Material Label
            </Button> */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !hasType}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Label Scanner Upload Modal */}
      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Scan Material Label with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Select or capture a material label image (Paper Roll, Ink, Glue, Rope, Carton, etc.). AI will extract specifications, barcode, and supplier details automatically.
            </p>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative border rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 p-2 flex flex-col items-center">
                <img src={imagePreview} alt="Label preview" className="max-h-56 object-contain rounded" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs"
                >
                  Change Image
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-44 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground"
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-foreground">Click to upload or take picture</span>
                <span className="text-xs">Supports JPG, PNG, WEBP label images</span>
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScanWithAI}
              disabled={scanning || !imagePreview}
              className="relative overflow-hidden min-w-[220px]"
            >
              {scanning ? (
                <>
                  <span
                    className="absolute inset-0 bg-primary-foreground/25 transition-all duration-150 ease-out"
                    style={{ width: `${scanProgress}%` }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="font-mono font-bold">{scanProgress}%</span>
                    <span className="truncate">{scanStepText}</span>
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract & Pre-fill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Creation Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Register New Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Supplier details captured from label. Confirm or edit details below to save.
            </p>
            <FormField label="Supplier Name" required error={supplierErrors.name}>
              <Input
                className={fieldClassName("", !!supplierErrors.name)}
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Supplier / Company Name"
              />
            </FormField>
            <FormField label="Company Name" error={supplierErrors.companyName}>
              <Input
                className={fieldClassName("", !!supplierErrors.companyName)}
                value={supplierForm.companyName}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="Full Business Name"
              />
            </FormField>
            <FormField label="Contact Person" error={supplierErrors.contactPerson}>
              <Input
                className={fieldClassName("", !!supplierErrors.contactPerson)}
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="Representative name"
              />
            </FormField>
            <FormField label="Phone / Contact Number (No Fax)" error={supplierErrors.contactNumber}>
              <Input
                className={fieldClassName("", !!supplierErrors.contactNumber)}
                value={supplierForm.contactNumber}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="Telephone / Phone number"
              />
            </FormField>
            <FormField label="Address" error={supplierErrors.address}>
              <textarea
                rows={3}
                className={fieldClassName("w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y", !!supplierErrors.address)}
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Physical address, street, city..."
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSupplier} disabled={savingSupplier}>
              {savingSupplier && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save & Select Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Freely Zoomable Image Lightbox Modal */}
      <Dialog open={!!previewImageUrl} onOpenChange={() => setPreviewImageUrl(null)}>
        <DialogContent className="sm:max-w-3xl p-4 max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4 text-primary" /> Reference Material Label Image
              </DialogTitle>
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Zoom Out"
                  onClick={() => setZoomScale((z) => Math.max(z - 0.25, 0.5))}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-mono font-medium px-1.5 text-muted-foreground w-12 text-center select-none">
                  {Math.round(zoomScale * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Zoom In"
                  onClick={() => setZoomScale((z) => Math.min(z + 0.25, 4))}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>

                <div className="h-4 w-px bg-border mx-1" />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Rotate Clockwise"
                  onClick={() => setRotationDegree((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Reset Zoom & Rotation"
                  onClick={() => {
                    setZoomScale(1);
                    setRotationDegree(0);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="relative border rounded-lg bg-black/95 flex-1 min-h-[350px] max-h-[75vh] overflow-auto flex items-center justify-center p-4">
            {previewImageUrl && (
              <img
                src={previewImageUrl}
                alt="Full Scanned Label"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded transition-transform duration-200 ease-out select-none cursor-grab active:cursor-grabbing"
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotationDegree}deg)`,
                }}
              />
            )}
          </div>
          <DialogFooter className="pt-2">
            <div className="text-xs text-muted-foreground flex-1 flex items-center gap-2">
              <span>Use controls above to zoom (50% – 400%) or rotate the scanned label.</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewImageUrl(null)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete material?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone if transactions reference it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} material{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any selected material that already has inventory
              transactions recorded against it will be skipped instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete {selectedIds.size} material{selectedIds.size === 1 ? "" : "s"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
