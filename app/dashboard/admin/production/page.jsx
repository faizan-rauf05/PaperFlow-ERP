"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, Loader2 } from "lucide-react";
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
import { productionOrderSchema } from "@/lib/validations/admin-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  PENDING: "bg-muted text-muted-foreground",
  RUNNING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-destructive/15 text-destructive",
};

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer: "", bagSpecId: "", plannedQty: "" });
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, specsRes] = await Promise.all([
        api.get("/production/orders"),
        api.get("/bag-specs"),
      ]);
      setOrders(ordersRes.data.orders || []);
      setSpecs(specsRes.data.specs || []);
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
    setForm({ customer: "", bagSpecId: "", plannedQty: "" });
    setErrors({});
    setDialogOpen(true);
  }

  async function handleCreate() {
    const result = validateForm(productionOrderSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post("/production/orders", result.data);
      toast.success(`Order ${data.order.orderNo} created`);
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
          <h1 className="text-2xl font-bold">Production Orders</h1>
          <p className="text-muted-foreground">10-stage bag production pipeline</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Order</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Bag Spec</TableHead>
              <TableHead className="text-right">Planned Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-medium">{o.orderNo}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{o.bagSpec?.name || "—"}</TableCell>
                <TableCell className="text-right">{o.plannedQty?.toLocaleString()}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[o.status] || ""}>{o.status}</Badge></TableCell>
                <TableCell>{formatDate(o.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/admin/production/${o.id}`}><Eye className="h-4 w-4 mr-1" />View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Production Order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Customer" required error={errors.customer}>
              <Input className={fieldClassName("", !!errors.customer)} value={form.customer} onChange={(e) => patchForm("customer", e.target.value)} />
            </FormField>
            <FormField label="Bag specification" required error={errors.bagSpecId}>
              <Select value={form.bagSpecId} onValueChange={(v) => patchForm("bagSpecId", v)}>
                <SelectTrigger className={cn(errors.bagSpecId && "border-destructive")}><SelectValue placeholder="Select spec" /></SelectTrigger>
                <SelectContent>{specs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Planned quantity (bags)" required error={errors.plannedQty}>
              <Input type="number" min="1" step="1" className={fieldClassName("", !!errors.plannedQty)} value={form.plannedQty} onChange={(e) => patchForm("plannedQty", e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
