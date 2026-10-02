"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  Edit,
  LogOut,
  Building,
  UserCheck,
  FileDown,
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
import { CustomerQuoteSection } from "@/components/orders/customer-quote-section";
import { OrderRowActions } from "@/components/orders/order-row-actions";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn, formatDateTime } from "@/lib/utils";
import { formatKWD } from "@/lib/currency";
import { bagSizeLabel } from "@/lib/order-labels";
import { getOrderLineProgressRows } from "@/lib/order-progress";
import { EDITABLE_ORDER_STATUSES } from "@/lib/validations/sales-order";

const ORDER_STATUS_CONFIG = {
  DRAFT: { label: "Draft", cls: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-400/40" },
  PENDING_APPROVAL: { label: "Pending Approval", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-semibold" },
  APPROVED: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-semibold" },
  PENDING_CUSTOMER_APPROVAL: { label: "Quote Sent", cls: "bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/40 font-semibold" },
  CUSTOMER_APPROVED: { label: "Customer Approved", cls: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/40 font-semibold" },
  AWAITING_MATERIALS: { label: "Awaiting Materials", cls: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/40 font-semibold" },
  READY_FOR_WORK: { label: "Ready for Work", cls: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 font-semibold" },
  PICKED: { label: "Picked", cls: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 font-semibold" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 font-semibold" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-600/20 text-emerald-900 dark:text-emerald-200 border-emerald-600/50 font-bold" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/15 text-destructive border-destructive/40 font-semibold" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-500/20 text-gray-500 border-gray-500/30" },
};

export default function SalesDashboardPage() {
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewFilter, setViewFilter] = useState("active"); // "active" | "cancelled" | "archived"

  // Inspection Modal State
  const [inspectOrder, setInspectOrder] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders");
      setOrders(data.orders || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep the open inspect dialog + the list row in sync after an action
  function applyOrderUpdate(updatedOrder) {
    setInspectOrder(updatedOrder);
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  }

  // Row-menu actions (archive/cancel) fire with no dialog open — update the
  // list only, don't pop the inspect modal open.
  function updateOrderInList(updatedOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  }

  async function handleLogout() {
    await api.post("/auth/logout");
    router.push("/login");
  }

  // Three-way partition: every order falls into exactly one — archived takes
  // priority over cancelled (an order can be both; archived hides it either way).
  const viewFilteredOrders = orders.filter((o) => {
    if (viewFilter === "archived") return o.isArchived;
    if (o.isArchived) return false;
    return viewFilter === "cancelled" ? o.status === "CANCELLED" : o.status !== "CANCELLED";
  });

  const filteredOrders = viewFilteredOrders.filter((o) => {
    if (viewFilter === "active" && statusFilter !== "ALL" && o.status !== statusFilter) return false;
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
          <Button asChild className="shrink-0">
            <Link href="/dashboard/sales/orders/new">
              <Plus className="h-4 w-4 mr-2" /> New Order Proposal
            </Link>
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

      {/* Active / Cancelled / Archived */}
      <div className="flex items-center gap-2">
        {[
          { key: "active", label: "Active" },
          { key: "cancelled", label: "Cancelled" },
          { key: "archived", label: "Archived" },
        ].map((v) => (
          <Button
            key={v.key}
            variant={viewFilter === v.key ? "default" : "outline"}
            size="sm"
            onClick={() => setViewFilter(v.key)}
            className="text-xs"
          >
            {v.label}
          </Button>
        ))}
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
        {viewFilter === "active" && (
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
        )}
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
                          ? `${bagSizeLabel(o.lines[0])} (${o.lines[0].paperColor || "White"} ${o.lines[0].paperType || "Virgin"})`
                          : "Custom Paper Bag"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground">
                        {formatKWD(o.proposedTotal || o.total)}
                        {o.approvedTotal && Number(o.approvedTotal) !== Number(o.proposedTotal) && (
                          <span className="block text-[11px] text-emerald-600 font-normal">
                            Approved: {formatKWD(o.approvedTotal)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="outline" className={cn("text-xs py-0.5", statusInfo.cls)}>
                          {statusInfo.label}
                        </Badge>
                        {o.isArchived && (
                          <Badge variant="outline" className="ml-1 text-[10px] bg-gray-500/10 text-gray-600 border-gray-400/40">
                            Archived
                          </Badge>
                        )}
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
                        {EDITABLE_ORDER_STATUSES.includes(o.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <Link href={`/dashboard/sales/orders/${o.id}/edit`}>
                              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                            </Link>
                          </Button>
                        )}
                        <OrderRowActions order={o} onUpdated={updateOrderInList} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
                    {(() => {
                      const progressByLine = new Map(
                        getOrderLineProgressRows(inspectOrder).map((r) => [r.key, r]),
                      );
                      return (inspectOrder.lines || []).map((l, i) => {
                        const progress = progressByLine.get(l.id);
                        return (
                      <div key={i} className="p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            Line #{l.lineNo || i + 1}: {bagSizeLabel(l)} (H × W × B)
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
                              Line Total: {formatKWD(l.lineTotal)}
                            </span>
                          )}
                          {progress && progress.stageLabel !== "—" && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                progress.className,
                              )}
                            >
                              Production: {progress.stageLabel}
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
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-3 bg-muted/50 rounded-md border flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Proposed Total:</span>{" "}
                    <strong className="text-sm">{formatKWD(inspectOrder.proposedTotal || inspectOrder.total)}</strong>
                  </div>
                  {inspectOrder.approvedTotal && (
                    <div className="text-right">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Approved Total:</span>{" "}
                      <strong className="text-sm text-emerald-700 dark:text-emerald-400">{formatKWD(inspectOrder.approvedTotal)}</strong>
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

                <CustomerQuoteSection order={inspectOrder} onUpdate={applyOrderUpdate} canSendToProduction={false} />
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
