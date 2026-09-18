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
  ChevronRight,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Primary metrics: the numbers an admin needs at a glance — output, demand,
// revenue, and anything that needs action right now.
const primaryKpis = [
  {
    title: "Today's Production",
    value: '24,850',
    unit: 'bags',
    icon: Factory,
    change: '+3.2%',
    trend: 'up',
  },
  {
    title: 'Active Orders',
    value: '47',
    unit: 'orders',
    icon: ShoppingCart,
    change: '+5 today',
    trend: 'up',
  },
  {
    title: 'Sales Today',
    value: '1,56,400',
    unit: 'PKR',
    icon: Banknote,
    change: '+12.5%',
    trend: 'up',
  },
  {
    title: 'Low Stock Alerts',
    value: '3',
    unit: 'items',
    icon: AlertTriangle,
    change: 'Needs action',
    trend: 'critical',
  },
];

// Secondary metrics: supporting context, checked less often than the
// primary row — grouped into one compact strip instead of four more cards.
const secondaryKpis = [
  {
    title: 'Waste % Today',
    value: '2.4',
    unit: 'percent',
    change: '-0.3%',
    trend: 'up',
  },
  {
    title: 'Yield Efficiency',
    value: '94.2',
    unit: '% this week',
    change: '+1.8%',
    trend: 'up',
  },
  {
    title: 'Profit Snapshot',
    value: '42,800',
    unit: 'PKR',
    change: '+8.1%',
    trend: 'up',
  },
  {
    title: 'Attendance Today',
    value: '38/45',
    unit: 'workers present',
    change: '84.4% present',
    trend: 'neutral',
  },
];

const recentActivity = [
  {
    id: 1,
    user: 'Ahmed Khan',
    initials: 'AK',
    action: 'Created new production order #PO-2024-0847',
    timestamp: '2 min ago',
  },
  {
    id: 2,
    user: 'Fatima Ali',
    initials: 'FA',
    action: 'Updated inventory for Kraft Paper Roll',
    timestamp: '15 min ago',
  },
  {
    id: 3,
    user: 'Hassan Malik',
    initials: 'HM',
    action: 'Completed quality check for Order #ORD-0392',
    timestamp: '32 min ago',
  },
  {
    id: 4,
    user: 'Sara Ahmed',
    initials: 'SA',
    action: 'Approved supplier invoice INV-2024-156',
    timestamp: '1 hour ago',
  },
  {
    id: 5,
    user: 'Usman Sheikh',
    initials: 'US',
    action: 'Clocked in at Line 3 — Bag Former',
    timestamp: '2 hours ago',
  },
];

const alerts = [
  {
    id: 1,
    type: 'critical',
    title: 'Low Stock Alert',
    message: 'Kraft Paper Roll (Brown) — Only 5 units remaining',
    icon: Package,
  },
  {
    id: 2,
    type: 'warning',
    title: 'Yield Warning',
    message: 'Line 2 efficiency dropped to 78% in the last hour',
    icon: TrendingUp,
  },
  {
    id: 3,
    type: 'info',
    title: 'Maintenance Due',
    message: 'Bag Former #3 scheduled maintenance tomorrow',
    icon: Settings,
  },
  {
    id: 4,
    type: 'warning',
    title: 'Order Deadline',
    message: 'Order #ORD-0385 due in 4 hours — 15% remaining',
    icon: FileText,
  },
];

const alertMeta = {
  critical: { badge: 'destructive', label: 'Critical', border: 'border-l-destructive', icon: 'text-destructive' },
  warning: { badge: 'warning', label: 'Warning', border: 'border-l-warning', icon: 'text-warning' },
  info: { badge: 'info', label: 'Info', border: 'border-l-info', icon: 'text-info' },
};

const trendClass = {
  up: 'text-success',
  down: 'text-warning',
  critical: 'text-destructive',
  neutral: 'text-muted-foreground',
};

function PrimaryKpiCard({ title, value, unit, icon: Icon, change, trend }) {
  const isCritical = trend === 'critical';
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        isCritical && 'border-destructive/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className={cn('h-4 w-4 shrink-0', isCritical ? 'text-destructive' : 'text-muted-foreground')} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn('text-kpi-value', isCritical && 'text-destructive')}>{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <p className={cn('mt-1 text-xs font-medium', trendClass[trend])}>{change}</p>
    </div>
  );
}

function SecondaryKpiStat({ title, value, unit, change, trend }) {
  return (
    <div className="flex-1 min-w-40 px-4 py-3 first:pl-0 last:pr-0">
      <p className="text-caption">{title}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <p className={cn('text-xs font-medium', trendClass[trend])}>{change}</p>
    </div>
  );
}

function ActivityItem({ user, initials, action, timestamp }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0 group hover:bg-muted/40 -mx-1 px-1 rounded-md transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-medium">{user}</span>{' '}
          <span className="text-muted-foreground">{action}</span>
        </p>
        <p className="text-caption flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {timestamp}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
    </div>
  );
}

function AlertItem({ type, title, message, icon: Icon }) {
  const meta = alertMeta[type];
  return (
    <div className={cn('flex items-start gap-3 border-l-2 bg-muted/30 py-2.5 pl-3 pr-2', meta.border)}>
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', meta.icon)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-caption mt-0.5">{message}</p>
      </div>
      <Badge variant={meta.badge} className="shrink-0">{meta.label}</Badge>
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-page-title">Good morning, Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dateString} · {timeString} · Here&apos;s your factory overview
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-caption">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Synced just now
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {primaryKpis.map((kpi) => (
          <PrimaryKpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Secondary KPIs — one compact strip, not four more cards */}
      <div className="rounded-lg border bg-card px-4 py-1">
        <div className="flex flex-wrap divide-x divide-border">
          {secondaryKpis.map((kpi) => (
            <SecondaryKpiStat key={kpi.title} {...kpi} />
          ))}
        </div>
      </div>

      {/* Alerts + Recent Activity — alerts first: it's the actionable one */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <h2 className="text-section-heading flex-1">Alerts</h2>
            <Badge variant="secondary">{alerts.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <AlertItem key={alert.id} {...alert} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-section-heading">Recent Activity</h2>
          </div>
          <div className="px-4">
            {recentActivity.map((activity) => (
              <ActivityItem key={activity.id} {...activity} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
