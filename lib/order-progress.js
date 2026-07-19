/** Helpers for production order list / progress display. */

import { getStageLabel } from "@/lib/production-constants";

/** Color classes for stage type badges (list + detail). */
export const STAGE_TYPE_COLORS = {
  RAW_MATERIAL: "bg-stone-500/15 text-stone-800 border-stone-400/40 dark:text-stone-200",
  SLITTING: "bg-orange-500/15 text-orange-800 border-orange-400/40 dark:text-orange-200",
  PRINTING: "bg-violet-500/15 text-violet-800 border-violet-400/40 dark:text-violet-200",
  PRINT_QC: "bg-fuchsia-500/15 text-fuchsia-800 border-fuchsia-400/40 dark:text-fuchsia-200",
  HANDLE_MAKING_PASTING: "bg-cyan-500/15 text-cyan-800 border-cyan-400/40 dark:text-cyan-200",
  QUALITY_CHECK: "bg-amber-500/15 text-amber-800 border-amber-400/40 dark:text-amber-200",
  PACKING: "bg-blue-500/15 text-blue-800 border-blue-400/40 dark:text-blue-200",
  DISPATCH: "bg-emerald-500/15 text-emerald-800 border-emerald-400/40 dark:text-emerald-200",
  COMPLETED: "bg-emerald-600/20 text-emerald-900 border-emerald-500/50 dark:text-emerald-100",
};

export const ORDER_STATUS_COLORS = {
  PENDING: "bg-muted text-muted-foreground border-border",
  RUNNING: "bg-blue-500/15 text-blue-800 border-blue-400/40 dark:text-blue-200",
  COMPLETED: "bg-emerald-500/15 text-emerald-800 border-emerald-400/40 dark:text-emerald-200",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * First incomplete stage on a line (by sequence), or last stage if all complete.
 */
export function getLineCurrentStage(line) {
  const stages = [...(line?.stages || [])].sort((a, b) => a.sequence - b.sequence);
  if (stages.length === 0) return null;
  return stages.find((s) => s.status !== "COMPLETED") || stages[stages.length - 1];
}

export function getStageTypeColor(stageType, { completed = false } = {}) {
  if (completed) return STAGE_TYPE_COLORS.COMPLETED;
  return STAGE_TYPE_COLORS[stageType] || "bg-muted text-muted-foreground border-border";
}

/**
 * Current stage info for badge rendering (single-line or multi-line chips).
 * @returns {{ key: string, label: string, className: string }[]}
 */
export function getOrderCurrentStageBadges(order) {
  const lines = order?.lines || [];
  if (lines.length === 0) {
    return [{ key: "none", label: "—", className: "bg-muted text-muted-foreground border-border" }];
  }

  return lines.map((line) => {
    const stages = [...(line.stages || [])].sort((a, b) => a.sequence - b.sequence);
    const allDone = stages.length > 0 && stages.every((s) => s.status === "COMPLETED");
    const stage = getLineCurrentStage(line);
    const prefix = lines.length > 1 ? `L${line.lineNo}: ` : "";
    if (allDone) {
      return {
        key: `${line.id}-done`,
        label: `${prefix}Completed`,
        className: getStageTypeColor(null, { completed: true }),
      };
    }
    return {
      key: `${line.id}-${stage?.stageType || "na"}`,
      label: `${prefix}${stage ? getStageLabel(stage.stageType) : "—"}`,
      className: getStageTypeColor(stage?.stageType),
    };
  });
}

/**
 * Human-readable current stage for an order (handles multi-line).
 */
export function getOrderCurrentStageLabel(order) {
  return getOrderCurrentStageBadges(order)
    .map((b) => b.label)
    .join(" · ");
}
