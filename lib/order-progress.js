/** Helpers for production order list / progress display. */

import { getStageLabel } from "@/lib/production-constants";

/** Color by stage *status* (same status → same color). */
export const STAGE_STATUS_COLORS = {
  PENDING: "bg-slate-500/15 text-slate-700 border-slate-400/40 dark:text-slate-200",
  READY: "bg-amber-500/20 text-amber-900 border-amber-500/50 dark:text-amber-100",
  IN_PROGRESS: "bg-blue-500/20 text-blue-900 border-blue-500/50 dark:text-blue-100",
  COMPLETED: "bg-emerald-500/20 text-emerald-900 border-emerald-500/50 dark:text-emerald-100",
};

export const ORDER_STATUS_COLORS = {
  PENDING: "bg-slate-500/15 text-slate-700 border-slate-400/40 dark:text-slate-200",
  RUNNING: "bg-blue-500/20 text-blue-900 border-blue-500/50 dark:text-blue-100",
  COMPLETED: "bg-emerald-500/20 text-emerald-900 border-emerald-500/50 dark:text-emerald-100",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

export function getLineCurrentStage(line) {
  const stages = [...(line?.stages || [])].sort((a, b) => a.sequence - b.sequence);
  if (stages.length === 0) return null;
  return stages.find((s) => s.status !== "COMPLETED") || stages[stages.length - 1];
}

export function getStageStatusColor(status) {
  return STAGE_STATUS_COLORS[status] || STAGE_STATUS_COLORS.PENDING;
}

/**
 * One badge per order line: bag spec · qty · current stage (status-colored).
 */
export function getOrderLineProgressRows(order) {
  return (order?.lines || []).map((line) => {
    const stages = [...(line.stages || [])].sort((a, b) => a.sequence - b.sequence);
    const allDone = stages.length > 0 && stages.every((s) => s.status === "COMPLETED");
    const stage = getLineCurrentStage(line);
    const status = allDone ? "COMPLETED" : stage?.status || "PENDING";
    const dims =
      line.heightMm || line.widthMm || line.baseMm
        ? `${line.heightMm || 0}×${line.widthMm || 0}×${line.baseMm || 0} mm`
        : "—";
    return {
      key: line.id,
      lineNo: line.lineNo,
      bagSpecName: dims,
      plannedQty: line.plannedQty,
      stageLabel: allDone ? "Completed" : stage ? getStageLabel(stage.stageType) : "—",
      status,
      className: getStageStatusColor(status),
    };
  });
}

/** @deprecated prefer getOrderLineProgressRows */
export function getOrderCurrentStageBadges(order) {
  return getOrderLineProgressRows(order).map((row) => ({
    key: row.key,
    label: `L${row.lineNo}: ${row.stageLabel}`,
    className: row.className,
  }));
}

export function getOrderCurrentStageLabel(order) {
  return getOrderLineProgressRows(order)
    .map((r) => `L${r.lineNo}: ${r.stageLabel}`)
    .join(" · ") || "—";
}

/** Sum waste / issued paper meters across completed stages for order header. */
export function summarizeOrderMaterials(order) {
  let wasteMeters = 0;
  let usedMeters = 0;
  let wasteBags = 0;
  let usedBags = 0;

  for (const line of order?.lines || []) {
    for (const stage of line.stages || []) {
      if (stage.status !== "COMPLETED") continue;
      const waste = Number(stage.wasteQty) || 0;
      const out = Number(stage.outputQty) || 0;
      const unit = stage.outputUnit || stage.inputUnit;

      if (stage.stageType === "RAW_MATERIAL") {
        usedMeters += out;
      }
      if (["SLITTING", "PRINTING", "PRINT_QC"].includes(stage.stageType) || unit === "METER") {
        if (stage.stageType !== "RAW_MATERIAL") wasteMeters += waste;
      }
      if (["HANDLE_MAKING_PASTING", "QUALITY_CHECK"].includes(stage.stageType) || unit === "BAG") {
        if (stage.stageType === "HANDLE_MAKING_PASTING") usedBags += out;
        if (stage.stageType === "QUALITY_CHECK") wasteBags += waste;
      }
      if (stage.stageType === "SLITTING" && stage.remainderAction === "WASTE") {
        wasteMeters += Number(stage.remainderQty) || 0;
      }
    }
  }

  return { wasteMeters, usedMeters, wasteBags, usedBags };
}

export function generateBagSpecCode({ name, bagWidthMm, bagLengthMm }) {
  const slug = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const w = bagWidthMm != null && bagWidthMm !== "" ? String(Number(bagWidthMm)) : "";
  const l = bagLengthMm != null && bagLengthMm !== "" ? String(Number(bagLengthMm)) : "";
  if (!slug || !w || !l) return slug || "";
  return `BAG-${slug}-${w}x${l}`;
}
