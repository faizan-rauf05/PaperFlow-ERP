'use client'

import { 
  Factory, 
  Users, 
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
  Eye,
  Play,
  Pause,
  XCircle,
  MoreHorizontal
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// KPI Data
const kpiCards = [
  { 
    title: "Today's Production", 
    value: '24,580', 
    unit: 'bags',
    subtitle: 'Target: 30,000 bags', 
    icon: Factory,
    color: 'bg-primary/10 text-primary'
  },
  { 
    title: 'Active Orders', 
    value: '12', 
    unit: '',
    subtitle: '3 high priority', 
    icon: ShoppingBag,
    color: 'bg-blue-100 text-blue-600'
  },
  { 
    title: 'Waste % Today', 
    value: '2.4', 
    unit: '%',
    subtitle: 'Below 3% target', 
    icon: AlertTriangle,
    color: 'bg-amber-100 text-amber-600'
  },
  { 
    title: 'Yield Efficiency', 
    value: '94.2', 
    unit: '%',
    subtitle: 'This week average', 
    icon: TrendingUp,
    color: 'bg-green-100 text-green-600'
  },
  { 
    title: 'Attendance Today', 
    value: '42/48', 
    unit: '',
    subtitle: '6 absent workers', 
    icon: Users,
    color: 'bg-purple-100 text-purple-600'
  },
]

// Production Orders Data
const productionOrders = [
  { 
    id: 'PO-2024-001', 
    bagType: 'Kraft Shopping Bag 12x18', 
    targetQty: 50000, 
    completedQty: 32500,
    status: 'active', 
    workers: ['Ahmed K.', 'Bilal S.', 'Farhan M.']
  },
  { 
    id: 'PO-2024-002', 
    bagType: 'Brown Paper Bag 8x10', 
    targetQty: 25000, 
    completedQty: 25000,
    status: 'completed', 
    workers: ['Hassan R.', 'Imran A.']
  },
  { 
    id: 'PO-2024-003', 
    bagType: 'Custom Print Bag XL', 
    targetQty: 75000, 
    completedQty: 12000,
    status: 'paused', 
    workers: ['Kamran T.', 'Noman Q.', 'Umer J.']
  },
  { 
    id: 'PO-2024-004', 
    bagType: 'Food Grade Bag 6x9', 
    targetQty: 30000, 
    completedQty: 0,
    status: 'draft', 
    workers: []
  },
  { 
    id: 'PO-2024-005', 
    bagType: 'Eco-Friendly Bag Medium', 
    targetQty: 40000, 
    completedQty: 40000,
    status: 'cancelled', 
    workers: ['Zain P.', 'Yasir H.']
  },
]

// Status badge colors
const statusColors = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const statusIcons = {
  draft: null,
  active: Play,
  paused: Pause,
  completed: null,
  cancelled: XCircle,
}

function StatusBadge({ status }) {
  const Icon = statusIcons[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-muted-foreground">Monitor production and manage orders</p>
      </div>

      {/* KPI Cards Grid - 5 cards in a row on large screens */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {kpi.title}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
                      {kpi.unit && <span className="text-sm text-muted-foreground">{kpi.unit}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Production Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">Production Orders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Manage and track all production orders</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            + New Order
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Order ID</TableHead>
                  <TableHead className="font-semibold">Bag Type</TableHead>
                  <TableHead className="font-semibold text-right">Target Qty</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Assigned Workers</TableHead>
                  <TableHead className="font-semibold">Progress</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionOrders.map((order) => {
                  const progressPercent = order.targetQty > 0 
                    ? Math.round((order.completedQty / order.targetQty) * 100) 
                    : 0
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-primary">{order.id}</TableCell>
                      <TableCell>{order.bagType}</TableCell>
                      <TableCell className="text-right font-medium">
                        {order.targetQty.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        {order.workers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {order.workers.slice(0, 2).map((worker, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                              >
                                {worker}
                              </span>
                            ))}
                            {order.workers.length > 2 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                +{order.workers.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <Progress 
                            value={progressPercent} 
                            className="h-2 flex-1"
                          />
                          <span className="text-sm font-medium w-10 text-right">
                            {progressPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {order.status === 'active' && (
                              <DropdownMenuItem>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Order
                              </DropdownMenuItem>
                            )}
                            {order.status === 'paused' && (
                              <DropdownMenuItem>
                                <Play className="h-4 w-4 mr-2" />
                                Resume Order
                              </DropdownMenuItem>
                            )}
                            {order.status === 'draft' && (
                              <DropdownMenuItem>
                                <Play className="h-4 w-4 mr-2" />
                                Start Order
                              </DropdownMenuItem>
                            )}
                            {(order.status === 'active' || order.status === 'paused') && (
                              <DropdownMenuItem className="text-red-600">
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Order
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
