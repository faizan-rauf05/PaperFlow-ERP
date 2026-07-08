"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { inventoryTransactionSchema, MATERIAL_UNITS, TX_TYPES } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const emptyForm = {
  transactionType: "STOCK_IN", materialId: "", rollId: "", quantity: "", unit: "METER", remarks: "",
};

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, lowRes, histRes, matsRes, rollsRes] = await Promise.all([
        api.get("/inventory/current-stock"),
        api.get("/inventory/low-stock"),
        api.get("/inventory/history"),
        api.get("/materials"),
        api.get("/rolls"),
      ]);
      setStock(stockRes.data.stock || []);
      setLowStock(lowRes.data.items || []);
      setHistory(histRes.data.transactions || []);
      setMaterials(matsRes.data.materials || []);
      setRolls(rollsRes.data.rolls || []);
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

  function openDialog() {
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  async function handlePost() {
    const result = validateForm(inventoryTransactionSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      await api.post("/inventory/transactions", {
        ...result.data,
        rollId: result.data.rollId || null,
      });
      toast.success("Transaction posted");
      setDialogOpen(false);
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
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Ledger-based stock tracking and transactions</p>
        </div>
        <Button onClick={openDialog}><Plus className="h-4 w-4 mr-2" />Post Transaction</Button>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alerts ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStock.map((m) => (
              <Badge key={m.id} variant="outline" className="border-amber-500/50">
                {m.name}: {m.currentStock} / {m.minimumStock} {m.unit}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : stock.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.code}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{s.name}</p>
              <p className="text-2xl font-bold mt-1">{s.currentStock} <span className="text-sm font-normal text-muted-foreground">{s.unit}</span></p>
              {s.isLowStock && <Badge variant="destructive" className="mt-2">Low stock</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions</TableCell></TableRow>
              ) : history.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell><Badge variant="outline">{t.transactionType}</Badge></TableCell>
                  <TableCell>{t.material?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{t.roll?.rollNo || "—"}</TableCell>
                  <TableCell className="text-right">{t.quantity} {t.unit}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Inventory Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Type" required error={errors.transactionType}>
              <Select value={form.transactionType} onValueChange={(v) => patchForm("transactionType", v)}>
                <SelectTrigger className={cn(errors.transactionType && "border-destructive")}><SelectValue /></SelectTrigger>
                <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Material" required error={errors.materialId}>
              <Select value={form.materialId} onValueChange={(v) => patchForm("materialId", v)}>
                <SelectTrigger className={cn(errors.materialId && "border-destructive")}><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Roll (optional)" error={errors.rollId}>
              <Select value={form.rollId || "none"} onValueChange={(v) => patchForm("rollId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {rolls.map((r) => <SelectItem key={r.id} value={r.id}>{r.rollNo}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Quantity" required error={errors.quantity}>
                <Input type="number" min="0" step="0.01" className={fieldClassName("", !!errors.quantity)} value={form.quantity} onChange={(e) => patchForm("quantity", e.target.value)} />
              </FormField>
              <FormField label="Unit" required error={errors.unit}>
                <Select value={form.unit} onValueChange={(v) => patchForm("unit", v)}>
                  <SelectTrigger className={cn(errors.unit && "border-destructive")}><SelectValue /></SelectTrigger>
                  <SelectContent>{MATERIAL_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Remarks" error={errors.remarks}>
              <Input className={fieldClassName("", !!errors.remarks)} value={form.remarks} onChange={(e) => patchForm("remarks", e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePost} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
