'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Loader2,
  User,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import api, { getApiErrorMessage } from '@/lib/api/client'
import {
  AUDIT_ACTION_OPTIONS,
  formatAuditMessage,
  getActionMeta,
  getAuditChanges,
  getModelLabel,
} from '@/lib/audit-display'
import { formatDateTime, cn } from '@/lib/utils'

const PAGE_SIZE = 20

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

function AuditLogEntry({ log }) {
  const meta = getActionMeta(log.action)
  const message = formatAuditMessage(log)
  const changes = getAuditChanges(log)
  const hasDetails = changes.length > 0

  return (
    <article className="group relative flex gap-4 border-b border-border/80 px-4 py-4 last:border-0 sm:px-5 hover:bg-muted/30 transition-colors">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          meta.className,
        )}
        aria-hidden
      >
        <ClipboardList className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              meta.className,
            )}
          >
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground">{getModelLabel(log.model)}</span>
        </div>

        <p className="text-sm font-medium text-foreground leading-snug">{message}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            {log.userName ? (
              <>
                <span className="font-medium text-foreground">{log.userName}</span>
                {log.userEmail && (
                  <span className="hidden sm:inline">· {log.userEmail}</span>
                )}
              </>
            ) : (
              <span className="italic">System</span>
            )}
          </span>
          <span className="font-mono truncate max-w-[12rem] sm:max-w-xs" title={log.recordId}>
            ID {log.recordId.slice(0, 12)}…
          </span>
        </div>

        {hasDetails && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                View changes ({changes.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ul className="rounded-lg border bg-muted/40 divide-y text-xs">
                {changes.map((change) => (
                  <li key={change.label} className="grid gap-1 px-3 py-2 sm:grid-cols-3">
                    <span className="font-medium text-muted-foreground">{change.label}</span>
                    <span className="text-destructive/90 line-through sm:text-center">
                      {change.before}
                    </span>
                    <span className="text-primary font-medium sm:text-right">{change.after}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <time
        className="shrink-0 text-right text-xs text-muted-foreground whitespace-nowrap"
        dateTime={log.createdAt}
      >
        <span className="hidden sm:inline-flex sm:items-center sm:gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDateTime(log.createdAt)}
        </span>
        <span className="sm:hidden">{formatDateTime(log.createdAt).split(',')[0]}</span>
      </time>
    </article>
  )
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [users, setUsers] = useState([])

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userId, setUserId] = useState('all')
  const [action, setAction] = useState('all')
  const [filtersVersion, setFiltersVersion] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, limit: PAGE_SIZE }
      if (userId && userId !== 'all') params.userId = userId
      if (action && action !== 'all') params.action = action
      if (dateFrom) params.from = new Date(dateFrom).toISOString()
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        params.to = end.toISOString()
      }

      const { data } = await api.get('/audit-logs', { params })
      setLogs(data.logs || [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load audit logs'))
    } finally {
      setLoading(false)
    }
  }, [page, userId, action, dateFrom, dateTo, filtersVersion])

  useEffect(() => {
    api
      .get('/users', { params: { limit: 100 } })
      .then(({ data }) => setUsers(data.users || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleApplyFilters = () => {
    setPage(1)
    setFiltersVersion((v) => v + 1)
  }

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setUserId('all')
    setAction('all')
    setPage(1)
    setFiltersVersion((v) => v + 1)
  }

  const pageNumbers = getPageNumbers(page, totalPages)
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track who did what across the system — newest activity first
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="dashboard-panel p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filters
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Action</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApplyFilters}>Apply</Button>
          <Button variant="ghost" onClick={handleClearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="dashboard-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading activity…
          </div>
        ) : logs.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No audit entries match your filters.
          </p>
        ) : (
          <div>
            {logs.map((log) => (
              <AuditLogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {pageNumbers.map((num, i) => (
                <span key={num} className="flex items-center">
                  {i > 0 && pageNumbers[i - 1] !== num - 1 && (
                    <span className="px-1 text-muted-foreground">…</span>
                  )}
                  <Button
                    variant={page === num ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-9"
                    onClick={() => setPage(num)}
                  >
                    {num}
                  </Button>
                </span>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
