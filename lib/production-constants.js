/** Fixed 10-stage production pipeline (sequence 1–10). */
export const STAGE_PIPELINE = [
  { sequence: 1, stageType: "RAW_MATERIAL", label: "Raw Material", inputUnit: "METER", outputUnit: "METER", requiresRoll: true },
  { sequence: 2, stageType: "PRINTING", label: "Printing", inputUnit: "METER", outputUnit: "METER", requiresRoll: true },
  { sequence: 3, stageType: "PRINT_QC", label: "Print QC", inputUnit: "METER", outputUnit: "METER", isQc: true },
  { sequence: 4, stageType: "SLITTING", label: "Slitting", inputUnit: "METER", outputUnit: "METER" },
  { sequence: 5, stageType: "BAG_MAKING", label: "Bag Making", inputUnit: "METER", outputUnit: "BAG" },
  { sequence: 6, stageType: "HANDLE_MAKING", label: "Handle Making", inputUnit: "PCS", outputUnit: "PCS", inputFromSequence: 5 },
  { sequence: 7, stageType: "HANDLE_PASTING", label: "Handle Pasting", inputUnit: "BAG", outputUnit: "BAG", inputFromSequence: 5 },
  { sequence: 8, stageType: "FINAL_QC", label: "Final QC", inputUnit: "BAG", outputUnit: "BAG", isQc: true },
  { sequence: 9, stageType: "PACKING", label: "Packing", inputUnit: "BAG", outputUnit: "CARTON" },
  { sequence: 10, stageType: "DISPATCH", label: "Dispatch", inputUnit: "CARTON", outputUnit: "CARTON" },
];

export const QC_STAGE_TYPES = ["PRINT_QC", "FINAL_QC"];

export const YIELD_THRESHOLD_PERCENT = 85;

export function getStageMeta(stageType) {
  return STAGE_PIPELINE.find((s) => s.stageType === stageType);
}

export function getStageLabel(stageType) {
  return getStageMeta(stageType)?.label || stageType;
}
