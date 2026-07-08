import { statusBadgeStyles, STATUS_LABELS } from "../worker-dashboard.styles";

/** Returns visual status for a worker task card. */
export function getTaskDisplayStatus(task) {
  if (task.status === "IN_PROGRESS" && task.locked === false && task.outputQty != null) {
    return "UNLOCKED";
  }
  return task.status;
}

export function StatusBadge({ task }) {
  const key = getTaskDisplayStatus(task);
  const className = statusBadgeStyles[key] || statusBadgeStyles.READY;
  const label = STATUS_LABELS[key] || task.status;

  return <span className={className}>{label}</span>;
}
