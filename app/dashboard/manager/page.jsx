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

export default function ManagerDashboard() {
  const [kpis, setKpis] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review / Approval Modal State
  const [reviewOrder, setReviewOrder] = useState(null);
  const [approvedTotal, setApprovedTotal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, ordersRes] = await Promise.all([
        api.get("/kpi").catch(() => ({ data: { kpis: null } })),
        api.get("/orders"),
      ]);
      setKpis(kpiRes.data?.kpis || null);
      setOrders(ordersRes.data.orders || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingApprovals = orders.filter((o) => o.status === "PENDING_APPROVAL");

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
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmittingReview(false);
    }
  }

  const kpiCards = [
    {
      title: "Pending Approvals",
      value: pendingApprovals.length,
      subtitle: "Awaiting manager review",
      icon: Clock,
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Ready for Work",
      value: orders.filter((o) => ["READY_FOR_WORK", "APPROVED"].includes(o.status)).length,
      subtitle: "Available for workers",
      icon: ShoppingBag,
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    },
    {
      title: "In Progress Orders",
      value: orders.filter((o) => ["IN_PROGRESS", "RUNNING"].includes(o.status)).length,
      subtitle: "Active production",
      icon: Factory,
      color: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    },
    {
      title: "Total Orders",
      value: orders.length,
      subtitle: "All order proposals",
      icon: TrendingUp,
      color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-muted-foreground">Review commercial sales proposals and monitor orders</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {kpi.title}
                    </p>
                    <span className="text-2xl font-bold">{loading ? "…" : kpi.value}</span>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Approval Queue Section */}
      {pendingApprovals.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse" /> Orders Pending Approval Queue ({pendingApprovals.length})
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Sales & Production Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Full pipeline from sales proposal to completion</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/manager/inventory">View Inventory</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No</TableHead>
                <TableHead>Customer / Sales Rep</TableHead>
                <TableHead>Lines Specs</TableHead>
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
                    No orders in database
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
                      {o.status === "PENDING_APPROVAL" ? (
                        <Button
                          size="sm"
                          onClick={() => openReviewModal(o)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                        >
                          Review
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReviewModal(o)}
                          className="h-8 text-xs"
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review & Approval Modal */}
      <Dialog open={!!reviewOrder} onOpenChange={() => setReviewOrder(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {reviewOrder && (
            <>
              <DialogHeader className="border-b pb-3">
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="font-mono text-lg flex items-center gap-2">
                      Review Commercial Proposal: {reviewOrder.orderNo}
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
                {/* Order Lines Specifications */}
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

                {/* Commercial Pricing Review Inputs */}
                <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Commercial Price Review
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Sales Rep Proposed Price</span>
                      <p className="font-mono text-lg font-bold text-foreground">
                        ${Number(reviewOrder.proposedTotal || reviewOrder.total || 0).toFixed(2)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Original quote proposed by sales rep is preserved in history.
                      </p>
                    </div>

                    <FormField label="Manager Approved Price ($)">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvedTotal}
                        onChange={(e) => setApprovedTotal(e.target.value)}
                        placeholder="Approved commercial total"
                        className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-background"
                      />
                    </FormField>
                  </div>

                  <FormField label="Manager Remarks / Approval Notes">
                    <Input
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Price confirmed, approved for production..."
                      className="bg-background"
                    />
                  </FormField>
                </div>

                {/* Approval History Trail */}
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Previous Approval History
                  </h4>
                  {Array.isArray(reviewOrder.approvals) && reviewOrder.approvals.length > 0 ? (
                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                      {reviewOrder.approvals.map((app, aIdx) => (
                        <div key={app.id || aIdx} className="p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span>Status: {app.status}</span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatDateTime(app.reviewedAt || app.createdAt)}
                            </span>
                          </div>
                          {app.remarks && <p className="text-muted-foreground">"{app.remarks}"</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic border p-3 rounded">
                      No previous approval attempts.
                    </p>
                  )}
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
