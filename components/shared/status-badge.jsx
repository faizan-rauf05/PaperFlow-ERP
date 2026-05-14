import { cn } from '@/lib/utils'

const statusConfig = {
  // Order statuses
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_production: { label: 'In Production', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  quality_check: { label: 'Quality Check', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
  
  // Machine statuses
  running: { label: 'Running', color: 'bg-green-100 text-green-800 border-green-200' },
  idle: { label: 'Idle', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  maintenance: { label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  offline: { label: 'Offline', color: 'bg-red-100 text-red-800 border-red-200' },
  
  // Inventory statuses
  in_stock: { label: 'In Stock', color: 'bg-green-100 text-green-800 border-green-200' },
  low_stock: { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 border-red-200' },
  
  // General
  active: { label: 'Active', color: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  
  // Payment statuses
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800 border-green-200' },
  unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-800 border-red-200' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800 border-red-200' },
}

export function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800 border-gray-200' }
  
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      config.color,
      className
    )}>
      {config.label}
    </span>
  )
}
