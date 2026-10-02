/** Fixed 8-stage production pipeline (per order line). */
export const STAGE_PIPELINE = [
  {
    sequence: 1,
    stageType: "RAW_MATERIAL",
    label: "Raw Material Receiving",
    inputUnit: "METER",
    outputUnit: "METER",
  },
  {
    sequence: 2,
    stageType: "SLITTING",
    label: "Slitting",
    inputUnit: "METER",
    outputUnit: "METER",
  },
  {
    sequence: 3,
    stageType: "PRINTING",
    label: "Printing",
    inputUnit: "METER",
    outputUnit: "METER",
  },
  {
    sequence: 4,
    stageType: "PRINT_QC",
    label: "Print QC",
    inputUnit: "METER",
    outputUnit: "METER",
    isQc: true,
  },
  {
    sequence: 5,
    stageType: "HANDLE_MAKING_PASTING",
    label: "Handle Making & Pasting",
    inputUnit: "METER",
    outputUnit: "BAG",
  },
  {
    sequence: 6,
    stageType: "QUALITY_CHECK",
    label: "Quality Check",
    inputUnit: "BAG",
    outputUnit: "BAG",
    isQc: true,
  },
  {
    sequence: 7,
    stageType: "PACKING",
    label: "Packing",
    inputUnit: "BAG",
    outputUnit: "CARTON",
  },
  {
    sequence: 8,
    stageType: "DISPATCH",
    label: "Dispatch",
    inputUnit: "CARTON",
    outputUnit: "CARTON",
  },
];

export const QC_STAGE_TYPES = ["PRINT_QC", "QUALITY_CHECK"];

/**
 * Stage progression graph. RAW_MATERIAL -> PRINTING -> PRINT_QC, then a
 * manual branch (worker's choice at PRINT_QC) to either SLITTING or
 * directly HANDLE_MAKING_PASTING, reconverging through the rest.
 */
export const STAGE_FLOW = {
  RAW_MATERIAL: { next: "PRINTING" },
  PRINTING: { next: "PRINT_QC" },
  PRINT_QC: { next: null, branches: ["SLITTING", "HANDLE_MAKING_PASTING"] },
  SLITTING: { next: "HANDLE_MAKING_PASTING" },
  HANDLE_MAKING_PASTING: { next: "QUALITY_CHECK" },
  QUALITY_CHECK: { next: "PACKING" },
  PACKING: { next: "DISPATCH" },
  DISPATCH: { next: null },
};

export const YIELD_THRESHOLD_PERCENT = 85;

export function getStageMeta(stageType) {
  return STAGE_PIPELINE.find((s) => s.stageType === stageType);
}

export function getStageLabel(stageType) {
  return getStageMeta(stageType)?.label || stageType;
}
