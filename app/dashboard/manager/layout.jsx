'use client'

import { DashboardShell } from '@/components/layout'
import {
  LayoutDashboard,
  ClipboardList,
  Warehouse,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard/manager', icon: LayoutDashboard },
  { name: 'Inventory', href: '/dashboard/manager/inventory', icon: Warehouse },
]

export default function ManagerLayout({ children }) {
  return (
    <DashboardShell 
      navigation={navigation} 
      userRole="manager"
      userName="Sarah Johnson"
    >
      {children}
    </DashboardShell>
  )
}
