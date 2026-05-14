"use client";

import { useState } from "react";
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
  FileText,
  Bell,
  ChevronRight,
  Leaf,
} from "lucide-react";

const kpiData = [
  {
    title: "Today's Production",
    value: "24,850",
    unit: "bags",
    icon: Factory,
    gradient: "from-emerald-50 to-green-100",
    iconBg: "bg-green-600",
    valueColor: "text-green-900",
    change: "+3.2%",
    changeUp: true,
  },
  {
    title: "Active Orders",
    value: "47",
    unit: "orders",
    icon: ShoppingCart,
    gradient: "from-sky-50 to-blue-100",
    iconBg: "bg-blue-500",
    valueColor: "text-blue-900",
    change: "+5 today",
    changeUp: true,
  },
  {
    title: "Waste % Today",
    value: "2.4",
    unit: "percent",
    icon: Trash2,
    gradient: "from-amber-50 to-orange-100",
    iconBg: "bg-amber-500",
    valueColor: "text-amber-900",
    change: "-0.3%",
    changeUp: true,
  },
  {
    title: "Low Stock Alerts",
    value: "3",
    unit: "items",
    icon: AlertTriangle,
    gradient: "from-red-50 to-rose-100",
    iconBg: "bg-red-500",
    valueColor: "text-red-900",
    change: "Needs action",
    changeUp: false,
    urgent: true,
  },
  {
    title: "Sales Today",
    value: "1,56,400",
    unit: "PKR",
    icon: Banknote,
    gradient: "from-emerald-50 to-teal-100",
    iconBg: "bg-teal-600",
    valueColor: "text-teal-900",
    change: "+12.5%",
    changeUp: true,
  },
  {
    title: "Yield Efficiency",
    value: "94.2",
    unit: "% this week",
    icon: TrendingUp,
    gradient: "from-violet-50 to-purple-100",
    iconBg: "bg-violet-600",
    valueColor: "text-violet-900",
    change: "+1.8%",
    changeUp: true,
  },
  {
    title: "Profit Snapshot",
    value: "42,800",
    unit: "PKR",
    icon: PiggyBank,
    gradient: "from-green-50 to-emerald-100",
    iconBg: "bg-green-700",
    valueColor: "text-green-900",
    change: "+8.1%",
    changeUp: true,
  },
  {
    title: "Attendance Today",
    value: "38/45",
    unit: "workers present",
    icon: Users,
    gradient: "from-blue-50 to-indigo-100",
    iconBg: "bg-indigo-500",
    valueColor: "text-indigo-900",
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
    wrap: "bg-red-50 border border-red-200",
    icon: "text-red-500",
    title: "text-red-800",
    msg: "text-red-600",
    dot: "bg-red-500",
  },
  warning: {
    wrap: "bg-amber-50 border border-amber-200",
    icon: "text-amber-500",
    title: "text-amber-800",
    msg: "text-amber-600",
    dot: "bg-amber-500",
  },
  info: {
    wrap: "bg-blue-50 border border-blue-200",
    icon: "text-blue-500",
    title: "text-blue-800",
    msg: "text-blue-600",
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
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-5 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
    >
      {/* Subtle decorative circle */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/30 pointer-events-none" />
      <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/20 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${iconBg} shadow-sm`}>
          <Icon className="h-5 w-5 text-white" strokeWidth={1.8} />
        </div>
        {urgent && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            Alert
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">
          {title}
        </p>
        <p
          className={`mt-1 text-3xl font-bold ${valueColor} leading-none tracking-tight`}
        >
          {value}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">{unit}</p>
          <span
            className={`text-xs font-semibold ${changeUp ? "text-emerald-600" : "text-red-500"}`}
          >
            {change}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ user, initials, action, timestamp, color }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 -mx-1 px-1 rounded-lg transition-colors">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          <span className="font-semibold">{user}</span>{" "}
          <span className="text-gray-500">{action}</span>
        </p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {timestamp}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/20 p-6 font-sans">
      {/* Top Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-green-600 rounded-lg">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-green-700 tracking-wide uppercase">
              PackFactory ERP
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Good morning, Admin
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {dateString} · {timeString} · Here's your factory overview
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Summary Banner */}
      <div className="mb-8 bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-green-200">
        <div>
          <p className="text-green-100 text-sm font-medium">
            Daily Production Target
          </p>
          <p className="text-white text-2xl font-bold mt-0.5">82% Complete</p>
        </div>
        <div className="flex-1 min-w-48">
          <div className="flex justify-between text-xs text-green-100 mb-1.5">
            <span>24,850 bags done</span>
            <span>30,000 target</span>
          </div>
          <div className="w-full bg-white/25 rounded-full h-2.5">
            <div
              className="bg-white rounded-full h-2.5 transition-all"
              style={{ width: "82%" }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-green-100 text-xs">Est. completion</p>
          <p className="text-white font-semibold text-sm mt-0.5">
            6:40 PM today
          </p>
        </div>
      </div>

      {/* Two-column: Activity + Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-50 rounded-lg">
                <Clock className="h-4 w-4 text-green-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <button className="text-xs text-green-600 font-medium hover:text-green-700 flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="px-4 py-2">
            {recentActivity.map((a) => (
              <ActivityItem key={a.id} {...a} />
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <h2 className="font-semibold text-gray-900">Alerts</h2>
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                4
              </span>
            </div>
            <button className="text-xs text-green-600 font-medium hover:text-green-700 flex items-center gap-1">
              Dismiss all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {alerts.map((alert) => (
              <AlertItem key={alert.id} {...alert} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-8">
        PackFactory ERP · Last synced just now · All times in PKT
      </p>
    </div>
  );
}
