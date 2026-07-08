"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { rollSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  IN_USE: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  FINISHED: "bg-muted text-muted-foreground",
  WASTED: "bg-destructive/15 text-destructive",
};

const ROLL_STATUSES = ["AVAILABLE", "IN_USE", "FINISHED", "WASTED"];

const emptyForm = {
  rollNo: "", barcode: "", materialId: "", supplier: "", batchLot: "", gsm: "",
  widthMm: "", weightKg: "", lengthM: "", receivedAt: "", storageLocation: "",
};

export default function RollsPage() {
  const [rolls, setRolls] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [rollsRes, matsRes] = await Promise.all([
        api.get("/rolls", { params }),
        api.get("/materials"),
      ]);
      setRolls(rollsRes.data.rolls || []);
      setMaterials(matsRes.data.materials || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function openRegister() {
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  async function handleSave() {
    const result = validateForm(rollSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      await api.post("/rolls", result.data);
      toast.success("Roll registered");
      setDialogOpen(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paper Rolls</h1>
          <p className="text-muted-foreground">Register and track individual paper rolls</p>
        </div>
        <Button onClick={openRegister}><Plus className="h-4 w-4 mr-2" />Register Roll</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search roll no, barcode, or batch…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ROLL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll No</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rolls.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No rolls found</TableCell></TableRow>
            ) : rolls.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/dashboard/admin/rolls/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                    {r.rollNo}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">{r.barcode}</TableCell>
                <TableCell>{r.material?.name || "—"}</TableCell>
                <TableCell className="text-right text-sm">
                  {r.remainingLengthM}m / {r.remainingWeightKg}kg
                </TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge></TableCell>
                <TableCell>{r.receivedAt ? formatDate(r.receivedAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register Paper Roll</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <FormField label="Roll number" required error={errors.rollNo} className="col-span-2">
              <Input className={fieldClassName("", !!errors.rollNo)} value={form.rollNo} onChange={(e) => patchForm("rollNo", e.target.value)} />
            </FormField>
            <FormField label="Barcode (optional)" error={errors.barcode} className="col-span-2">
              <Input className={fieldClassName("", !!errors.barcode)} placeholder="Defaults to roll number" value={form.barcode} onChange={(e) => patchForm("barcode", e.target.value)} />
            </FormField>
            <FormField label="Material" required error={errors.materialId} className="col-span-2">
              <Select value={form.materialId} onValueChange={(v) => patchForm("materialId", v)}>
                <SelectTrigger className={cn(errors.materialId && "border-destructive")}><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date received" error={errors.receivedAt}>
              <Input type="date" className={fieldClassName("", !!errors.receivedAt)} value={form.receivedAt} onChange={(e) => patchForm("receivedAt", e.target.value)} />
            </FormField>
            <FormField label="Storage location" error={errors.storageLocation}>
              <Input className={fieldClassName("", !!errors.storageLocation)} value={form.storageLocation} onChange={(e) => patchForm("storageLocation", e.target.value)} />
            </FormField>
            <FormField label="Supplier" error={errors.supplier}>
              <Input className={fieldClassName("", !!errors.supplier)} value={form.supplier} onChange={(e) => patchForm("supplier", e.target.value)} />
            </FormField>
            <FormField label="Batch / lot" error={errors.batchLot}>
              <Input className={fieldClassName("", !!errors.batchLot)} value={form.batchLot} onChange={(e) => patchForm("batchLot", e.target.value)} />
            </FormField>
            <FormField label="GSM" error={errors.gsm}>
              <Input type="number" min="0" className={fieldClassName("", !!errors.gsm)} value={form.gsm} onChange={(e) => patchForm("gsm", e.target.value)} />
            </FormField>
            <FormField label="Width (mm)" error={errors.widthMm}>
              <Input type="number" min="0" className={fieldClassName("", !!errors.widthMm)} value={form.widthMm} onChange={(e) => patchForm("widthMm", e.target.value)} />
            </FormField>
            <FormField label="Weight (kg)" required error={errors.weightKg}>
              <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.weightKg)} value={form.weightKg} onChange={(e) => patchForm("weightKg", e.target.value)} />
            </FormField>
            <FormField label="Length (m)" required error={errors.lengthM}>
              <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.lengthM)} value={form.lengthM} onChange={(e) => patchForm("lengthM", e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
