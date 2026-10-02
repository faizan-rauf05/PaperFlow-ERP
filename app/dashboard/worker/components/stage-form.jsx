import { Clock, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { getStageLabel } from "@/lib/production-constants";
import { workerStyles } from "../worker-dashboard.styles";
import { getTaskDisplayStatus } from "./status-badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { UNIT_LABELS, formatQuantity } from "@/lib/material-catalog";
import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";
import { formatWeight } from "@/lib/paper-sizing";
import {
  HANDLE_CONSUMPTIONS,
  catalogMaterialOptions,
  factoryStockLabel,
  plannedConsumption,
} from "@/components/production/stage-materials";

function fieldInputClass(hasError) {
  return cn(workerStyles.formInput, hasError && workerStyles.inputError);
}

// Material stores width in cm (paperWidthCm) — display everything in mm.
function widthMm(material) {
  return material?.paperWidthCm != null ? Number(material.paperWidthCm) * 10 : null;
}

export function StageForm({
  task,
  formLoading,
  submitting,
  timerSeconds,
  formatTime,
  isRawMaterial,
  isSlitting,
  isPrinting,
  isHandleMaking,
  isPacking,
  isDispatch,
  isPrintQc,
  nextStage,
  setNextStage,
  materials,
  stockById,
  inheritedMaterial,
  machines,
  materialId,
  setMaterialId,
  machineId,
  setMachineId,
  outputQty,
  setOutputQty,
  wasteQty,
  setWasteQty,
  remarks,
  setRemarks,
  // Slitting
  recycledRollCount,
  setRecycledRollCount,
  recycledWidthCm,
  setRecycledWidthCm,
  lengthRestockQty,
  setLengthRestockQty,
  slitPreview,
  bagWidthCm,
  inputQty,
  // Packing
  cartonMaterialId,
  setCartonMaterialId,
  cartonMaterials,
  // Handle making/pasting
  perBagConsumption,
  glueMaterials,
  ropeMaterials,
  handleConsumption = {},
  setHandleConsumptionField,
  // Downtime
  downtimeOpen,
  setDowntimeOpen,
  downtimeReason,
  setDowntimeReason,
  // Proof
  proofPhotoUrl,
  uploadingProof,
  onProofUpload,
  errors = {},
  clearError,
  onBack,
  onSubmit,
  onReportDowntime,
}) {
  const isUnlocked = getTaskDisplayStatus(task) === "UNLOCKED";
  const selectedMaterialStock = materialId
    ? stockById?.[materialId]
    : undefined;

  const outputLabel = isRawMaterial
    ? "Meters issued *"
    : isHandleMaking
      ? "Bags produced *"
      : isPacking
        ? "Cartons packed *"
        : isDispatch
          ? "Cartons dispatched *"
          : isPrinting
            ? "Printed meters *"
            : "Output qty *";

  const wasteLabel = isHandleMaking ? "Defective handles" : "Waste qty";

  // Show the generic output+waste block for everything except slitting
  // (which has its own custom fields) and packing/dispatch (no waste input).
  const showGenericOutput = !isSlitting;
  const showWasteField = showGenericOutput && !isPacking && !isDispatch;

  return (
    <div className={workerStyles.formCard}>
      <div className={workerStyles.formHeader}>
        <button type="button" className={workerStyles.backBtn} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
        </button>
        <h2 className={workerStyles.formTitle}>
          {getStageLabel(task.stageType)}
        </h2>
        <p className={workerStyles.formOrder}>
          {task.orderLine?.order?.orderNo} · Step {task.sequence}
        </p>
        <div className={workerStyles.timerPill}>
          <Clock className="h-4 w-4 text-white" />
          <span className={workerStyles.timerValue}>
            {formatTime(timerSeconds)}
          </span>
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
                  <p>
                    Correct the values below and submit again to re-lock this
                    stage.
                  </p>
                </div>
              </div>
            )}

            {task.inputQty != null && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>
                  Input (from previous stage)
                </label>
                <input
                  className={workerStyles.readonlyInput}
                  value={`${task.inputQty} ${task.inputUnit || ""}`}
                  readOnly
                />
              </div>
            )}

            {isRawMaterial && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>
                  Paper material *
                </label>
                <SearchableSelect
                  value={materialId}
                  onValueChange={(v) => {
                    setMaterialId(v);
                    clearError?.("materialId");
                  }}
                  options={(materials || []).map((m) => ({
                    value: m.id,
                    label: `${m.name} · ${widthMm(m) ?? "?"}mm (${m.code})`,
                    description: factoryStockLabel(m),
                  }))}
                  placeholder="Choose paper material…"
                  searchPlaceholder="Search material…"
                  error={!!errors.materialId}
                />
                {errors.materialId ? (
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.materialId}
                  </span>
                ) : (
                  <span className={workerStyles.hintText}>
                    {materialId
                      ? `Factory stock: ${selectedMaterialStock != null ? formatQuantity(selectedMaterialStock, "METER") : "—"}`
                      : "Meters issued from factory stock into this order"}
                  </span>
                )}
              </div>
            )}

            {isPrintQc && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>
                  Send to next stage *
                </label>
                <select
                  className={fieldInputClass(!!errors.nextStage)}
                  value={nextStage}
                  onChange={(e) => {
                    setNextStage(e.target.value);
                    clearError?.("nextStage");
                  }}
                >
                  <option value="">Choose Slitting or Handle Making…</option>
                  <option value="SLITTING">Slitting</option>
                  <option value="HANDLE_MAKING_PASTING">
                    Handle Making &amp; Pasting (skip slitting)
                  </option>
                </select>
                {errors.nextStage ? (
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.nextStage}
                  </span>
                ) : (
                  <span className={workerStyles.hintText}>
                    Pick where this order goes after QC
                  </span>
                )}
              </div>
            )}

            {isPrinting && inheritedMaterial && (
              <div className={workerStyles.rollBanner}>
                <strong>Material in use:</strong> {inheritedMaterial.name} —{" "}
                {widthMm(inheritedMaterial) ?? "—"}mm
                <p className={`${workerStyles.hintText} mt-1`}>
                  Continues from Raw Material — no re-selection
                </p>
              </div>
            )}

            {isSlitting && (
              <>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Slitting machine *
                  </label>
                  <SearchableSelect
                    value={machineId}
                    onValueChange={(v) => {
                      setMachineId(v);
                      clearError?.("machineId");
                    }}
                    options={(machines || []).map((m) => ({
                      value: m.id,
                      label: m.name,
                      description: `Code: ${m.machineCode}`,
                    }))}
                    placeholder="Select machine…"
                    searchPlaceholder="Search machine…"
                    error={!!errors.machineId}
                  />
                  {errors.machineId && (
                    <span className={workerStyles.fieldError} role="alert">
                      {errors.machineId}
                    </span>
                  )}
                </div>

                {inheritedMaterial && (
                  <p className={workerStyles.hintText}>
                    Roll: {inheritedMaterial.name} ({inheritedMaterial.barCode}) · bags need{" "}
                    {bagWidthCm ?? "—"} cm · leftover{" "}
                    {slitPreview?.leftoverCm ?? "—"} cm · input {inputQty ?? "—"} m
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className={workerStyles.formField}>
                    <label className={workerStyles.formLabel}>Recycled rolls</label>
                    <input
                      className={fieldInputClass(!!errors.recycledRollCount)}
                      type="number"
                      min="0"
                      step="1"
                      value={recycledRollCount}
                      onChange={(e) => {
                        setRecycledRollCount(e.target.value);
                        clearError?.("recycledRollCount");
                      }}
                    />
                  </div>
                  <div className={workerStyles.formField}>
                    <label className={workerStyles.formLabel}>Width each (cm)</label>
                    <input
                      className={fieldInputClass(!!errors.recycledRollCount)}
                      type="number"
                      min={C.RECYCLE_STRIP_MIN_CM}
                      max={C.RECYCLE_STRIP_MAX_CM}
                      step="0.1"
                      disabled={!(Number(recycledRollCount) > 0)}
                      value={recycledWidthCm}
                      onChange={(e) => {
                        setRecycledWidthCm(e.target.value);
                        clearError?.("recycledRollCount");
                      }}
                    />
                  </div>
                </div>
                {errors.recycledRollCount ? (
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.recycledRollCount}
                  </span>
                ) : (
                  <span className={workerStyles.hintText}>
                    Prefilled from the plan: leftover width cut into {C.RECYCLE_STRIP_MIN_CM}–{C.RECYCLE_STRIP_MAX_CM} cm rolls for handle making.
                  </span>
                )}

                {slitPreview && !slitPreview.error && (
                  <div className="rounded-md border px-3 py-2 text-sm space-y-1">
                    <p>
                      Bags: <strong>{bagWidthCm} cm × {Number(slitPreview.lengthM.toFixed(2))} m</strong>
                    </p>
                    {Number(recycledRollCount) > 0 && (
                      <p>
                        Recycled: <strong>{recycledRollCount} × {recycledWidthCm} cm</strong>
                        {slitPreview.stripWeightKg != null && ` (${formatWeight(slitPreview.stripWeightKg, "kg")} each)`} — added to
                        factory stock as {inheritedMaterial?.barCode}-1, -2…
                      </p>
                    )}
                    <p>
                      Waste: <strong>{slitPreview.wasteWidthCm} cm</strong>
                      {slitPreview.wasteKg != null && ` (${formatWeight(slitPreview.wasteKg, "kg")})`}
                    </p>
                  </div>
                )}

                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Length restock (m)
                  </label>
                  <input
                    className={fieldInputClass(!!errors.lengthRestockQty)}
                    type="number"
                    min="0"
                    step="0.01"
                    value={lengthRestockQty}
                    onChange={(e) => {
                      setLengthRestockQty(e.target.value);
                      clearError?.("lengthRestockQty");
                    }}
                  />
                  <span className={workerStyles.hintText}>
                    Optional: unused length returned to the roll
                  </span>
                </div>

              </>
            )}

            {isPacking && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Carton type *</label>
                <SearchableSelect
                  value={cartonMaterialId}
                  onValueChange={(v) => {
                    setCartonMaterialId(v);
                    clearError?.("cartonMaterialId");
                  }}
                  options={catalogMaterialOptions(cartonMaterials)}
                  placeholder="Select carton…"
                  searchPlaceholder="Search carton type…"
                  error={!!errors.cartonMaterialId}
                />
                {errors.cartonMaterialId && (
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.cartonMaterialId}
                  </span>
                )}
              </div>
            )}

            {machines?.length > 0 && !isSlitting && (
              <div className={workerStyles.formField}>
                <label className={workerStyles.formLabel}>Machine</label>
                <SearchableSelect
                  value={machineId}
                  onValueChange={(v) => {
                    setMachineId(v);
                    clearError?.("machineId");
                  }}
                  options={machines.map((m) => ({
                    value: m.id,
                    label: m.name,
                    description: `Code: ${m.machineCode}`,
                  }))}
                  placeholder="Select machine (optional)…"
                  searchPlaceholder="Search machine…"
                  error={!!errors.machineId}
                />
                {errors.machineId && (
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.machineId}
                  </span>
                )}
              </div>
            )}

            {showGenericOutput && (
              <div className={workerStyles.twoCol}>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    {outputLabel}
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
                  {errors.outputQty && (
                    <span className={workerStyles.fieldError} role="alert">
                      {errors.outputQty}
                    </span>
                  )}
                  {isPrinting && inputQty != null && outputQty !== "" && (
                    <span className={workerStyles.hintText}>
                      Waste (auto):{" "}
                      {(Number(inputQty) - Number(outputQty || 0)).toFixed(2)} m
                    </span>
                  )}
                </div>
                {showWasteField && (
                  <div className={workerStyles.formField}>
                    <label className={workerStyles.formLabel}>
                      {wasteLabel}
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
                      <span className={workerStyles.fieldError} role="alert">
                        {errors.wasteQty}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {isHandleMaking &&
              HANDLE_CONSUMPTIONS.map((c) => {
                const planned = plannedConsumption(
                  perBagConsumption,
                  c.perBagKey,
                  outputQty,
                );
                const options = catalogMaterialOptions(
                  c.materialType === "ROPE" ? ropeMaterials : glueMaterials,
                );
                const qtyError = errors[c.qtyField];
                const materialError = errors[c.materialField];
                return (
                  <div key={c.kind} className={workerStyles.formField}>
                    <label className={workerStyles.formLabel}>
                      {c.label} used ({UNIT_LABELS[c.unit]})
                    </label>
                    <SearchableSelect
                      value={handleConsumption[c.materialField] || ""}
                      onValueChange={(v) => {
                        setHandleConsumptionField?.(c.materialField, v);
                        clearError?.(c.materialField);
                      }}
                      options={options}
                      placeholder={`Which ${c.label.toLowerCase()}?`}
                      searchPlaceholder="Search supplier…"
                      error={!!materialError}
                    />
                    <input
                      className={`${fieldInputClass(!!qtyError)} mt-2`}
                      type="number"
                      min="0"
                      step="any"
                      placeholder={
                        planned != null
                          ? `Planned: ${formatQuantity(planned, c.unit)}`
                          : "Defaults to planned"
                      }
                      value={handleConsumption[c.qtyField] || ""}
                      onChange={(e) => {
                        setHandleConsumptionField?.(c.qtyField, e.target.value);
                        clearError?.(c.qtyField);
                      }}
                    />
                    {materialError || qtyError ? (
                      <span className={workerStyles.fieldError} role="alert">
                        {materialError || qtyError}
                      </span>
                    ) : (
                      <span className={workerStyles.hintText}>
                        {planned != null
                          ? `Planned for ${outputQty} bags: ${formatQuantity(planned, c.unit)} — leave blank to use it`
                          : "Enter bags produced to see the planned amount"}
                      </span>
                    )}
                  </div>
                );
              })}

            {/* <div className={workerStyles.formField}>
              <label className={workerStyles.formLabel}>
                Stage proof photo *
              </label>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="text-sm"
                disabled={uploadingProof}
                onChange={(e) => onProofUpload?.(e.target.files?.[0])}
              />

              {uploadingProof && (
                <span className={workerStyles.hintText}>Uploading…</span>
              )}

              {proofPhotoUrl && (
                <img
                  src={proofPhotoUrl}
                  alt="Stage proof"
                  className="mt-2 h-24 w-24 rounded-lg object-cover border"
                />
              )}

              {errors.proofPhoto && (
                <span className={workerStyles.fieldError} role="alert">
                  {errors.proofPhoto}
                </span>
              )}
            </div> */}
            <div className={workerStyles.formField}>
              <label className={workerStyles.formLabel}>
                Stage proof photo *
              </label>

              <div
                className={cn(
                  workerStyles.uploadBox,
                  errors.proofPhoto && "border-destructive bg-red-50",
                  proofPhotoUrl && "border-emerald-500 bg-emerald-50/50",
                )}
              >
                {!proofPhotoUrl ? (
                  <label className={workerStyles.uploadButton}>
                    <div className={workerStyles.uploadIcon}>
                      <Upload size={24} className="stroke-background" />
                    </div>

                    <div>
                      <p className={workerStyles.uploadTitle}>
                        Take stage photo
                      </p>

                      <p className={workerStyles.uploadHint}>
                        Camera or gallery
                      </p>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingProof}
                      onChange={(e) => {
                        onProofUpload?.(e.target.files?.[0]);
                        clearError?.("proofPhoto");
                      }}
                    />
                  </label>
                ) : (
                  <>
                    <div className={workerStyles.uploadPreview}>
                      <img
                        src={proofPhotoUrl}
                        alt="Stage proof"
                        className={workerStyles.uploadImage}
                      />

                      <span className={workerStyles.uploadBadge}>
                        Uploaded ✓
                      </span>
                    </div>

                    <label className={workerStyles.replaceUploadBtn}>
                      Replace photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingProof}
                        onChange={(e) => onProofUpload?.(e.target.files?.[0])}
                      />
                    </label>
                  </>
                )}
              </div>

              {uploadingProof && (
                <span className={workerStyles.hintText}>
                  Uploading photo...
                </span>
              )}

              {errors.proofPhoto && (
                <span className={workerStyles.fieldError} role="alert">
                  {errors.proofPhoto}
                </span>
              )}
            </div>

            <div className={workerStyles.formField}>
              <label className={workerStyles.formLabel}>Remarks</label>
              <textarea
                className={cn(
                  workerStyles.formTextarea,
                  errors.remarks && workerStyles.inputError,
                )}
                rows={2}
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  clearError?.("remarks");
                }}
              />
              {errors.remarks && (
                <span className={workerStyles.fieldError} role="alert">
                  {errors.remarks}
                </span>
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
                  <span className={workerStyles.fieldError} role="alert">
                    {errors.reason}
                  </span>
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
