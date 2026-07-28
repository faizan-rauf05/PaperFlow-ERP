import { Play, Loader2, AlertCircle } from "lucide-react";
import { getStageLabel } from "@/lib/production-constants";
import { workerStyles } from "../worker-dashboard.styles";
import { StatusBadge, getTaskDisplayStatus } from "./status-badge";

export function TaskCard({ task, isStarting, onStart }) {
  const isUnlocked = getTaskDisplayStatus(task) === "UNLOCKED";
  const isInProgress = task.status === "IN_PROGRESS";

  return (
    <article
      className={`${workerStyles.taskCard} ${isUnlocked ? workerStyles.taskCardUnlocked : ""}`}
    >
      <div className={workerStyles.taskCardHeader}>
        <div className={workerStyles.taskCardBody}>
          <span className={workerStyles.stepBadge}>
            Step {task.sequence} of 10
          </span>
          <h3 className={workerStyles.taskName}>{getStageLabel(task.stageType)}</h3>
          <p className={workerStyles.taskOrder}>
            {task.orderLine
              ? `${task.orderLine.heightMm || 0}×${task.orderLine.widthMm || 0}×${task.orderLine.baseMm || 0} mm`
              : task.order?.orderNo || ""}
          </p>
        </div>
        <StatusBadge task={task} />
      </div>

      {isUnlocked && (
        <div className={`${workerStyles.unlockBanner} mb-3`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Manager unlocked this stage</p>
              <p className="mt-0.5 text-xs opacity-90">
                Tap Continue, correct the values, then submit again.
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={workerStyles.startBtn}
        disabled={isStarting}
        onClick={() => onStart(task)}
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening…
          </>
        ) : (
          <>
            <Play className="h-4 w-4 fill-current" />
            {isUnlocked ? "Continue correction" : isInProgress ? "Continue" : "Start stage"}
          </>
        )}
      </button>
    </article>
  );
}
