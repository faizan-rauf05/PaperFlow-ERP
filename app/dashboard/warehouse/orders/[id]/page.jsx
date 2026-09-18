"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, ScanLine, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";

function MaterialPickRow({ orderId, item, onPicked }) {
  const [scanValue, setScanValue] = useState("");
  const [scanState, setScanState] = useState(null); // null | "match" | "mismatch"
  const [qty, setQty] = useState(item.isPicked ? "" : String(item.remainingQty));
  const [submitting, setSubmitting] = useState(false);

  function handleScanKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const expected = (item.material?.barCode || "").trim();
    if (!expected) {
      toast.error("This material has no barcode on file — skipping barcode validation");
      setScanState("match");
      return;
    }
    if (scanValue.trim() === expected) {
      setScanState("match");
    } else {
      setScanState("mismatch");
    }
  }

  async function confirmPick() {
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (item.material?.barCode && scanState !== "match") {
      toast.error("Scan the correct barcode before confirming");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/pick-materials`, {
        orderLineMaterialId: item.id,
        pickedQty: qtyNum,
        scannedBarcode: scanValue.trim() || undefined,
      });
      toast.success(`Picked ${qtyNum} ${item.unit} of ${item.material?.name}`);
      onPicked(data.order);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (item.isPicked) {
    return (
      <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
        <div>
          <p className="font-medium">{item.material?.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.role} · {item.pickedQty} {item.unit} picked {item.pickedAt ? `on ${formatDateTime(item.pickedAt)}` : ""}
          </p>
        </div>
        <Badge className="bg-emerald-600/90 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" /> Picked
        </Badge>
      </div>
    );
  }

  return (
    <div className="rounded-md border px-3 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">
            {item.material?.name}{" "}
            <span className="text-xs text-muted-foreground">({item.role})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Need {item.remainingQty} {item.unit} · Available {item.availableStock} {item.unit}
          </p>
        </div>
        {item.hasShortage && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Shortage
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Scan barcode</label>
          <div className="relative mt-1">
            <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className={`pl-8 ${
                scanState === "match"
                  ? "border-emerald-500 focus-visible:ring-emerald-500"
                  : scanState === "mismatch"
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
              }`}
              value={scanValue}
              onChange={(e) => {
                setScanValue(e.target.value);
                setScanState(null);
              }}
              onKeyDown={handleScanKeyDown}
              placeholder={item.material?.barCode ? "Scan and press Enter" : "No barcode on file"}
            />
            {scanState === "match" && (
              <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-600" />
            )}
            {scanState === "mismatch" && (
              <XCircle className="absolute right-2.5 top-2.5 h-4 w-4 text-destructive" />
            )}
          </div>
          {scanState === "mismatch" && (
            <p className="text-xs text-destructive mt-1">Barcode does not match this material.</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Quantity ({item.unit})</label>
          <Input
            type="number"
            min="0"
            step="any"
            className="mt-1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <Button onClick={confirmPick} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Confirm
        </Button>
      </div>
    </div>
  );
}

export default function WarehouseOrderPickingPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders/materials-pending");
      const match = (data.orders || []).find((o) => o.id === id);
      if (!match) {
        setError("This order is not (or no longer) awaiting material fulfillment.");
        setOrder(null);
      } else {
        setOrder(match);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading order...
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          </div>

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
                  {line.materials.map((item) => (
                    <MaterialPickRow
                      key={item.id}
                      orderId={order.id}
                      item={item}
                      onPicked={() => load()}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
