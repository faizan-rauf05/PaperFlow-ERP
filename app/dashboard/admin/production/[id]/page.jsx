"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, Loader2, ClipboardEdit, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel, QC_STAGE_TYPES } from "@/lib/production-constants";
import { computeSlittingPreview } from "@/lib/slitting-math";
import {
  getOrderLineProgressRows,
  getStageStatusColor,
  ORDER_STATUS_COLORS,
  summarizeOrderMaterials,
  getLineCurrentStage,
} from "@/lib/order-progress";
import { cn } from "@/lib/utils";

function buildInitialForm(stage, context) {
  const stg = context?.stage || stage || {};
  const isQc = QC_STAGE_TYPES.includes(stg.stageType);
  const qcRec = stg.qcRecords?.[0];
  const sideConsumption = stg.consumptions?.find((c) => c.consumptionKind === "GLUE_SIDE");
  const bottomConsumption = stg.consumptions?.find((c) => c.consumptionKind === "GLUE_BOTTOM");

  let initialOutputQty = "";
  if (stg.outputQty != null) {
    initialOutputQty = String(stg.outputQty);
  } else if (isQc && qcRec?.passedQty != null) {
    initialOutputQty = String(qcRec.passedQty);
  }

  let initialPassedQty = "";
  if (qcRec?.passedQty != null) {
    initialPassedQty = String(qcRec.passedQty);
  } else if (isQc && stg.outputQty != null) {
    initialPassedQty = String(stg.outputQty);
  }

  let initialGlueSideQty = "";
  if (sideConsumption?.actualQty != null) {
    initialGlueSideQty = String(sideConsumption.actualQty);
  } else if (context?.gluePlan?.sideKg != null) {
    initialGlueSideQty = String(context.gluePlan.sideKg);
  }

  let initialGlueBottomQty = "";
  if (bottomConsumption?.actualQty != null) {
    initialGlueBottomQty = String(bottomConsumption.actualQty);
  } else if (context?.gluePlan?.bottomKg != null) {
    initialGlueBottomQty = String(context.gluePlan.bottomKg);
  }

  return {
    materialId: stg.materialId || "",
    machineId: stg.machineId || "",
    outputQty: initialOutputQty,
    cutWidthMm: stg.cutWidthMm != null ? String(stg.cutWidthMm) : (context?.suggestedCutWidthMm != null ? String(context.suggestedCutWidthMm) : ""),
    remainderAction: stg.remainderAction || "",
    lengthRestockQty: stg.lengthRestockQty != null ? String(stg.lengthRestockQty) : "0",
    pieceCount: stg.pieceCount != null ? String(stg.pieceCount) : "",
    pieceWeightKg: stg.pieceWeightKg != null ? String(stg.pieceWeightKg) : "",
    proofUrls: Array.isArray(stg.proofUrls) ? stg.proofUrls : [],
    remarks: stg.remarks || "",
    passedQty: initialPassedQty,
    defectTypeId: qcRec?.defectTypeId || "",
    glueSideQty: initialGlueSideQty,
    glueBottomQty: initialGlueBottomQty,
    cartonMaterialId: stg.stageType === "PACKING" ? stg.materialId || "" : "",
  };
}

function StageRecordForm({ orderId, stage, context, onDone, onCancel }) {
  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [paperMaterials, setPaperMaterials] = useState([]);
  const [glueMaterials, setGlueMaterials] = useState([]);
  const [cartonMaterials, setCartonMaterials] = useState([]);
  const [stockById, setStockById] = useState({});
  const [machines, setMachines] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [form, setForm] = useState(() => buildInitialForm(stage, context));

  useEffect(() => {
    if (context) {
      setForm(buildInitialForm(stage, context));
    }
  }, [context, stage]);

  const inputQty = context?.inputQty;

  useEffect(() => {
    (async () => {
      try {
        const [mats, mach, defects, stock] = await Promise.all([
          api.get("/materials"),
          api.get("/machines"),
          api.get("/defect-types"),
          api.get("/inventory/current-stock"),
        ]);
        const all = mats.data.materials || [];
        setPaperMaterials(all.filter((m) => m.materialType === "PAPER_ROLL"));
        setGlueMaterials(all.filter((m) => m.materialType === "GLUE"));
        setCartonMaterials(all.filter((m) => m.materialType === "CARTON"));
        setMachines((mach.data.machines || []).filter((m) => m.stageType === stage.stageType));
        setDefectTypes((defects.data.defectTypes || defects.data.types || []).filter((d) => d.stageType === stage.stageType));

        const map = {};
        for (const row of stock.data.stock || stock.data.materials || stock.data.stocks || []) {
          map[row.id] = Number(row.currentStock ?? row.stock ?? 0);
        }
        setStockById(map);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    })();
  }, [stage.stageType]);

  useEffect(() => {
    if (stage.stageType !== "HANDLE_MAKING_PASTING" || !context?.gluePlan) return;
    setForm((prev) => ({
      ...prev,
      glueSideQty: prev.glueSideQty || String(context.gluePlan.sideKg || 0),
      glueBottomQty: prev.glueBottomQty || String(context.gluePlan.bottomKg || 0),
    }));
  }, [stage.stageType, context?.gluePlan]);

  const selectedPaperStock = form.materialId
    ? stockById[form.materialId]
    : context?.paperStock;

  const slitPreview = useMemo(() => {
    if (stage.stageType !== "SLITTING") return null;
    return computeSlittingPreview({
      inputMeters: inputQty,
      parentWidthMm: context?.paperMaterial?.paperWidthMm,
      cutWidthMm: form.cutWidthMm,
      gsm: context?.paperMaterial?.gsm,
      lengthRestockMeters: form.lengthRestockQty,
    });
  }, [stage.stageType, inputQty, context?.paperMaterial, form.cutWidthMm, form.lengthRestockQty]);

  useEffect(() => {
    if (!slitPreview) return;
    setForm((prev) => ({
      ...prev,
      pieceCount: slitPreview.pieceCount || "",
      pieceWeightKg: slitPreview.pieceWeightKg ?? "",
      outputQty: String(slitPreview.usableMeters ?? ""),
    }));
  }, [slitPreview]);

  const rejectedLive = useMemo(() => {
    if (!isQc || inputQty == null || form.passedQty === "") return null;
    return Math.max(0, Number(inputQty) - Number(form.passedQty || 0));
  }, [isQc, inputQty, form.passedQty]);

  const handleBagsPlan = useMemo(() => {
    if (stage.stageType !== "HANDLE_MAKING_PASTING") return null;
    const bags = Number(form.outputQty) || 0;
    const bpm = Number(context?.bagSpec?.bagsPerMeter) || 0;
    const hpb = Number(context?.bagSpec?.handlesPerBag) || 2;
    const side = Number(context?.bagSpec?.sideGlueKgPerBag) || 0;
    const bottom = Number(context?.bagSpec?.bottomGlueKgPerBag) || 0;
    return {
      metersNeeded: bpm > 0 ? bags / bpm : null,
      ropePcs: bags * hpb,
      sideKg: bags * side,
      bottomKg: bags * bottom,
      maxFromMeters: bpm > 0 && inputQty != null ? Math.floor(Number(inputQty) * bpm) : null,
    };
  }, [stage.stageType, form.outputQty, context?.bagSpec, inputQty]);

  function patch(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate() {
    const next = {};
    if (form.proofUrls.length === 0) next.proofUrls = "Add at least one proof";

    if (stage.stageType === "RAW_MATERIAL") {
      if (!form.materialId) next.materialId = "Select paper material";
      if (!form.outputQty || Number(form.outputQty) <= 0) next.outputQty = "Enter meters issued";
    }
    if (stage.stageType === "SLITTING") {
      if (!form.machineId) next.machineId = "Slitting machine required";
      if (!form.cutWidthMm || Number(form.cutWidthMm) <= 0) next.cutWidthMm = "Cut width required";
      if (slitPreview?.widthRemainderMeters > 0 && !form.remainderAction) {
        next.remainderAction = "Choose waste or restock for width leftover";
      }
    }
    if (stage.stageType === "PRINTING") {
      if (!form.outputQty || Number(form.outputQty) <= 0) next.outputQty = "Printed meters required";
    }
    if (isQc) {
      if (form.passedQty === "" || Number(form.passedQty) < 0) next.passedQty = "Enter passed qty";
      if (inputQty != null && Number(form.passedQty) > Number(inputQty)) {
        next.passedQty = "Cannot exceed input";
      }
    }
    if (stage.stageType === "HANDLE_MAKING_PASTING") {
      if (!form.outputQty || Number(form.outputQty) <= 0) next.outputQty = "Bags produced required";
    }
    if (stage.stageType === "PACKING") {
      if (!form.outputQty || Number(form.outputQty) <= 0) next.outputQty = "Cartons required";
      if (!form.cartonMaterialId) next.cartonMaterialId = "Select carton type";
    }
    if (stage.stageType === "DISPATCH") {
      if (!form.outputQty || Number(form.outputQty) <= 0) next.outputQty = "Dispatched qty required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function uploadProof(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/qc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({ ...prev, proofUrls: [...prev.proofUrls, data.photoUrl] }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.proofUrls;
        return next;
      });
      toast.success("Proof uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error("Fix the highlighted fields");
      return;
    }

    if (
      stage.stageType === "RAW_MATERIAL" &&
      selectedPaperStock != null &&
      Number(form.outputQty) > Number(selectedPaperStock)
    ) {
      const ok = window.confirm(
        `Issued ${form.outputQty} m exceeds stock (${selectedPaperStock} m). Continue anyway?`,
      );
      if (!ok) return;
    }

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
        remainderQty: slitPreview?.widthRemainderMeters || undefined,
        lengthRestockQty: form.lengthRestockQty || undefined,
        glueSideQty: form.glueSideQty || undefined,
        glueBottomQty: form.glueBottomQty || undefined,
        cartonMaterialId: form.cartonMaterialId || undefined,
        qc: isQc
          ? {
              passedQty: form.passedQty,
              rejectedQty: rejectedLive ?? 0,
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
          {stage.stageType === "PRINTING" && (
            <span className="text-muted-foreground"> (slit meters × cut pieces)</span>
          )}
        </div>
      )}

      {stage.stageType === "RAW_MATERIAL" && (
        <>
          <FormField
            label="Paper material"
            required
            error={errors.materialId}
            hint="Paper stock only — pick the roll material to issue."
          >
            <SearchableSelect
              value={form.materialId}
              onValueChange={(v) => patch("materialId", v)}
              options={paperMaterials.map((m) => ({
                value: m.id,
                label: `${m.name} · ${m.paperWidthMm ?? "?"}mm (${m.code})`,
                description: `Stock: ${stockById[m.id] ?? 0} m`,
              }))}
              placeholder="Select paper material"
              searchPlaceholder="Search paper..."
              error={!!errors.materialId}
            />
          </FormField>
          <FormField
            label="Meters issued"
            required
            error={errors.outputQty}
            hint="Length taken from stock into this order."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.outputQty}
              onChange={(e) => patch("outputQty", e.target.value)}
            />
            {form.materialId && (
              <p className="text-xs text-muted-foreground mt-1">
                Available stock for this paper:{" "}
                <strong>{selectedPaperStock != null ? `${selectedPaperStock} m` : "—"}</strong>
              </p>
            )}
          </FormField>
        </>
      )}

      {stage.stageType === "SLITTING" && (
        <>
          <FormField
            label="Slitting machine"
            required
            error={errors.machineId}
            hint="Required — which slitters did this cut."
          >
            <SearchableSelect
              value={form.machineId}
              onValueChange={(v) => patch("machineId", v)}
              options={machines.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.machineCode})`,
                description: `Status: ${m.status}`,
              }))}
              placeholder="Select slitting machine"
              searchPlaceholder="Search machine..."
              error={!!errors.machineId}
            />
          </FormField>
          <FormField
            label="Cut width (mm)"
            required
            error={errors.cutWidthMm}
            hint="Target strip width (prefilled from bag width). Editable."
          >
            <Input
              type="number"
              min="1"
              value={form.cutWidthMm}
              onChange={(e) => patch("cutWidthMm", e.target.value)}
            />
          </FormField>
          {context?.paperMaterial && (
            <p className="text-xs text-muted-foreground">
              Parent paper: {context.paperMaterial.name} · width{" "}
              {context.paperMaterial.paperWidthMm ?? "—"} mm · input {inputQty ?? "—"} m
            </p>
          )}
          {slitPreview && (
            <div className="rounded-md border px-3 py-2 text-sm space-y-1">
              <p>Pieces across width: <strong>{slitPreview.pieceCount}</strong></p>
              <p>
                Gross usable: {inputQty} × {slitPreview.pieceCount} ={" "}
                <strong>{(Number(inputQty || 0) * slitPreview.pieceCount).toFixed(2)} m</strong>
              </p>
              <p>
                Width leftover: <strong>{slitPreview.widthRemainderMm} mm</strong> strip × {inputQty} m
                {" "}(= {Number(slitPreview.widthRemainderMeters || 0).toFixed(2)} m)
              </p>
              <p>
                After length restock → next stage input:{" "}
                <strong>{Number(slitPreview.usableMeters || 0).toFixed(2)} m</strong>
              </p>
            </div>
          )}
          <FormField
            label="Length restock (m)"
            hint="Optional: return unused cut-strip length to stock. Reduces usable meters."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.lengthRestockQty}
              onChange={(e) => patch("lengthRestockQty", e.target.value)}
            />
          </FormField>
          {slitPreview?.widthRemainderMeters > 0 && (
            <FormField
              label="Width leftover action"
              required
              error={errors.remainderAction}
              hint="Leftover width strip — you choose restock or waste (not auto)."
            >
              <Select value={form.remainderAction} onValueChange={(v) => patch("remainderAction", v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Waste or Restock" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTOCK">Restock leftover width strip</SelectItem>
                  <SelectItem value="WASTE">Mark leftover width as waste</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          )}
        </>
      )}

      {stage.stageType === "PRINTING" && (
        <FormField
          label="Printed meters"
          required
          error={errors.outputQty}
          hint="Good printed length from the slit usable meters."
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.outputQty}
            onChange={(e) => patch("outputQty", e.target.value)}
          />
          {inputQty != null && form.outputQty !== "" && (
            <p className="text-xs text-muted-foreground mt-1">
              Waste (auto): {(Number(inputQty) - Number(form.outputQty || 0)).toFixed(2)} m
            </p>
          )}
        </FormField>
      )}

      {isQc && (
        <div className="space-y-3">
          <FormField
            label="Passed"
            required
            error={errors.passedQty}
            hint="Good qty after check. Rejected = input − passed."
          >
            <Input
              type="number"
              min="0"
              value={form.passedQty}
              onChange={(e) => patch("passedQty", e.target.value)}
            />
          </FormField>
          <p className="text-sm">
            Rejected (auto): <strong>{rejectedLive != null ? rejectedLive : "—"}</strong> {stage.inputUnit}
          </p>
          {defectTypes.length > 0 && (
            <FormField label="Defect type" hint="Optional reason for rejects.">
              <SearchableSelect
                value={form.defectTypeId}
                onValueChange={(v) => patch("defectTypeId", v)}
                options={defectTypes.map((d) => ({
                  value: d.id,
                  label: d.description,
                  description: `Code: ${d.code}`,
                }))}
                placeholder="Select defect type (optional)"
                searchPlaceholder="Search defect..."
              />
            </FormField>
          )}
        </div>
      )}

      {stage.stageType === "HANDLE_MAKING_PASTING" && (
        <>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
            {context?.handleCapacity && (
              <p>
                Max from rope + meters:{" "}
                <strong>{Math.floor(context.handleCapacity.capacityBags)}</strong> bags
              </p>
            )}
            {context?.gluePlan && (
              <>
                <p>Bags / meter (spec): {context.gluePlan.bagsPerMeter ?? "—"}</p>
                <p>Handles / bag: {context.gluePlan.handlesPerBag}</p>
              </>
            )}
            {handleBagsPlan && (
              <p className="text-muted-foreground">
                For entered bags → rope ~{handleBagsPlan.ropePcs} pcs · side glue ~{handleBagsPlan.sideKg.toFixed(4)} kg · bottom ~{handleBagsPlan.bottomKg.toFixed(4)} kg
              </p>
            )}
          </div>
          <FormField
            label="Bags produced"
            required
            error={errors.outputQty}
            hint="Actual bags with handles pasted."
          >
            <Input
              type="number"
              min="1"
              value={form.outputQty}
              onChange={(e) => patch("outputQty", e.target.value)}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Side glue (kg)"
              hint="Prefilled from bag spec × bags. Editable."
            >
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={form.glueSideQty}
                onChange={(e) => patch("glueSideQty", e.target.value)}
              />
              {glueMaterials.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stock: {glueMaterials.map((g) => `${g.name} ${stockById[g.id] ?? "?"}kg`).join(" · ")}
                </p>
              )}
            </FormField>
            <FormField
              label="Bottom glue (kg)"
              hint="Prefilled from bag spec × bags. Editable."
            >
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={form.glueBottomQty}
                onChange={(e) => patch("glueBottomQty", e.target.value)}
              />
            </FormField>
          </div>
        </>
      )}

      {stage.stageType === "PACKING" && (
        <>
          <FormField
            label="Cartons packed"
            required
            error={errors.outputQty}
            hint="How many cartons filled."
          >
            <Input
              type="number"
              min="1"
              value={form.outputQty}
              onChange={(e) => patch("outputQty", e.target.value)}
            />
          </FormField>
          <FormField
            label="Carton type"
            required
            error={errors.cartonMaterialId}
            hint="Deducts this carton from inventory."
          >
            <SearchableSelect
              value={form.cartonMaterialId}
              onValueChange={(v) => patch("cartonMaterialId", v)}
              options={cartonMaterials.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.code})`,
                description: `Stock: ${stockById[m.id] ?? "—"}`,
              }))}
              placeholder="Select carton"
              searchPlaceholder="Search carton type..."
              error={!!errors.cartonMaterialId}
            />
          </FormField>
        </>
      )}

      {stage.stageType === "DISPATCH" && (
        <FormField label="Cartons dispatched" required error={errors.outputQty} hint="Qty leaving the factory.">
          <Input
            type="number"
            min="1"
            value={form.outputQty}
            onChange={(e) => patch("outputQty", e.target.value)}
          />
        </FormField>
      )}

      {machines.length > 0 && stage.stageType !== "SLITTING" && (
        <FormField label="Machine" hint="Optional machine used.">
          <SearchableSelect
            value={form.machineId}
            onValueChange={(v) => patch("machineId", v)}
            options={machines.map((m) => ({
              value: m.id,
              label: `${m.name} (${m.machineCode})`,
              description: `Status: ${m.status}`,
            }))}
            placeholder="Select machine (optional)"
            searchPlaceholder="Search machine..."
          />
        </FormField>
      )}

      <FormField label="Proof images" required error={errors.proofUrls} hint="Photo evidence for this stage.">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {form.proofUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{url}</a>
          ))}
        </div>
      </FormField>

      <FormField label="Remarks" hint="Optional note.">
        <Input value={form.remarks} onChange={(e) => patch("remarks", e.target.value)} />
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

  const materialSummary = useMemo(
    () => (order ? summarizeOrderMaterials(order) : null),
    [order],
  );

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
              <span>{order.customer?.name} {order.customer?.companyName ? `(${order.customer.companyName})` : ""}</span>
              {order.salesRep && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                  Sales Rep: {order.salesRep}
                </span>
              )}
              <Badge variant="outline" className={cn("font-medium", ORDER_STATUS_COLORS[order.status])}>
                {order.status}
              </Badge>
            </p>
          </div>

          {materialSummary && (
            <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-2">
              <p>
                Paper used: <strong>{materialSummary.usedMeters.toFixed(2)} m</strong>
              </p>
              <p>
                Paper / meter waste: <strong>{materialSummary.wasteMeters.toFixed(2)} m</strong>
              </p>
              <p>
                Bags made: <strong>{materialSummary.usedBags}</strong>
              </p>
              <p>
                Bag rejects: <strong>{materialSummary.wasteBags}</strong>
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <FormField label="Responsible worker" className="min-w-[240px]">
              <SearchableSelect
                value={order.assignedWorkerId || ""}
                onValueChange={reassignWorker}
                disabled={assigning}
                options={workers.map((w) => ({
                  value: w.id,
                  label: w.name,
                  description: w.email,
                }))}
                placeholder="Assign worker"
                searchPlaceholder="Search worker..."
              />
            </FormField>
            {assigning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>

      {(order.lines || []).map((line) => {
        const progress = getOrderLineProgressRows({ lines: [line] })[0];
        const dims = line.heightMm || line.widthMm || line.baseMm
          ? `${line.heightMm || 0} × ${line.widthMm || 0} × ${line.baseMm || 0} mm`
          : "—";
        const currentStage = getLineCurrentStage(line);

        return (
          <div key={line.id} className="rounded-lg border">
            <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <p className="font-medium">
                  Line #{line.lineNo}: <span className="font-mono text-primary font-semibold">{dims}</span>
                </p>
                <span className="text-sm text-muted-foreground">{line.plannedQty} bags</span>
                {line.fileUrl && (
                  <a
                    href={line.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1 rounded border inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    📎 {line.fileName || "View Attachment"}
                  </a>
                )}
              </div>
              {progress && (
                <Badge variant="outline" className={cn("font-medium", progress.className)}>
                  {progress.stageLabel}
                </Badge>
              )}
            </div>
            <div className="divide-y">
              {(line.stages || []).map((stage) => {
                const isCurrent = stage.id === currentStage?.id;
                const isPrevious = stage.status === "COMPLETED" || stage.sequence < (currentStage?.sequence || 0);

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors",
                      isCurrent && "bg-primary/5 dark:bg-primary/10"
                    )}
                  >
                    <div>
                      <p className="font-medium flex flex-wrap items-center gap-2">
                        <span>{stage.sequence}. {getStageLabel(stage.stageType)}</span>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", getStageStatusColor(stage.status))}
                        >
                          {stage.status}
                        </Badge>
                        {isCurrent && (
                          <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
                            Current Stage
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stage.outputQty != null && `out ${stage.outputQty} ${stage.outputUnit || ""}`}
                        {stage.wasteQty != null && Number(stage.wasteQty) > 0 && ` · waste ${stage.wasteQty}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage.status === "COMPLETED" && (
                        <Button variant="outline" size="sm" onClick={() => setPreviewStage(stage)}>
                          <Eye className="h-4 w-4 mr-1" />Preview Input
                        </Button>
                      )}
                      {isPrevious ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openRecord(stage)}
                        >
                          <ClipboardEdit className="h-4 w-4 mr-1" />
                          Update Input
                        </Button>
                      ) : isCurrent ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openRecord(stage)}
                        >
                          <ClipboardEdit className="h-4 w-4 mr-1" />
                          Record Input
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic px-2.5 py-1 bg-muted/40 rounded border border-dashed flex items-center gap-1">
                          <Lock className="h-3 w-3 text-muted-foreground/70" />
                          Locked (Awaiting previous stage)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog
        open={!!recordStage}
        onOpenChange={(open) => {
          if (!open) {
            setRecordStage(null);
            setRecordContext(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {recordStage?.status === "COMPLETED" ? "Update Input — " : "Record — "}
              {recordStage ? getStageLabel(recordStage.stageType) : ""}
            </DialogTitle>
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
            <DialogTitle className="flex items-center justify-between">
              <span>Preview — {previewStage ? getStageLabel(previewStage.stageType) : ""}</span>
            </DialogTitle>
          </DialogHeader>
          {previewStage && (
            <div className="space-y-4 text-sm py-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                <span className="text-muted-foreground font-medium">Stage Status</span>
                <Badge variant="outline" className={getStageStatusColor(previewStage.status)}>
                  {previewStage.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border bg-card text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Input</p>
                  <p className="font-semibold text-base">{previewStage.inputQty ?? "—"} <span className="text-xs text-muted-foreground">{previewStage.inputUnit}</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Output</p>
                  <p className="font-semibold text-base text-emerald-600 dark:text-emerald-400">{previewStage.outputQty ?? "—"} <span className="text-xs text-muted-foreground">{previewStage.outputUnit}</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Waste</p>
                  <p className="font-semibold text-base text-destructive">{previewStage.wasteQty ?? "—"}</p>
                </div>
              </div>

              {(previewStage.cutWidthMm != null || previewStage.pieceCount != null || previewStage.lengthRestockQty != null) && (
                <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slitting Details</p>
                  {previewStage.cutWidthMm != null && <p>Cut Width: <strong>{previewStage.cutWidthMm} mm</strong></p>}
                  {previewStage.pieceCount != null && <p>Pieces Across Width: <strong>{previewStage.pieceCount}</strong></p>}
                  {previewStage.lengthRestockQty != null && <p>Length Restock: <strong>{previewStage.lengthRestockQty} m</strong></p>}
                  {previewStage.remainderAction && (
                    <p>Width Leftover: <strong>{previewStage.remainderQty}</strong> → {previewStage.remainderAction}</p>
                  )}
                </div>
              )}

              {previewStage.remarks && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Remarks</p>
                  <p className="text-foreground italic">{previewStage.remarks}</p>
                </div>
              )}

              {Array.isArray(previewStage.proofUrls) && previewStage.proofUrls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proof Images</p>
                  <div className="flex flex-wrap gap-2">
                    {previewStage.proofUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="group relative">
                        <img src={url} alt="Proof" className="h-16 w-16 rounded-md object-cover border group-hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-row justify-between sm:justify-between items-center pt-2 border-t">
            <Button variant="outline" onClick={() => setPreviewStage(null)}>Close</Button>
            <Button
              onClick={() => {
                const target = previewStage;
                setPreviewStage(null);
                openRecord(target);
              }}
            >
              <ClipboardEdit className="h-4 w-4 mr-1.5" /> Edit / Update Values
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
