import { cn } from '@/lib/utils'

export function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, className }) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-sm">
          <span className={cn('font-medium', trendUp ? 'text-green-600' : 'text-red-600')}>
            {trendUp ? '+' : ''}{trend}
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  )
}
