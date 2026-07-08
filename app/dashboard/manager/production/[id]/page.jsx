"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel } from "@/lib/production-constants";
import { cn } from "@/lib/utils";

const STAGE_STATUS = {
  PENDING: "bg-muted text-muted-foreground",
  READY: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function ManagerProductionDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/production/orders/${id}`);
      setOrder(data.order);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUnlock(stageId) {
    setUnlocking(stageId);
    try {
      await api.post(`/production/orders/${id}/stages/${stageId}/unlock`);
      toast.success("Stage unlocked");
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUnlocking(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!order) return <p className="text-muted-foreground">Order not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/manager"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{order.orderNo}</h1>
          <p className="text-muted-foreground">{order.customer}</p>
        </div>
        <Badge className="ml-auto">{order.status}</Badge>
      </div>

      <div className="grid gap-3">
        {order.stages?.map((stage) => (
          <Card key={stage.id} className={cn(stage.status === "IN_PROGRESS" && "border-primary/50")}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">{stage.sequence}</span>
                <CardTitle className="text-base flex-1">{getStageLabel(stage.stageType)}</CardTitle>
                <Badge className={STAGE_STATUS[stage.status] || ""}>{stage.status}</Badge>
                {stage.locked && <Lock className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs text-muted-foreground">Input</p><p>{stage.inputQty ?? "—"} {stage.inputUnit}</p></div>
                <div><p className="text-xs text-muted-foreground">Output</p><p>{stage.outputQty ?? "—"} {stage.outputUnit}</p></div>
                <div><p className="text-xs text-muted-foreground">Waste</p><p>{stage.wasteQty ?? "—"}</p></div>
              </div>
              {stage.locked && (
                <Button variant="outline" size="sm" onClick={() => handleUnlock(stage.id)} disabled={unlocking === stage.id}>
                  {unlocking === stage.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlock className="h-4 w-4 mr-1" />}
                  Unlock Stage
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
