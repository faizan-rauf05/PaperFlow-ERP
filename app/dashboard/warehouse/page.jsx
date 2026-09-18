"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, PackageCheck, PackageX, ClipboardList, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import api, { getApiErrorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";

function StatTile({ label, value, icon: Icon, tone = "default" }) {
  const toneCls =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold ${toneCls}`}>{value}</p>
        </div>
        {Icon && <Icon className={`h-5 w-5 ${toneCls}`} />}
      </CardContent>
    </Card>
  );
}

export default function WarehouseDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [recentReceipts, setRecentReceipts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [materialsRes, lowStockRes, pendingRes, historyRes] = await Promise.all([
          api.get("/materials"),
          api.get("/inventory/low-stock"),
          api.get("/orders/materials-pending"),
          api.get("/inventory/history?limit=8"),
        ]);
        if (cancelled) return;
        setMaterials(materialsRes.data.materials || []);
        setLowStock(lowStockRes.data.items || []);
        setPendingOrders(pendingRes.data.orders || []);
        setRecentReceipts(
          (historyRes.data.transactions || []).filter((t) => t.transactionType === "STOCK_IN"),
        );
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

  const outOfStockCount = materials.filter((m) => Number(m.availableStock) <= 0).length;
  const ordersWithShortage = pendingOrders.filter((o) => o.hasShortage).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading warehouse overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Warehouse</h1>
        <p className="text-sm text-muted-foreground">Inventory, receiving, and order material fulfillment.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active Materials" value={materials.length} icon={PackageCheck} />
        <StatTile label="Low Stock" value={lowStock.length} icon={AlertTriangle} tone={lowStock.length ? "warning" : "default"} />
        <StatTile label="Out of Stock" value={outOfStockCount} icon={PackageX} tone={outOfStockCount ? "destructive" : "default"} />
        <StatTile label="Orders Awaiting Pick" value={pendingOrders.length} icon={ClipboardList} />
        <StatTile label="Orders with Shortage" value={ordersWithShortage} icon={AlertTriangle} tone={ordersWithShortage ? "destructive" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Materials required for current orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/warehouse/orders">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingOrders.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No orders currently need materials.</p>
            )}
            {pendingOrders.slice(0, 6).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {order.orderNo}{" "}
                    <span className="text-muted-foreground font-normal">— {order.customer?.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.lines.reduce((n, l) => n + l.materials.length, 0)} material(s) needed
                    {order.deliveryDate ? ` · due ${formatDateTime(order.deliveryDate)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {order.hasShortage && <Badge variant="destructive">Shortage</Badge>}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/warehouse/orders/${order.id}`}>Fulfill</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentReceipts.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent stock-in activity.</p>
            )}
            {recentReceipts.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="font-medium">{tx.material?.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                </div>
                <Badge variant="secondary">
                  +{Number(tx.quantity)} {tx.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
