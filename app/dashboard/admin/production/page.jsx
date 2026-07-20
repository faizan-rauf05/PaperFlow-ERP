"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { productionOrderSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { getOrderLineProgressRows, ORDER_STATUS_COLORS } from "@/lib/order-progress";
import { cn } from "@/lib/utils";

const emptyLine = { bagSpecId: "", plannedQty: "" };
const emptyForm = { customerId: "", assignedWorkerId: "", notes: "", lines: [{ ...emptyLine }] };

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [bagSpecs, setBagSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const loadBagSpecs = useCallback(async () => {
    const specsRes = await api.get("/bag-specs");
    setBagSpecs(specsRes.data.specs || specsRes.data.bagSpecs || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, custRes, workersRes] = await Promise.all([
        api.get("/production/orders"),
        api.get("/customers"),
        api.get("/workers"),
      ]);
      setOrders(ordersRes.data.orders || []);
      setCustomers(custRes.data.customers || []);
      setWorkers(workersRes.data.workers || []);
      await loadBagSpecs();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadBagSpecs]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onFocus() {
      if (dialogOpen) loadBagSpecs().catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dialogOpen, loadBagSpecs]);

  function patchForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => clearFieldError(prev, field));
  }

  function patchLine(index, field, value) {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyLine }] }));
  }

  function removeLine(index) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length <= 1 ? prev.lines : prev.lines.filter((_, i) => i !== index),
    }));
  }

  async function openCreateDialog() {
    setErrors({});
    setForm(emptyForm);
    try {
      await loadBagSpecs();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    const result = validateForm(productionOrderSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }
    setSaving(true);
    try {
      await api.post("/production/orders", result.data);
      toast.success("Production order created");
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
          <h1 className="text-2xl font-bold">Production Orders</h1>
          <p className="text-muted-foreground">Assign worker · pick bag size per line</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />New Order
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer / Worker</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No orders yet
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id} className="align-top">
                  <TableCell className="font-mono text-sm pt-4">{o.orderNo}</TableCell>
                  <TableCell className="pt-4">
                    <div className="space-y-0.5">
                      <p>{o.customer?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.assignedWorker?.name || "Unassigned"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="pt-3">
                    <div className="space-y-2">
                      {getOrderLineProgressRows(o).map((row) => (
                        <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">L{row.lineNo}</span>
                          <span className="font-medium">{row.bagSpecName}</span>
                          <span className="text-muted-foreground">· {row.plannedQty} bags</span>
                          <Badge variant="outline" className={cn("font-medium", row.className)}>
                            {row.stageLabel}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pt-4">
                    <Badge
                      variant="outline"
                      className={cn("font-medium", ORDER_STATUS_COLORS[o.status])}
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pt-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/admin/production/${o.id}`}>View</Link>
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
            <DialogTitle>Create Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Customer" required error={errors.customerId}>
              <Select value={form.customerId} onValueChange={(v) => patchForm("customerId", v)}>
                <SelectTrigger className={cn("w-full", errors.customerId && "border-destructive")}>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Assign worker" required error={errors.assignedWorkerId}>
              <Select
                value={form.assignedWorkerId}
                onValueChange={(v) => patchForm("assignedWorkerId", v)}
              >
                <SelectTrigger
                  className={cn("w-full", errors.assignedWorkerId && "border-destructive")}
                >
                  <SelectValue placeholder="Select responsible worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Notes" error={errors.notes}>
              <Input
                className={fieldClassName("", !!errors.notes)}
                value={form.notes}
                onChange={(e) => patchForm("notes", e.target.value)}
              />
            </FormField>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Bag lines</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="link" size="sm" className="h-auto px-0" asChild>
                    <Link href="/dashboard/admin/bag-specs" target="_blank" rel="noreferrer">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add new size
                      <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    Add line
                  </Button>
                </div>
              </div>
              {form.lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_120px_auto]"
                >
                  <FormField label="Bag size" required>
                    <Select
                      value={line.bagSpecId}
                      onValueChange={(v) => patchLine(index, "bagSpecId", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select bag size" />
                      </SelectTrigger>
                      <SelectContent>
                        {bagSpecs.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No sizes yet — add one first
                          </SelectItem>
                        ) : (
                          bagSpecs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                              {s.bagWidthMm != null && s.repeatLengthMm != null
                                ? ` (${s.bagWidthMm}×${s.repeatLengthMm})`
                                : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Qty (bags)" required>
                    <Input
                      type="number"
                      min="1"
                      value={line.plannedQty}
                      onChange={(e) => patchLine(index, "plannedQty", e.target.value)}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={form.lines.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || bagSpecs.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
