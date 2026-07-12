"use client";

import { DashboardShell } from "@/components/layout";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  ScrollText,
  Warehouse,
  Cog,
  Factory,
  ShieldAlert,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  {
    name: "Audit Logs",
    href: "/dashboard/admin/audit-logs",
    icon: ClipboardList,
  },
  { name: "Materials", href: "/dashboard/admin/materials", icon: Package },
  { name: "Rolls", href: "/dashboard/admin/rolls", icon: ScrollText },
  { name: "Inventory", href: "/dashboard/admin/inventory", icon: Warehouse },
  { name: "Machines", href: "/dashboard/admin/machines", icon: Cog },
  { name: "Production", href: "/dashboard/admin/production", icon: Factory },
  {
    name: "Defect Types",
    href: "/dashboard/admin/defect-types",
    icon: ShieldAlert,
  },
  // { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
  // { name: 'AI Insights', href: '/dashboard/admin/ai-insights', icon: Sparkles },
  // { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }) {
  return (
    <DashboardShell
      navigation={navigation}
      userRole="admin"
      userName="Demo User"
    >
      {children}
    </DashboardShell>
  );
}
