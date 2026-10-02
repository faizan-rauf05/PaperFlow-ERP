"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, Loader2, ClipboardEdit, Lock, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrderRowActions } from "@/components/orders/order-row-actions";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel, QC_STAGE_TYPES, STAGE_FLOW } from "@/lib/production-constants";
import { computeSlitting } from "@/lib/slitting-math";
import { MATERIAL_SUGGESTION_CONSTANTS as SLIT } from "@/lib/material-constants";
import { formatWeight } from "@/lib/paper-sizing";
import {
  getOrderLineProgressRows,
  getStageStatusColor,
  ORDER_STATUS_COLORS,
  summarizeOrderMaterials,
  getLineCurrentStage,
  formatElapsed,
} from "@/lib/order-progress";
import { cn, formatDateTime } from "@/lib/utils";
import { UNIT_LABELS, formatQuantity } from "@/lib/material-catalog";
import {
  HANDLE_CONSUMPTIONS,
  catalogMaterialOptions,
  factoryStock,
  factoryStockLabel,
  handleConsumptionPayload,
  initialHandleConsumptions,
  plannedConsumption,
  sortByFactoryStock,
  toastStockWarnings,
  validateHandleConsumptions,
} from "@/components/production/stage-materials";

// Material stores width in cm (paperWidthCm) — display everything in mm.
function widthMm(material) {
  return material?.paperWidthCm != null ? Number(material.paperWidthCm) * 10 : null;
}

function buildInitialForm(stage, context) {
  const stg = context?.stage || stage || {};
  const isQc = QC_STAGE_TYPES.includes(stg.stageType);
  const qcRec = stg.qcRecords?.[0];

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

  return {
    materialId: stg.materialId || "",
    machineId: stg.machineId || "",
    outputQty: initialOutputQty,
    // Recycled rolls: as recorded, else the plan for this roll and bag width
    recycledRollCount: String(stg.recycledRollCount ?? context?.slitPlan?.stripCount ?? 0),
    recycledWidthCm:
      stg.recycledRollCount != null
        ? stg.recycledWidthCm != null ? String(Number(stg.recycledWidthCm)) : ""
        : context?.slitPlan?.stripCount ? String(context.slitPlan.stripWidthCm) : "",
    lengthRestockQty:
      stg.lengthRestockQty != null ? String(stg.lengthRestockQty) : "0",
    proofUrls: Array.isArray(stg.proofUrls) ? stg.proofUrls : [],
    remarks: stg.remarks || "",
    passedQty: initialPassedQty,
    defectTypeId: qcRec?.defectTypeId || "",
    // The order's stages carry recorded consumptions; the record context's stage doesn't.
    ...initialHandleConsumptions(stage?.consumptions || stg.consumptions),
    cartonMaterialId: stg.stageType === "PACKING" ? stg.materialId || "" : "",
  };
}

function StageRecordForm({ orderId, stage, context, onDone, onCancel }) {
  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [paperMaterials, setPaperMaterials] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [glueMaterials, setGlueMaterials] = useState([]);
  const [ropeMaterials, setRopeMaterials] = useState([]);
  const [cartonMaterials, setCartonMaterials] = useState([]);
  const [stockById, setStockById] = useState({});
  const [machines, setMachines] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [form, setForm] = useState(() => buildInitialForm(stage, context));
  const [nextStage, setNextStage] = useState("");
  const isPrintQc = stage.stageType === "PRINT_QC";

  useEffect(() => {
    if (context) {
      setForm(buildInitialForm(stage, context));
    }
  }, [context, stage]);

  const inputQty = context?.inputQty;

  useEffect(() => {
    (async () => {
      try {
        const [mats, mach, defects] = await Promise.all([
          api.get("/materials"),
          api.get("/machines"),
          api.get("/defect-types"),
        ]);
        // Production draws from factory stock — pickers list stocked materials first.
        const all = mats.data.materials || [];
        const byType = (type) =>
          sortByFactoryStock(all.filter((m) => m.materialType === type));
        const glues = byType("GLUE");
        const ropes = byType("ROPE");
        setPaperMaterials(byType("PAPER_ROLL"));
        setGlueMaterials(glues);
        setRopeMaterials(ropes);
        setCartonMaterials(byType("CARTON"));
        // Preselect glue/rope when only one supplier's material exists.
        const defaults = initialHandleConsumptions(null, {
          GLUE: glues,
          ROPE: ropes,
        });
        setForm((prev) => {
          const next = { ...prev };
          for (const c of HANDLE_CONSUMPTIONS) {
            if (!next[c.materialField]) {
              next[c.materialField] = defaults[c.materialField];
            }
          }
          return next;
        });
        setMachines(
          (mach.data.machines || []).filter(
            (m) => m.stageType === stage.stageType,
          ),
        );
        setDefectTypes(
          (defects.data.defectTypes || defects.data.types || []).filter(
            (d) => d.stageType === stage.stageType,
          ),
        );

        const map = {};
        for (const m of all) map[m.id] = factoryStock(m);
        setStockById(map);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setLookupsLoading(false);
      }
    })();
  }, [stage.stageType]);

  const selectedPaperStock = form.materialId
    ? stockById[form.materialId]
    : context?.paperStock;

  const slitPreview = useMemo(() => {
    if (stage.stageType !== "SLITTING") return null;
    return computeSlitting({
      inputMeters: inputQty,
      lengthRestockMeters: form.lengthRestockQty,
      parentWidthCm: context?.paperMaterial?.paperWidthCm,
      bagWidthCm: context?.bagWidthCm,
      gsm: context?.paperMaterial?.gsm,
      stripCount: Number(form.recycledRollCount) || 0,
      stripWidthCm: form.recycledWidthCm,
    });
  }, [
    stage.stageType,
    inputQty,
    context?.paperMaterial,
    context?.bagWidthCm,
    form.recycledRollCount,
    form.recycledWidthCm,
    form.lengthRestockQty,
  ]);

  useEffect(() => {
    if (!slitPreview) return;
    setForm((prev) => ({ ...prev, outputQty: String(slitPreview.lengthM ?? "") }));
  }, [slitPreview]);

  const rejectedLive = useMemo(() => {
    if (!isQc || inputQty == null || form.passedQty === "") return null;
    return Math.max(0, Number(inputQty) - Number(form.passedQty || 0));
  }, [isQc, inputQty, form.passedQty]);

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
      if (!form.outputQty || Number(form.outputQty) <= 0)
        next.outputQty = "Enter meters issued";
    }
    if (stage.stageType === "SLITTING") {
      if (!form.machineId) next.machineId = "Slitting machine required";
      if (slitPreview?.error) next.recycledRollCount = slitPreview.error;
    }
    if (stage.stageType === "PRINTING") {
      if (!form.outputQty || Number(form.outputQty) <= 0)
        next.outputQty = "Printed meters required";
    }
    if (isQc) {
      if (form.passedQty === "" || Number(form.passedQty) < 0)
        next.passedQty = "Enter passed qty";
      if (inputQty != null && Number(form.passedQty) > Number(inputQty)) {
        next.passedQty = "Cannot exceed input";
      }
    }
    if (stage.stageType === "HANDLE_MAKING_PASTING") {
      if (!form.outputQty || Number(form.outputQty) <= 0)
        next.outputQty = "Bags produced required";
      Object.assign(
        next,
        validateHandleConsumptions(
          form,
          context?.perBagConsumption,
          form.outputQty,
        ),
      );
    }
    if (stage.stageType === "PACKING") {
      if (!form.outputQty || Number(form.outputQty) <= 0)
        next.outputQty = "Cartons required";
      if (!form.cartonMaterialId) next.cartonMaterialId = "Select carton type";
    }
    if (stage.stageType === "DISPATCH") {
      if (!form.outputQty || Number(form.outputQty) <= 0)
        next.outputQty = "Dispatched qty required";
    }
    if (isPrintQc && !nextStage) {
      next.nextStage = "Choose Slitting or Handle Making";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function uploadProof(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({
        ...prev,
        proofUrls: [...prev.proofUrls, data.photoUrl],
      }));
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
        `Issued ${form.outputQty} m exceeds factory stock (${selectedPaperStock} m). Continue anyway?`,
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
        lengthRestockQty: form.lengthRestockQty || undefined,
        ...(stage.stageType === "SLITTING"
          ? { recycledRollCount: Number(form.recycledRollCount) || 0, recycledWidthCm: form.recycledWidthCm || undefined }
          : {}),
        ...(stage.stageType === "HANDLE_MAKING_PASTING"
          ? handleConsumptionPayload(form)
          : {}),
        cartonMaterialId: form.cartonMaterialId || undefined,
        qc: isQc
          ? {
              passedQty: form.passedQty,
              rejectedQty: rejectedLive ?? 0,
              defectTypeId: form.defectTypeId || undefined,
            }
          : undefined,
        nextStage: isPrintQc ? nextStage || undefined : undefined,
      };
      const { data } = await api.post(
        `/production/orders/${orderId}/stages/${stage.id}/record`,
        payload,
      );
      toast.success("Stage recorded");
      toastStockWarnings(toast, data?.stockWarnings);
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
            <span className="text-muted-foreground">
              {" "}
              (slit meters × cut pieces)
            </span>
          )}
        </div>
      )}

      {stage.stageType === "RAW_MATERIAL" && (
        <>
          <FormField
            label="Paper material"
            required
            error={errors.materialId}
            hint="Paper rolls — issued from factory stock."
          >
            <SearchableSelect
              loading={lookupsLoading}
              value={form.materialId}
              onValueChange={(v) => patch("materialId", v)}
              options={paperMaterials.map((m) => ({
                value: m.id,
                label: `${m.name} · ${widthMm(m) ?? "?"}mm (${m.code})`,
                description: factoryStockLabel(m),
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
            hint="Length taken from factory stock into this order."
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
                Factory stock for this paper:{" "}
                <strong>
                  {selectedPaperStock != null
                    ? formatQuantity(selectedPaperStock, "METER")
                    : "—"}
                </strong>
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
              loading={lookupsLoading}
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
          {context?.paperMaterial && (
            <p className="text-xs text-muted-foreground">
              Roll: {context.paperMaterial.name} ({context.paperMaterial.barCode}) · bags need{" "}
              {context.bagWidthCm ?? "—"} cm · leftover {slitPreview?.leftoverCm ?? "—"} cm · input{" "}
              {inputQty ?? "—"} m
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Recycled rolls" error={errors.recycledRollCount}>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.recycledRollCount}
                onChange={(e) => patch("recycledRollCount", e.target.value)}
              />
            </FormField>
            <FormField label="Width each (cm)" hint={`${SLIT.RECYCLE_STRIP_MIN_CM}–${SLIT.RECYCLE_STRIP_MAX_CM} cm`}>
              <Input
                type="number"
                min={SLIT.RECYCLE_STRIP_MIN_CM}
                max={SLIT.RECYCLE_STRIP_MAX_CM}
                step="0.1"
                disabled={!(Number(form.recycledRollCount) > 0)}
                value={form.recycledWidthCm}
                onChange={(e) => patch("recycledWidthCm", e.target.value)}
              />
            </FormField>
          </div>
          {slitPreview && !slitPreview.error && (
            <div className="rounded-md border px-3 py-2 text-sm space-y-1">
              <p>
                Bags: <strong>{context?.bagWidthCm} cm × {Number(slitPreview.lengthM.toFixed(2))} m</strong>
              </p>
              {Number(form.recycledRollCount) > 0 && (
                <p>
                  Recycled: <strong>{form.recycledRollCount} × {form.recycledWidthCm} cm</strong>
                  {slitPreview.stripWeightKg != null && ` (${formatWeight(slitPreview.stripWeightKg, "kg")} each)`} — added
                  to factory stock as {context?.paperMaterial?.barCode}-1, -2…
                </p>
              )}
              <p>
                Waste: <strong>{slitPreview.wasteWidthCm} cm</strong>
                {slitPreview.wasteKg != null && ` (${formatWeight(slitPreview.wasteKg, "kg")})`}
              </p>
            </div>
          )}
          <FormField
            label="Length restock (m)"
            hint="Optional: unused length returned to the roll. Reduces the slit length."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.lengthRestockQty}
              onChange={(e) => patch("lengthRestockQty", e.target.value)}
            />
          </FormField>
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
              Waste (auto):{" "}
              {(Number(inputQty) - Number(form.outputQty || 0)).toFixed(2)} m
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
            Rejected (auto):{" "}
            <strong>{rejectedLive != null ? rejectedLive : "—"}</strong>{" "}
            {stage.inputUnit}
          </p>
          {defectTypes.length > 0 && (
            <FormField label="Defect type" hint="Optional reason for rejects.">
              <SearchableSelect
                loading={lookupsLoading}
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

          {isPrintQc && (
            <FormField
              label="Send to next stage"
              required
              error={errors.nextStage}
              hint="Where this order goes after QC."
            >
              <Select
                value={nextStage}
                onValueChange={(v) => {
                  setNextStage(v);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.nextStage;
                    return next;
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose Slitting or Handle Making" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_FLOW.PRINT_QC.branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {getStageLabel(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
      )}

      {stage.stageType === "HANDLE_MAKING_PASTING" && (
        <>
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
          {HANDLE_CONSUMPTIONS.map((c) => {
            const planned = plannedConsumption(
              context?.perBagConsumption,
              c.perBagKey,
              form.outputQty,
            );
            return (
              <FormField
                key={c.kind}
                label={`${c.label} used (${UNIT_LABELS[c.unit]})`}
                error={errors[c.materialField] || errors[c.qtyField]}
                hint={
                  planned != null
                    ? `Planned for ${form.outputQty} bags: ${formatQuantity(planned, c.unit)}. Leave blank to use it.`
                    : "Enter bags produced to see the planned amount."
                }
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                  <SearchableSelect
                    loading={lookupsLoading}
                    value={form[c.materialField]}
                    onValueChange={(v) => patch(c.materialField, v)}
                    options={catalogMaterialOptions(
                      c.materialType === "ROPE" ? ropeMaterials : glueMaterials,
                    )}
                    placeholder={`Which ${c.label.toLowerCase()}?`}
                    searchPlaceholder="Search supplier..."
                    error={!!errors[c.materialField]}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={
                      planned != null
                        ? formatQuantity(planned, c.unit)
                        : "Planned"
                    }
                    value={form[c.qtyField]}
                    onChange={(e) => patch(c.qtyField, e.target.value)}
                  />
                </div>
              </FormField>
            );
          })}
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
            hint="Deducts this carton from factory stock."
          >
            <SearchableSelect
              loading={lookupsLoading}
              value={form.cartonMaterialId}
              onValueChange={(v) => patch("cartonMaterialId", v)}
              options={catalogMaterialOptions(cartonMaterials)}
              placeholder="Select carton"
              searchPlaceholder="Search carton type..."
              error={!!errors.cartonMaterialId}
            />
          </FormField>
        </>
      )}

      {stage.stageType === "DISPATCH" && (
        <FormField
          label="Cartons dispatched"
          required
          error={errors.outputQty}
          hint="Qty leaving the factory."
        >
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
            loading={lookupsLoading}
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

      <FormField
        label="Proof images"
        required
        error={errors.proofUrls}
        hint="Photo evidence for this stage."
      >
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) =>
            e.target.files?.[0] && uploadProof(e.target.files[0])
          }
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {form.proofUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              {url}
            </a>
          ))}
        </div>
      </FormField>

      <FormField label="Remarks" hint="Optional note.">
        <Input
          value={form.remarks}
          onChange={(e) => patch("remarks", e.target.value)}
        />
      </FormField>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving || uploading}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          record
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const materialSummary = useMemo(
    () => (order ? summarizeOrderMaterials(order) : null),
    [order],
  );

  async function openRecord(stage) {
    setLoadingContext(true);
    setRecordStage(stage);
    try {
      const { data } = await api.get(
        `/production/orders/${id}/stages/${stage.id}/record`,
      );
      setRecordContext(data.context);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setRecordStage(null);
    } finally {
      setLoadingContext(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!order) {
    return <p className="text-muted-foreground">Order not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/production">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold font-mono">{order.orderNo}</h1>
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                <span>{order.customer?.name}</span>
                {order.salesRep && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                    Sales Rep: {order.salesRep}
                  </span>
                )}
                {order.startDate && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-medium">
                    Start: {new Date(order.startDate).toLocaleDateString()}
                  </span>
                )}
                {order.deliveryDate && (
                  <span className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                    Delivery: {new Date(order.deliveryDate).toLocaleDateString()}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={cn("font-medium", ORDER_STATUS_COLORS[order.status])}
                >
                  {order.status}
                </Badge>
                {order.isArchived && (
                  <Badge variant="outline" className="font-medium bg-gray-500/10 text-gray-600 border-gray-400/40">
                    Archived
                  </Badge>
                )}
              </p>
              {order.status === "CANCELLED" && order.cancelReason && (
                <p className="text-xs text-destructive mt-1">
                  Cancelled: "{order.cancelReason}"
                </p>
              )}
            </div>
            <OrderRowActions order={order} onUpdated={setOrder} />
          </div>

          {materialSummary && (
            <div className="grid gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm sm:grid-cols-2">
              <p>
                Paper used:{" "}
                <strong>{materialSummary.usedMeters.toFixed(2)} m</strong>
              </p>
              <p>
                Paper / meter waste:{" "}
                <strong>{materialSummary.wasteMeters.toFixed(2)} m</strong>
              </p>
              <p>
                Slitting waste: <strong>{materialSummary.slitWasteKg.toFixed(2)} kg</strong>
              </p>
              <p>
                Bags made: <strong>{materialSummary.usedBags}</strong>
              </p>
              <p>
                Bag rejects: <strong>{materialSummary.wasteBags}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {(order.lines || []).map((line) => {
        const progress = getOrderLineProgressRows({ lines: [line] })[0];
        const dims =
          line.heightMm || line.widthMm || line.baseMm
            ? `${line.heightMm || 0} × ${line.widthMm || 0} × ${line.baseMm || 0} mm`
            : "—";
        const currentStage = getLineCurrentStage(line);

        return (
          <div key={line.id} className="rounded-lg border">
            <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <p className="font-medium">
                  Line #{line.lineNo}:{" "}
                  <span className="font-mono text-primary font-semibold">
                    {dims}
                  </span>
                </p>
                <span className="text-sm text-muted-foreground">
                  {line.plannedQty} bags
                </span>
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
                <Badge
                  variant="outline"
                  className={cn("font-medium", progress.className)}
                >
                  {progress.stageLabel}
                </Badge>
              )}
            </div>
            <div className="divide-y">
              {(line.stages || []).map((stage) => {
                const isCurrent = stage.id === currentStage?.id;
                const isPrevious =
                  stage.status === "COMPLETED" ||
                  stage.sequence < (currentStage?.sequence || 0);

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors",
                      isCurrent && "bg-primary/5 dark:bg-primary/10",
                    )}
                  >
                    <div>
                      <p className="font-medium flex flex-wrap items-center gap-2">
                        <span>
                          {stage.sequence}. {getStageLabel(stage.stageType)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            getStageStatusColor(stage.status),
                          )}
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
                        {stage.outputQty != null &&
                          `out ${stage.outputQty} ${stage.outputUnit || ""}`}
                        {stage.wasteQty != null &&
                          Number(stage.wasteQty) > 0 &&
                          ` · waste ${stage.wasteQty}`}
                      </p>
                      {(stage.worker || stage.startedAt) && (
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {stage.worker && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" /> {stage.worker.name}
                            </span>
                          )}
                          {stage.startedAt && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Started {formatDateTime(stage.startedAt)}
                            </span>
                          )}
                          {stage.completedAt && (
                            <span>Completed {formatDateTime(stage.completedAt)}</span>
                          )}
                          {formatElapsed(stage.startedAt, stage.completedAt) && (
                            <span className="font-medium text-foreground">
                              Took {formatElapsed(stage.startedAt, stage.completedAt)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {stage.status === "COMPLETED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewStage(stage)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview Input
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
              {recordStage?.status === "COMPLETED"
                ? "Update Input — "
                : "Record — "}
              {recordStage ? getStageLabel(recordStage.stageType) : ""}
            </DialogTitle>
          </DialogHeader>
          {loadingContext || !recordContext ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <StageRecordForm
              orderId={id}
              stage={recordStage}
              context={recordContext}
              onCancel={() => {
                setRecordStage(null);
                setRecordContext(null);
              }}
              onDone={() => {
                setRecordStage(null);
                setRecordContext(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewStage}
        onOpenChange={(open) => !open && setPreviewStage(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                Preview —{" "}
                {previewStage ? getStageLabel(previewStage.stageType) : ""}
              </span>
            </DialogTitle>
          </DialogHeader>
          {previewStage && (
            <div className="space-y-4 text-sm py-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                <span className="text-muted-foreground font-medium">
                  Stage Status
                </span>
                <Badge
                  variant="outline"
                  className={getStageStatusColor(previewStage.status)}
                >
                  {previewStage.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border bg-card text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Input</p>
                  <p className="font-semibold text-base">
                    {previewStage.inputQty ?? "—"}{" "}
                    <span className="text-xs text-muted-foreground">
                      {previewStage.inputUnit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Output</p>
                  <p className="font-semibold text-base text-emerald-600 dark:text-emerald-400">
                    {previewStage.outputQty ?? "—"}{" "}
                    <span className="text-xs text-muted-foreground">
                      {previewStage.outputUnit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Waste</p>
                  <p className="font-semibold text-base text-destructive">
                    {previewStage.wasteQty ?? "—"}
                  </p>
                </div>
              </div>

              {previewStage.stageType === "SLITTING" && previewStage.bagWidthCm != null && (
                <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Slitting Details
                  </p>
                  <p>
                    Bag width: <strong>{Number(previewStage.bagWidthCm)} cm</strong>
                  </p>
                  <p>
                    Recycled rolls:{" "}
                    <strong>
                      {previewStage.recycledRollCount
                        ? `${previewStage.recycledRollCount} × ${Number(previewStage.recycledWidthCm)} cm`
                        : "none"}
                    </strong>
                  </p>
                  <p>
                    Waste:{" "}
                    <strong>
                      {Number(previewStage.slitWasteWidthCm)} cm
                      {previewStage.slitWasteKg != null && ` (${Number(previewStage.slitWasteKg)} kg)`}
                    </strong>
                  </p>
                  {previewStage.lengthRestockQty != null && (
                    <p>
                      Length Restock:{" "}
                      <strong>{previewStage.lengthRestockQty} m</strong>
                    </p>
                  )}
                </div>
              )}

              {previewStage.remarks && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Remarks
                  </p>
                  <p className="text-foreground italic">
                    {previewStage.remarks}
                  </p>
                </div>
              )}

              {Array.isArray(previewStage.proofUrls) &&
                previewStage.proofUrls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Proof Images
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewStage.proofUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative"
                        >
                          <img
                            src={url}
                            alt="Proof"
                            className="h-16 w-16 rounded-md object-cover border group-hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
          <DialogFooter className="flex flex-row justify-between sm:justify-between items-center pt-2 border-t">
            <Button variant="outline" onClick={() => setPreviewStage(null)}>
              Close
            </Button>
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
