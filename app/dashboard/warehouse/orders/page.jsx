"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";

const PRIORITY_CLS = {
  LOW: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-400/40",
  NORMAL: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-400/40",
  HIGH: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40",
  URGENT: "bg-destructive/15 text-destructive border-destructive/40",
};

export default function WarehouseOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/orders/materials-pending");
        if (!cancelled) setOrders(data.orders || []);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Orders — Material Fulfillment</h1>
        <p className="text-sm text-muted-foreground">Orders that need materials picked before production can proceed.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No orders currently need materials.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const totalMaterials = order.lines.reduce((n, l) => n + l.materials.length, 0);
            const pickedMaterials = order.lines.reduce(
              (n, l) => n + l.materials.filter((m) => m.isPicked).length,
              0,
            );
            return (
              <Card key={order.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {order.orderNo}
                      <Badge variant="outline" className={PRIORITY_CLS[order.priority] || ""}>
                        {order.priority}
                      </Badge>
                      {order.hasShortage ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Shortage
                        </Badge>
                      ) : order.isFullyPicked ? (
                        <Badge className="gap-1 bg-emerald-600/90 text-white">
                          <CheckCircle2 className="h-3 w-3" /> Fully Picked
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {order.customer?.name}
                      {order.deliveryDate ? ` · due ${formatDateTime(order.deliveryDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {pickedMaterials}/{totalMaterials} materials picked
                    </span>
                    <Button asChild size="sm">
                      <Link href={`/dashboard/warehouse/orders/${order.id}`}>Fulfill</Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
