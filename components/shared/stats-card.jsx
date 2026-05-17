import { cn } from '@/lib/utils'

export function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, className }) {
  return (
    <div className={cn('dashboard-panel p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="dashboard-kpi-icon">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-sm">
          <span className={cn('font-medium', trendUp ? 'text-primary' : 'text-destructive')}>
            {trendUp ? '+' : ''}{trend}
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  )
}
