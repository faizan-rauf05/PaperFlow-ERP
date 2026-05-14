'use client'

import { useState, createContext, useContext } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

const SidebarContext = createContext()

export function useSidebar() {
  return useContext(SidebarContext)
}

export function DashboardShell({ children, navigation, userRole, userName }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header 
            userName={userName} 
            userRole={userRole}
            onMenuClick={() => setMobileSidebarOpen(true)}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
