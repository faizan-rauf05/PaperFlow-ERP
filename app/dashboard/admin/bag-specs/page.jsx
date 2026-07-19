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
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { bagSpecSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";

const emptyForm = {
  name: "",
  code: "",
  bagWidthMm: "",
  repeatLengthMm: "",
  bagsPerMeter: "",
  handlesPerBag: "2",
  sideGlueKgPerBag: "",
  bottomGlueKgPerBag: "",
  description: "",
};

function toPayload(data) {
  const num = (v) => (v === "" || v == null ? undefined : Number(v));
  return {
    name: data.name,
    code: data.code,
    bagWidthMm: num(data.bagWidthMm),
    repeatLengthMm: num(data.repeatLengthMm),
    bagsPerMeter: num(data.bagsPerMeter),
    handlesPerBag: num(data.handlesPerBag) ?? 2,
    sideGlueKgPerBag: num(data.sideGlueKgPerBag),
    bottomGlueKgPerBag: num(data.bottomGlueKgPerBag),
    description: data.description || undefined,
  };
}

export default function BagSpecsPage() {
  const [specs, setSpecs] = useState([]);
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
      const { data } = await api.get("/bag-specs");
      setSpecs(data.specs || data.bagSpecs || []);
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

  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      code: s.code ?? "",
      bagWidthMm: s.bagWidthMm ?? "",
      repeatLengthMm: s.repeatLengthMm ?? "",
      bagsPerMeter: s.bagsPerMeter ?? "",
      handlesPerBag: s.handlesPerBag ?? "2",
      sideGlueKgPerBag: s.sideGlueKgPerBag ?? "",
      bottomGlueKgPerBag: s.bottomGlueKgPerBag ?? "",
      description: s.description ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const result = validateForm(bagSpecSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(result.data);
      if (editing) {
        await api.put("/bag-specs", { id: editing.id, ...payload });
        toast.success("Bag specification updated");
      } else {
        await api.post("/bag-specs", payload);
        toast.success("Bag specification created");
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
      await api.delete(`/bag-specs?id=${deleteId}`);
      toast.success("Bag specification deleted");
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
          <h1 className="text-2xl font-bold">Bag Specifications</h1>
          <p className="text-muted-foreground">Sizes and consumption rates used on production lines</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Add bag spec
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / size</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Width × repeat (mm)</TableHead>
              <TableHead>Bags/m</TableHead>
              <TableHead>Handles/bag</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : specs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No bag specifications yet
                </TableCell>
              </TableRow>
            ) : specs.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-sm">{s.code}</TableCell>
                <TableCell>
                  {s.bagWidthMm != null && s.repeatLengthMm != null
                    ? `${s.bagWidthMm} × ${s.repeatLengthMm}`
                    : "—"}
                </TableCell>
                <TableCell>{s.bagsPerMeter ?? "—"}</TableCell>
                <TableCell>{s.handlesPerBag ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit bag specification" : "New bag specification"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <FormField label="Name / size" required error={errors.name} className="sm:col-span-2">
              <Input
                className={fieldClassName("", !!errors.name)}
                placeholder="e.g. 200x400 or Standard 8x10"
                value={form.name}
                onChange={(e) => patchForm("name", e.target.value)}
              />
            </FormField>
            <FormField label="Code" required error={errors.code}>
              <Input
                className={fieldClassName("", !!errors.code)}
                value={form.code}
                onChange={(e) => patchForm("code", e.target.value)}
              />
            </FormField>
            <FormField label="Handles per bag" error={errors.handlesPerBag}>
              <Input
                type="number"
                step="any"
                className={fieldClassName("", !!errors.handlesPerBag)}
                value={form.handlesPerBag}
                onChange={(e) => patchForm("handlesPerBag", e.target.value)}
              />
            </FormField>
            <FormField label="Bag width (mm)" error={errors.bagWidthMm}>
              <Input
                type="number"
                step="any"
                value={form.bagWidthMm}
                onChange={(e) => patchForm("bagWidthMm", e.target.value)}
              />
            </FormField>
            <FormField label="Repeat length (mm)" error={errors.repeatLengthMm}>
              <Input
                type="number"
                step="any"
                value={form.repeatLengthMm}
                onChange={(e) => patchForm("repeatLengthMm", e.target.value)}
              />
            </FormField>
            <FormField label="Bags per meter" error={errors.bagsPerMeter}>
              <Input
                type="number"
                step="any"
                value={form.bagsPerMeter}
                onChange={(e) => patchForm("bagsPerMeter", e.target.value)}
              />
            </FormField>
            <FormField label="Side glue kg/bag" error={errors.sideGlueKgPerBag}>
              <Input
                type="number"
                step="any"
                value={form.sideGlueKgPerBag}
                onChange={(e) => patchForm("sideGlueKgPerBag", e.target.value)}
              />
            </FormField>
            <FormField label="Bottom glue kg/bag" error={errors.bottomGlueKgPerBag}>
              <Input
                type="number"
                step="any"
                value={form.bottomGlueKgPerBag}
                onChange={(e) => patchForm("bottomGlueKgPerBag", e.target.value)}
              />
            </FormField>
            <FormField label="Description" error={errors.description} className="sm:col-span-2">
              <Input
                value={form.description}
                onChange={(e) => patchForm("description", e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bag specification?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Specs used on orders cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
