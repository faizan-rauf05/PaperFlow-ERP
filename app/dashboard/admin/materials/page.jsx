"use client";

import { useCallback, useEffect, useState } from "react";
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
import { materialSchema, MATERIAL_UNITS } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { cn } from "@/lib/utils";

const emptyForm = { name: "", code: "", unit: "METER", minimumStock: 0, kgPerMeter: "" };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code,
      unit: m.unit,
      minimumStock: m.minimumStock,
      kgPerMeter: m.kgPerMeter ?? "",
    });
    setErrors({});
    setDialogOpen(true);
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
      const payload = {
        ...result.data,
        code: result.data.code.toUpperCase(),
      };
      if (editing) {
        await api.put(`/materials/${editing.id}`, payload);
        toast.success("Material updated");
      } else {
        await api.post("/materials", payload);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials</h1>
          <p className="text-muted-foreground">Master data for raw materials and supplies</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Material</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead className="text-right">kg/m</TableHead>
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
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.unit}</TableCell>
                <TableCell className="text-right">{m.minimumStock}</TableCell>
                <TableCell className="text-right">{m.kgPerMeter ?? "—"}</TableCell>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Material" : "New Material"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Name" required error={errors.name}>
              <Input className={fieldClassName("", !!errors.name)} value={form.name} onChange={(e) => patchForm("name", e.target.value)} />
            </FormField>
            <FormField label="Code" required error={errors.code}>
              <Input className={fieldClassName("", !!errors.code)} value={form.code} onChange={(e) => patchForm("code", e.target.value.toUpperCase())} disabled={!!editing} />
            </FormField>
            <FormField label="Unit" required error={errors.unit}>
              <Select value={form.unit} onValueChange={(v) => patchForm("unit", v)}>
                <SelectTrigger className={cn(errors.unit && "border-destructive")}><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIAL_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Minimum stock" error={errors.minimumStock}>
                <Input type="number" min="0" className={fieldClassName("", !!errors.minimumStock)} value={form.minimumStock} onChange={(e) => patchForm("minimumStock", e.target.value)} />
              </FormField>
              <FormField label="kg per meter" error={errors.kgPerMeter}>
                <Input type="number" min="0" step="0.001" className={fieldClassName("", !!errors.kgPerMeter)} value={form.kgPerMeter} onChange={(e) => patchForm("kgPerMeter", e.target.value)} placeholder="Optional" />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
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
