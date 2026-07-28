"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Factory } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { workerStyles } from "./worker-dashboard.styles";
import { TaskList } from "./components/task-list";
import { StageForm } from "./components/stage-form";

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkerMobileDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingTaskId, setStartingTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [context, setContext] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [machines, setMachines] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Stage form inputs
  const [rollId, setRollId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [passedQty, setPassedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [defectTypeId, setDefectTypeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [sideGlueKg, setSideGlueKg] = useState("");
  const [bottomGlueKg, setBottomGlueKg] = useState("");
  const [handleRopePcs, setHandleRopePcs] = useState("");
  const [qcPhotoUrl, setQcPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState("");
  const [errors, setErrors] = useState({});

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/production/my-tasks");
      setTasks(data.tasks || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  async function handleStartTask(task) {
    setStartingTaskId(task.id);
    try {
      const [recordRes, rollsRes, machRes, defectsRes] = await Promise.all([
        api.get(
          `/production/orders/${task.orderLine?.orderId || task.orderId}/stages/${task.id}/record`,
        ),
        api.get("/rolls").catch(() => ({ data: { rolls: [] } })),
        api.get("/machines").catch(() => ({ data: { machines: [] } })),
        api.get("/defect-types").catch(() => ({ data: { defectTypes: [] } })),
      ]);

      const ctx = recordRes.data.context || {};
      const stg = ctx.stage || task;
      const qcRec = stg.qcRecords?.[0];
      const sideConsumption = stg.consumptions?.find(
        (c) => c.consumptionKind === "GLUE_SIDE",
      );
      const bottomConsumption = stg.consumptions?.find(
        (c) => c.consumptionKind === "GLUE_BOTTOM",
      );

      setContext(ctx);
      setRolls(rollsRes.data.rolls || []);
      setMachines(
        (machRes.data.machines || []).filter(
          (m) => m.stageType === task.stageType,
        ),
      );
      setDefectTypes(
        (defectsRes.data.defectTypes || defectsRes.data.types || []).filter(
          (d) => d.stageType === task.stageType,
        ),
      );

      // Auto-populate form values if previously entered or available in context
      setRollId(stg.materialId || "");
      setMachineId(stg.machineId || "");
      setOutputQty(stg.outputQty != null ? String(stg.outputQty) : "");
      setWasteQty(stg.wasteQty != null ? String(stg.wasteQty) : "");
      setRemarks(stg.remarks || "");
      setPassedQty(
        qcRec?.passedQty != null
          ? String(qcRec.passedQty)
          : stg.outputQty != null
            ? String(stg.outputQty)
            : "",
      );
      setRejectedQty(
        qcRec?.rejectedQty != null ? String(qcRec.rejectedQty) : "",
      );
      setDefectTypeId(qcRec?.defectTypeId || "");
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
      setQcPhotoUrl(Array.isArray(stg.proofUrls) ? stg.proofUrls[0] || "" : "");
      setErrors({});

      setSelectedTask(task);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setStartingTaskId(null);
    }
  }

  async function handleQcPhotoUpload(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/qc", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setQcPhotoUrl(data.photoUrl);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingPhoto(false);
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
    setSubmitting(true);
    try {
      const isQc = ["PRINT_QC", "QUALITY_CHECK"].includes(
        selectedTask.stageType,
      );
      const proofUrls = qcPhotoUrl ? [qcPhotoUrl] : [];
      const orderId = selectedTask.orderLine?.orderId || selectedTask.orderId;

      const payload = {
        materialId: rollId || undefined,
        machineId: machineId || undefined,
        outputQty: isQc ? passedQty : outputQty,
        wasteQty: wasteQty || undefined,
        proofUrls: proofUrls.length > 0 ? proofUrls : undefined,
        remarks: remarks || undefined,
        glueSideQty: sideGlueKg || undefined,
        glueBottomQty: bottomGlueKg || undefined,
        ropeMaterialId: handleRopePcs || undefined,
        qc: isQc
          ? {
              passedQty: passedQty,
              rejectedQty: rejectedQty || undefined,
              defectTypeId: defectTypeId || undefined,
            }
          : undefined,
      };

      await api.post(
        `/production/orders/${orderId}/stages/${selectedTask.id}/record`,
        payload,
      );
      toast.success("Stage recorded successfully!");
      setSelectedTask(null);
      setContext(null);
      loadTasks();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const isQc = selectedTask
    ? ["PRINT_QC", "QUALITY_CHECK"].includes(selectedTask.stageType)
    : false;
  const isRawMaterial = selectedTask?.stageType === "RAW_MATERIAL";
  const isPrinting = selectedTask?.stageType === "PRINTING";
  const isBagMaking = selectedTask?.stageType === "SLITTING";
  const isHandleMaking = selectedTask?.stageType === "HANDLE_MAKING_PASTING";
  const isHandlePasting = selectedTask?.stageType === "HANDLE_MAKING_PASTING";

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
                PaperFlow{" "}
                <span className={workerStyles.logoAccent}>Worker</span>
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

        <main className={workerStyles.main}>
          {selectedTask ? (
            <StageForm
              task={selectedTask}
              formLoading={false}
              submitting={submitting}
              timerSeconds={timerSeconds}
              formatTime={formatTimer}
              isQc={isQc}
              isRawMaterial={isRawMaterial}
              isPrinting={isPrinting}
              isBagMaking={isBagMaking}
              isHandleMaking={isHandleMaking}
              isHandlePasting={isHandlePasting}
              rolls={rolls}
              inheritedRoll={context?.paperMaterial}
              machines={machines}
              defectTypes={defectTypes}
              rollId={rollId}
              setRollId={setRollId}
              machineId={machineId}
              setMachineId={setMachineId}
              outputQty={outputQty}
              setOutputQty={setOutputQty}
              wasteQty={wasteQty}
              setWasteQty={setWasteQty}
              passedQty={passedQty}
              setPassedQty={setPassedQty}
              rejectedQty={rejectedQty}
              setRejectedQty={setRejectedQty}
              defectTypeId={defectTypeId}
              setDefectTypeId={setDefectTypeId}
              remarks={remarks}
              setRemarks={setRemarks}
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
              qcPhotoUrl={qcPhotoUrl}
              uploadingPhoto={uploadingPhoto}
              onQcPhotoUpload={handleQcPhotoUpload}
              errors={errors}
              clearError={(field) =>
                setErrors((prev) => ({ ...prev, [field]: null }))
              }
              onBack={() => setSelectedTask(null)}
              onSubmit={handleSubmitStage}
              onReportDowntime={handleReportDowntime}
            />
          ) : (
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
