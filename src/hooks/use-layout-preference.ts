'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

export type LayoutType = 'tabbed' | 'scroll'

const STORAGE_KEY = 'pvre-results-layout'
const URL_PARAM = 'layout'

// ============================================================================
// Hook
// ============================================================================

export function useLayoutPreference() {
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

  return {
    layout,
    setLayout,
    toggleLayout,
    isScrollLayout: layout === 'scroll',
    isTabbedLayout: layout === 'tabbed',
    isLoaded, // Use this to avoid hydration mismatch
  }
}
