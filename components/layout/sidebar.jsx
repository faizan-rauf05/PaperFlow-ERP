'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Factory, X, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Fixed display order for nav groups. Items without a matching `group` field
// fall back to "Workspace" so ungrouped/legacy configs still render.
const GROUP_ORDER = ['Workspace', 'Operations', 'Business', 'Factory', 'Administration']

function groupNavigation(navigation) {
  const groups = new Map()
  for (const item of navigation) {
    const key = item.group || 'Workspace'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  const ordered = GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ name: g, items: groups.get(g) }))
  // Any group not in GROUP_ORDER (unexpected/custom) is appended at the end.
  for (const [name, items] of groups) {
    if (!GROUP_ORDER.includes(name)) ordered.push({ name, items })
  }
  return ordered
}

export function Sidebar({ navigation, userRole, userName, isOpen, mobileOpen, onMobileClose, onLogout }) {
  const pathname = usePathname()
  const navGroups = groupNavigation(navigation)
  const rootHref = navigation[0]?.href

  const roleLabels = {
    admin: 'Admin',
    ADMIN: 'Admin',
    manager: 'Manager',
    MANAGER: 'Manager',
    worker: 'Worker',
    WORKER: 'Worker',
    sales: 'Sales',
    SALES: 'Sales',
    finance: 'Finance',
    FINANCE: 'Finance',
    warehouse: 'Warehouse',
    WAREHOUSE: 'Warehouse',
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
          isOpen ? 'w-64' : 'w-20',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex h-14 items-center gap-3 px-4 border-b border-sidebar-border',
          !isOpen && 'justify-center px-2'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <Factory className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm leading-tight truncate">PaperPro ERP</span>
              <span className="text-xs text-sidebar-foreground/60 leading-tight">Manufacturing ERP</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden ml-auto text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onMobileClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navGroups.map((group, groupIndex) => (
            <div key={group.name} className={groupIndex > 0 ? 'mt-4' : undefined}>
              {isOpen ? (
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                  {group.name}
                </p>
              ) : (
                groupIndex > 0 && <div className="mx-3 mb-2 border-t border-sidebar-border/60" />
              )}
              <ul className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== rootHref && pathname.startsWith(`${item.href}/`))
                  const Icon = item.icon

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md border-l-2 border-transparent px-2.5 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'border-primary bg-primary/15 text-sidebar-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          !isOpen && 'justify-center px-0'
                        )}
                        title={!isOpen ? item.name : undefined}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        {isOpen && <span className="truncate">{item.name}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className={cn(
          'border-t border-sidebar-border p-3',
          !isOpen && 'p-2'
        )}>
          {isOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-xs">
                  {userName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName || 'User'}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabels[userRole] || userRole}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => onLogout?.()}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-xs">
                {userName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Logout"
                onClick={() => onLogout?.()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
