'use client'

import { DashboardShell } from '@/components/layout'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/dashboard/admin/users', icon: Users },
  { name: 'Audit Logs', href: '/dashboard/admin/audit-logs', icon: ClipboardList },
  // { name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package },
  // { name: 'Production Orders', href: '/dashboard/admin/orders', icon: ClipboardList },
  // { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
  // { name: 'AI Insights', href: '/dashboard/admin/ai-insights', icon: Sparkles },
  // { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }) {
  return (
    <DashboardShell 
      navigation={navigation} 
      userRole="admin"
      userName="Ahmed Khan"
    >
      {children}
    </DashboardShell>
  )
}
