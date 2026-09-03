"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderRowActions } from "@/components/orders/order-row-actions";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel } from "@/lib/production-constants";
import {
  getOrderLineProgressRows,
  getStageStatusColor,
  ORDER_STATUS_COLORS,
  formatElapsed,
} from "@/lib/order-progress";
import { cn, formatDateTime } from "@/lib/utils";

export default function ManagerProductionDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!order) return <p className="text-muted-foreground">Order not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/manager"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{order.orderNo}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
            <span>{order.customer?.name}</span>
            {order.salesRepUser?.name || order.salesRep ? (
              <span>· {order.salesRepUser?.name || order.salesRep}</span>
            ) : null}
          </p>
          <div className="mt-2 space-y-1">
            {getOrderLineProgressRows(order).map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">L{row.lineNo}</span>
                <span className="font-medium">{row.bagSpecName}</span>
                <span className="text-muted-foreground">· {row.plannedQty} bags</span>
                <Badge variant="outline" className={cn("font-medium", row.className)}>
                  {row.stageLabel}
                </Badge>
              </div>
            ))}
          </div>
          {order.status === "CANCELLED" && order.cancelReason && (
            <p className="text-xs text-destructive mt-1">Cancelled: "{order.cancelReason}"</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("font-medium", ORDER_STATUS_COLORS[order.status])}>
            {order.status}
          </Badge>
          {order.isArchived && (
            <Badge variant="outline" className="font-medium bg-gray-500/10 text-gray-600 border-gray-400/40">
              Archived
            </Badge>
          )}
          <OrderRowActions order={order} onUpdated={setOrder} />
        </div>
      </div>

      {(order.lines || []).map((line) => {
        const dims =
          line.heightMm || line.widthMm || line.baseMm
            ? `${line.heightMm || 0} × ${line.widthMm || 0} × ${line.baseMm || 0} mm`
            : "—";
        return (
        <div key={line.id} className="space-y-3">
          <h2 className="text-lg font-semibold">
            Line {line.lineNo}: {dims} ({line.plannedQty} bags)
          </h2>
          <div className="grid gap-3">
            {(line.stages || []).map((stage) => (
              <Card key={stage.id} className={cn(stage.status === "IN_PROGRESS" && "border-primary/50")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">{stage.sequence}</span>
                    <CardTitle className="text-base flex-1 flex flex-wrap items-center gap-2">
                      {getStageLabel(stage.stageType)}
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          getStageStatusColor(stage.status),
                        )}
                      >
                        {stage.status}
                      </Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-xs text-muted-foreground">Input</p><p>{stage.inputQty ?? "—"} {stage.inputUnit}</p></div>
                    <div><p className="text-xs text-muted-foreground">Output</p><p>{stage.outputQty ?? "—"} {stage.outputUnit}</p></div>
                    <div><p className="text-xs text-muted-foreground">Waste</p><p>{stage.wasteQty ?? "—"}</p></div>
                  </div>
                  {(stage.worker || stage.startedAt) && (
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t">
                      {stage.worker && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" /> {stage.worker.name}
                        </span>
                      )}
                      {stage.startedAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Started {formatDateTime(stage.startedAt)}
                        </span>
                      )}
                      {stage.completedAt && (
                        <span>Completed {formatDateTime(stage.completedAt)}</span>
                      )}
                      {formatElapsed(stage.startedAt, stage.completedAt) && (
                        <span className="font-medium text-foreground">
                          Took {formatElapsed(stage.startedAt, stage.completedAt)}
                        </span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
