"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { FormField } from "@/components/ui/form-field";
import { CustomerQuoteSection } from "@/components/orders/customer-quote-section";
import { bagSizeLabel } from "@/lib/order-labels";
import { bagWeightLabel, formatWeight, matchedRollBagWeight } from "@/lib/paper-sizing";
import { MaterialSourcingSection } from "@/components/orders/material-sourcing-section";
import { EDITABLE_ORDER_STATUSES } from "@/lib/validations/sales-order";
import { OrderRowActions } from "@/components/orders/order-row-actions";
import { OrderLineMaterialsDialog } from "@/components/orders/order-line-materials-dialog";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { ORDER_STATUS_COLORS, getOrderLineProgressRows } from "@/lib/order-progress";
import { cn, formatDateTime } from "@/lib/utils";
import { formatKWD } from "@/lib/currency";

const STATUS_COLORS = {
  ...ORDER_STATUS_COLORS,
  DRAFT: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-400/40",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-semibold",
  APPROVED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-semibold",
  PENDING_CUSTOMER_APPROVAL: "bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/40 font-semibold",
  CUSTOMER_APPROVED: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/40 font-semibold",
  READY_FOR_WORK: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 font-semibold",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/40 font-semibold",
};

export default function AdminProductionOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState("active"); // "active" | "cancelled" | "archived"

  // Review / Approval Modal State
  const [reviewOrder, setReviewOrder] = useState(null);
  const [materialsDialogLine, setMaterialsDialogLine] = useState(null);
  const [approvedTotal, setApprovedTotal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [materialSources, setMaterialSources] = useState({});

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

  const pendingApprovals = orders.filter((o) => o.status === "PENDING_APPROVAL");

  // Three-way partition: archived hides an order regardless of status.
  const viewFilteredOrders = orders.filter((o) => {
    if (viewFilter === "archived") return o.isArchived;
    if (o.isArchived) return false;
    return viewFilter === "cancelled" ? o.status === "CANCELLED" : o.status !== "CANCELLED";
  });

  function openReviewModal(o) {
    setReviewOrder(o);
    setApprovedTotal(
      o.proposedTotal || o.total
        ? parseFloat(o.proposedTotal || o.total).toFixed(2)
        : "",
    );
    setRemarks("");
    setMaterialSources({});
  }

  // Keep the open review dialog + the list row in sync after a Customer
  // Quote Approval / cliche / send-to-production action, without closing it
  function applyOrderUpdate(updatedOrder) {
    setReviewOrder(updatedOrder);
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
  }

  // Row-menu actions (archive/cancel) fire with no dialog open.
  function updateOrderInList(updatedOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
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
        materialSources: action === "APPROVE" ? materialSources : undefined,
      });

      toast.success(
        action === "APPROVE"
          ? "Order approved — quote generated, ready to send to the customer"
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
          <h1 className="text-2xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground text-sm">
            Manage paper bag sales proposals, review commercial pricing, and assign orders
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/dashboard/admin/production/new">
            <Plus className="h-4 w-4 mr-2" /> New Order Proposal
          </Link>
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
                      {formatKWD(o.proposedTotal || o.total)}
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
              ) : viewFilteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                viewFilteredOrders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="align-top cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/dashboard/admin/production/${o.id}`)}
                  >
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
                              L{l.lineNo || lIdx + 1}: {bagSizeLabel(l)}
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
                        Proposed: {formatKWD(o.proposedTotal || o.total)}
                      </div>
                      {o.approvedTotal && (
                        <div className="text-xs text-emerald-600 font-semibold">
                          Approved: {formatKWD(o.approvedTotal)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pt-4">
                      <Badge variant="outline" className={cn("font-medium text-xs", STATUS_COLORS[o.status] || "")}>
                        {o.status}
                      </Badge>
                      {o.isArchived && (
                        <Badge variant="outline" className="ml-1 text-[10px] bg-gray-500/10 text-gray-600 border-gray-400/40">
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pt-4 space-x-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReviewModal(o)}
                        className="h-8 text-xs"
                      >
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                      {EDITABLE_ORDER_STATUSES.includes(o.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 text-xs border-primary/40 text-primary"
                        >
                          <Link href={`/dashboard/admin/production/${o.id}/edit`}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Link>
                        </Button>
                      )}
                      <OrderRowActions order={o} onUpdated={updateOrderInList} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                    {(() => {
                      const progressByLine = new Map(
                        getOrderLineProgressRows(reviewOrder).map((r) => [r.key, r]),
                      );
                      return (reviewOrder.lines || []).map((l, i) => {
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
                          <span>Paper Color: <strong>{l.paperColor || "White"}</strong></span>
                          <span>Paper Type: <strong>{l.paperType || "Virgin"}</strong></span>
                          <span>Colors: <strong>{l.colorCount ?? 0} Print Color(s)</strong></span>
                          <span>Handle: <strong>{l.withHandle ? "Yes" : "No"}</strong></span>
                          {(() => {
                            const bagWeight = matchedRollBagWeight(l);
                            return bagWeight ? (
                              <span title={bagWeightLabel(bagWeight)}>
                                Bag Weight: <strong>{formatWeight(bagWeight.perBagG, "g")}</strong>
                              </span>
                            ) : null;
                          })()}
                          {l.lineTotal && (
                            <span className="font-mono text-foreground font-medium">
                              Line Price: {formatKWD(l.lineTotal)}
                            </span>
                          )}
                          {Number(l.clicheCharge) > 0 && (
                            <span className="font-mono text-foreground font-medium">
                              Cliché: {formatKWD(l.clicheCharge)}
                            </span>
                          )}
                          {Array.isArray(l.suggestedMaterials) && l.suggestedMaterials.length > 0 && (
                            <span className="font-mono text-foreground font-medium">
                              Est. Material Cost:{" "}
                              {formatKWD(
                                l.suggestedMaterials.reduce(
                                  (sum, sm) => sum + Number(sm.suggestedCost || 0),
                                  0,
                                ),
                              )}
                            </span>
                          )}
                          {Array.isArray(l.suggestedMaterials) && l.suggestedMaterials.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => setMaterialsDialogLine(l)}
                            >
                              View Details
                            </Button>
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
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Pricing Review — only relevant while awaiting internal approval */}
                {reviewOrder.status === "PENDING_APPROVAL" && (
                  <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-600" /> Commercial Price Review
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Proposed Price</span>
                        <p className="font-mono text-lg font-bold text-foreground">
                          {formatKWD(reviewOrder.proposedTotal || reviewOrder.total)}
                        </p>
                      </div>

                      <div>
                        <span className="text-xs text-muted-foreground">Est. Cost (materials + clichés)</span>
                        <p className="font-mono text-lg font-bold text-foreground">
                          {formatKWD(
                            (reviewOrder.lines || []).reduce(
                              (sum, l) =>
                                sum +
                                Number(l.clicheCharge || 0) +
                                (l.suggestedMaterials || []).reduce((s, sm) => s + Number(sm.suggestedCost || 0), 0),
                              0,
                            ),
                          )}
                        </p>
                      </div>

                      <FormField label="Approved Price (KWD)" hint="Change it to revise the price — the customer quote shows the difference as a price adjustment.">
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
                )}

                {reviewOrder.status === "PENDING_APPROVAL" && (
                  <MaterialSourcingSection orderId={reviewOrder.id} value={materialSources} onChange={setMaterialSources} />
                )}

                <CustomerQuoteSection order={reviewOrder} onUpdate={applyOrderUpdate} />
              </div>

              {reviewOrder.status === "PENDING_APPROVAL" ? (
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
              ) : (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReviewOrder(null)}>
                    Close
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <OrderLineMaterialsDialog line={materialsDialogLine} onOpenChange={setMaterialsDialogLine} />
    </div>
  );
}
