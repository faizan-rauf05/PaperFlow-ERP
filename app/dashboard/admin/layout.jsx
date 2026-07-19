"use client";

import { DashboardShell } from "@/components/layout";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Warehouse,
  Cog,
  Factory,
  ShieldAlert,
  Contact,
  Ruler,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  {
    name: "Audit Logs",
    href: "/dashboard/admin/audit-logs",
    icon: ClipboardList,
  },
  { name: "Customers", href: "/dashboard/admin/customers", icon: Contact },
  { name: "Bag Specs", href: "/dashboard/admin/bag-specs", icon: Ruler },
  { name: "Materials", href: "/dashboard/admin/materials", icon: Package },
  { name: "Inventory", href: "/dashboard/admin/inventory", icon: Warehouse },
  { name: "Machines", href: "/dashboard/admin/machines", icon: Cog },
  { name: "Production", href: "/dashboard/admin/production", icon: Factory },
  {
    name: "Defect Types",
    href: "/dashboard/admin/defect-types",
    icon: ShieldAlert,
  },
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
