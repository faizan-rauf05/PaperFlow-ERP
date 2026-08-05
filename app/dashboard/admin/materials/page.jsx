"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowDownAZ,
  ArrowUpZA,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Filter,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { materialSchema } from "@/lib/validations/admin-forms";
import {
  validateForm,
  clearFieldError,
  firstErrorMessage,
} from "@/lib/validations/form-utils";
import {
  createCodeSuffix,
  generateMaterialCode,
  getMaterialSummary,
  materialToFormValues,
  generatePaperRollBarcode,
} from "@/lib/material-code";
import {
  PAPER_COLORS,
  PAPER_WIDTH_PRESETS,
  GLUE_TYPES,
  INK_COLORS,
  KAPTON_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPES,
  PAPER_TYPES,
  ROPE_COLORS,
} from "@/lib/material-constants";
import { cn, formatDateTime } from "@/lib/utils";

function selectTriggerClass(hasError) {
  return cn("w-full", hasError && "border-destructive");
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
  const av = (a[sortBy] ?? "").toString();
  const bv = (b[sortBy] ?? "").toString();
  return av.localeCompare(bv, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function SortableHead({ label, column, sortBy, sortDir, onSort, className }) {
  const active = sortBy === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpZA className="h-3.5 w-3.5" />
          ))}
      </button>
    </TableHead>
  );
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
  paperLengthM: "",
  paperWidthMm: "",
  gsm: "",
  glueType: "",
  inkColor: "",
  inkColorCustom: "",
  weightKg: "",
  ropeColor: "",
  ropeLengthM: "",
  tapeType: "",
  sheetCount: "",
  cartonSize: "",
  cartonLength: "",
  cartonWidth: "",
  cartonHeight: "",
};

function TypeSpecificFields({ form, errors, patchForm }) {
  const [isCustomWidth, setIsCustomWidth] = useState(
    form.paperWidthMm &&
      !PAPER_WIDTH_PRESETS.includes(Number(form.paperWidthMm)),
  );

  switch (form.materialType) {
    case "PAPER_ROLL":
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Paper Type" required error={errors.paperType}>
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

            <FormField label="Paper Color" required error={errors.paperColor}>
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
              label="Paper Width (mm)"
              required
              error={errors.paperWidthMm}
            >
              <Select
                value={
                  isCustomWidth
                    ? "custom"
                    : form.paperWidthMm
                      ? String(form.paperWidthMm)
                      : ""
                }
                onValueChange={(v) => {
                  if (v === "custom") {
                    setIsCustomWidth(true);
                  } else {
                    setIsCustomWidth(false);
                    patchForm("paperWidthMm", v);
                  }
                }}
              >
                <SelectTrigger
                  className={selectTriggerClass(!!errors.paperWidthMm)}
                >
                  <SelectValue placeholder="Select width" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_WIDTH_PRESETS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w} mm
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {isCustomWidth && (
              <FormField
                label="Custom Width (mm)"
                required
                error={errors.paperWidthMm}
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className={fieldClassName("", !!errors.paperWidthMm)}
                  value={form.paperWidthMm}
                  onChange={(e) => patchForm("paperWidthMm", e.target.value)}
                  placeholder="Enter custom width"
                />
              </FormField>
            )}

            <FormField
              label="Paper Length (m)"
              required
              error={errors.paperLengthM}
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

          <FormField label="GSM" required error={errors.gsm}>
            <Input
              type="number"
              min="1"
              step="1"
              className={fieldClassName("", !!errors.gsm)}
              value={form.gsm}
              onChange={(e) => patchForm("gsm", e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Receiving Date" error={errors.receivingDate}>
              <Input
                type="date"
                className={fieldClassName("", !!errors.receivingDate)}
                value={form.receivingDate || ""}
                onChange={(e) => patchForm("receivingDate", e.target.value)}
              />
            </FormField>

            <FormField label="Bar code" error={errors.barCode}>
              <div className="flex gap-2">
                <Input
                  className={fieldClassName(
                    "font-mono text-xs",
                    !!errors.barCode,
                  )}
                  value={form.barCode || ""}
                  onChange={(e) => patchForm("barCode", e.target.value)}
                  placeholder="Barcode number / string"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patchForm(
                      "barCode",
                      generatePaperRollBarcode({
                        paperType: form.paperType,
                        paperColor: form.paperColor,
                        paperWidthMm: form.paperWidthMm,
                      }),
                    )
                  }
                >
                  Gen
                </Button>
              </div>
            </FormField>
          </div>
        </>
      );
    case "GLUE":
      return (
        <>
          <FormField label="Glue Type" required error={errors.glueType}>
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
          <FormField label="Weight (kg)" required error={errors.weightKg}>
            <Input
              type="number"
              min="0"
              step="0.01"
              className={fieldClassName("", !!errors.weightKg)}
              value={form.weightKg}
              onChange={(e) => patchForm("weightKg", e.target.value)}
            />
          </FormField>
        </>
      );
    case "INK":
      return (
        <>
          <FormField label="Ink Color" required error={errors.inkColor}>
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
          <FormField label="Weight (kg)" required error={errors.weightKg}>
            <Input
              type="number"
              min="0"
              step="0.01"
              className={fieldClassName("", !!errors.weightKg)}
              value={form.weightKg}
              onChange={(e) => patchForm("weightKg", e.target.value)}
            />
          </FormField>
        </>
      );
    case "ROPE":
      return (
        <>
          <FormField label="Rope Color" required error={errors.ropeColor}>
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
          <FormField label="Length (m)" required error={errors.ropeLengthM}>
            <Input
              type="number"
              min="0"
              step="0.01"
              className={fieldClassName("", !!errors.ropeLengthM)}
              value={form.ropeLengthM}
              onChange={(e) => patchForm("ropeLengthM", e.target.value)}
            />
          </FormField>
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
    default:
      return null;
  }
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [groupBy, setGroupBy] = useState("materialType");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const previewCode = useMemo(() => generateMaterialCode(form), [form]);

  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((m) => {
        const name = (m.name || "").toLowerCase();
        const code = (m.code || "").toLowerCase();
        const supplier = (m.supplier || "").toLowerCase();
        const typeLabel = (
          MATERIAL_TYPE_LABELS[m.materialType] ||
          m.materialType ||
          ""
        ).toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          supplier.includes(q) ||
          typeLabel.includes(q)
        );
      });
    }
    return list;
  }, [materials, searchQuery]);

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

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "createdAt" ? "desc" : "asc");
    }
  }

  function handleSortSelect(value) {
    const [field, dir] = value.split(":");
    setSortBy(field);
    setSortDir(dir === "asc" ? "asc" : "desc");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/materials");
      setMaterials(data.materials || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function patchMaterialType(value) {
    setForm({
      ...emptyForm,
      materialType: value,
      name: form.name,
      supplier: form.supplier,
      codeSuffix: form.codeSuffix || createCodeSuffix(),
    });
    setErrors({});
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, codeSuffix: createCodeSuffix() });
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm(materialToFormValues(m));
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = { ...form, code: previewCode };
    const result = validateForm(materialSchema, payload);
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

  const hasType = Boolean(form.materialType);

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
              placeholder="Search by name, code, supplier..."
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

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <SortableHead
                label="Code"
                column="code"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Type"
                column="materialType"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Name"
                column="name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <TableHead>Initial Stock</TableHead>
              <TableHead>Available Stock</TableHead>
              <TableHead>Details</TableHead>
              <SortableHead
                label="Supplier"
                column="supplier"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Created At"
                column="createdAt"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableHead
                label="Modified At"
                column="updatedAt"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : sortedMaterials.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-8 text-muted-foreground"
                >
                  No materials found
                </TableCell>
              </TableRow>
            ) : groupBy !== "none" && groupedMaterials ? (
              groupedMaterials.map((group) => {
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                return (
                  <Fragment key={`group-block-${group.key}`}>
                    <TableRow
                      className="bg-muted/60 hover:bg-muted/80 cursor-pointer font-medium select-none transition-colors"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <TableCell colSpan={11} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-foreground text-sm">
                              {group.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {group.items.length}{" "}
                              {group.items.length === 1 ? "item" : "items"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {!isCollapsed &&
                      group.items.map((m, idx) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {m.code}
                          </TableCell>
                          <TableCell>
                            {MATERIAL_TYPE_LABELS[m.materialType] ??
                              m.materialType}
                          </TableCell>
                          <TableCell className="font-medium">
                            {m.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {m.initialStock !== undefined
                              ? `${m.initialStock.toLocaleString()} ${m.unit || ""}`
                              : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            <span
                              className={cn(
                                "font-semibold px-2 py-0.5 rounded text-xs inline-block",
                                (m.availableStock ?? 0) <= 0
                                  ? "bg-destructive/10 text-destructive"
                                  : m.isLowStock
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              {(m.availableStock ?? 0).toLocaleString()}{" "}
                              {m.unit || ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {getMaterialSummary(m)}
                          </TableCell>
                          <TableCell>{m.supplier || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {m.createdAt ? formatDateTime(m.createdAt) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {m.updatedAt ? formatDateTime(m.updatedAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(m)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(m.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })
            ) : (
              sortedMaterials.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{m.code}</TableCell>
                  <TableCell>
                    {MATERIAL_TYPE_LABELS[m.materialType] ?? m.materialType}
                  </TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {m.initialStock !== undefined
                      ? `${m.initialStock.toLocaleString()} ${m.unit || ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    <span
                      className={cn(
                        "font-semibold px-2 py-0.5 rounded text-xs inline-block",
                        (m.availableStock ?? 0) <= 0
                          ? "bg-destructive/10 text-destructive"
                          : m.isLowStock
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {(m.availableStock ?? 0).toLocaleString()} {m.unit || ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {getMaterialSummary(m)}
                  </TableCell>
                  <TableCell>{m.supplier || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {m.createdAt ? formatDateTime(m.createdAt) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {m.updatedAt ? formatDateTime(m.updatedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Material" : "New Material"}
            </DialogTitle>
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
                <FormField label="Supplier" error={errors.supplier}>
                  <Input
                    className={fieldClassName("", !!errors.supplier)}
                    value={form.supplier}
                    onChange={(e) => patchForm("supplier", e.target.value)}
                    placeholder="Supplier name"
                  />
                </FormField>

                <FormField label="Code" error={errors.code}>
                  <Input
                    className={fieldClassName("font-mono", !!errors.code)}
                    value={previewCode}
                    readOnly
                    placeholder="Auto-generated from selections"
                  />
                </FormField>

                <TypeSpecificFields
                  form={form}
                  errors={errors}
                  patchForm={patchForm}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasType}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
