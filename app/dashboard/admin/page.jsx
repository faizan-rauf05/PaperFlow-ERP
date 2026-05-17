'use client'

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
  User,
  Package,
  Settings,
  FileText
} from 'lucide-react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// KPI data
const kpiData = [
  { 
    title: "Today's Production", 
    value: '24,850', 
    unit: 'bags',
    icon: Factory, 
    color: 'text-primary'
  },
  { 
    title: 'Active Orders', 
    value: '47', 
    unit: 'orders',
    icon: ShoppingCart, 
    color: 'text-blue-600'
  },
  { 
    title: 'Waste % Today', 
    value: '2.4', 
    unit: '%',
    icon: Trash2, 
    color: 'text-amber-600'
  },
  { 
    title: 'Low Stock Alerts', 
    value: '3', 
    unit: 'items',
    icon: AlertTriangle, 
    color: 'text-red-600',
    showBadge: true
  },
  { 
    title: 'Sales Today', 
    value: '156,400', 
    unit: 'PKR',
    icon: Banknote, 
    color: 'text-emerald-600'
  },
  { 
    title: 'Yield Efficiency', 
    value: '94.2', 
    unit: '% this week',
    icon: TrendingUp, 
    color: 'text-violet-600'
  },
  { 
    title: 'Profit Snapshot', 
    value: '42,800', 
    unit: 'PKR',
    icon: PiggyBank, 
    color: 'text-primary'
  },
  { 
    title: 'Attendance Today', 
    value: '38/45', 
    unit: 'workers present',
    icon: Users, 
    color: 'text-blue-600'
  },
]

// Recent activity data
const recentActivity = [
  { 
    id: 1, 
    user: 'Ahmed Khan', 
    action: 'Created new production order #PO-2024-0847', 
    timestamp: '2 min ago' 
  },
  { 
    id: 2, 
    user: 'Fatima Ali', 
    action: 'Updated inventory for Kraft Paper Roll', 
    timestamp: '15 min ago' 
  },
  { 
    id: 3, 
    user: 'Hassan Malik', 
    action: 'Completed quality check for Order #ORD-0392', 
    timestamp: '32 min ago' 
  },
  { 
    id: 4, 
    user: 'Sara Ahmed', 
    action: 'Approved supplier invoice INV-2024-156', 
    timestamp: '1 hour ago' 
  },
  { 
    id: 5, 
    user: 'Usman Sheikh', 
    action: 'Clocked in at Line 3 - Bag Former', 
    timestamp: '2 hours ago' 
  },
]

// Alerts data
const alerts = [
  { 
    id: 1, 
    type: 'critical', 
    title: 'Low Stock Alert',
    message: 'Kraft Paper Roll (Brown) - Only 5 units remaining', 
    icon: Package
  },
  { 
    id: 2, 
    type: 'warning', 
    title: 'Yield Warning',
    message: 'Line 2 efficiency dropped to 78% in last hour', 
    icon: TrendingUp
  },
  { 
    id: 3, 
    type: 'info', 
    title: 'Maintenance Due',
    message: 'Bag Former #3 scheduled maintenance tomorrow', 
    icon: Settings
  },
  { 
    id: 4, 
    type: 'warning', 
    title: 'Order Deadline',
    message: 'Order #ORD-0385 due in 4 hours - 15% remaining', 
    icon: FileText
  },
]

function KPICard({ title, value, unit, icon: Icon, color, showBadge }) {
  return (
    <div className="dashboard-panel p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">{value}</span>
              {showBadge && parseInt(value) > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {value}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{unit}</p>
          </div>
          <div className={cn('dashboard-kpi-icon', color)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
    </div>
  )
}

function ActivityItem({ user, action, timestamp }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {user.split(' ').map(n => n[0]).join('')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{user}</span>
          {' '}{action}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {timestamp}
        </p>
      </div>
    </div>
  )
}

function AlertItem({ type, title, message, icon: Icon }) {
  const typeStyles = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconStyles = {
    critical: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${typeStyles[type]}`}>
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconStyles[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs mt-0.5 opacity-80">{message}</p>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, here is your factory overview.</p>
      </div>

      {/* KPI Grid - 2x4 on large screens */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Two-column section: Activity + Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Feed */}
        <div className="dashboard-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0">
              {recentActivity.map((activity) => (
                <ActivityItem key={activity.id} {...activity} />
              ))}
            </div>
          </CardContent>
        </div>

        {/* Alerts Feed */}
        <div className="dashboard-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alerts
              <Badge variant="secondary" className="ml-auto">
                {alerts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertItem key={alert.id} {...alert} />
              ))}
            </div>
          </CardContent>
        </div>
      </div>
    </div>
  )
}
