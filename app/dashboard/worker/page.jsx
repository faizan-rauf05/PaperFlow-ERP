"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Factory, Hand, CheckCircle2, FileDown, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { computeSlittingPreview } from "@/lib/slitting-math";
import { workerStyles } from "./worker-dashboard.styles";
import { TaskList } from "./components/task-list";
import { StageForm } from "./components/stage-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkerMobileDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("available"); // "available" or "my_tasks"
  const [availableOrders, setAvailableOrders] = useState([]);
  const [pickingOrderId, setPickingOrderId] = useState(null);

  const [tasks, setTasks] = useState([]);
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
      const [availRes, tasksRes] = await Promise.all([
        api.get("/orders/available").catch(() => ({ data: { orders: [] } })),
        api.get("/production/my-tasks").catch(() => ({ data: { tasks: [] } })),
      ]);
      setAvailableOrders(availRes.data.orders || []);
      setTasks(tasksRes.data.tasks || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer interval for active task
  useEffect(() => {
    if (!selectedTask) return;
    setTimerSeconds(0);
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTask]);

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  // Pick an available approved order
  async function handlePickOrder(orderId) {
    setPickingOrderId(orderId);
    try {
      await api.post(`/orders/${orderId}/pick`);
      toast.success("Order picked & assigned to you!");
      await loadData();
      setActiveTab("my_tasks");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setPickingOrderId(null);
    }
  }

  async function handleStartTask(task) {
    setStartingTaskId(task.id);
    try {
      const [recordRes, matsRes, stockRes, machRes] = await Promise.all([
        api.get(
          `/production/orders/${task.orderLine?.orderId || task.orderId}/stages/${task.id}/record`,
        ),
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

      setErrors({});
      setSelectedTask(task);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setStartingTaskId(null);
    }
  }

  const isRawMaterial = selectedTask?.stageType === "RAW_MATERIAL";
  const isSlitting = selectedTask?.stageType === "SLITTING";
  const isPrinting = selectedTask?.stageType === "PRINTING";
  const isHandleMaking = selectedTask?.stageType === "HANDLE_MAKING_PASTING";
  const isPacking = selectedTask?.stageType === "PACKING";
  const isDispatch = selectedTask?.stageType === "DISPATCH";

  const inputQty = context?.inputQty ?? selectedTask?.inputQty;

  const slitPreview = useMemo(() => {
    if (!isSlitting) return null;
    return computeSlittingPreview({
      inputMeters: inputQty,
      parentWidthMm: context?.paperMaterial?.paperWidthMm,
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
              Available Orders ({availableOrders.length})
            </Button>
            <Button
              variant={activeTab === "my_tasks" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("my_tasks")}
              className="text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              My Assigned Tasks ({tasks.length})
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
            /* Available Approved Orders Queue */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Hand className="h-4 w-4 text-primary" /> Approved Orders Ready to Pick
                </h2>
                <span className="text-xs text-muted-foreground">
                  Pick an order to assign it to yourself
                </span>
              </div>

              {loading ? (
                <div className={workerStyles.loadingBox}>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p>Loading available orders…</p>
                </div>
              ) : availableOrders.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No approved orders available for picking right now.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check back when a manager approves new paper bag orders!
                  </p>
                </div>
              ) : (
                availableOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 border rounded-xl bg-card shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-foreground">
                            {ord.orderNo}
                          </span>
                          {ord.priority && ord.priority !== "NORMAL" && (
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300">
                              {ord.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                          Customer: {ord.customer?.name || "Standard Client"}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
                        Ready for Work
                      </Badge>
                    </div>

                    {/* Specifications */}
                    <div className="border rounded-lg p-2.5 bg-muted/40 text-xs space-y-1.5">
                      {(ord.lines || []).map((l, lIdx) => (
                        <div key={lIdx} className="flex items-center justify-between">
                          <span>
                            Line #{l.lineNo || lIdx + 1}:{" "}
                            <strong>
                              {l.widthCm || (l.widthMm ? l.widthMm / 10 : 30)}×
                              {l.heightCm || (l.heightMm ? l.heightMm / 10 : 40)}×
                              {l.baseCm || (l.baseMm ? l.baseMm / 10 : 12)}cm
                            </strong>{" "}
                            ({l.paperType || "Brown"}, {l.colorCount ?? 0} colors,{" "}
                            {l.withHandle ? "With Handle" : "No Handle"})
                          </span>
                          <span className="font-mono font-bold">
                            {Number(l.quantity || l.plannedQty || 0).toLocaleString()} bags
                          </span>
                        </div>
                      ))}
                    </div>

                    {ord.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        Notes: "{ord.notes}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {ord.deliveryDate
                          ? `Delivery: ${new Date(ord.deliveryDate).toLocaleDateString()}`
                          : "Standard Schedule"}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handlePickOrder(ord.id)}
                        disabled={pickingOrderId === ord.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 shadow-xs"
                      >
                        {pickingOrderId === ord.id ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Hand className="h-4 w-4 mr-1.5" />
                        )}
                        Pick This Order
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* My Picked / Assigned Tasks */
            <TaskList
              tasks={tasks}
              loading={loading}
              startingTaskId={startingTaskId}
              onStartTask={handleStartTask}
            />
          )}
        </main>
      </div>
    </div>
  );
}
