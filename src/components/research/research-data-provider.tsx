'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { ResearchPageData } from '@/lib/research/fetch-research-data'

// ============================================================================
// Context
// ============================================================================

const ResearchDataContext = createContext<ResearchPageData | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface ResearchDataProviderProps {
  data: ResearchPageData
  children: ReactNode
}

export function ResearchDataProvider({ data, children }: ResearchDataProviderProps) {
  return (
    <ResearchDataContext.Provider value={data}>
      {children}
    </ResearchDataContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useResearchData(): ResearchPageData {
  const context = useContext(ResearchDataContext)
  if (!context) {
    throw new Error('useResearchData must be used within a ResearchDataProvider')
  }
  return context
}

// Optional: Non-throwing version for components that may be outside provider
export function useResearchDataOptional(): ResearchPageData | null {
  return useContext(ResearchDataContext)
}
