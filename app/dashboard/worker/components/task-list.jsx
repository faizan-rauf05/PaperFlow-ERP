import { Loader2 } from "lucide-react";
import { workerStyles } from "../worker-dashboard.styles";
import { TaskCard } from "./task-card";

/** Group tasks by production order so each stage is a separate card under its order. */
function groupTasksByOrder(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const orderId = task.orderId;
    if (!groups.has(orderId)) {
      groups.set(orderId, {
        orderId,
        orderNo: task.order?.orderNo || "Unknown order",
        customer: task.order?.customer,
        tasks: [],
      });
    }
    groups.get(orderId).tasks.push(task);
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    tasks: g.tasks.sort((a, b) => a.sequence - b.sequence),
  }));
}

export function TaskList({ tasks, loading, startingTaskId, onStartTask }) {
  if (loading) {
    return (
      <div className={workerStyles.loadingBox}>
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading tasks…</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className={workerStyles.emptyText}>
        No tasks ready. Ask admin to create a production order.
      </p>
    );
  }

  const groups = groupTasksByOrder(tasks);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.orderId} className={workerStyles.orderGroup}>
          <header className={workerStyles.orderGroupHeader}>
            <div>{group.orderNo}</div>
            {group.customer && (
              <div className={workerStyles.orderGroupMeta}>{group.customer}</div>
            )}
          </header>
          <div className={workerStyles.taskList}>
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isStarting={startingTaskId === task.id}
                onStart={onStartTask}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
