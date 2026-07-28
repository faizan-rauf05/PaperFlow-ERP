"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Upload, Paperclip } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { productionOrderSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { getOrderLineProgressRows, ORDER_STATUS_COLORS } from "@/lib/order-progress";
import { cn } from "@/lib/utils";

const emptyLine = { heightMm: "", widthMm: "", baseMm: "", plannedQty: "", fileUrl: "", fileName: "" };
const emptyForm = { customerId: "", salesRep: "", assignedWorkerId: "", notes: "", lines: [{ ...emptyLine }] };

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

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

  async function handleLineFileUpload(index, file) {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/qc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      patchLine(index, "fileUrl", data.photoUrl);
      patchLine(index, "fileName", file.name);
      toast.success("File attached");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  }

  function openCreateDialog() {
    setErrors({});
    setForm(emptyForm);
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
          <p className="text-muted-foreground">Sales Rep · Assign worker · Order Line dimensions & files</p>
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
              <TableHead>Customer / Sales Rep / Worker</TableHead>
              <TableHead>Order Lines (Dimensions)</TableHead>
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
                      <p className="font-medium">{o.customer?.name} {o.customer?.companyName ? `(${o.customer.companyName})` : ""}</p>
                      {o.salesRep && (
                        <p className="text-xs text-muted-foreground">
                          Sales Rep: <strong className="text-foreground font-medium">{o.salesRep}</strong>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Worker: {o.assignedWorker?.name || "Unassigned"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="pt-3">
                    <div className="space-y-2">
                      {getOrderLineProgressRows(o).map((row) => (
                        <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">L{row.lineNo}</span>
                          <span className="font-mono font-medium">{row.bagSpecName}</span>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Customer" required error={errors.customerId}>
                <SearchableSelect
                  value={form.customerId}
                  onValueChange={(v) => patchForm("customerId", v)}
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.companyName ? ` (${c.companyName})` : ""}`,
                    description: c.phone || c.email || undefined,
                  }))}
                  placeholder="Select customer"
                  searchPlaceholder="Search customer..."
                  error={!!errors.customerId}
                />
              </FormField>

              <FormField label="Sales Rep" error={errors.salesRep}>
                <Input
                  className={fieldClassName("", !!errors.salesRep)}
                  value={form.salesRep}
                  onChange={(e) => patchForm("salesRep", e.target.value)}
                  placeholder="Sales Rep Name"
                />
              </FormField>
            </div>

            <FormField label="Assign worker" required error={errors.assignedWorkerId}>
              <SearchableSelect
                value={form.assignedWorkerId}
                onValueChange={(v) => patchForm("assignedWorkerId", v)}
                options={workers.map((w) => ({
                  value: w.id,
                  label: w.name,
                  description: w.email,
                }))}
                placeholder="Select responsible worker"
                searchPlaceholder="Search worker..."
                error={!!errors.assignedWorkerId}
              />
            </FormField>

            <FormField label="Notes" error={errors.notes}>
              <Input
                className={fieldClassName("", !!errors.notes)}
                value={form.notes}
                onChange={(e) => patchForm("notes", e.target.value)}
                placeholder="Optional order notes"
              />
            </FormField>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Order Lines (Bag Specs)</p>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </Button>
              </div>

              {form.lines.map((line, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border p-3 bg-muted/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Line #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={form.lines.length <= 1}
                      className="h-7 text-xs text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <FormField label="Height (mm)" required>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.heightMm}
                        onChange={(e) => patchLine(index, "heightMm", e.target.value)}
                        placeholder="Height"
                      />
                    </FormField>
                    <FormField label="Width (mm)" required>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.widthMm}
                        onChange={(e) => patchLine(index, "widthMm", e.target.value)}
                        placeholder="Width"
                      />
                    </FormField>
                    <FormField label="Base (mm)" required>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.baseMm}
                        onChange={(e) => patchLine(index, "baseMm", e.target.value)}
                        placeholder="Base"
                      />
                    </FormField>
                    <FormField label="Qty (bags)" required>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.plannedQty}
                        onChange={(e) => patchLine(index, "plannedQty", e.target.value)}
                        placeholder="Qty"
                      />
                    </FormField>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        className="text-xs w-[220px]"
                        onChange={(e) => e.target.files?.[0] && handleLineFileUpload(index, e.target.files[0])}
                      />
                      {uploadingIndex === index && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {line.fileUrl && (
                        <a
                          href={line.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline flex items-center gap-1"
                        >
                          <Paperclip className="h-3 w-3" />
                          {line.fileName || "View Attachment"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
