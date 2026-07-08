import { Clock, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { getStageLabel } from "@/lib/production-constants";
import { workerStyles } from "../worker-dashboard.styles";
import { getTaskDisplayStatus } from "./status-badge";
import { cn } from "@/lib/utils";

function fieldInputClass(hasError) {
  return cn(workerStyles.formInput, hasError && workerStyles.inputError);
}

function fieldSelectClass(hasError) {
  return cn(workerStyles.formSelect, hasError && workerStyles.inputError);
}

function groupDefectsByCategory(defectTypes) {
  const groups = {};
  for (const d of defectTypes) {
    const key = d.category?.name || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }
  return groups;
}

export function StageForm({
  task,
  formLoading,
  submitting,
  timerSeconds,
  formatTime,
  isQc,
  isRawMaterial,
  isPrinting,
  isBagMaking,
  isHandleMaking,
  isHandlePasting,
  rolls,
  inheritedRoll,
  machines,
  defectTypes,
  rollId,
  setRollId,
  machineId,
  setMachineId,
  outputQty,
  setOutputQty,
  wasteQty,
  setWasteQty,
  passedQty,
  setPassedQty,
  rejectedQty,
  setRejectedQty,
  defectTypeId,
  setDefectTypeId,
  remarks,
  setRemarks,
  downtimeOpen,
  setDowntimeOpen,
  downtimeReason,
  setDowntimeReason,
  outputHint,
  plannedSideGlue,
  plannedBottomGlue,
  sideGlueKg,
  setSideGlueKg,
  bottomGlueKg,
  setBottomGlueKg,
  handleRopePcs,
  setHandleRopePcs,
  qcPhotoUrl,
  uploadingPhoto,
  onQcPhotoUpload,
  errors = {},
  clearError,
  onBack,
  onSubmit,
  onReportDowntime,
}) {
  const isUnlocked = getTaskDisplayStatus(task) === "UNLOCKED";
  const defectGroups = groupDefectsByCategory(defectTypes);
  const qcRoll = task.roll || inheritedRoll;
  const qcMachine = machines.find((m) => m.id === machineId);

  return (
    <div className={workerStyles.formCard}>
      <div className={workerStyles.formHeader}>
        <button type="button" className={workerStyles.backBtn} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
        </button>
        <h2 className={workerStyles.formTitle}>{getStageLabel(task.stageType)}</h2>
        <p className={workerStyles.formOrder}>
          {task.order?.orderNo} · Step {task.sequence} of 10
        </p>
        <div className={workerStyles.timerPill}>
          <Clock className="h-4 w-4 text-white" />
          <span className={workerStyles.timerValue}>{formatTime(timerSeconds)}</span>
          <span className={workerStyles.timerHint}>since start</span>
        </div>
      </div>

      <div className={workerStyles.formBody}>
        {formLoading ? (
          <div className={workerStyles.loadingBox}>
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {isUnlocked && (
              <div className={workerStyles.unlockBanner}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Correct the values below and submit again to re-lock this stage.</p>
                </div>
              </div>
            )}

            {task.inputQty != null && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Input (from previous stage)</label>
                <input
                  className={workerStyles.readonlyInput}
                  value={`${task.inputQty} ${task.inputUnit || ""}`}
                  readOnly
                />
              </div>
            )}

            {isRawMaterial && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Select roll *</label>
                <select
                  className={fieldSelectClass(!!errors.rollId)}
                  value={rollId}
                  onChange={(e) => {
                    setRollId(e.target.value);
                    clearError?.("rollId");
                  }}
                >
                  <option value="">Choose roll…</option>
                  {rolls.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rollNo} — {r.remainingLengthM}m left ({r.status})
                    </option>
                  ))}
                </select>
                {errors.rollId ? (
                  <span className={workerStyles.fieldError} role="alert">{errors.rollId}</span>
                ) : (
                  <span className={workerStyles.hintText}>Meters issued from this roll to production</span>
                )}
              </div>
            )}

            {isPrinting && inheritedRoll && (
              <div className={workerStyles.rollBanner}>
                <strong>Roll in use:</strong> {inheritedRoll.rollNo} — {inheritedRoll.remainingLengthM}m remaining
                <p className={`${workerStyles.hintText} mt-1`}>Continues from Raw Material — no re-selection</p>
              </div>
            )}

            {machines.length > 0 && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Machine</label>
                <select
                  className={fieldSelectClass(!!errors.machineId)}
                  value={machineId}
                  onChange={(e) => {
                    setMachineId(e.target.value);
                    clearError?.("machineId");
                  }}
                >
                  <option value="">Select machine…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {errors.machineId && (
                  <span className={workerStyles.fieldError} role="alert">{errors.machineId}</span>
                )}
              </div>
            )}

            {isQc && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>QC context</label>
                <div className="text-xs text-muted-foreground space-y-1 rounded-lg border p-2">
                  {qcRoll && <p>Roll: {qcRoll.rollNo}</p>}
                  {qcMachine && <p>Machine: {qcMachine.name}</p>}
                </div>
              </div>
            )}

            {isQc ? (
              <div className={workerStyles.twoCol}>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>Passed qty *</label>
                  <input
                    className={fieldInputClass(!!errors.passedQty)}
                    type="number"
                    min="0"
                    step="any"
                    value={passedQty}
                    onChange={(e) => {
                      setPassedQty(e.target.value);
                      clearError?.("passedQty");
                    }}
                  />
                  {errors.passedQty && (
                    <span className={workerStyles.fieldError} role="alert">{errors.passedQty}</span>
                  )}
                </div>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>Rejected qty *</label>
                  <input
                    className={fieldInputClass(!!errors.rejectedQty)}
                    type="number"
                    min="0"
                    step="any"
                    value={rejectedQty}
                    onChange={(e) => {
                      setRejectedQty(e.target.value);
                      clearError?.("rejectedQty");
                    }}
                  />
                  {errors.rejectedQty && (
                    <span className={workerStyles.fieldError} role="alert">{errors.rejectedQty}</span>
                  )}
                </div>
                <div className={`${workerStyles.formField} col-span-2`}>
                  <label className={workerStyles.formLabel}>Defect type</label>
                  <select
                    className={fieldSelectClass(!!errors.defectTypeId)}
                    value={defectTypeId}
                    onChange={(e) => {
                      setDefectTypeId(e.target.value);
                      clearError?.("defectTypeId");
                    }}
                  >
                    <option value="">Select defect…</option>
                    {Object.entries(defectGroups).map(([cat, items]) => (
                      <optgroup key={cat} label={cat}>
                        {items.map((d) => (
                          <option key={d.id} value={d.id}>{d.description}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {errors.defectTypeId && (
                    <span className={workerStyles.fieldError} role="alert">{errors.defectTypeId}</span>
                  )}
                </div>
                <div className={`${workerStyles.formField} col-span-2`}>
                  <label className={workerStyles.formLabel}>Defect photo (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="text-sm"
                    disabled={uploadingPhoto}
                    onChange={(e) => onQcPhotoUpload?.(e.target.files?.[0])}
                  />
                  {uploadingPhoto && <span className={workerStyles.hintText}>Uploading…</span>}
                  {qcPhotoUrl && (
                    <img src={qcPhotoUrl} alt="QC" className="mt-2 h-20 w-20 rounded-lg object-cover border" />
                  )}
                </div>
              </div>
            ) : (
              <div className={workerStyles.twoCol}>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    {isRawMaterial ? "Meters issued *" : isHandleMaking ? "Handles produced *" : isHandlePasting ? "Bags with handles *" : "Output qty *"}
                    {task.outputUnit ? ` (${task.outputUnit})` : ""}
                  </label>
                  <input
                    className={fieldInputClass(!!errors.outputQty)}
                    type="number"
                    min="0"
                    step="any"
                    value={outputQty}
                    onChange={(e) => {
                      setOutputQty(e.target.value);
                      clearError?.("outputQty");
                    }}
                  />
                  {errors.outputQty ? (
                    <span className={workerStyles.fieldError} role="alert">{errors.outputQty}</span>
                  ) : outputHint ? (
                    <span className={workerStyles.hintText}>{outputHint}</span>
                  ) : null}
                </div>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    {isHandleMaking ? "Defective handles" : "Waste qty"}
                  </label>
                  <input
                    className={fieldInputClass(!!errors.wasteQty)}
                    type="number"
                    min="0"
                    step="any"
                    value={wasteQty}
                    onChange={(e) => {
                      setWasteQty(e.target.value);
                      clearError?.("wasteQty");
                    }}
                  />
                  {errors.wasteQty && (
                    <span className={workerStyles.fieldError} role="alert">{errors.wasteQty}</span>
                  )}
                </div>
              </div>
            )}

            {isBagMaking && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Side glue used (kg)</label>
                <input
                  className={fieldInputClass(!!errors.sideGlueKg)}
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder={plannedSideGlue ? `Planned: ${plannedSideGlue}` : ""}
                  value={sideGlueKg}
                  onChange={(e) => {
                    setSideGlueKg(e.target.value);
                    clearError?.("sideGlueKg");
                  }}
                />
                {plannedSideGlue && <span className={workerStyles.hintText}>Planned: {plannedSideGlue} kg</span>}
              </div>
            )}

            {isHandleMaking && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Handle rope used (PCS)</label>
                <input
                  className={fieldInputClass(!!errors.handleRopePcs)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Defaults to produced + defective"
                  value={handleRopePcs}
                  onChange={(e) => {
                    setHandleRopePcs(e.target.value);
                    clearError?.("handleRopePcs");
                  }}
                />
                <span className={workerStyles.hintText}>Rope consumed from handle stock</span>
              </div>
            )}

            {isHandlePasting && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Bottom glue used (kg)</label>
                <input
                  className={fieldInputClass(!!errors.bottomGlueKg)}
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder={plannedBottomGlue ? `Planned: ${plannedBottomGlue}` : ""}
                  value={bottomGlueKg}
                  onChange={(e) => {
                    setBottomGlueKg(e.target.value);
                    clearError?.("bottomGlueKg");
                  }}
                />
                {plannedBottomGlue && <span className={workerStyles.hintText}>Planned: {plannedBottomGlue} kg</span>}
                {task.order?.bagSpec?.handlesPerBag && task.inputQty != null && (
                  <span className={workerStyles.hintText}>
                    Handles required: {Number(task.inputQty) * Number(task.order.bagSpec.handlesPerBag)} PCS
                  </span>
                )}
              </div>
            )}

            <div className={workerStyles.formField}>
              <label className={workerStyles.formLabel}>Remarks</label>
              <textarea
                className={cn(workerStyles.formTextarea, errors.remarks && workerStyles.inputError)}
                rows={2}
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  clearError?.("remarks");
                }}
              />
              {errors.remarks && (
                <span className={workerStyles.fieldError} role="alert">{errors.remarks}</span>
              )}
            </div>

            {machineId && (
              <button
                type="button"
                className={workerStyles.secondaryBtn}
                onClick={() => setDowntimeOpen(!downtimeOpen)}
              >
                Report machine downtime
              </button>
            )}

            {downtimeOpen && (
              <div className={workerStyles.formField}>
                <input
                  className={fieldInputClass(!!errors.reason)}
                  value={downtimeReason}
                  onChange={(e) => {
                    setDowntimeReason(e.target.value);
                    clearError?.("reason");
                  }}
                  placeholder="Downtime reason…"
                />
                {errors.reason && (
                  <span className={workerStyles.fieldError} role="alert">{errors.reason}</span>
                )}
                <button
                  type="button"
                  className={`${workerStyles.submitBtn} mt-2`}
                  onClick={onReportDowntime}
                >
                  Log downtime
                </button>
              </div>
            )}

            <button
              type="button"
              className={workerStyles.submitBtn}
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : isUnlocked ? (
                "Resubmit stage"
              ) : (
                "Submit stage"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
