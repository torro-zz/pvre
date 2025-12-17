'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

type TabValue = 'community' | 'market' | 'timing' | 'competitors' | 'verdict' | 'app-overview' | 'user-feedback' | 'opportunities'
type CommunitySubTab = 'themes' | 'signals' | 'quotes' | 'interview'

interface ResearchTabsContextType {
  activeTab: TabValue
  setActiveTab: (tab: TabValue) => void
  communitySubTab: CommunitySubTab
  setCommunitySubTab: (subTab: CommunitySubTab) => void
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

export function ResearchTabsProvider({ children, defaultTab = 'community' }: ResearchTabsProviderProps) {
  const [activeTab, setActiveTabState] = useState<TabValue>(defaultTab)
  const [communitySubTab, setCommunitySubTabState] = useState<CommunitySubTab>('themes')

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

  return (
    <ResearchTabsContext.Provider value={{ activeTab, setActiveTab, communitySubTab, setCommunitySubTab }}>
      {children}
    </ResearchTabsContext.Provider>
  )
}
