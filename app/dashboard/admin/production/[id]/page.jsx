"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, Loader2, ClipboardEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField, fieldClassName } from "@/components/ui/form-field";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel, QC_STAGE_TYPES } from "@/lib/production-constants";
import { computeSlittingPreview } from "@/lib/slitting-math";
import {
  getOrderCurrentStageBadges,
  getStageTypeColor,
  ORDER_STATUS_COLORS,
} from "@/lib/order-progress";
import { cn } from "@/lib/utils";

function StageRecordForm({ orderId, stage, context, onDone, onCancel }) {
  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paperMaterials, setPaperMaterials] = useState([]);
  const [machines, setMachines] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [form, setForm] = useState({
    materialId: "",
    machineId: "",
    outputQty: "",
    cutWidthMm: "",
    remainderAction: "",
    remainderQty: "",
    pieceCount: "",
    pieceWeightKg: "",
    proofUrls: [],
    remarks: "",
    passedQty: "",
    rejectedQty: "",
    defectTypeId: "",
  });

  const inputQty = context?.inputQty;

  useEffect(() => {
    (async () => {
      try {
        const [mats, mach, defects] = await Promise.all([
          api.get("/materials"),
          api.get("/machines"),
          api.get("/defect-types"),
        ]);
        setPaperMaterials((mats.data.materials || []).filter((m) => m.materialType === "PAPER_ROLL"));
        setMachines((mach.data.machines || []).filter((m) => m.stageType === stage.stageType || !stage.stageType));
        setDefectTypes((defects.data.defectTypes || defects.data.types || []).filter((d) => d.stageType === stage.stageType));
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    })();
  }, [stage.stageType]);

  const slitPreview = useMemo(() => {
    if (stage.stageType !== "SLITTING") return null;
    return computeSlittingPreview({
      inputMeters: inputQty,
      parentWidthMm: context?.paperMaterial?.paperWidthMm,
      cutWidthMm: form.cutWidthMm,
      gsm: context?.paperMaterial?.gsm,
    });
  }, [stage.stageType, inputQty, context?.paperMaterial, form.cutWidthMm]);

  useEffect(() => {
    if (!slitPreview) return;
    setForm((prev) => ({
      ...prev,
      pieceCount: slitPreview.pieceCount || "",
      pieceWeightKg: slitPreview.pieceWeightKg ?? "",
      remainderQty: slitPreview.remainderMeters ? Number(slitPreview.remainderMeters).toFixed(2) : "",
      outputQty: prev.outputQty || (inputQty != null ? String(inputQty) : ""),
    }));
  }, [slitPreview, inputQty]);

  async function uploadProof(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/qc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({ ...prev, proofUrls: [...prev.proofUrls, data.photoUrl] }));
      toast.success("Proof uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = {
        materialId: form.materialId || context?.paperMaterial?.id || undefined,
        machineId: form.machineId || undefined,
        outputQty: isQc ? form.passedQty : form.outputQty,
        proofUrls: form.proofUrls,
        remarks: form.remarks,
        cutWidthMm: form.cutWidthMm || undefined,
        pieceCount: form.pieceCount || undefined,
        pieceWeightKg: form.pieceWeightKg || undefined,
        remainderAction: form.remainderAction || undefined,
        remainderQty: form.remainderQty || undefined,
        qc: isQc
          ? {
              passedQty: form.passedQty,
              rejectedQty: form.rejectedQty || 0,
              defectTypeId: form.defectTypeId || undefined,
            }
          : undefined,
      };
      await api.post(`/production/orders/${orderId}/stages/${stage.id}/record`, payload);
      toast.success("Stage recorded");
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {stage.sequence > 1 && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Prefill input: <strong>{inputQty ?? "—"}</strong> {stage.inputUnit}
        </div>
      )}

      {stage.stageType === "RAW_MATERIAL" && (
        <>
          <FormField label="Paper material" required>
            <Select value={form.materialId} onValueChange={(v) => setForm((p) => ({ ...p, materialId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select paper" /></SelectTrigger>
              <SelectContent>
                {paperMaterials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Meters issued" required>
            <Input type="number" min="0" step="0.01" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
          </FormField>
        </>
      )}

      {stage.stageType === "SLITTING" && (
        <>
          <FormField label="Cut width (mm)" required>
            <Input type="number" min="1" value={form.cutWidthMm} onChange={(e) => setForm((p) => ({ ...p, cutWidthMm: e.target.value }))} />
          </FormField>
          {slitPreview && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Pieces across width: {slitPreview.pieceCount}</p>
              <p>Each piece length: {inputQty} m · Est. piece weight: {slitPreview.pieceWeightKg != null ? `${Number(slitPreview.pieceWeightKg).toFixed(3)} kg` : "—"}</p>
              <p>Remainder length (width scrap): {Number(slitPreview.remainderMeters || 0).toFixed(2)} m</p>
            </div>
          )}
          <FormField label="Usable output length (m)" required>
            <Input type="number" min="0" step="0.01" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
          </FormField>
          {Number(form.remainderQty) > 0 && (
            <FormField label="Remainder action" required>
              <Select value={form.remainderAction} onValueChange={(v) => setForm((p) => ({ ...p, remainderAction: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Waste or Restock" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WASTE">Waste</SelectItem>
                  <SelectItem value="RESTOCK">Restock</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          )}
        </>
      )}

      {stage.stageType === "PRINTING" && (
        <FormField label="Printed meters" required>
          <Input type="number" min="0" step="0.01" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
          {inputQty != null && form.outputQty !== "" && (
            <p className="text-xs text-muted-foreground mt-1">Waste (auto): {(Number(inputQty) - Number(form.outputQty || 0)).toFixed(2)} m</p>
          )}
        </FormField>
      )}

      {isQc && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Passed" required>
            <Input type="number" min="0" value={form.passedQty} onChange={(e) => setForm((p) => ({ ...p, passedQty: e.target.value }))} />
          </FormField>
          <FormField label="Rejected">
            <Input type="number" min="0" value={form.rejectedQty} onChange={(e) => setForm((p) => ({ ...p, rejectedQty: e.target.value }))} />
          </FormField>
          {defectTypes.length > 0 && (
            <FormField label="Defect type" className="col-span-2">
              <Select value={form.defectTypeId} onValueChange={(v) => setForm((p) => ({ ...p, defectTypeId: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {defectTypes.map((d) => <SelectItem key={d.id} value={d.id}>{d.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
      )}

      {stage.stageType === "HANDLE_MAKING_PASTING" && (
        <>
          {context?.handleCapacity && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              <p>Handle capacity (from rope + meters): <strong>{Math.floor(context.handleCapacity.capacityBags)}</strong> bags</p>
              <p className="text-muted-foreground">Rope stock: {context.handleCapacity.ropeStock} · Handles/bag: {context.handleCapacity.handlesPerBag}</p>
            </div>
          )}
          <FormField label="Bags produced (handles pasted)" required>
            <Input type="number" min="1" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
          </FormField>
        </>
      )}

      {stage.stageType === "PACKING" && (
        <FormField label="Cartons packed" required>
          <Input type="number" min="1" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
        </FormField>
      )}

      {stage.stageType === "DISPATCH" && (
        <FormField label="Cartons dispatched" required>
          <Input type="number" min="1" value={form.outputQty} onChange={(e) => setForm((p) => ({ ...p, outputQty: e.target.value }))} />
        </FormField>
      )}

      {machines.length > 0 && (
        <FormField label="Machine">
          <Select value={form.machineId} onValueChange={(v) => setForm((p) => ({ ...p, machineId: v }))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      )}

      <FormField label="Proof images" required>
        <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])} />
        <div className="flex flex-wrap gap-2 mt-2">
          {form.proofUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{url}</a>
          ))}
        </div>
      </FormField>

      <FormField label="Remarks">
        <Input value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
      </FormField>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving || uploading}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save record
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function ProductionOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recordStage, setRecordStage] = useState(null);
  const [recordContext, setRecordContext] = useState(null);
  const [previewStage, setPreviewStage] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/production/orders/${id}`);
      setOrder(data.order);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/workers");
        setWorkers(data.workers || []);
      } catch {
        /* non-blocking */
      }
    })();
  }, []);

  async function openRecord(stage) {
    setLoadingContext(true);
    setRecordStage(stage);
    try {
      const { data } = await api.get(`/production/orders/${id}/stages/${stage.id}/record`);
      setRecordContext(data.context);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setRecordStage(null);
    } finally {
      setLoadingContext(false);
    }
  }

  async function reassignWorker(workerId) {
    if (!workerId) return;
    setAssigning(true);
    try {
      const { data } = await api.patch(`/production/orders/${id}/assign`, {
        assignedWorkerId: workerId,
      });
      setOrder(data.order);
      toast.success("Worker assigned");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!order) {
    return <p className="text-muted-foreground">Order not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/production"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-bold font-mono">{order.orderNo}</h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-2">
              <span>{order.customer?.name}</span>
              <Badge variant="outline" className={cn("font-medium", ORDER_STATUS_COLORS[order.status])}>
                {order.status}
              </Badge>
              {getOrderCurrentStageBadges(order).map((badge) => (
                <Badge
                  key={badge.key}
                  variant="outline"
                  className={cn("font-medium", badge.className)}
                >
                  {badge.label}
                </Badge>
              ))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FormField label="Responsible worker" className="min-w-[220px]">
              <Select
                value={order.assignedWorkerId || ""}
                onValueChange={reassignWorker}
                disabled={assigning}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {assigning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>

      {(order.lines || []).map((line) => (
        <div key={line.id} className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <p className="font-medium">Line {line.lineNo}: {line.bagSpec?.name}</p>
            <p className="text-sm text-muted-foreground">Planned {line.plannedQty} bags</p>
          </div>
          <div className="divide-y">
            {(line.stages || []).map((stage) => (
              <div key={stage.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium flex flex-wrap items-center gap-2">
                    <span>{stage.sequence}. {getStageLabel(stage.stageType)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        getStageTypeColor(stage.stageType, {
                          completed: stage.status === "COMPLETED",
                        }),
                      )}
                    >
                      {stage.status}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stage.status}
                    {stage.outputQty != null && ` · out ${stage.outputQty} ${stage.outputUnit}`}
                    {stage.wasteQty != null && Number(stage.wasteQty) > 0 && ` · waste ${stage.wasteQty}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {stage.status === "COMPLETED" && (
                    <Button variant="outline" size="sm" onClick={() => setPreviewStage(stage)}>
                      <Eye className="h-4 w-4 mr-1" />Preview
                    </Button>
                  )}
                  {["READY", "IN_PROGRESS"].includes(stage.status) && (
                    <Button size="sm" onClick={() => openRecord(stage)}>
                      <ClipboardEdit className="h-4 w-4 mr-1" />Record input
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={!!recordStage} onOpenChange={(open) => { if (!open) { setRecordStage(null); setRecordContext(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record — {recordStage ? getStageLabel(recordStage.stageType) : ""}</DialogTitle>
          </DialogHeader>
          {loadingContext || !recordContext ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <StageRecordForm
              orderId={id}
              stage={recordStage}
              context={recordContext}
              onCancel={() => { setRecordStage(null); setRecordContext(null); }}
              onDone={() => { setRecordStage(null); setRecordContext(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewStage} onOpenChange={(open) => !open && setPreviewStage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview — {previewStage ? getStageLabel(previewStage.stageType) : ""}</DialogTitle>
          </DialogHeader>
          {previewStage && (
            <div className="space-y-2 text-sm">
              <p>Status: <Badge variant="outline">{previewStage.status}</Badge></p>
              <p>Input: {previewStage.inputQty ?? "—"} {previewStage.inputUnit}</p>
              <p>Output: {previewStage.outputQty ?? "—"} {previewStage.outputUnit}</p>
              <p>Waste: {previewStage.wasteQty ?? "—"}</p>
              {previewStage.cutWidthMm != null && <p>Cut width: {previewStage.cutWidthMm} mm</p>}
              {previewStage.pieceCount != null && <p>Pieces: {previewStage.pieceCount}</p>}
              {previewStage.remainderAction && <p>Remainder: {previewStage.remainderQty} → {previewStage.remainderAction}</p>}
              {previewStage.material && <p>Material: {previewStage.material.name}</p>}
              {previewStage.machine && <p>Machine: {previewStage.machine.name}</p>}
              {previewStage.remarks && <p>Remarks: {previewStage.remarks}</p>}
              {Array.isArray(previewStage.proofUrls) && previewStage.proofUrls.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Proofs</p>
                  <ul className="space-y-1">
                    {previewStage.proofUrls.map((url) => (
                      <li key={url}><a className="text-primary underline" href={url} target="_blank" rel="noreferrer">{url}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
