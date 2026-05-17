'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import api from '@/lib/api/client'

const SidebarContext = createContext()

export function useSidebar() {
  return useContext(SidebarContext)
}

export function DashboardShell({ children, navigation, userRole: roleProp, userName: nameProp }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState(null)

  useEffect(() => {
    api
      .get('/auth/session')
      .then(({ data }) => {
        if (data?.user) setSessionUser(data.user)
      })
      .catch(() => {})
  }, [])

  const userName = sessionUser?.name || nameProp || 'User'
  const userRole = (sessionUser?.role || roleProp || 'ADMIN').toLowerCase()

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, mobileSidebarOpen, setMobileSidebarOpen }}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          navigation={navigation}
          userRole={userRole}
          userName={userName}
          isOpen={sidebarOpen}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onLogout={async () => {
            await api.post('/auth/logout')
            router.push('/login')
            router.refresh()
          }}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            userName={userName}
            userRole={userRole}
            onMenuClick={() => setMobileSidebarOpen(true)}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onLogout={async () => {
              await api.post('/auth/logout')
              router.push('/login')
              router.refresh()
            }}
          />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
