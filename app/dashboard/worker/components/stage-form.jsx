import { Clock, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { getStageLabel } from "@/lib/production-constants";
import { workerStyles } from "../worker-dashboard.styles";
import { getTaskDisplayStatus } from "./status-badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

function fieldInputClass(hasError) {
  return cn(workerStyles.formInput, hasError && workerStyles.inputError);
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
  cutWidthMm,
  setCutWidthMm,
  lengthRestockQty,
  setLengthRestockQty,
  remainderAction,
  setRemainderAction,
  slitPreview,
  inputQty,
  // Packing
  cartonMaterialId,
  setCartonMaterialId,
  cartonMaterials,
  // Handle making/pasting
  plannedSideGlue,
  plannedBottomGlue,
  sideGlueKg,
  setSideGlueKg,
  bottomGlueKg,
  setBottomGlueKg,
  handleRopePcs,
  setHandleRopePcs,
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
          {task.order?.orderNo} · Step {task.sequence} of 10
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
                    label: `${m.name} · ${m.paperWidthMm ?? "?"}mm (${m.code})`,
                    description: `Stock: ${stockById?.[m.id] ?? 0} m`,
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
                      ? `Available stock: ${selectedMaterialStock != null ? `${selectedMaterialStock} m` : "—"}`
                      : "Meters issued from stock into this order"}
                  </span>
                )}
              </div>
            )}

            {isPrinting && inheritedMaterial && (
              <div className={workerStyles.rollBanner}>
                <strong>Material in use:</strong> {inheritedMaterial.name} —{" "}
                {inheritedMaterial.paperWidthMm ?? "—"}mm
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

                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Cut width (mm) *
                  </label>
                  <input
                    className={fieldInputClass(!!errors.cutWidthMm)}
                    type="number"
                    min="1"
                    value={cutWidthMm}
                    onChange={(e) => {
                      setCutWidthMm(e.target.value);
                      clearError?.("cutWidthMm");
                    }}
                  />
                  {errors.cutWidthMm ? (
                    <span className={workerStyles.fieldError} role="alert">
                      {errors.cutWidthMm}
                    </span>
                  ) : (
                    <span className={workerStyles.hintText}>
                      Target strip width — prefilled from bag width
                    </span>
                  )}
                </div>

                {inheritedMaterial && (
                  <p className={workerStyles.hintText}>
                    Parent paper: {inheritedMaterial.name} · width{" "}
                    {inheritedMaterial.paperWidthMm ?? "—"} mm · input{" "}
                    {inputQty ?? "—"} m
                  </p>
                )}

                {slitPreview && (
                  <div className="rounded-md border px-3 py-2 text-sm space-y-1">
                    <p>
                      Pieces across width:{" "}
                      <strong>{slitPreview.pieceCount}</strong>
                    </p>
                    <p>
                      Width leftover:{" "}
                      <strong>{slitPreview.widthRemainderMm} mm</strong> strip{" "}
                      (≈{" "}
                      {Number(slitPreview.widthRemainderMeters || 0).toFixed(2)}{" "}
                      m)
                    </p>
                    <p>
                      Usable meters (next stage input):{" "}
                      <strong>
                        {Number(slitPreview.usableMeters || 0).toFixed(2)} m
                      </strong>
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
                    Optional: return unused cut-strip length to stock
                  </span>
                </div>

                {slitPreview?.widthRemainderMeters > 0 && (
                  <div className={workerStyles.formField}>
                    <label className={workerStyles.formLabel}>
                      Width leftover action *
                    </label>
                    <select
                      className={fieldInputClass(!!errors.remainderAction)}
                      value={remainderAction}
                      onChange={(e) => {
                        setRemainderAction(e.target.value);
                        clearError?.("remainderAction");
                      }}
                    >
                      <option value="">Waste or Restock…</option>
                      <option value="RESTOCK">
                        Restock leftover width strip
                      </option>
                      <option value="WASTE">
                        Mark leftover width as waste
                      </option>
                    </select>
                    {errors.remainderAction && (
                      <span className={workerStyles.fieldError} role="alert">
                        {errors.remainderAction}
                      </span>
                    )}
                  </div>
                )}
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
                  options={(cartonMaterials || []).map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.code})`,
                    description: `Stock: ${stockById?.[m.id] ?? "—"}`,
                  }))}
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

            {isHandleMaking && (
              <>
                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Side glue used (kg)
                  </label>
                  <input
                    className={fieldInputClass(!!errors.sideGlueKg)}
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder={
                      plannedSideGlue ? `Planned: ${plannedSideGlue}` : ""
                    }
                    value={sideGlueKg}
                    onChange={(e) => {
                      setSideGlueKg(e.target.value);
                      clearError?.("sideGlueKg");
                    }}
                  />
                  {plannedSideGlue && (
                    <span className={workerStyles.hintText}>
                      Planned: {plannedSideGlue} kg
                    </span>
                  )}
                </div>

                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Bottom glue used (kg)
                  </label>
                  <input
                    className={fieldInputClass(!!errors.bottomGlueKg)}
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder={
                      plannedBottomGlue ? `Planned: ${plannedBottomGlue}` : ""
                    }
                    value={bottomGlueKg}
                    onChange={(e) => {
                      setBottomGlueKg(e.target.value);
                      clearError?.("bottomGlueKg");
                    }}
                  />
                  {plannedBottomGlue && (
                    <span className={workerStyles.hintText}>
                      Planned: {plannedBottomGlue} kg
                    </span>
                  )}
                </div>

                <div className={workerStyles.formField}>
                  <label className={workerStyles.formLabel}>
                    Handle rope used (PCS)
                  </label>
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
                  <span className={workerStyles.hintText}>
                    Rope consumed from handle stock
                  </span>
                </div>
              </>
            )}

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
