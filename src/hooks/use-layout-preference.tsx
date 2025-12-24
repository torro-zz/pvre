'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

export type LayoutType = 'tabbed' | 'scroll'

const STORAGE_KEY = 'pvre-results-layout'
const URL_PARAM = 'layout'

interface LayoutPreferenceContextType {
  layout: LayoutType
  setLayout: (layout: LayoutType) => void
  toggleLayout: () => void
  isScrollLayout: boolean
  isTabbedLayout: boolean
  isLoaded: boolean
}

// ============================================================================
// Context
// ============================================================================

const LayoutPreferenceContext = createContext<LayoutPreferenceContextType | null>(null)

// ============================================================================
// Provider
// ============================================================================

export function LayoutPreferenceProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const [layout, setLayoutState] = useState<LayoutType>('tabbed')
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize from URL param or localStorage
  useEffect(() => {
    // URL param takes priority
    const urlLayout = searchParams.get(URL_PARAM) as LayoutType | null
    if (urlLayout === 'scroll' || urlLayout === 'tabbed') {
      setLayoutState(urlLayout)
      setIsLoaded(true)
      return
    }

    // Fall back to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LayoutType | null
      if (stored === 'scroll' || stored === 'tabbed') {
        setLayoutState(stored)
      }
    } catch {
      // localStorage not available (SSR or privacy mode)
    }
    setIsLoaded(true)
  }, [searchParams])

  // Update layout and persist to localStorage
  const setLayout = useCallback((newLayout: LayoutType) => {
    setLayoutState(newLayout)
    try {
      localStorage.setItem(STORAGE_KEY, newLayout)
    } catch {
      // localStorage not available
    }
  }, [])

  // Toggle between layouts
  const toggleLayout = useCallback(() => {
    setLayout(layout === 'tabbed' ? 'scroll' : 'tabbed')
  }, [layout, setLayout])

  return (
    <LayoutPreferenceContext.Provider
      value={{
        layout,
        setLayout,
        toggleLayout,
        isScrollLayout: layout === 'scroll',
        isTabbedLayout: layout === 'tabbed',
        isLoaded,
      }}
    >
      {children}
    </LayoutPreferenceContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useLayoutPreference() {
  const context = useContext(LayoutPreferenceContext)

  // If not in provider, create standalone state (for backwards compatibility)
  const searchParams = useSearchParams()
  const [standaloneLayout, setStandaloneLayoutState] = useState<LayoutType>('tabbed')
  const [standaloneIsLoaded, setStandaloneIsLoaded] = useState(false)

  useEffect(() => {
    if (context) return // Skip if using context

    const urlLayout = searchParams.get(URL_PARAM) as LayoutType | null
    if (urlLayout === 'scroll' || urlLayout === 'tabbed') {
      setStandaloneLayoutState(urlLayout)
      setStandaloneIsLoaded(true)
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LayoutType | null
      if (stored === 'scroll' || stored === 'tabbed') {
        setStandaloneLayoutState(stored)
      }
    } catch {
      // localStorage not available
    }
    setStandaloneIsLoaded(true)
  }, [searchParams, context])

  const setStandaloneLayout = useCallback((newLayout: LayoutType) => {
    setStandaloneLayoutState(newLayout)
    try {
      localStorage.setItem(STORAGE_KEY, newLayout)
    } catch {
      // localStorage not available
    }
  }, [])

  const toggleStandaloneLayout = useCallback(() => {
    setStandaloneLayout(standaloneLayout === 'tabbed' ? 'scroll' : 'tabbed')
  }, [standaloneLayout, setStandaloneLayout])

  // Return context values if available, otherwise standalone
  if (context) {
    return context
  }

  return {
    layout: standaloneLayout,
    setLayout: setStandaloneLayout,
    toggleLayout: toggleStandaloneLayout,
    isScrollLayout: standaloneLayout === 'scroll',
    isTabbedLayout: standaloneLayout === 'tabbed',
    isLoaded: standaloneIsLoaded,
  }
}
