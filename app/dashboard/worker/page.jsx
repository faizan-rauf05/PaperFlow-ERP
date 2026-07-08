"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { QC_STAGE_TYPES, getStageMeta } from "@/lib/production-constants";
import { getConversionHint } from "@/lib/conversion-hint";
import {
  workerStandardStageSchema,
  workerQcStageSchema,
  workerDowntimeSchema,
} from "@/lib/validations/worker-forms";
import { validateForm, clearFieldError, firstErrorMessage } from "@/lib/validations/form-utils";
import { workerStyles } from "./worker-dashboard.styles";
import { TaskList } from "./components/task-list";
import { StageForm } from "./components/stage-form";

function elapsedSince(startedAt) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function prefillFromTask(task, setters) {
  if (task.outputQty != null && !QC_STAGE_TYPES.includes(task.stageType)) {
    setters.setOutputQty(String(task.outputQty));
  }
  if (task.wasteQty != null) setters.setWasteQty(String(task.wasteQty));
  if (task.remarks) setters.setRemarks(task.remarks);
}

export default function WorkerMobileDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const [rolls, setRolls] = useState([]);
  const [inheritedRoll, setInheritedRoll] = useState(null);
  const [machines, setMachines] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);

  const [rollId, setRollId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [passedQty, setPassedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("");
  const [defectTypeId, setDefectTypeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState("");
  const [sideGlueKg, setSideGlueKg] = useState("");
  const [bottomGlueKg, setBottomGlueKg] = useState("");
  const [handleRopePcs, setHandleRopePcs] = useState("");
  const [qcPhotoUrl, setQcPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formErrors, setFormErrors] = useState({});

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

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (!isTimerRunning) return undefined;
    const interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const isQc = activeTask && QC_STAGE_TYPES.includes(activeTask.stageType);
  const isRawMaterial = activeTask?.stageType === "RAW_MATERIAL";
  const isPrinting = activeTask?.stageType === "PRINTING";
  const isBagMaking = activeTask?.stageType === "BAG_MAKING";
  const isHandleMaking = activeTask?.stageType === "HANDLE_MAKING";
  const isHandlePasting = activeTask?.stageType === "HANDLE_PASTING";

  async function loadInheritedRoll(orderId) {
    const { data } = await api.get(`/production/orders/${orderId}`);
    const rawStage = data.order?.stages?.find((s) => s.sequence === 1);
    if (rawStage?.roll) {
      setInheritedRoll(rawStage.roll);
      setRollId(rawStage.roll.id);
    }
  }

  function resetForm() {
    setRollId("");
    setInheritedRoll(null);
    setMachineId("");
    setOutputQty("");
    setWasteQty("");
    setPassedQty("");
    setRejectedQty("");
    setDefectTypeId("");
    setRemarks("");
    setDowntimeOpen(false);
    setDowntimeReason("");
    setSideGlueKg("");
    setBottomGlueKg("");
    setHandleRopePcs("");
    setQcPhotoUrl("");
    setFormErrors({});
  }

  function clearError(field) {
    setFormErrors((prev) => clearFieldError(prev, field));
  }

  async function loadFormData(task) {
    setFormLoading(true);
    try {
      const promises = [
        api.get("/machines", { params: { stageType: task.stageType } }).then((r) => setMachines(r.data.machines || [])),
      ];

      if (task.stageType === "RAW_MATERIAL") {
        promises.push(
          api.get("/rolls", { params: { selectable: "true" } }).then((r) => setRolls(r.data.rolls || [])),
        );
      }

      if (task.stageType === "PRINTING") {
        promises.push(loadInheritedRoll(task.orderId));
      }

      if (QC_STAGE_TYPES.includes(task.stageType)) {
        promises.push(
          api.get("/defect-types", { params: { stageType: task.stageType } }).then((r) => setDefectTypes(r.data.defectTypes || [])),
        );
      }

      await Promise.all(promises);

      if (task.roll) {
        setRollId(task.roll.id);
        setInheritedRoll(task.roll);
      }
      if (task.machine) setMachineId(task.machine.id);

      prefillFromTask(task, { setOutputQty, setWasteQty, setRemarks });
    } finally {
      setFormLoading(false);
    }
  }

  function openTaskForm(task, startedAt) {
    setActiveTask(task);
    setTimerSeconds(elapsedSince(startedAt));
    setIsTimerRunning(true);
    resetForm();
    loadFormData(task);
  }

  async function handleStartStage(task) {
    setStartingTaskId(task.id);
    try {
      const needsRoll = getStageMeta(task.stageType)?.requiresRoll;
      if (task.status === "READY" && !needsRoll) {
        const { data } = await api.post(`/production/orders/${task.orderId}/stages/${task.id}/start`, {
          rollId: null,
          machineId: null,
        });
        await loadTasks();
        openTaskForm({ ...task, status: "IN_PROGRESS", startedAt: data.stage?.startedAt }, data.stage?.startedAt);
      } else if (task.status === "IN_PROGRESS") {
        openTaskForm(task, task.startedAt);
      } else {
        openTaskForm(task, null);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setStartingTaskId(null);
    }
  }

  async function handleSubmitStage() {
    if (!activeTask) return;

    const effectiveRollId = rollId || inheritedRoll?.id || "";
    const selectedRoll = rolls.find((r) => r.id === rollId) || inheritedRoll;

    const validationResult = isQc
      ? validateForm(workerQcStageSchema, {
          passedQty,
          rejectedQty,
          defectTypeId,
          remarks,
          inputQty: activeTask.inputQty,
        })
      : validateForm(workerStandardStageSchema, {
          rollId: effectiveRollId || undefined,
          outputQty,
          wasteQty: wasteQty || 0,
          remarks,
          inputQty: activeTask.inputQty,
          isRawMaterial,
          rollRemainingM: selectedRoll?.remainingLengthM ?? null,
        });

    if (!validationResult.success) {
      setFormErrors(validationResult.errors);
      toast.error(firstErrorMessage(validationResult.errors));
      return;
    }

    setSubmitting(true);
    try {
      if (activeTask.status === "READY") {
        const { data } = await api.post(`/production/orders/${activeTask.orderId}/stages/${activeTask.id}/start`, {
          rollId: effectiveRollId || null,
          machineId: machineId || null,
        });
        setActiveTask((t) => ({ ...t, status: "IN_PROGRESS", startedAt: data.stage?.startedAt }));
      }

      const payload = { remarks: validationResult.data.remarks || "" };
      if (isQc) {
        payload.qc = {
          passedQty: validationResult.data.passedQty,
          rejectedQty: validationResult.data.rejectedQty,
          defectTypeId: validationResult.data.defectTypeId || null,
          photoUrl: qcPhotoUrl || null,
        };
        payload.outputQty = validationResult.data.passedQty;
      } else {
        payload.outputQty = validationResult.data.outputQty;
        payload.wasteQty = validationResult.data.wasteQty ?? 0;
        const consumptions = {};
        if (isBagMaking && sideGlueKg) consumptions.sideGlueKg = Number(sideGlueKg);
        if (isHandlePasting && bottomGlueKg) consumptions.bottomGlueKg = Number(bottomGlueKg);
        if (isHandleMaking && handleRopePcs) consumptions.handleRopePcs = Number(handleRopePcs);
        if (Object.keys(consumptions).length) payload.consumptions = consumptions;
      }

      await api.post(`/production/orders/${activeTask.orderId}/stages/${activeTask.id}/submit`, payload);
      toast.success("Stage submitted and locked");
      setIsTimerRunning(false);
      setActiveTask(null);
      setTimerSeconds(0);
      resetForm();
      await loadTasks();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoll = rolls.find((r) => r.id === rollId) || inheritedRoll;
  const inProgressCount = loading ? "—" : tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const taskCount = loading ? "—" : tasks.length;

  const outputHint = activeTask && outputQty
    ? getConversionHint({
        quantity: outputQty,
        fromUnit: activeTask.outputUnit || "METER",
        toUnit: isHandleMaking
          ? "PCS"
          : activeTask.outputUnit === "METER"
            ? "KG"
            : activeTask.outputUnit === "BAG"
              ? isHandlePasting
                ? "PCS"
                : "CARTON"
              : "BAG",
        roll: selectedRoll,
        bagSpec: activeTask.order?.bagSpec,
      })
    : null;

  const plannedSideGlue = isBagMaking && outputQty && activeTask.order?.bagSpec?.sideGlueKgPerBag
    ? (parseFloat(outputQty) * activeTask.order.bagSpec.sideGlueKgPerBag).toFixed(4)
    : null;

  const plannedBottomGlue = isHandlePasting && outputQty && activeTask.order?.bagSpec?.bottomGlueKgPerBag
    ? (parseFloat(outputQty) * activeTask.order.bagSpec.bottomGlueKgPerBag).toFixed(4)
    : null;

  async function handleQcPhotoUpload(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/uploads/qc", formData, {
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
    const result = validateForm(workerDowntimeSchema, { machineId, reason: downtimeReason });
    if (!result.success) {
      setFormErrors((prev) => ({ ...prev, ...result.errors }));
      toast.error(firstErrorMessage(result.errors));
      return;
    }

    try {
      await api.post(`/machines/${machineId}/downtime`, {
        reason: result.data.reason,
        startTime: new Date().toISOString(),
      });
      toast.success("Downtime reported");
      setDowntimeOpen(false);
      setDowntimeReason("");
      setFormErrors((prev) => clearFieldError(clearFieldError(prev, "reason"), "machineId"));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  function handleBackToTasks() {
    setIsTimerRunning(false);
    setActiveTask(null);
    setTimerSeconds(0);
    resetForm();
  }

  return (
    <div className={workerStyles.root}>
      <div className={workerStyles.shell}>
        <header className={workerStyles.header}>
          <div className={workerStyles.headerInner}>
            <div className={workerStyles.logo}>
              <div className={workerStyles.logoIcon}>
                <Factory size={17} className="text-white" />
              </div>
              <span className={workerStyles.logoName}>
                Paper<span className={workerStyles.logoAccent}>Pro</span>
              </span>
            </div>
            <button
              type="button"
              className={workerStyles.logoutBtn}
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className={workerStyles.main}>
          <div className={workerStyles.summaryGrid}>
            <div className={workerStyles.summaryTile}>
              <div className={workerStyles.summaryValue}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : taskCount}
              </div>
              <div className={workerStyles.summaryLabel}>My tasks</div>
            </div>
            <div className={workerStyles.summaryTile}>
              <div className={workerStyles.summaryValue}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : inProgressCount}
              </div>
              <div className={workerStyles.summaryLabel}>In progress</div>
            </div>
          </div>

          {activeTask ? (
            <StageForm
              task={activeTask}
              formLoading={formLoading}
              submitting={submitting}
              timerSeconds={timerSeconds}
              formatTime={formatTime}
              isQc={isQc}
              isRawMaterial={isRawMaterial}
              isPrinting={isPrinting}
              isBagMaking={isBagMaking}
              isHandleMaking={isHandleMaking}
              isHandlePasting={isHandlePasting}
              rolls={rolls}
              inheritedRoll={inheritedRoll}
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
              outputHint={outputHint}
              plannedSideGlue={plannedSideGlue}
              plannedBottomGlue={plannedBottomGlue}
              sideGlueKg={sideGlueKg}
              setSideGlueKg={setSideGlueKg}
              bottomGlueKg={bottomGlueKg}
              setBottomGlueKg={setBottomGlueKg}
              handleRopePcs={handleRopePcs}
              setHandleRopePcs={setHandleRopePcs}
              qcPhotoUrl={qcPhotoUrl}
              uploadingPhoto={uploadingPhoto}
              onQcPhotoUpload={handleQcPhotoUpload}
              errors={formErrors}
              clearError={clearError}
              onBack={handleBackToTasks}
              onSubmit={handleSubmitStage}
              onReportDowntime={handleReportDowntime}
            />
          ) : (
            <section>
              <div className={workerStyles.sectionHead}>
                <h2 className={workerStyles.sectionTitle}>My tasks</h2>
                {!loading && <span className={workerStyles.sectionCount}>{tasks.length}</span>}
              </div>
              <TaskList
                tasks={tasks}
                loading={loading}
                startingTaskId={startingTaskId}
                onStartTask={handleStartStage}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
