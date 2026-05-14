'use client'

import { DashboardShell } from '@/components/layout'
import { 
  LayoutDashboard, 
  Receipt,
  CreditCard,
  PieChart,
  FileText
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard/finance', icon: LayoutDashboard },
  // { name: 'Invoices', href: '/dashboard/finance/invoices', icon: Receipt },
  // { name: 'Payments', href: '/dashboard/finance/payments', icon: CreditCard },
  // { name: 'Cost Reports', href: '/dashboard/finance/cost-reports', icon: PieChart },
  // { name: 'Finance Reports', href: '/dashboard/finance/reports', icon: FileText },
]

export default function FinanceLayout({ children }) {
  return (
    <DashboardShell 
      navigation={navigation} 
      userRole="finance"
      userName="Robert Brown"
    >
      {children}
    </DashboardShell>
  )
}
