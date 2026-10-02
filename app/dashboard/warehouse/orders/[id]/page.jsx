"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Factory, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import { UNIT_LABELS, formatQuantity } from "@/lib/material-catalog";
import { ORDER_MATERIAL_ROLE_LABELS } from "@/lib/material-constants";
import { ProofPhotosInput } from "@/components/inventory/proof-photos-input";
import { bagWeightLabel, formatWeight } from "@/lib/paper-sizing";

const roleLabel = (role) => ORDER_MATERIAL_ROLE_LABELS[role] || role;

function MaterialTitle({ item }) {
  return (
    <>
      <p className="font-medium text-sm">
        {item.material?.name} <span className="text-xs text-muted-foreground">({roleLabel(item.role)})</span>
      </p>
      {item.bagWeight && (
        <p className="text-xs text-muted-foreground">
          ≈ {formatWeight(item.paperWeightKg, "kg")} of paper for this order · Bag weight {bagWeightLabel(item.bagWeight)}
        </p>
      )}
    </>
  );
}

/** A material the approver sourced from stock already in the factory — nothing to pick. */
function FactoryRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2">
      <div>
        <MaterialTitle item={item} />
        <p className="text-xs text-muted-foreground">
          Need {formatQuantity(item.suggestedQty, item.unit)} · In factory {formatQuantity(item.factoryStock, item.unit)}
        </p>
      </div>
      <Badge variant="outline" className="gap-1 shrink-0 border-sky-500/40 text-sky-700 dark:text-sky-300">
        <Factory className="h-3 w-3" /> Available in factory
      </Badge>
    </div>
  );
}

function PickedRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
      <div>
        <MaterialTitle item={item} />
        <p className="text-xs text-muted-foreground">
          {formatQuantity(item.pickedQty, item.unit)} picked → factory
          {item.pickedAt ? ` on ${formatDateTime(item.pickedAt)}` : ""}
        </p>
      </div>
      <Badge className="bg-emerald-600/90 text-white gap-1 shrink-0">
        <CheckCircle2 className="h-3 w-3" /> Picked
      </Badge>
    </div>
  );
}

/** A warehouse material still to pick: quantity (not for rolls — they move whole) and its own proof. */
function PickRow({ item, draft, onDraft, sharedProof, disabled }) {
  const hasOwnProof = draft.proofUrls.length > 0;
  return (
    <div className="rounded-md border px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <MaterialTitle item={item} />
          <p className="text-xs text-muted-foreground">
            Need {formatQuantity(item.remainingQty, item.unit)} · In warehouse{" "}
            {formatQuantity(item.warehouseStock, item.unit)}
          </p>
          {item.isRoll && (
            <p className="text-xs text-muted-foreground">
              The whole roll moves to the factory ({formatQuantity(item.warehouseStock, item.unit)}).
            </p>
          )}
        </div>
        {item.hasShortage && (
          <Badge variant="destructive" className="gap-1 shrink-0">
            <AlertTriangle className="h-3 w-3" /> Shortage
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {!item.isRoll && (
          <div className="sm:w-40">
            <label className="text-xs font-medium text-muted-foreground">
              Quantity ({UNIT_LABELS[item.unit] || item.unit})
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              className="mt-1"
              value={draft.qty}
              disabled={disabled}
              onChange={(e) => onDraft({ ...draft, qty: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Proof photo
            {!hasOwnProof && sharedProof && <span className="font-normal"> — using the photo for all items</span>}
          </label>
          <div className="mt-1">
            <ProofPhotosInput
              value={draft.proofUrls}
              onChange={(proofUrls) => onDraft({ ...draft, proofUrls })}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WarehouseOrderPickingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [drafts, setDrafts] = useState({}); // item id -> { qty, proofUrls }
  const [sharedProofUrls, setSharedProofUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders/materials-pending");
      const match = (data.orders || []).find((o) => o.id === id);
      if (!match) {
        setError("This order is not (or no longer) awaiting material fulfillment.");
        setOrder(null);
        return;
      }
      setOrder(match);
      setDrafts((prev) => {
        const next = {};
        for (const item of match.lines.flatMap((l) => l.materials)) {
          if (item.source === "WAREHOUSE" && !item.isPicked) {
            next[item.id] = prev[item.id] || { qty: String(item.remainingQty), proofUrls: [] };
          }
        }
        return next;
      });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toPick = order ? order.lines.flatMap((l) => l.materials).filter((m) => m.source === "WAREHOUSE" && !m.isPicked) : [];
  const proofFor = (item) => (drafts[item.id]?.proofUrls.length ? drafts[item.id].proofUrls : sharedProofUrls);
  const isReady = (item) => proofFor(item).length > 0 && (item.isRoll || Number(drafts[item.id]?.qty) > 0);
  const ready = toPick.filter(isReady);

  async function confirmAll() {
    if (ready.length === 0) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/pick-materials`, {
        picks: ready.map((item) => ({
          orderLineMaterialId: item.id,
          pickedQty: item.isRoll ? undefined : Number(drafts[item.id].qty),
          proofUrls: proofFor(item),
        })),
      });
      if (data.results?.some((r) => r.released)) {
        toast.success(`All materials picked — ${order.orderNo} is now with the workers`);
        router.push("/dashboard/warehouse/orders");
        return;
      }
      toast.success(`${ready.length} item(s) moved to the factory`);
      setSharedProofUrls([]);
      load();
    } catch (e) {
      const done = e.response?.data?.results?.length || 0;
      toast.error(getApiErrorMessage(e), {
        description: done ? `${done} item(s) before it were moved successfully.` : undefined,
      });
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading order...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/warehouse/orders">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to orders
        </Link>
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {order && (
        <>
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              {order.orderNo}
              {order.hasShortage && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Shortage
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.customer?.name}
              {order.deliveryDate ? ` · due ${formatDateTime(order.deliveryDate)}` : ""}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Move the warehouse items to the factory, add a proof photo, then confirm them together. Production starts
              automatically once everything is picked.
            </p>
          </div>

          {toPick.length > 1 && (
            <Card>
              <CardContent className="py-4 space-y-1">
                <p className="text-sm font-medium">One photo for all items</p>
                <p className="text-xs text-muted-foreground">
                  If one photo shows everything moved, add it here — it&apos;s used for every item without its own photo.
                </p>
                <div className="pt-1">
                  <ProofPhotosInput value={sharedProofUrls} onChange={setSharedProofUrls} disabled={submitting} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {order.lines.map((line) => (
              <Card key={line.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Line #{line.lineNo}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      {[line.paperType, line.paperColor, line.withHandle ? "with handle" : null]
                        .filter(Boolean)
                        .join(" · ")}
                      {line.plannedQty ? ` · qty ${line.plannedQty}` : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {line.materials.map((item) =>
                    item.source === "FACTORY" ? (
                      <FactoryRow key={item.id} item={item} />
                    ) : item.isPicked ? (
                      <PickedRow key={item.id} item={item} />
                    ) : (
                      <PickRow
                        key={item.id}
                        item={item}
                        draft={drafts[item.id] || { qty: "", proofUrls: [] }}
                        onDraft={(d) => setDrafts((prev) => ({ ...prev, [item.id]: d }))}
                        sharedProof={sharedProofUrls.length > 0}
                        disabled={submitting}
                      />
                    ),
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {toPick.length > 0 && (
            <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {ready.length} of {toPick.length} item(s) ready
                  {ready.length < toPick.length && " — each needs a proof photo (and a quantity)"}
                </p>
                <Button onClick={confirmAll} disabled={submitting || ready.length === 0}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                  {ready.length === toPick.length ? "Confirm all & move to factory" : `Confirm ${ready.length} item(s)`}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
