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
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const EMPTY_CLICHE_FORM = {
  widthMm: "",
  heightMm: "",
  colorCount: "",
  ownership: "COMPANY_OWNED",
  source: "PURCHASED_NEW",
  cost: "",
  notes: "",
};

/**
 * Customer quote PDF + response recording + per-line cliche assignment +
 * send-to-production. Shared between Sales and Admin/Manager order review —
 * same controls, same behavior, wherever an order is inspected.
 */
export function CustomerQuoteSection({ order, onUpdate }) {
  const [customerApproved, setCustomerApproved] = useState(true);
  const [approvalMethod, setApprovalMethod] = useState("");
  const [responseRemarks, setResponseRemarks] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [recordingResponse, setRecordingResponse] = useState(false);

  const [markingSent, setMarkingSent] = useState(false);

  const [clicheDialogLine, setClicheDialogLine] = useState(null);
  const [clicheSearch, setClicheSearch] = useState("");
  const [clicheResults, setClicheResults] = useState([]);
  const [clicheSearching, setClicheSearching] = useState(false);
  const [showNewClicheForm, setShowNewClicheForm] = useState(false);
  const [newClicheForm, setNewClicheForm] = useState(EMPTY_CLICHE_FORM);
  const [assigningCliche, setAssigningCliche] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);

  // Reset the response form whenever a different order is being viewed
  useEffect(() => {
    setCustomerApproved(true);
    setApprovalMethod("");
    setResponseRemarks("");
    setEvidenceUrl("");
  }, [order?.id]);

  useEffect(() => {
    if (!clicheDialogLine) return;
    const timer = setTimeout(async () => {
      setClicheSearching(true);
      try {
        const { data } = await api.get("/cliches", {
          params: {
            search: clicheSearch || undefined,
            customerId: order?.customerId || undefined,
          },
        });
        setClicheResults(data.cliches || []);
      } catch (e) {
        // silent — search box, not worth a toast on every keystroke
      } finally {
        setClicheSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clicheDialogLine, clicheSearch]);

  async function refreshOrder() {
    const { data } = await api.get("/orders");
    const refreshed = (data.orders || []).find((o) => o.id === order.id);
    if (refreshed) onUpdate(refreshed);
  }

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

  function openClicheDialog(line) {
    setClicheDialogLine(line);
    setClicheSearch("");
    setClicheResults([]);
    setShowNewClicheForm(false);
    setNewClicheForm(EMPTY_CLICHE_FORM);
  }

  async function handleAssignExistingCliche(clicheId) {
    if (!clicheDialogLine) return;
    setAssigningCliche(true);
    try {
      await api.post(`/order-lines/${clicheDialogLine.id}/cliche`, { clicheId });
      await refreshOrder();
      toast.success("Cliche assigned");
      setClicheDialogLine(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to assign cliche"));
    } finally {
      setAssigningCliche(false);
    }
  }

  async function handleCreateAndAssignCliche() {
    if (!clicheDialogLine) return;
    setAssigningCliche(true);
    try {
      await api.post(`/order-lines/${clicheDialogLine.id}/cliche`, {
        newCliche: { ...newClicheForm, customerId: order?.customerId || undefined },
      });
      await refreshOrder();
      toast.success("Cliche created and assigned");
      setClicheDialogLine(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to create cliche"));
    } finally {
      setAssigningCliche(false);
    }
  }

  async function handleSendToProduction() {
    setSendingToProduction(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/send-to-production`);
      onUpdate(data.order);
      toast.success("Order sent to production");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to send to production"));
    } finally {
      setSendingToProduction(false);
    }
  }

  if (!order) return null;

  const hasQuotes = Array.isArray(order.quoteApprovals) && order.quoteApprovals.length > 0;
  const showClicheSection = ["CUSTOMER_APPROVED", "READY_FOR_WORK", "PICKED", "IN_PROGRESS", "COMPLETED"].includes(
    order.status,
  );

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

      {showClicheSection && (
        <div>
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5 text-primary" /> Cliches (Printing Plates)
          </h4>
          <div className="border rounded-md divide-y">
            {(order.lines || []).map((l, i) => (
              <div key={l.id || i} className="p-3 text-xs flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">Line #{l.lineNo || i + 1}</span>
                  {l.cliche ? (
                    <p className="text-muted-foreground mt-0.5">
                      {l.cliche.code} · {l.cliche.widthMm || "?"}×{l.cliche.heightMm || "?"}mm ·{" "}
                      {l.cliche.ownership === "CUSTOMER_OWNED" ? "Customer-owned" : "Company-owned"}
                    </p>
                  ) : (
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">No cliche assigned</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openClicheDialog(l)}
                  disabled={order.status !== "CUSTOMER_APPROVED"}
                >
                  {l.cliche ? "Change" : "Assign"}
                </Button>
              </div>
            ))}
          </div>
          {order.status === "CUSTOMER_APPROVED" && (
            <div className="mt-3">
              {(() => {
                const missing = (order.lines || []).filter((l) => !l.clicheId);
                return missing.length > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                    {missing.length} of {order.lines.length} line(s) still need a cliche before this can go to production.
                  </p>
                ) : null;
              })()}
              <Button
                size="sm"
                className="w-full"
                disabled={sendingToProduction || (order.lines || []).some((l) => !l.clicheId)}
                onClick={handleSendToProduction}
              >
                {sendingToProduction ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                Send to Production
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cliche Assign/Create Dialog */}
      <Dialog open={!!clicheDialogLine} onOpenChange={(open) => !open && setClicheDialogLine(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Cliche — Line #{clicheDialogLine?.lineNo}</DialogTitle>
          </DialogHeader>

          {!showNewClicheForm ? (
            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by code, customer, or notes..."
                  value={clicheSearch}
                  onChange={(e) => setClicheSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {clicheSearching ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Searching...
                  </div>
                ) : clicheResults.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">No matching cliches found.</p>
                ) : (
                  clicheResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={assigningCliche}
                      onClick={() => handleAssignExistingCliche(c.id)}
                      className="w-full text-left p-3 text-xs hover:bg-muted/60 transition-colors"
                    >
                      <div className="font-medium">{c.code}</div>
                      <div className="text-muted-foreground">
                        {c.widthMm || "?"}×{c.heightMm || "?"}mm · {c.colorCount ?? "?"} colors ·{" "}
                        {c.ownership === "CUSTOMER_OWNED" ? "Customer-owned" : "Company-owned"}
                        {c.customer?.name ? ` · ${c.customer.name}` : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowNewClicheForm(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Log a New Cliche
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Width (mm)">
                  <Input
                    type="number"
                    value={newClicheForm.widthMm}
                    onChange={(e) => setNewClicheForm({ ...newClicheForm, widthMm: e.target.value })}
                  />
                </FormField>
                <FormField label="Height (mm)">
                  <Input
                    type="number"
                    value={newClicheForm.heightMm}
                    onChange={(e) => setNewClicheForm({ ...newClicheForm, heightMm: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Color Count">
                <Input
                  type="number"
                  value={newClicheForm.colorCount}
                  onChange={(e) => setNewClicheForm({ ...newClicheForm, colorCount: e.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Ownership">
                  <Select
                    value={newClicheForm.ownership}
                    onValueChange={(v) => setNewClicheForm({ ...newClicheForm, ownership: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY_OWNED">Company-owned</SelectItem>
                      <SelectItem value="CUSTOMER_OWNED">Customer-owned</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Source">
                  <Select
                    value={newClicheForm.source}
                    onValueChange={(v) => setNewClicheForm({ ...newClicheForm, source: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PURCHASED_NEW">Purchased new</SelectItem>
                      <SelectItem value="CUSTOMER_SUPPLIED">Customer supplied</SelectItem>
                      <SelectItem value="REUSED_EXISTING">Reused existing</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              {newClicheForm.source === "PURCHASED_NEW" && (
                <FormField label="Cost">
                  <Input
                    type="number"
                    value={newClicheForm.cost}
                    onChange={(e) => setNewClicheForm({ ...newClicheForm, cost: e.target.value })}
                  />
                </FormField>
              )}
              <FormField label="Notes">
                <Input
                  value={newClicheForm.notes}
                  onChange={(e) => setNewClicheForm({ ...newClicheForm, notes: e.target.value })}
                  placeholder="Optional"
                />
              </FormField>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowNewClicheForm(false)}>
                  Back to Search
                </Button>
                <Button size="sm" className="flex-1" disabled={assigningCliche} onClick={handleCreateAndAssignCliche}>
                  {assigningCliche ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Save & Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
