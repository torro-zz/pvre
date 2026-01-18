'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type TabValue = 'summary' | 'evidence' | 'market' | 'action' | 'community' | 'app-overview' | 'user-feedback' | 'opportunities' | 'verdict'
export type CommunitySubTab = 'themes' | 'signals' | 'quotes' | 'interview'
export type MarketSubTab = 'overview' | 'sizing' | 'timing' | 'competition' | 'opportunities' | 'positioning'

interface ResearchTabsContextType {
  activeTab: TabValue
  setActiveTab: (tab: TabValue) => void
  communitySubTab: CommunitySubTab
  setCommunitySubTab: (subTab: CommunitySubTab) => void
  marketSubTab: MarketSubTab
  setMarketSubTab: (subTab: MarketSubTab) => void
}

const ResearchTabsContext = createContext<ResearchTabsContextType | null>(null)

export function useResearchTabs() {
  const context = useContext(ResearchTabsContext)
  if (!context) {
    throw new Error('useResearchTabs must be used within ResearchTabsProvider')
  }
  return context
}

interface ResearchTabsProviderProps {
  children: ReactNode
  defaultTab?: TabValue
}

export function ResearchTabsProvider({ children, defaultTab = 'summary' }: ResearchTabsProviderProps) {
  const [activeTab, setActiveTabState] = useState<TabValue>(defaultTab)
  const [communitySubTab, setCommunitySubTabState] = useState<CommunitySubTab>('themes')
  const [marketSubTab, setMarketSubTabState] = useState<MarketSubTab>('overview')

  const setActiveTab = useCallback((tab: TabValue) => {
    setActiveTabState(tab)
    // Scroll to top of tabs after switching
    setTimeout(() => {
      const tabsElement = document.querySelector('[data-slot="tabs"]')
      if (tabsElement) {
        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }, [])

  const setCommunitySubTab = useCallback((subTab: CommunitySubTab) => {
    setCommunitySubTabState(subTab)
  }, [])

  const setMarketSubTab = useCallback((subTab: MarketSubTab) => {
    setMarketSubTabState(subTab)
  }, [])

  return (
    <ResearchTabsContext.Provider value={{ activeTab, setActiveTab, communitySubTab, setCommunitySubTab, marketSubTab, setMarketSubTab }}>
      {children}
    </ResearchTabsContext.Provider>
  )
}
