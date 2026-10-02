"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2,
  FileText,
  FileDown,
  CheckCircle2,
  XCircle,
  Stamp,
  Upload,
  Loader2,
  PackageCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { cn, formatDateTime } from "@/lib/utils";
import { formatKWD } from "@/lib/currency";
import { clicheDetailsLabel, clicheSizeLabel, lineNeedsCliche } from "@/lib/order-labels";

/**
 * Customer quote PDF + response recording + each line's cliché (chosen in
 * the proposal, read-only here) + send-to-production. Shared between Sales
 * and Admin/Manager order review — same controls, same behavior, wherever an
 * order is inspected — except send-to-production, which only Admin/Manager
 * may do (`canSendToProduction`).
 */
export function CustomerQuoteSection({ order, onUpdate, canSendToProduction = true }) {
  const [customerApproved, setCustomerApproved] = useState(true);
  const [approvalMethod, setApprovalMethod] = useState("");
  const [responseRemarks, setResponseRemarks] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [recordingResponse, setRecordingResponse] = useState(false);

  const [markingSent, setMarkingSent] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);

  // Reset the response form whenever a different order is being viewed
  useEffect(() => {
    setCustomerApproved(true);
    setApprovalMethod("");
    setResponseRemarks("");
    setEvidenceUrl("");
  }, [order?.id]);

  async function handleUploadEvidence(file) {
    if (!file) return;
    setUploadingEvidence(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post("/uploads", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvidenceUrl(data.photoUrl);
      toast.success("Evidence uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to upload evidence"));
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function handleMarkQuoteSent() {
    setMarkingSent(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/mark-quote-sent`);
      onUpdate(data.order);
      toast.success("Quote marked as sent to the customer");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to mark quote as sent"));
    } finally {
      setMarkingSent(false);
    }
  }

  async function handleRecordCustomerResponse() {
    setRecordingResponse(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/customer-approval`, {
        approved: customerApproved,
        approvalMethod: approvalMethod || undefined,
        evidenceUrl: evidenceUrl || undefined,
        remarks: responseRemarks || undefined,
      });
      onUpdate(data.order);
      toast.success(customerApproved ? "Customer approval recorded" : "Customer rejection recorded");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to record customer response"));
    } finally {
      setRecordingResponse(false);
    }
  }

  async function handleSendToProduction() {
    setSendingToProduction(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/send-to-production`);
      onUpdate(data.order);
      if (data.status === "AWAITING_MATERIALS") {
        const moved = data.movedToWarehouse || [];
        toast.success("Sent to production — waiting for the warehouse to pick materials", {
          description: moved.length
            ? `No longer enough in the factory, now picked from the warehouse: ${moved.map((m) => m.name).join(", ")}`
            : undefined,
        });
      } else {
        toast.success("Order sent to production — all materials are in the factory, workers can start");
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to send to production"));
    } finally {
      setSendingToProduction(false);
    }
  }

  if (!order) return null;

  const hasQuotes = Array.isArray(order.quoteApprovals) && order.quoteApprovals.length > 0;
  const missingCliches = (order.lines || []).filter((l) => lineNeedsCliche(l) && !l.clicheId);

  return (
    <>
      {hasQuotes && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Customer Quote Approval
          </h4>
          <div className="border rounded-md p-3 space-y-3 text-xs">
            {order.quoteApprovals.map((q, qIdx) => (
              <div key={q.id || qIdx} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">Quote PDF</p>
                    <p className="text-muted-foreground text-[11px]">
                      {q.sentAt
                        ? `Sent ${formatDateTime(q.sentAt)}`
                        : `Generated ${formatDateTime(q.generatedAt)} — not sent yet`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      q.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : q.status === "REJECTED"
                          ? "bg-destructive/15 text-destructive"
                          : q.status === "GENERATED"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-violet-500/15 text-violet-700 dark:text-violet-400",
                    )}
                  >
                    {q.status === "GENERATED" ? "NOT SENT" : q.status}
                  </span>
                  <Button asChild variant="outline" size="sm" className="h-8">
                    <a href={`/api/orders/${order.id}/quote-pdf`} target="_blank" rel="noreferrer">
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> View PDF
                    </a>
                  </Button>
                </div>
              </div>
            ))}

            {order.status === "APPROVED" && (
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={markingSent}
                  onClick={handleMarkQuoteSent}
                >
                  {markingSent ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1" />
                  )}
                  Mark Quote as Sent
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  The quote is generated but hasn't been sent yet — confirm once you've actually shared it with the customer.
                </p>
              </div>
            )}

            {order.status === "PENDING_CUSTOMER_APPROVAL" && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={customerApproved ? "default" : "outline"}
                    onClick={() => setCustomerApproved(true)}
                    className="flex-1"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Customer Approved
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!customerApproved ? "destructive" : "outline"}
                    onClick={() => setCustomerApproved(false)}
                    className="flex-1"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Customer Rejected
                  </Button>
                </div>
                <Input
                  placeholder="How was this confirmed? (e.g. Signed copy returned, phone call) *"
                  value={approvalMethod}
                  onChange={(e) => setApprovalMethod(e.target.value)}
                  className={cn("text-xs h-8", !approvalMethod.trim() && "border-amber-500/60")}
                />
                <Input
                  placeholder="Remarks (optional)"
                  value={responseRemarks}
                  onChange={(e) => setResponseRemarks(e.target.value)}
                  className="text-xs h-8"
                />
                <div className="flex items-center gap-2">
                  {evidenceUrl ? (
                    <a href={evidenceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Evidence uploaded — view
                    </a>
                  ) : (
                    <label className="inline-flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                      {uploadingEvidence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Attach evidence (optional)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingEvidence}
                        onChange={(e) => handleUploadEvidence(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={recordingResponse || !approvalMethod.trim()}
                  onClick={handleRecordCustomerResponse}
                >
                  {recordingResponse ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Stamp className="h-3.5 w-3.5 mr-1" />
                  )}
                  Record Customer Response
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {(order.lines || []).length > 0 && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 text-primary" /> Clichés (Printing Plates)
          </h4>
          <div className="border rounded-md divide-y">
            {order.lines.map((l, i) => (
              <div key={l.id || i} className="p-3 text-xs flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground">Line #{l.lineNo || i + 1}</p>
                  {l.cliche ? (
                    <>
                      <p className="font-semibold text-sm">{clicheSizeLabel(l.cliche)}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {clicheDetailsLabel(l.cliche)}
                      </p>
                    </>
                  ) : lineNeedsCliche(l) ? (
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">No cliché — edit the order to add one</p>
                  ) : (
                    <p className="text-muted-foreground mt-0.5">Plain bag — no cliché needed</p>
                  )}
                </div>
                {Number(l.clicheCharge) > 0 && (
                  <span className="shrink-0 text-right">
                    <span className="block font-mono font-semibold">{formatKWD(l.clicheCharge)}</span>
                    <span className="text-[11px] text-muted-foreground">Billed at cost</span>
                  </span>
                )}
              </div>
            ))}
          </div>
          {order.status === "CUSTOMER_APPROVED" && (
            <div className="mt-3">
              {missingCliches.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  {missingCliches.length} printed line(s) still need a cliché — edit the order to add it before production.
                </p>
              )}
              {canSendToProduction ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={sendingToProduction || missingCliches.length > 0}
                  onClick={handleSendToProduction}
                >
                  {sendingToProduction ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1" />
                  )}
                  Send to Production
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The customer has approved — an admin or manager sends this order to production.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
