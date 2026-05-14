'use client'

import { DashboardShell } from '@/components/layout'
import { 
  LayoutDashboard, 
  ClipboardList,
  Cog,
  Trash2,
  FileCheck,
  Users
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard/manager', icon: LayoutDashboard },
  // { name: 'Production Orders', href: '/dashboard/manager/production', icon: ClipboardList },
  // { name: 'Machines', href: '/dashboard/manager/machines', icon: Cog },
  // { name: 'Waste Reports', href: '/dashboard/manager/waste', icon: Trash2 },
  // { name: 'QC Reports', href: '/dashboard/manager/quality', icon: FileCheck },
  // { name: 'Attendance', href: '/dashboard/manager/attendance', icon: Users },
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
