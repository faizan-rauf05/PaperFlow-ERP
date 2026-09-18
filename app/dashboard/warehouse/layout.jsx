'use client'

import { DashboardShell } from '@/components/layout'
import {
  LayoutDashboard,
  Warehouse,
  Package,
  ClipboardList,
  Truck,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard/warehouse', icon: LayoutDashboard, group: 'Workspace' },
  { name: 'Inventory', href: '/dashboard/warehouse/inventory', icon: Warehouse, group: 'Operations' },
  { name: 'Materials', href: '/dashboard/warehouse/materials', icon: Package, group: 'Operations' },
  { name: 'Orders', href: '/dashboard/warehouse/orders', icon: ClipboardList, group: 'Fulfillment' },
  { name: 'Suppliers', href: '/dashboard/warehouse/suppliers', icon: Truck, group: 'Business' },
]

export default function WarehouseLayout({ children }) {
  return (
    <DashboardShell
      navigation={navigation}
      userRole="warehouse"
      userName="Warehouse User"
    >
      {children}
    </DashboardShell>
  )
}
