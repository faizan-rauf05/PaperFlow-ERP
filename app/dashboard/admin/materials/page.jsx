"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { materialSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { generateMaterialCode, getMaterialSummary, materialToFormValues } from "@/lib/material-code";
import {
  GLUE_TYPES,
  INK_COLORS,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPES,
  PAPER_TYPES,
  ROPE_COLORS,
  TAPE_TYPES,
} from "@/lib/material-constants";
import { cn } from "@/lib/utils";

function selectTriggerClass(hasError) {
  return cn("w-full", hasError && "border-destructive");
}

const emptyForm = {
  materialType: "",
  supplier: "",
  code: "",
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
  ropeWeightKg: "",
  tapeType: "",
  sheetCount: "",
  cartonSize: "",
  cartonLength: "",
  cartonWidth: "",
  cartonHeight: "",
};

function TypeSpecificFields({ form, errors, patchForm }) {
  switch (form.materialType) {
    case "PAPER_ROLL":
      return (
        <>
          <FormField label="Paper Type" required error={errors.paperType}>
            <Select value={form.paperType} onValueChange={(v) => patchForm("paperType", v)}>
              <SelectTrigger className={selectTriggerClass(!!errors.paperType)}><SelectValue placeholder="Select paper type" /></SelectTrigger>
              <SelectContent>{PAPER_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Paper Length (m)" required error={errors.paperLengthM}>
              <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.paperLengthM)} value={form.paperLengthM} onChange={(e) => patchForm("paperLengthM", e.target.value)} />
            </FormField>
            <FormField label="Paper Width (mm)" required error={errors.paperWidthMm}>
              <Input type="number" min="0" step="1" className={fieldClassName("", !!errors.paperWidthMm)} value={form.paperWidthMm} onChange={(e) => patchForm("paperWidthMm", e.target.value)} />
            </FormField>
          </div>
          <FormField label="GSM" required error={errors.gsm}>
            <Input type="number" min="1" step="1" className={fieldClassName("", !!errors.gsm)} value={form.gsm} onChange={(e) => patchForm("gsm", e.target.value)} />
          </FormField>
        </>
      );
    case "GLUE":
      return (
        <>
          <FormField label="Glue Type" required error={errors.glueType}>
            <Select value={form.glueType} onValueChange={(v) => patchForm("glueType", v)}>
              <SelectTrigger className={selectTriggerClass(!!errors.glueType)}><SelectValue placeholder="Select glue type" /></SelectTrigger>
              <SelectContent>{GLUE_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Weight (kg)" required error={errors.weightKg}>
            <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.weightKg)} value={form.weightKg} onChange={(e) => patchForm("weightKg", e.target.value)} />
          </FormField>
        </>
      );
    case "INK":
      return (
        <>
          <FormField label="Ink Color" required error={errors.inkColor}>
            <Select value={form.inkColor} onValueChange={(v) => patchForm("inkColor", v)}>
              <SelectTrigger className={selectTriggerClass(!!errors.inkColor)}><SelectValue placeholder="Select ink color" /></SelectTrigger>
              <SelectContent>{INK_COLORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          {form.inkColor === "CUSTOM" && (
            <FormField label="Custom Color" required error={errors.inkColorCustom}>
              <Input className={fieldClassName("", !!errors.inkColorCustom)} value={form.inkColorCustom} onChange={(e) => patchForm("inkColorCustom", e.target.value)} placeholder="Enter color name" />
            </FormField>
          )}
          <FormField label="Weight (kg)" required error={errors.weightKg}>
            <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.weightKg)} value={form.weightKg} onChange={(e) => patchForm("weightKg", e.target.value)} />
          </FormField>
        </>
      );
    case "ROPE":
      return (
        <>
          <FormField label="Rope Color" required error={errors.ropeColor}>
            <Select value={form.ropeColor} onValueChange={(v) => patchForm("ropeColor", v)}>
              <SelectTrigger className={selectTriggerClass(!!errors.ropeColor)}><SelectValue placeholder="Select rope color" /></SelectTrigger>
              <SelectContent>{ROPE_COLORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Length (m)" required error={errors.ropeLengthM}>
              <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.ropeLengthM)} value={form.ropeLengthM} onChange={(e) => patchForm("ropeLengthM", e.target.value)} />
            </FormField>
            <FormField label="Rope Weight (kg)" required error={errors.ropeWeightKg}>
              <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.ropeWeightKg)} value={form.ropeWeightKg} onChange={(e) => patchForm("ropeWeightKg", e.target.value)} />
            </FormField>
          </div>
        </>
      );
    case "TAPE":
      return (
        <FormField label="Tape Type" required error={errors.tapeType}>
          <Select value={form.tapeType} onValueChange={(v) => patchForm("tapeType", v)}>
            <SelectTrigger className={selectTriggerClass(!!errors.tapeType)}><SelectValue placeholder="Select tape type" /></SelectTrigger>
            <SelectContent>{TAPE_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      );
    case "SPONGE":
      return (
        <FormField label="Sheets (No. of Sheets)" required error={errors.sheetCount}>
          <Input type="number" min="1" step="1" className={fieldClassName("", !!errors.sheetCount)} value={form.sheetCount} onChange={(e) => patchForm("sheetCount", e.target.value)} />
        </FormField>
      );
    case "CARTON":
      return (
        <>
          <FormField label="Carton Size" required error={errors.cartonSize}>
            <Input className={fieldClassName("", !!errors.cartonSize)} value={form.cartonSize} onChange={(e) => patchForm("cartonSize", e.target.value)} placeholder="e.g. Large, Medium" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Length (cm)" required error={errors.cartonLength}>
              <Input type="number" min="0" step="0.1" className={fieldClassName("", !!errors.cartonLength)} value={form.cartonLength} onChange={(e) => patchForm("cartonLength", e.target.value)} />
            </FormField>
            <FormField label="Width (cm)" required error={errors.cartonWidth}>
              <Input type="number" min="0" step="0.1" className={fieldClassName("", !!errors.cartonWidth)} value={form.cartonWidth} onChange={(e) => patchForm("cartonWidth", e.target.value)} />
            </FormField>
            <FormField label="Height (cm)" error={errors.cartonHeight}>
              <Input type="number" min="0" step="0.1" className={fieldClassName("", !!errors.cartonHeight)} value={form.cartonHeight} onChange={(e) => patchForm("cartonHeight", e.target.value)} placeholder="Optional" />
            </FormField>
          </div>
        </>
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

  const previewCode = useMemo(() => generateMaterialCode(form), [form]);

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

  useEffect(() => { load(); }, [load]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function patchMaterialType(value) {
    setForm({ ...emptyForm, materialType: value, supplier: form.supplier });
    setErrors({});
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials</h1>
          <p className="text-muted-foreground">Define raw materials and supplies by type</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Material</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : materials.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No materials yet</TableCell></TableRow>
            ) : materials.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-sm">{m.code}</TableCell>
                <TableCell>{MATERIAL_TYPE_LABELS[m.materialType] ?? m.materialType}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{getMaterialSummary(m)}</TableCell>
                <TableCell>{m.supplier || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Material" : "New Material"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Material Type" required error={errors.materialType}>
              <Select value={form.materialType} onValueChange={patchMaterialType}>
                <SelectTrigger className={selectTriggerClass(!!errors.materialType)}>
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{MATERIAL_TYPE_LABELS[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {hasType && (
              <>
                <FormField label="Supplier" error={errors.supplier}>
                  <Input className={fieldClassName("", !!errors.supplier)} value={form.supplier} onChange={(e) => patchForm("supplier", e.target.value)} placeholder="Supplier name" />
                </FormField>

                <FormField label="Code" error={errors.code}>
                  <Input
                    className={fieldClassName("font-mono", !!errors.code)}
                    value={previewCode}
                    readOnly
                    placeholder="Auto-generated from selections"
                  />
                </FormField>

                <TypeSpecificFields form={form} errors={errors} patchForm={patchForm} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
            <AlertDialogDescription>This cannot be undone if no rolls or transactions reference it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
