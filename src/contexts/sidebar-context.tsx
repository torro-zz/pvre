'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextValue {
  isCollapsed: boolean
  toggleCollapsed: () => void
  isMobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

const STORAGE_KEY = 'pvre-sidebar-collapsed'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      setIsCollapsed(true)
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed))
    }
  }, [isCollapsed, isHydrated])

  // Close mobile sidebar on route change (resize event as proxy)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileOpen])

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  const setMobileOpen = (open: boolean) => {
    setIsMobileOpen(open)
  }

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapsed,
        isMobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
