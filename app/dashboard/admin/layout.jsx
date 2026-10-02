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
  Building2,
  Ruler,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard, group: "Workspace" },

  { name: "Sales Orders", href: "/dashboard/admin/production", icon: Factory, group: "Operations" },
  { name: "Inventory", href: "/dashboard/admin/inventory", icon: Warehouse, group: "Operations" },
  { name: "Materials", href: "/dashboard/admin/materials", icon: Package, group: "Operations" },

  { name: "Customers", href: "/dashboard/admin/customers", icon: Contact, group: "Business" },
  { name: "Suppliers", href: "/dashboard/admin/suppliers", icon: Building2, group: "Business" },

  { name: "Machines", href: "/dashboard/admin/machines", icon: Cog, group: "Factory" },
  { name: "Defect Types", href: "/dashboard/admin/defect-types", icon: ShieldAlert, group: "Factory" },

  { name: "Users", href: "/dashboard/admin/users", icon: Users, group: "Administration" },
  { name: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: ClipboardList, group: "Administration" },
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
