"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import { UNIT_LABELS, formatQuantity } from "@/lib/material-catalog";
import { ProofPhotosInput } from "@/components/inventory/proof-photos-input";

function OpenTaskCard({ task, onDone }) {
  const [qty, setQty] = useState(String(Number(task.shortfallQty)));
  const [proofUrls, setProofUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const unit = task.material.unit;
  const glue = task.glueLevel;

  async function complete() {
    if (!task.isRoll && !(Number(qty) > 0)) {
      toast.error("Enter the quantity moved to the factory");
      return;
    }
    if (proofUrls.length === 0) {
      toast.error("Upload a photo as proof of the transfer");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/inventory/transfer-tasks/${task.id}/complete`, {
        quantity: task.isRoll ? undefined : Number(qty),
        proofUrls,
      });
      toast.success(`${task.material.name} moved to the factory`);
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          {task.material.name}
          {task.material.barCode && (
            <span className="text-xs font-normal text-muted-foreground">Barcode {task.material.barCode}</span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {glue
            ? `${glue.label} in the factory: ${glue.drums} drum(s), minimum ${glue.minDrums} — supply ${formatQuantity(task.shortfallQty, unit)}${
                glue.drumKg ? ` (${Math.round(Number(task.shortfallQty) / glue.drumKg)} drum(s) of ${glue.drumKg} kg)` : ""
              }`
            : `Factory is ${formatQuantity(task.shortfallQty, unit)} below zero`}
          {task.order ? ` · used by order ${task.order.orderNo}` : ""} · raised {formatDateTime(task.createdAt)}
        </p>
        <p className="text-xs text-muted-foreground">
          Now: factory {formatQuantity(task.stock.FACTORY, unit)} · warehouse {formatQuantity(task.stock.WAREHOUSE, unit)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.isRoll ? (
          <p className="text-sm">
            The whole roll moves to the factory ({formatQuantity(task.stock.WAREHOUSE, unit)}).
          </p>
        ) : (
          <div className="max-w-50">
            <label className="text-xs font-medium text-muted-foreground">
              Quantity moved ({UNIT_LABELS[unit] || unit})
            </label>
            <Input type="number" min="0" step="any" className="mt-1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Proof of transfer *</label>
            <div className="mt-1">
              <ProofPhotosInput value={proofUrls} onChange={setProofUrls} disabled={submitting} />
            </div>
          </div>
          <Button onClick={complete} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
            Confirm transfer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedTaskRow({ task }) {
  const proofs = Array.isArray(task.proofUrls) ? task.proofUrls : [];
  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium truncate">{task.material.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatQuantity(task.transferredQty, task.material.unit)} moved
          {task.completedBy ? ` by ${task.completedBy.name}` : ""} · {formatDateTime(task.completedAt)}
          {task.order ? ` · order ${task.order.orderNo}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {proofs.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
            Proof {i + 1}
          </a>
        ))}
        <Badge className="bg-emerald-600/90 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" /> Done
        </Badge>
      </div>
    </div>
  );
}

export default function WarehouseTransfersPage() {
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/inventory/transfer-tasks?status=${status}`);
      setTasks(data.tasks || []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Factory Transfers</h1>
        <p className="text-sm text-muted-foreground">
          Stock the factory needs: glue below its drum minimum, or anything production used beyond what the factory had on
          record. Move it from the warehouse and upload a photo as proof.
        </p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="OPEN">To do</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading transfers...
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {status === "OPEN" ? "Nothing to move — the factory isn't short of anything." : "No completed transfers yet."}
          </CardContent>
        </Card>
      ) : status === "OPEN" ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <OpenTaskCard key={task.id} task={task} onDone={load} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <CompletedTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
