"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Factory, ShoppingBag, AlertTriangle, TrendingUp, Eye, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/api/client";

const STATUS_COLORS = {
  PENDING: "bg-muted text-muted-foreground",
  RUNNING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-destructive/15 text-destructive",
};

export default function ManagerDashboard() {
  const [kpis, setKpis] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, ordersRes] = await Promise.all([
        api.get("/kpi"),
        api.get("/production/orders"),
      ]);
      setKpis(kpiRes.data.kpis);
      setOrders(ordersRes.data.orders || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpiCards = [
    {
      title: "Running Orders",
      value: kpis?.runningOrders ?? "—",
      subtitle: "Active production",
      icon: Factory,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Ready Stages",
      value: kpis?.readyStages ?? "—",
      subtitle: "Awaiting workers",
      icon: ShoppingBag,
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Low Stock Items",
      value: kpis?.lowStockCount ?? "—",
      subtitle: "Below minimum",
      icon: AlertTriangle,
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Total Orders",
      value: orders.length,
      subtitle: "All time in system",
      icon: TrendingUp,
      color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-muted-foreground">Monitor production and manage orders</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.title}</p>
                    <span className="text-2xl font-bold">{loading ? "…" : kpi.value}</span>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Production Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">View pipeline and unlock stages</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/manager/inventory">Inventory</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bag Spec</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : orders.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>
                ) : orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-medium">{o.orderNo}</TableCell>
                    <TableCell>{o.customer}</TableCell>
                    <TableCell>{o.bagSpec?.name || "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[o.status] || ""}>{o.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/manager/production/${o.id}`}><Eye className="h-4 w-4 mr-1" />View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
