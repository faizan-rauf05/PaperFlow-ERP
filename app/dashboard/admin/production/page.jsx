"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Factory,
  ShoppingBag,
  TrendingUp,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  FileDown,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Send,
  Edit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { ORDER_STATUS_COLORS } from "@/lib/order-progress";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_COLORS = {
  ...ORDER_STATUS_COLORS,
  DRAFT: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-400/40",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-semibold",
  APPROVED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-semibold",
  READY_FOR_WORK: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 font-semibold",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/40 font-semibold",
};

const PAPER_TYPES = [
  { value: "VIRGIN", label: "Virgin Paper" },
  { value: "RECYCLED", label: "Recycled Paper" },
];

const PAPER_COLORS = [
  { value: "WHITE", label: "White" },
  { value: "BROWN", label: "Brown" },
];

const COLOR_COUNTS = [
  { value: 0, label: "0 (Plain - No Print)" },
  { value: 1, label: "1 Color" },
  { value: 2, label: "2 Colors" },
  { value: 3, label: "3 Colors" },
  { value: 4, label: "4 Colors" },
  { value: 5, label: "5+ Colors" },
];

const emptyLine = {
  widthCm: "",
  heightCm: "",
  baseCm: "",
  quantity: "",
  withHandle: true,
  paperType: "VIRGIN",
  paperColor: "WHITE",
  colorCount: 0,
  unitPrice: "",
  lineTotal: "",
  referenceFiles: [],
};

export default function AdminProductionOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLineIndex, setUploadingLineIndex] = useState(null);

  // Form Fields
  const [customerId, setCustomerId] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState([]); // Empty by default

  // Review / Approval Modal State
  const [reviewOrder, setReviewOrder] = useState(null);
  const [approvedTotal, setApprovedTotal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, custRes, repsRes] = await Promise.all([
        api.get("/orders"),
        api.get("/customers").catch(() => ({ data: { customers: [] } })),
        api.get("/users/sales-reps").catch(() => ({ data: { salesReps: [] } })),
      ]);
      setOrders(ordersRes.data.orders || []);
      setCustomers(custRes.data.customers || []);
      setSalesReps(repsRes.data.salesReps || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingApprovals = orders.filter((o) => o.status === "PENDING_APPROVAL");

  function openCreateDialog() {
    setEditingOrder(null);
    setCustomerId(customers[0]?.id || "");
    setSalesRepId(salesReps[0]?.id || "");
    setPriority("NORMAL");
    setDeliveryDate("");
    setNotes("");
    setDiscount("0");
    setLines([]); // No default lines
    setCreateDialogOpen(true);
  }

  function openEditDialog(o) {
    setEditingOrder(o);
    setCustomerId(o.customerId || "");
    setSalesRepId(o.salesRepId || "");
    setPriority(o.priority || "NORMAL");
    setDeliveryDate(o.deliveryDate ? o.deliveryDate.split("T")[0] : "");
    setNotes(o.notes || "");
    setDiscount(o.discount ? parseFloat(o.discount).toFixed(2) : "0.00");

    if (Array.isArray(o.lines) && o.lines.length > 0) {
      setLines(
        o.lines.map((l) => ({
          widthCm: l.widthCm ? String(l.widthCm) : "",
          heightCm: l.heightCm ? String(l.heightCm) : "",
          baseCm: l.baseCm ? String(l.baseCm) : "",
          quantity: l.quantity ? String(l.quantity) : "",
          withHandle: Boolean(l.withHandle),
          paperType: l.paperType || "VIRGIN",
          paperColor: l.paperColor || "WHITE",
          colorCount: l.colorCount != null ? Number(l.colorCount) : 0,
          unitPrice: l.unitPrice ? parseFloat(l.unitPrice).toFixed(2) : "",
          lineTotal: l.lineTotal ? parseFloat(l.lineTotal).toFixed(2) : "",
          referenceFiles: Array.isArray(l.referenceFiles)
            ? l.referenceFiles
            : l.fileUrl
              ? [{ url: l.fileUrl, name: l.fileName || "Reference File" }]
              : [],
        })),
      );
    } else {
      setLines([]);
    }

    setCreateDialogOpen(true);
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx, field, value) {
    setLines((prev) => {
      const copy = [...prev];
      const updated = { ...copy[idx], [field]: value };

      if (field === "quantity" || field === "unitPrice") {
        const qty = parseFloat(field === "quantity" ? value : updated.quantity) || 0;
        const uPrice = parseFloat(field === "unitPrice" ? value : updated.unitPrice) || 0;
        if (qty > 0 && uPrice > 0) {
          updated.lineTotal = (qty * uPrice).toFixed(2);
        }
      } else if (field === "lineTotal") {
        const total = parseFloat(value) || 0;
        const qty = parseFloat(updated.quantity) || 0;
        if (qty > 0 && total > 0) {
          updated.unitPrice = (total / qty).toFixed(2);
        }
      }

      copy[idx] = updated;
      return copy;
    });
  }

  const subtotal = lines.reduce((acc, l) => acc + (parseFloat(l.lineTotal) || 0), 0);
  const discountVal = parseFloat(discount) || 0;
  const proposedTotal = Math.max(subtotal - discountVal, 0);

  async function handleFileUpload(lineIndex, files) {
    if (!files || files.length === 0) return;
    const currentFiles = lines[lineIndex].referenceFiles || [];
    if (currentFiles.length + files.length > 5) {
      toast.error("Maximum 5 reference files allowed per order line");
      return;
    }

    setUploadingLineIndex(lineIndex);
    try {
      const uploadedList = [...currentFiles];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/uploads", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploadedList.push({
          url: data.photoUrl,
          name: file.name || "Design Reference",
        });
      }

      updateLine(lineIndex, "referenceFiles", uploadedList);
      toast.success("Reference file(s) attached");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingLineIndex(null);
    }
  }

  function removeReferenceFile(lineIndex, fileIdx) {
    const currentFiles = lines[lineIndex].referenceFiles || [];
    const filtered = currentFiles.filter((_, i) => i !== fileIdx);
    updateLine(lineIndex, "referenceFiles", filtered);
  }

  async function handleSaveOrder(targetStatus = "PENDING_APPROVAL") {
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one order line item");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.widthCm || !l.heightCm || !l.baseCm) {
        toast.error(`Line #${i + 1}: Enter width, height, and base in cm`);
        return;
      }
      if (!l.quantity || parseFloat(l.quantity) <= 0) {
        toast.error(`Line #${i + 1}: Enter a valid quantity`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        customerId,
        salesRepId: salesRepId || undefined,
        priority,
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        subtotal,
        discount: discountVal,
        total: proposedTotal,
        proposedTotal,
        lines,
        status: targetStatus,
      };

      if (editingOrder) {
        await api.put(`/orders/${editingOrder.id}`, payload);
        toast.success("Order updated");
      } else {
        await api.post("/orders", payload);
        toast.success("Order created successfully!");
      }

      setCreateDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function openReviewModal(o) {
    setReviewOrder(o);
    setApprovedTotal(
      o.proposedTotal || o.total
        ? parseFloat(o.proposedTotal || o.total).toFixed(2)
        : "",
    );
    setRemarks("");
  }

  async function handleApproveOrReject(action) {
    if (!reviewOrder) return;
    if (action === "REJECT" && !remarks.trim()) {
      toast.error("Please enter a reason / remarks for rejecting the order");
      return;
    }

    setSubmittingReview(true);
    try {
      await api.post(`/orders/${reviewOrder.id}/approve`, {
        action,
        approvedTotal: action === "APPROVE" ? approvedTotal || undefined : undefined,
        remarks: remarks.trim() || undefined,
      });

      toast.success(
        action === "APPROVE"
          ? "Order approved & marked Ready for Work!"
          : "Order proposal rejected",
      );
      setReviewOrder(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Production & Sales Orders</h1>
          <p className="text-muted-foreground text-sm">
            Manage paper bag sales proposals, review commercial pricing, and assign orders
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> New Order Proposal
        </Button>
      </div>

      {/* Pending Approvals Queue */}
      {pendingApprovals.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse" /> Pending Approval Queue ({pendingApprovals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Proposed Total</TableHead>
                  <TableHead>Line Summary</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-bold">{o.orderNo}</TableCell>
                    <TableCell className="font-medium">{o.customer?.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.salesRepUser?.name || o.salesRep || "Unassigned"}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-amber-800 dark:text-amber-300">
                      ${Number(o.proposedTotal || o.total || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.lines?.length || 0} line(s) · {o.lines?.[0]?.paperColor || "White"} {o.lines?.[0]?.paperType || "Virgin"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => openReviewModal(o)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        Review Proposal &rarr;
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Main Orders Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No</TableHead>
                <TableHead>Customer / Sales Rep</TableHead>
                <TableHead>Lines & Specifications</TableHead>
                <TableHead>Commercial Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id} className="align-top">
                    <TableCell className="font-mono font-medium pt-4">
                      {o.orderNo}
                      {o.priority && o.priority !== "NORMAL" && (
                        <Badge className="ml-1 text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300">
                          {o.priority}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pt-4">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm">{o.customer?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Rep: {o.salesRepUser?.name || o.salesRep || "Unassigned"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="pt-3">
                      <div className="space-y-1.5 text-xs">
                        {(o.lines || []).map((l, lIdx) => (
                          <div key={lIdx} className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">
                              L{l.lineNo || lIdx + 1}: {l.widthCm || (l.widthMm ? l.widthMm / 10 : 30)}×
                              {l.heightCm || (l.heightMm ? l.heightMm / 10 : 40)}×
                              {l.baseCm || (l.baseMm ? l.baseMm / 10 : 12)}cm
                            </span>
                            <span className="text-muted-foreground">
                              · {Number(l.quantity || l.plannedQty || 0).toLocaleString()} bags
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0">
                              {l.paperColor || "White"} {l.paperType || "Virgin"} ({l.colorCount ?? 0} colors)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="pt-4 font-mono text-sm">
                      <div>
                        Proposed: ${Number(o.proposedTotal || o.total || 0).toFixed(2)}
                      </div>
                      {o.approvedTotal && (
                        <div className="text-xs text-emerald-600 font-semibold">
                          Approved: ${Number(o.approvedTotal).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pt-4">
                      <Badge variant="outline" className={cn("font-medium text-xs", STATUS_COLORS[o.status] || "")}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pt-4 space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReviewModal(o)}
                        className="h-8 text-xs"
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(o)}
                        className="h-8 text-xs border-primary/40 text-primary"
                      >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              {editingOrder ? `Edit Order (${editingOrder.orderNo})` : "Create New Production / Sales Order"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-muted/40 rounded-lg border">
              <FormField label="Customer" required>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Sales Representative">
                <Select value={salesRepId} onValueChange={setSalesRepId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select sales rep..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salesReps.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Order Priority">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent ⚡</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Order Lines Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Order Line Items & Specifications
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                </Button>
              </div>

              {lines.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center space-y-2 bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    No order line items added yet.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Order Line Item
                  </Button>
                </div>
              ) : (
                lines.map((line, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-card space-y-3 relative shadow-2xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold text-xs text-primary font-mono">
                        Line #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(idx)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Width (cm)" required>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.widthCm}
                          onChange={(e) => updateLine(idx, "widthCm", e.target.value)}
                          placeholder="e.g. 30"
                        />
                      </FormField>
                      <FormField label="Height (cm)" required>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.heightCm}
                          onChange={(e) => updateLine(idx, "heightCm", e.target.value)}
                          placeholder="e.g. 40"
                        />
                      </FormField>
                      <FormField label="Gusset / Base (cm)" required>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.baseCm}
                          onChange={(e) => updateLine(idx, "baseCm", e.target.value)}
                          placeholder="e.g. 12"
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FormField label="Quantity (Bags)" required>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                          placeholder="e.g. 50000"
                        />
                      </FormField>

                      <FormField label="Paper Type">
                        <Select
                          value={line.paperType}
                          onValueChange={(v) => updateLine(idx, "paperType", v)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPER_TYPES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField label="Paper Color">
                        <Select
                          value={line.paperColor}
                          onValueChange={(v) => updateLine(idx, "paperColor", v)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPER_COLORS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField label="Color Count">
                        <Select
                          value={String(line.colorCount)}
                          onValueChange={(v) => updateLine(idx, "colorCount", Number(v))}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_COUNTS.map((c) => (
                              <SelectItem key={c.value} value={String(c.value)}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>

                    {/* Handle Option (Radio Choice) */}
                    <div className="pt-1">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Handle Option
                      </label>
                      <div className="flex items-center gap-4 text-xs font-medium">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`admin-handle-${idx}`}
                            checked={line.withHandle === true}
                            onChange={() => updateLine(idx, "withHandle", true)}
                            className="accent-primary"
                          />
                          <span>With Handle</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`admin-handle-${idx}`}
                            checked={line.withHandle === false}
                            onChange={() => updateLine(idx, "withHandle", false)}
                            className="accent-primary"
                          />
                          <span>Without Handle</span>
                        </label>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <FormField label="Unit Price ($ / bag)">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(idx, "unitPrice", e.target.value)}
                          placeholder="0.00"
                        />
                      </FormField>

                      <FormField label="Line Total ($)">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.lineTotal}
                          onChange={(e) => updateLine(idx, "lineTotal", e.target.value)}
                          placeholder="0.00"
                        />
                      </FormField>
                    </div>

                    {/* Reference Files */}
                    <div className="pt-1">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Reference / Design Files (Max 5 uploaded images or PDFs)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {(line.referenceFiles || []).map((f, fileIdx) => (
                          <div
                            key={fileIdx}
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs border"
                          >
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline max-w-[120px] truncate"
                            >
                              {f.name || `File ${fileIdx + 1}`}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeReferenceFile(idx, fileIdx)}
                              className="text-muted-foreground hover:text-destructive ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        {(line.referenceFiles || []).length < 5 && (
                          <label className="cursor-pointer border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 rounded px-2.5 py-1 text-xs text-primary font-medium flex items-center gap-1">
                            <Upload className="h-3 w-3" />
                            {uploadingLineIndex === idx ? "Uploading..." : "Attach File"}
                            <input
                              type="file"
                              multiple
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileUpload(idx, e.target.files)}
                              className="hidden"
                              disabled={uploadingLineIndex === idx}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Commercial Pricing Summary */}
            <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
              <h4 className="font-semibold text-sm">Commercial Proposal Pricing</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Subtotal Sum</span>
                  <p className="font-mono text-lg font-bold">${subtotal.toFixed(2)}</p>
                </div>
                <FormField label="Discount ($)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold text-primary">
                    Proposed Commercial Total
                  </span>
                  <p className="font-mono text-xl font-bold text-primary">${proposedTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Expected Delivery Date">
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </FormField>
              <FormField label="Special Order Notes / Client Instructions">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Special packing requirement..."
                />
              </FormField>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveOrder("DRAFT")}
              disabled={saving}
            >
              Save as Draft
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleSaveOrder("READY_FOR_WORK")} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Create & Approve Order
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={!!reviewOrder} onOpenChange={() => setReviewOrder(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {reviewOrder && (
            <>
              <DialogHeader className="border-b pb-3">
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="font-mono text-lg flex items-center gap-2">
                      Order Details: {reviewOrder.orderNo}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                      Customer: <strong>{reviewOrder.customer?.name}</strong> · Sales Rep:{" "}
                      <strong>{reviewOrder.salesRepUser?.name || reviewOrder.salesRep}</strong>
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(STATUS_COLORS[reviewOrder.status])}>
                    {reviewOrder.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-3">
                {/* Specifications */}
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Order Lines Specifications
                  </h4>
                  <div className="border rounded-md divide-y">
                    {(reviewOrder.lines || []).map((l, i) => (
                      <div key={i} className="p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            Line #{l.lineNo || i + 1}: {l.widthCm || l.widthMm / 10}cm (W) × {l.heightCm || l.heightMm / 10}cm (H) × {l.baseCm || l.baseMm / 10}cm (Gusset)
                          </span>
                          <span className="font-mono text-foreground font-bold">
                            {Number(l.quantity || l.plannedQty).toLocaleString()} bags
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                          <span>Paper Color: <strong>{l.paperColor || "White"}</strong></span>
                          <span>Paper Type: <strong>{l.paperType || "Virgin"}</strong></span>
                          <span>Colors: <strong>{l.colorCount ?? 0} Print Color(s)</strong></span>
                          <span>Handle: <strong>{l.withHandle ? "Yes" : "No"}</strong></span>
                          {l.lineTotal && (
                            <span className="font-mono text-foreground font-medium">
                              Line Price: ${Number(l.lineTotal).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Reference Files */}
                        {Array.isArray(l.referenceFiles) && l.referenceFiles.length > 0 && (
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-muted-foreground font-medium">Attached Design Files:</span>
                            {l.referenceFiles.map((rf, rIdx) => (
                              <a
                                key={rIdx}
                                href={rf.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 hover:underline"
                              >
                                <FileDown className="h-3 w-3" /> {rf.name || `File ${rIdx + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Review */}
                <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Commercial Price Review
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Proposed Price</span>
                      <p className="font-mono text-lg font-bold text-foreground">
                        ${Number(reviewOrder.proposedTotal || reviewOrder.total || 0).toFixed(2)}
                      </p>
                    </div>

                    <FormField label="Approved Price ($)">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvedTotal}
                        onChange={(e) => setApprovedTotal(e.target.value)}
                        placeholder="Approved total"
                        className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-background"
                      />
                    </FormField>
                  </div>

                  <FormField label="Manager/Admin Remarks">
                    <Input
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Notes..."
                      className="bg-background"
                    />
                  </FormField>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleApproveOrReject("REJECT")}
                  disabled={submittingReview}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject Proposal
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setReviewOrder(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleApproveOrReject("APPROVE")}
                    disabled={submittingReview}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {submittingReview ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve Order
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
