"use client";

import {
  Factory,
  ShoppingCart,
  Trash2,
  AlertTriangle,
  Banknote,
  TrendingUp,
  PiggyBank,
  Users,
  Clock,
  Package,
  Settings,
  Bell,
  ChevronRight,
  Leaf,
  FileText
} from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const kpiData = [
  {
    title: "Today's Production",
    value: "24,850",
    unit: "bags",
    icon: Factory,
    gradient: "from-emerald-50/80 to-green-100/80 dark:from-emerald-950/40 dark:to-green-950/20",
    iconBg: "bg-green-600",
    valueColor: "text-green-900 dark:text-emerald-100",
    change: "+3.2%",
    changeUp: true,
  },
  {
    title: "Active Orders",
    value: "47",
    unit: "orders",
    icon: ShoppingCart,
    gradient: "from-sky-50/80 to-blue-100/80 dark:from-sky-950/40 dark:to-blue-950/20",
    iconBg: "bg-blue-500",
    valueColor: "text-blue-900 dark:text-sky-100",
    change: "+5 today",
    changeUp: true,
  },
  {
    title: "Waste % Today",
    value: "2.4",
    unit: "percent",
    icon: Trash2,
    gradient: "from-amber-50/80 to-orange-100/80 dark:from-amber-950/40 dark:to-orange-950/20",
    iconBg: "bg-amber-500",
    valueColor: "text-amber-900 dark:text-amber-100",
    change: "-0.3%",
    changeUp: true,
  },
  {
    title: "Low Stock Alerts",
    value: "3",
    unit: "items",
    icon: AlertTriangle,
    gradient: "from-red-50/80 to-rose-100/80 dark:from-red-950/40 dark:to-rose-950/20",
    iconBg: "bg-red-500",
    valueColor: "text-red-900 dark:text-red-100",
    change: "Needs action",
    changeUp: false,
    urgent: true,
  },
  {
    title: "Sales Today",
    value: "1,56,400",
    unit: "PKR",
    icon: Banknote,
    gradient: "from-emerald-50/80 to-teal-100/80 dark:from-emerald-950/40 dark:to-teal-950/20",
    iconBg: "bg-teal-600",
    valueColor: "text-teal-900 dark:text-teal-100",
    change: "+12.5%",
    changeUp: true,
  },
  {
    title: "Yield Efficiency",
    value: "94.2",
    unit: "% this week",
    icon: TrendingUp,
    gradient: "from-violet-50/80 to-purple-100/80 dark:from-violet-950/40 dark:to-purple-950/20",
    iconBg: "bg-violet-600",
    valueColor: "text-violet-900 dark:text-violet-100",
    change: "+1.8%",
    changeUp: true,
  },
  {
    title: "Profit Snapshot",
    value: "42,800",
    unit: "PKR",
    icon: PiggyBank,
    gradient: "from-green-50/80 to-emerald-100/80 dark:from-green-950/40 dark:to-emerald-950/20",
    iconBg: "bg-green-700",
    valueColor: "text-green-900 dark:text-green-100",
    change: "+8.1%",
    changeUp: true,
  },
  {
    title: "Attendance Today",
    value: "38/45",
    unit: "workers present",
    icon: Users,
    gradient: "from-blue-50/80 to-indigo-100/80 dark:from-blue-950/40 dark:to-indigo-950/20",
    iconBg: "bg-indigo-500",
    valueColor: "text-indigo-900 dark:text-indigo-100",
    change: "84.4% present",
    changeUp: true,
  },
];

const recentActivity = [
  {
    id: 1,
    user: "Ahmed Khan",
    initials: "AK",
    action: "Created new production order #PO-2024-0847",
    timestamp: "2 min ago",
    color: "bg-green-100 text-green-700",
  },
  {
    id: 2,
    user: "Fatima Ali",
    initials: "FA",
    action: "Updated inventory for Kraft Paper Roll",
    timestamp: "15 min ago",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: 3,
    user: "Hassan Malik",
    initials: "HM",
    action: "Completed quality check for Order #ORD-0392",
    timestamp: "32 min ago",
    color: "bg-violet-100 text-violet-700",
  },
  {
    id: 4,
    user: "Sara Ahmed",
    initials: "SA",
    action: "Approved supplier invoice INV-2024-156",
    timestamp: "1 hour ago",
    color: "bg-teal-100 text-teal-700",
  },
  {
    id: 5,
    user: "Usman Sheikh",
    initials: "US",
    action: "Clocked in at Line 3 — Bag Former",
    timestamp: "2 hours ago",
    color: "bg-amber-100 text-amber-700",
  },
];

const alerts = [
  {
    id: 1,
    type: "critical",
    title: "Low Stock Alert",
    message: "Kraft Paper Roll (Brown) — Only 5 units remaining",
    icon: Package,
  },
  {
    id: 2,
    type: "warning",
    title: "Yield Warning",
    message: "Line 2 efficiency dropped to 78% in the last hour",
    icon: TrendingUp,
  },
  {
    id: 3,
    type: "info",
    title: "Maintenance Due",
    message: "Bag Former #3 scheduled maintenance tomorrow",
    icon: Settings,
  },
  {
    id: 4,
    type: "warning",
    title: "Order Deadline",
    message: "Order #ORD-0385 due in 4 hours — 15% remaining",
    icon: FileText,
  },
];

const alertStyles = {
  critical: {
    wrap: "bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-900/60",
    icon: "text-red-500 dark:text-red-400",
    title: "text-red-800 dark:text-red-200",
    msg: "text-red-600 dark:text-red-300",
    dot: "bg-red-500",
  },
  warning: {
    wrap: "bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-900/60",
    icon: "text-amber-500 dark:text-amber-400",
    title: "text-amber-800 dark:text-amber-200",
    msg: "text-amber-600 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    wrap: "bg-blue-50 border border-blue-200 dark:bg-blue-950/50 dark:border-blue-900/60",
    icon: "text-blue-500 dark:text-blue-400",
    title: "text-blue-800 dark:text-blue-200",
    msg: "text-blue-600 dark:text-blue-300",
    dot: "bg-blue-400",
  },
};

function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  gradient,
  iconBg,
  valueColor,
  change,
  changeUp,
  urgent,
}) {
  return (
    <div className={cn("dashboard-panel p-5 bg-linear-to-br", gradient)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-3xl font-bold tracking-tight", valueColor)}>
                {value}
              </span>
              {urgent && parseInt(value, 10) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Action
                </Badge>
              )}
            </div>
          <p className="text-xs text-muted-foreground">{unit}</p>
          {change && (
            <p
              className={cn(
                "text-xs font-medium",
                changeUp
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className={cn("dashboard-kpi-icon text-white", iconBg)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ user, initials, action, timestamp, color }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0 group hover:bg-muted/50 -mx-1 px-1 rounded-lg transition-colors">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">{user}</span>{" "}
          <span className="text-muted-foreground">{action}</span>
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {timestamp}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
    </div>
  );
}

function AlertItem({ type, title, message, icon: Icon }) {
  const s = alertStyles[type];
  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl ${s.wrap} transition-all hover:shadow-sm`}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className={`h-4.5 w-4.5 ${s.icon}`} strokeWidth={2} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
          <p className={`text-sm font-semibold ${s.title}`}>{title}</p>
        </div>
        <p className={`text-xs mt-0.5 ${s.msg}`}>{message}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-primary rounded-lg">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-wide uppercase">
              PackFactory ERP
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Good morning, Admin
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dateString} · {timeString} · Here&apos;s your factory overview
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Two-column section: Activity + Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Feed */}
        <div className="dashboard-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0">
              {recentActivity.map((activity) => (
                <ActivityItem key={activity.id} {...activity} />
              ))}
            </div>
          </CardContent>
        </div>

        {/* Alerts Feed */}
        <div className="dashboard-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerts
              <Badge variant="secondary" className="ml-auto">
                {alerts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertItem key={alert.id} {...alert} />
              ))}
            </div>
          </CardContent>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        PackFactory ERP · Last synced just now · All times in PKT
      </p>
    </div>
  );
}
