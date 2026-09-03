"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Factory, Hand, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { computeSlittingPreview } from "@/lib/slitting-math";
import { workerStyles } from "./worker-dashboard.styles";
import { TaskList } from "./components/task-list";
import { StageForm } from "./components/stage-form";
import { Button } from "@/components/ui/button";

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkerMobileDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("available"); // "available" or "mine"
  const [availableStages, setAvailableStages] = useState([]);
  const [myStages, setMyStages] = useState([]);

  const [loading, setLoading] = useState(true);
  const [startingTaskId, setStartingTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [context, setContext] = useState(null);

  const [paperMaterials, setPaperMaterials] = useState([]);
  const [cartonMaterials, setCartonMaterials] = useState([]);
  const [stockById, setStockById] = useState({});
  const [machines, setMachines] = useState([]);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Stage form inputs
  const [materialId, setMaterialId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextStage, setNextStage] = useState("");

  // Slitting
  const [cutWidthMm, setCutWidthMm] = useState("");
  const [lengthRestockQty, setLengthRestockQty] = useState("0");
  const [remainderAction, setRemainderAction] = useState("");

  // Packing
  const [cartonMaterialId, setCartonMaterialId] = useState("");

  // Handle making/pasting
  const [sideGlueKg, setSideGlueKg] = useState("");
  const [bottomGlueKg, setBottomGlueKg] = useState("");
  const [handleRopePcs, setHandleRopePcs] = useState("");

  const [proofPhotoUrl, setProofPhotoUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);

  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState("");
  const [errors, setErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/production/my-tasks");
      setAvailableStages(data.available || []);
      setMyStages(data.mine || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer interval for active task — seeded from the real claim time
  // (startedAt) so it reflects actual claim-to-submit elapsed time, not
  // just time since this screen was opened.
  useEffect(() => {
    if (!selectedTask) return;
    const startedAtMs = selectedTask.startedAt
      ? new Date(selectedTask.startedAt).getTime()
      : null;
    const seed = startedAtMs
      ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      : 0;
    setTimerSeconds(seed);
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTask]);

  async function handleLogout() {
    await api.post("/auth/logout");
    router.push("/login");
  }

  // Open a stage: claim it first if it's still in the open pool (unclaimed),
  // then load record-form context, same as continuing an already-claimed one.
  async function handleStartTask(task) {
    const orderId = task.orderLine?.orderId || task.orderId;
    setStartingTaskId(task.id);
    try {
      if (task.status === "READY") {
        try {
          await api.post(`/production/orders/${orderId}/stages/${task.id}/start`);
        } catch (e) {
          toast.error(getApiErrorMessage(e) || "Someone else already claimed this stage");
          await loadData();
          return;
        }
      }

      const [recordRes, matsRes, stockRes, machRes] = await Promise.all([
        api.get(`/production/orders/${orderId}/stages/${task.id}/record`),
        api.get("/materials").catch(() => ({ data: { materials: [] } })),
        api
          .get("/inventory/current-stock")
          .catch(() => ({ data: { stock: [] } })),
        api.get("/machines").catch(() => ({ data: { machines: [] } })),
      ]);

      const ctx = recordRes.data.context || {};
      const stg = ctx.stage || task;
      const sideConsumption = stg.consumptions?.find(
        (c) => c.consumptionKind === "GLUE_SIDE",
      );
      const bottomConsumption = stg.consumptions?.find(
        (c) => c.consumptionKind === "GLUE_BOTTOM",
      );

      const allMaterials = matsRes.data.materials || [];
      setPaperMaterials(
        allMaterials.filter((m) => m.materialType === "PAPER_ROLL"),
      );
      setCartonMaterials(
        allMaterials.filter((m) => m.materialType === "CARTON"),
      );

      const stockMap = {};
      for (const row of stockRes.data.stock ||
        stockRes.data.materials ||
        stockRes.data.stocks ||
        []) {
        stockMap[row.id] = Number(row.currentStock ?? row.stock ?? 0);
      }
      setStockById(stockMap);

      setMachines(
        (machRes.data.machines || []).filter(
          (m) => m.stageType === task.stageType,
        ),
      );

      setContext(ctx);

      // Auto-populate form values
      setMaterialId(task.stageType === "PACKING" ? "" : stg.materialId || "");
      setCartonMaterialId(
        task.stageType === "PACKING" ? stg.materialId || "" : "",
      );
      setMachineId(stg.machineId || "");
      setOutputQty(stg.outputQty != null ? String(stg.outputQty) : "");
      setWasteQty(stg.wasteQty != null ? String(stg.wasteQty) : "");
      setRemarks(stg.remarks || "");

      setCutWidthMm(
        stg.cutWidthMm != null
          ? String(stg.cutWidthMm)
          : ctx.suggestedCutWidthMm != null
            ? String(ctx.suggestedCutWidthMm)
            : "",
      );
      setLengthRestockQty(
        stg.lengthRestockQty != null ? String(stg.lengthRestockQty) : "0",
      );
      setRemainderAction(stg.remainderAction || "");

      setSideGlueKg(
        sideConsumption?.actualQty != null
          ? String(sideConsumption.actualQty)
          : ctx?.gluePlan?.sideKg != null
            ? String(ctx.gluePlan.sideKg)
            : "",
      );
      setBottomGlueKg(
        bottomConsumption?.actualQty != null
          ? String(bottomConsumption.actualQty)
          : ctx?.gluePlan?.bottomKg != null
            ? String(ctx.gluePlan.bottomKg)
            : "",
      );
      setHandleRopePcs("");
      setProofPhotoUrl(
        Array.isArray(stg.proofUrls) ? stg.proofUrls[0] || "" : "",
      );
      setNextStage("");

      setErrors({});
      setSelectedTask(stg);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setStartingTaskId(null);
    }
  }

  const isRawMaterial = selectedTask?.stageType === "RAW_MATERIAL";
  const isSlitting = selectedTask?.stageType === "SLITTING";
  const isPrinting = selectedTask?.stageType === "PRINTING";
  const isPrintQc = selectedTask?.stageType === "PRINT_QC";
  const isQualityCheck = selectedTask?.stageType === "QUALITY_CHECK";
  const isHandleMaking = selectedTask?.stageType === "HANDLE_MAKING_PASTING";
  const isPacking = selectedTask?.stageType === "PACKING";
  const isDispatch = selectedTask?.stageType === "DISPATCH";

  const inputQty = context?.inputQty ?? selectedTask?.inputQty;

  const slitPreview = useMemo(() => {
    if (!isSlitting) return null;
    return computeSlittingPreview({
      inputMeters: inputQty,
      parentWidthMm:
        context?.paperMaterial?.paperWidthCm != null
          ? Number(context.paperMaterial.paperWidthCm) * 10
          : undefined,
      cutWidthMm,
      gsm: context?.paperMaterial?.gsm,
      lengthRestockMeters: lengthRestockQty,
    });
  }, [
    isSlitting,
    inputQty,
    context?.paperMaterial,
    cutWidthMm,
    lengthRestockQty,
  ]);

  useEffect(() => {
    if (!slitPreview) return;
    setOutputQty(String(slitPreview.usableMeters ?? ""));
  }, [slitPreview]);

  function clearError(field) {
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function validate() {
    const next = {};
    if (!proofPhotoUrl) next.proofPhoto = "Add stage proof photo";

    if (isRawMaterial) {
      if (!materialId) next.materialId = "Select paper material";
      if (!outputQty || Number(outputQty) <= 0)
        next.outputQty = "Enter meters issued";
    }
    if (isSlitting) {
      if (!machineId) next.machineId = "Slitting machine required";
      if (!cutWidthMm || Number(cutWidthMm) <= 0)
        next.cutWidthMm = "Cut width required";
      if (slitPreview?.widthRemainderMeters > 0 && !remainderAction) {
        next.remainderAction = "Choose waste or restock for width leftover";
      }
    }
    if (isPrinting) {
      if (!outputQty || Number(outputQty) <= 0)
        next.outputQty = "Printed meters required";
    }
    if (isHandleMaking) {
      if (!outputQty || Number(outputQty) <= 0)
        next.outputQty = "Bags produced required";
    }
    if (isPacking) {
      if (!outputQty || Number(outputQty) <= 0)
        next.outputQty = "Cartons required";
      if (!cartonMaterialId) next.cartonMaterialId = "Select carton type";
    }
    if (isDispatch) {
      if (!outputQty || Number(outputQty) <= 0)
        next.outputQty = "Dispatched qty required";
    }
    if (isPrintQc || isQualityCheck) {
      if (!outputQty || Number(outputQty) < 0)
        next.outputQty = "Passed quantity required";
    }
    if (isPrintQc && !nextStage) {
      next.nextStage = "Choose Slitting or Handle Making";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleProofUpload(file) {
    if (!file) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProofPhotoUrl(data.photoUrl);
      clearError("proofPhoto");
      toast.success("Proof photo uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleReportDowntime() {
    if (!machineId) {
      toast.error("Please select a machine first");
      return;
    }
    if (!downtimeReason.trim()) {
      setErrors((prev) => ({ ...prev, reason: "Downtime reason required" }));
      return;
    }
    try {
      await api.post(`/machines/${machineId}/downtime`, {
        reason: downtimeReason.trim(),
        startTime: new Date().toISOString(),
      });
      toast.success("Downtime logged");
      setDowntimeOpen(false);
      setDowntimeReason("");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function handleSubmitStage() {
    if (!selectedTask) return;
    if (!validate()) {
      toast.error("Fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    try {
      const orderId = selectedTask.orderLine?.orderId || selectedTask.orderId;
      const proofUrls = proofPhotoUrl ? [proofPhotoUrl] : [];

      const payload = {
        materialId: isPacking
          ? cartonMaterialId || undefined
          : materialId || undefined,
        machineId: machineId || undefined,
        outputQty: outputQty || undefined,
        wasteQty: wasteQty || undefined,
        proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
        remarks: remarks || undefined,
        cutWidthMm: isSlitting ? cutWidthMm || undefined : undefined,
        remainderAction: isSlitting ? remainderAction || undefined : undefined,
        remainderQty: isSlitting
          ? slitPreview?.widthRemainderMeters || undefined
          : undefined,
        lengthRestockQty: isSlitting
          ? lengthRestockQty || undefined
          : undefined,
        pieceCount: isSlitting
          ? slitPreview?.pieceCount || undefined
          : undefined,
        pieceWeightKg: isSlitting
          ? (slitPreview?.pieceWeightKg ?? undefined)
          : undefined,
        cartonMaterialId: isPacking ? cartonMaterialId || undefined : undefined,
        glueSideQty: isHandleMaking ? sideGlueKg || undefined : undefined,
        glueBottomQty: isHandleMaking ? bottomGlueKg || undefined : undefined,
        nextStage: isPrintQc ? nextStage || undefined : undefined,
      };

      await api.post(
        `/production/orders/${orderId}/stages/${selectedTask.id}/record`,
        payload,
      );
      toast.success("Stage recorded successfully!");
      setSelectedTask(null);
      setContext(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={workerStyles.root}>
      <div className={workerStyles.shell}>
        <header className={workerStyles.header}>
          <div className={workerStyles.headerInner}>
            <div className={workerStyles.logo}>
              <div className={workerStyles.logoIcon}>
                <Factory size={18} className="text-white" />
              </div>
              <span className={workerStyles.logoName}>
                PaperFlow <span className={workerStyles.logoAccent}>Worker</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className={workerStyles.logoutBtn}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Tab Navigation Controls */}
        {!selectedTask && (
          <div className="p-3 bg-muted/40 border-b flex items-center justify-center gap-2">
            <Button
              variant={activeTab === "available" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("available")}
              className="text-xs font-semibold"
            >
              <Hand className="h-3.5 w-3.5 mr-1.5" />
              Available Stages ({availableStages.length})
            </Button>
            <Button
              variant={activeTab === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("mine")}
              className="text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              My Active Stages ({myStages.length})
            </Button>
          </div>
        )}

        <main className={workerStyles.main}>
          {selectedTask ? (
            <StageForm
              task={selectedTask}
              formLoading={false}
              submitting={submitting}
              timerSeconds={timerSeconds}
              formatTime={formatTimer}
              isRawMaterial={isRawMaterial}
              isSlitting={isSlitting}
              isPrinting={isPrinting}
              isHandleMaking={isHandleMaking}
              isPacking={isPacking}
              isDispatch={isDispatch}
              isPrintQc={isPrintQc}
              nextStage={nextStage}
              setNextStage={setNextStage}
              materials={paperMaterials}
              stockById={stockById}
              inheritedMaterial={context?.paperMaterial}
              machines={machines}
              materialId={materialId}
              setMaterialId={setMaterialId}
              machineId={machineId}
              setMachineId={setMachineId}
              outputQty={outputQty}
              setOutputQty={setOutputQty}
              wasteQty={wasteQty}
              setWasteQty={setWasteQty}
              remarks={remarks}
              setRemarks={setRemarks}
              cutWidthMm={cutWidthMm}
              setCutWidthMm={setCutWidthMm}
              lengthRestockQty={lengthRestockQty}
              setLengthRestockQty={setLengthRestockQty}
              remainderAction={remainderAction}
              setRemainderAction={setRemainderAction}
              slitPreview={slitPreview}
              inputQty={inputQty}
              cartonMaterialId={cartonMaterialId}
              setCartonMaterialId={setCartonMaterialId}
              cartonMaterials={cartonMaterials}
              downtimeOpen={downtimeOpen}
              setDowntimeOpen={setDowntimeOpen}
              downtimeReason={downtimeReason}
              setDowntimeReason={setDowntimeReason}
              plannedSideGlue={context?.gluePlan?.sideKg}
              plannedBottomGlue={context?.gluePlan?.bottomKg}
              sideGlueKg={sideGlueKg}
              setSideGlueKg={setSideGlueKg}
              bottomGlueKg={bottomGlueKg}
              setBottomGlueKg={setBottomGlueKg}
              handleRopePcs={handleRopePcs}
              setHandleRopePcs={setHandleRopePcs}
              proofPhotoUrl={proofPhotoUrl}
              uploadingProof={uploadingProof}
              onProofUpload={handleProofUpload}
              errors={errors}
              clearError={clearError}
              onBack={() => setSelectedTask(null)}
              onSubmit={handleSubmitStage}
              onReportDowntime={handleReportDowntime}
            />
          ) : activeTab === "available" ? (
            /* Open stage pool — first come, first served */
            <TaskList
              tasks={availableStages}
              loading={loading}
              startingTaskId={startingTaskId}
              onStartTask={handleStartTask}
              mode="available"
            />
          ) : (
            /* Stages this worker currently holds */
            <TaskList
              tasks={myStages}
              loading={loading}
              startingTaskId={startingTaskId}
              onStartTask={handleStartTask}
              mode="mine"
            />
          )}
        </main>
      </div>
    </div>
  );
}
