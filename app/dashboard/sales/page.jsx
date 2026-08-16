"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  Edit,
  Send,
  Upload,
  LogOut,
  Building,
  UserCheck,
  FileDown,
  Sparkles,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn, formatDateTime } from "@/lib/utils";

const ORDER_STATUS_CONFIG = {
  DRAFT: { label: "Draft", cls: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-400/40" },
  PENDING_APPROVAL: { label: "Pending Approval", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-semibold" },
  APPROVED: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-semibold" },
  READY_FOR_WORK: { label: "Ready for Work", cls: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 font-semibold" },
  PICKED: { label: "Picked", cls: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 font-semibold" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 font-semibold" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-600/20 text-emerald-900 dark:text-emerald-200 border-emerald-600/50 font-bold" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/15 text-destructive border-destructive/40 font-semibold" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-500/20 text-gray-500 border-gray-500/30" },
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

export default function SalesDashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Order Create / Edit Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLineIndex, setUploadingLineIndex] = useState(null);

  // Form Fields
  const [customerId, setCustomerId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState([]); // Empty by default

  // Inspection Modal State
  const [inspectOrder, setInspectOrder] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, custRes] = await Promise.all([
        api.get("/orders"),
        api.get("/customers").catch(() => ({ data: { customers: [] } })),
      ]);

      setOrders(ordersRes.data.orders || []);
      setCustomers(custRes.data.customers || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  // Open Create Dialog
  function openCreateOrder() {
    setEditingOrder(null);
    setCustomerId(customers[0]?.id || "");
    setPriority("NORMAL");
    setDeliveryDate("");
    setNotes("");
    setDiscount("0");
    setLines([]); // No default lines
    setDialogOpen(true);
  }

  // Open Edit Dialog
  function openEditOrder(order) {
    setEditingOrder(order);
    setCustomerId(order.customerId || "");
    setPriority(order.priority || "NORMAL");
    setDeliveryDate(order.deliveryDate ? order.deliveryDate.split("T")[0] : "");
    setNotes(order.notes || "");
    setDiscount(order.discount ? parseFloat(order.discount).toFixed(2) : "0.00");

    if (Array.isArray(order.lines) && order.lines.length > 0) {
      setLines(
        order.lines.map((l) => ({
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

    setDialogOpen(true);
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

      // Auto calculation: lineTotal = qty * unitPrice or unitPrice = lineTotal / qty
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

  // File upload handler for reference files (up to 5 per line)
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

  // Submit Sales Order
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
        salesRepId: session?.user?.id || undefined,
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
        toast.success(
          targetStatus === "PENDING_APPROVAL"
            ? "Order updated and submitted for manager approval"
            : "Order draft saved",
        );
      } else {
        await api.post("/orders", payload);
        toast.success(
          targetStatus === "PENDING_APPROVAL"
            ? "Order proposal submitted for manager approval!"
            : "Order saved as draft",
        );
      }

      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const customerName = (o.customer?.name || "").toLowerCase();
      const orderNo = (o.orderNo || "").toLowerCase();
      const salesRep = (o.salesRepUser?.name || o.salesRep || "").toLowerCase();
      return customerName.includes(q) || orderNo.includes(q) || salesRep.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" /> Sales Order Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Create paper bag proposals, track approval status, and manage customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateOrder} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New Order Proposal
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign Out">
            <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Orders</p>
              <span className="text-2xl font-bold">{orders.length}</span>
            </div>
            <FileText className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">Pending Approval</p>
              <span className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                {orders.filter((o) => o.status === "PENDING_APPROVAL").length}
              </span>
            </div>
            <Clock className="h-6 w-6 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Approved / Ready</p>
              <span className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                {orders.filter((o) => ["APPROVED", "READY_FOR_WORK"].includes(o.status)).length}
              </span>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-destructive uppercase">Rejected</p>
              <span className="text-2xl font-bold text-destructive">
                {orders.filter((o) => o.status === "REJECTED").length}
              </span>
            </div>
            <XCircle className="h-6 w-6 text-destructive" />
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Order #, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_FOR_WORK", "IN_PROGRESS", "COMPLETED", "REJECTED"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="text-xs shrink-0"
            >
              {st === "ALL" ? "All Orders" : ORDER_STATUS_CONFIG[st]?.label || st}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Sales Rep</th>
                <th className="py-3 px-4">Lines & Specs</th>
                <th className="py-3 px-4 text-right">Proposed Price</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const statusInfo = ORDER_STATUS_CONFIG[o.status] || {
                    label: o.status,
                    cls: "bg-gray-100",
                  };
                  const latestApproval = o.approvals?.[0];

                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                        {o.orderNo}
                        {o.priority && o.priority !== "NORMAL" && (
                          <Badge className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300">
                            {o.priority}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {o.customer?.name || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        {o.salesRepUser?.name || o.salesRep || "Unassigned"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {o.lines?.length || 0} line(s) ·{" "}
                        {o.lines?.[0]
                          ? `${o.lines[0].widthCm}x${o.lines[0].heightCm}x${o.lines[0].baseCm}cm (${o.lines[0].paperColor || "White"} ${o.lines[0].paperType || "Virgin"})`
                          : "Custom Paper Bag"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground">
                        ${Number(o.proposedTotal || o.total || 0).toFixed(2)}
                        {o.approvedTotal && Number(o.approvedTotal) !== Number(o.proposedTotal) && (
                          <span className="block text-[11px] text-emerald-600 font-normal">
                            Approved: ${Number(o.approvedTotal).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="outline" className={cn("text-xs py-0.5", statusInfo.cls)}>
                          {statusInfo.label}
                        </Badge>
                        {latestApproval?.remarks && (
                          <p className="text-[11px] text-muted-foreground italic truncate max-w-[140px] mx-auto mt-0.5">
                            "{latestApproval.remarks}"
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectOrder(o)}
                          className="h-8 text-xs"
                          title="View Details & Approval History"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        {["DRAFT", "REJECTED", "PENDING_APPROVAL", "APPROVED"].includes(o.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditOrder(o)}
                            className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create / Edit Order Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editingOrder ? `Edit Order (${editingOrder.orderNo})` : "Create New Paper Bag Proposal"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Top Info Grid */}
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

              {/* Sales Representative (Read-only for Sales Dashboard) */}
              <FormField label="Sales Representative">
                <Input
                  value={session?.user?.name || "Sales Representative"}
                  readOnly
                  className="bg-muted font-medium cursor-not-allowed"
                />
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

                    {/* Dimensions in cm (Step = 1) */}
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

                    {/* Qty, Paper Type, Paper Color, Color Count */}
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
                            name={`handle-${idx}`}
                            checked={line.withHandle === true}
                            onChange={() => updateLine(idx, "withHandle", true)}
                            className="accent-primary"
                          />
                          <span>With Handle</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`handle-${idx}`}
                            checked={line.withHandle === false}
                            onChange={() => updateLine(idx, "withHandle", false)}
                            className="accent-primary"
                          />
                          <span>Without Handle</span>
                        </label>
                      </div>
                    </div>

                    {/* Pricing per line (Step = 0.01) */}
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

                    {/* Reference / Design Files Upload */}
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

            {/* Notes & Delivery Date */}
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
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleSaveOrder("PENDING_APPROVAL")} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for Approval
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspection & Approval History Modal */}
      <Dialog open={!!inspectOrder} onOpenChange={() => setInspectOrder(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {inspectOrder && (
            <>
              <DialogHeader className="border-b pb-3">
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="font-mono text-lg flex items-center gap-2">
                      Order #{inspectOrder.orderNo}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                      Customer: <strong className="text-foreground">{inspectOrder.customer?.name}</strong> · Sales Rep:{" "}
                      <strong>{inspectOrder.salesRepUser?.name || inspectOrder.salesRep}</strong>
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(ORDER_STATUS_CONFIG[inspectOrder.status]?.cls)}>
                    {ORDER_STATUS_CONFIG[inspectOrder.status]?.label || inspectOrder.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-3">
                {/* Line Items Details */}
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Line Items & Specifications
                  </h4>
                  <div className="border rounded-md divide-y">
                    {(inspectOrder.lines || []).map((l, i) => (
                      <div key={i} className="p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            Line #{l.lineNo || i + 1}: {l.widthCm || (l.widthMm ? l.widthMm / 10 : 30)}cm (W) × {l.heightCm || (l.heightMm ? l.heightMm / 10 : 40)}cm (H) × {l.baseCm || (l.baseMm ? l.baseMm / 10 : 12)}cm (Base)
                          </span>
                          <span className="font-mono text-foreground font-bold">
                            {Number(l.quantity || l.plannedQty).toLocaleString()} bags
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                          <span>Paper: <strong>{l.paperColor || "White"} ({l.paperType || "Virgin"})</strong></span>
                          <span>Colors: <strong>{l.colorCount ?? 0}</strong></span>
                          <span>Handle: <strong>{l.withHandle ? "Yes" : "No"}</strong></span>
                          {l.lineTotal && (
                            <span className="font-mono text-foreground font-medium">
                              Line Total: ${Number(l.lineTotal).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Reference Files */}
                        {Array.isArray(l.referenceFiles) && l.referenceFiles.length > 0 && (
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-muted-foreground font-medium">Reference Files:</span>
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

                {/* Pricing Summary */}
                <div className="p-3 bg-muted/50 rounded-md border flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Proposed Total:</span>{" "}
                    <strong className="text-sm">${Number(inspectOrder.proposedTotal || inspectOrder.total || 0).toFixed(2)}</strong>
                  </div>
                  {inspectOrder.approvedTotal && (
                    <div className="text-right">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Approved Total:</span>{" "}
                      <strong className="text-sm text-emerald-700 dark:text-emerald-400">${Number(inspectOrder.approvedTotal).toFixed(2)}</strong>
                    </div>
                  )}
                </div>

                {/* Approval History Audit Trail */}
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Manager Approval History Log
                  </h4>
                  {Array.isArray(inspectOrder.approvals) && inspectOrder.approvals.length > 0 ? (
                    <div className="border rounded-md divide-y">
                      {inspectOrder.approvals.map((app, aIdx) => (
                        <div key={app.id || aIdx} className="p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5">
                              {app.status === "APPROVED" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : app.status === "REJECTED" ? (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                              )}
                              Approval Status: {app.status}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatDateTime(app.reviewedAt || app.createdAt)}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Reviewed by: <strong>{app.reviewedBy?.name || app.reviewedBy?.email || "Manager"}</strong>
                          </p>
                          {app.remarks && (
                            <p className="text-foreground bg-muted p-2 rounded text-xs mt-1 border">
                              Remarks: "{app.remarks}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic border p-3 rounded">
                      No approval history recorded yet.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setInspectOrder(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
