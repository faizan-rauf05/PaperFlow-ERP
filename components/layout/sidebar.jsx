'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Factory, 
  X,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Sidebar({ navigation, userRole, userName, isOpen, mobileOpen, onMobileClose, onLogout }) {
  const pathname = usePathname()

  const roleLabels = {
    admin: 'Administrator',
    ADMIN: 'Administrator',
    manager: 'Manager',
    MANAGER: 'Manager',
    worker: 'Worker',
    WORKER: 'Worker',
    sales: 'Sales',
    SALES: 'Sales',
    finance: 'Finance',
    FINANCE: 'Finance',
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
          'flex h-16 items-center gap-3 px-4 border-b border-sidebar-border',
          !isOpen && 'justify-center px-2'
        )}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Factory className="h-6 w-6 text-white" />
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <span className="font-bold text-lg">PaperPro ERP</span>
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
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard/admin' && pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      !isOpen && 'justify-center px-2'
                    )}
                    title={!isOpen ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {isOpen && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User info at bottom */}
        <div className={cn(
          'border-t border-sidebar-border p-4',
          !isOpen && 'p-2'
        )}>
          {isOpen ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                  {userName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName || 'User'}</p>
                  <Badge variant="secondary" className="text-xs mt-0.5">
                    {roleLabels[userRole] || userRole}
                  </Badge>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
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
