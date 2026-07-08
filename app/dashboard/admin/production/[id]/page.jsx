"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { getStageLabel } from "@/lib/production-constants";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STAGE_STATUS = {
  PENDING: "bg-muted text-muted-foreground",
  READY: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const KIND_LABELS = {
  GLUE_SIDE: "Side glue",
  GLUE_BOTTOM: "Bottom glue",
  HANDLE_ROPE: "Handle rope",
};

export default function ProductionOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [handleStock, setHandleStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, stockRes] = await Promise.all([
        api.get(`/production/orders/${id}`),
        api.get("/inventory/handle-stock").catch(() => ({ data: { summary: null } })),
      ]);
      setOrder(orderRes.data.order);
      setHandleStock(stockRes.data.summary);
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

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!order) {
    return <p className="text-muted-foreground">Order not found</p>;
  }

  const allConsumptions = order.stages?.flatMap((s) =>
    (s.consumptions || []).map((c) => ({ ...c, stageType: s.stageType, sequence: s.sequence })),
  ) || [];

  const allQcRecords = order.stages?.flatMap((s) =>
    (s.qcRecords || []).map((q) => ({ ...q, stageType: s.stageType, sequence: s.sequence })),
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/production"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{order.orderNo}</h1>
          <p className="text-muted-foreground">{order.customer} · {order.bagSpec?.name}</p>
        </div>
        <Badge className="ml-auto">{order.status}</Badge>
      </div>

      {handleStock && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Handle stock summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Produced</p><p className="font-semibold">{handleStock.produced} PCS</p></div>
            <div><p className="text-muted-foreground text-xs">Consumed</p><p className="font-semibold">{handleStock.consumed} PCS</p></div>
            <div><p className="text-muted-foreground text-xs">Defective</p><p className="font-semibold">{handleStock.defective} PCS</p></div>
            <div><p className="text-muted-foreground text-xs">Remaining (ledger)</p><p className="font-semibold">{handleStock.remaining} PCS</p></div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="consumption">Consumption ({allConsumptions.length})</TabsTrigger>
          <TabsTrigger value="qc">QC ({allQcRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="grid gap-3 mt-4">
          {order.stages?.map((stage, idx) => (
            <Card key={stage.id} className={cn(stage.status === "IN_PROGRESS" && "border-primary/50")}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">{stage.sequence}</span>
                  <div className="flex-1">
                    <CardTitle className="text-base">{getStageLabel(stage.stageType)}</CardTitle>
                  </div>
                  <Badge className={STAGE_STATUS[stage.status] || ""}>{stage.status}</Badge>
                  {stage.locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-muted-foreground text-xs">Input</p><p className="font-medium">{stage.inputQty ?? "—"} {stage.inputUnit}</p></div>
                  <div><p className="text-muted-foreground text-xs">Output</p><p className="font-medium">{stage.outputQty ?? "—"} {stage.outputUnit}</p></div>
                  <div><p className="text-muted-foreground text-xs">Waste</p><p className="font-medium">{stage.wasteQty ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Yield</p><p className="font-medium">{stage.yieldRecord?.yieldPercent ? `${Number(stage.yieldRecord.yieldPercent).toFixed(1)}%` : "—"}</p></div>
                </div>
                <div className="flex flex-wrap gap-4 text-muted-foreground">
                  {stage.worker && <span>Worker: {stage.worker.name}</span>}
                  {stage.machine && <span>Machine: {stage.machine.name}</span>}
                  {stage.roll && <span>Roll: {stage.roll.rollNo}</span>}
                </div>
                {stage.locked && (
                  <Button variant="outline" size="sm" onClick={() => handleUnlock(stage.id)} disabled={unlocking === stage.id}>
                    {unlocking === stage.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlock className="h-4 w-4 mr-1" />}
                    Unlock Stage
                  </Button>
                )}
                {idx < order.stages.length - 1 && <div className="flex justify-center pt-1"><div className="h-4 w-px bg-border" /></div>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="consumption" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allConsumptions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No consumption recorded yet</TableCell></TableRow>
                  ) : allConsumptions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{getStageLabel(c.stageType)}</TableCell>
                      <TableCell>{KIND_LABELS[c.consumptionKind] || c.material?.name}</TableCell>
                      <TableCell className="text-right">{c.plannedQty} {c.unit}</TableCell>
                      <TableCell className="text-right">{c.actualQty} {c.unit}</TableCell>
                      <TableCell className={cn("text-right", Number(c.variance) > 0 && "text-amber-600")}>{c.variance} {c.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qc" className="mt-4">
          <div className="grid gap-4">
            {allQcRecords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No QC records yet</p>
            ) : allQcRecords.map((q) => (
              <Card key={q.id}>
                <CardContent className="pt-4 flex flex-col sm:flex-row gap-4">
                  {q.photoUrl && (
                    <img src={q.photoUrl} alt="QC defect" className="h-24 w-24 rounded-lg object-cover border" />
                  )}
                  <div className="flex-1 text-sm space-y-1">
                    <p className="font-medium">{getStageLabel(q.stageType)} — {formatDateTime(q.createdAt)}</p>
                    <p>Passed: {q.passedQty} · Rejected: {q.rejectedQty}</p>
                    {q.defectType && (
                      <p>Defect: {q.defectType.description}
                        {q.defectType.category && <span className="text-muted-foreground"> ({q.defectType.category.name})</span>}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
                      {q.createdBy && <span>Worker: {q.createdBy.name}</span>}
                      {q.machine && <span>Machine: {q.machine.name}</span>}
                      {q.roll && <span>Roll: {q.roll.rollNo}</span>}
                    </div>
                    {q.remarks && <p className="text-muted-foreground">{q.remarks}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
