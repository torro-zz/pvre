'use client'

import { Tabs } from '@/components/ui/tabs'
import { useResearchTabs } from './research-tabs-context'
import { ReactNode } from 'react'

interface ControlledTabsProps {
  children: ReactNode
  className?: string
}

export function ControlledTabs({ children, className }: ControlledTabsProps) {
  const { activeTab, setActiveTab } = useResearchTabs()

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as 'community' | 'market' | 'timing' | 'competitors' | 'verdict' | 'app-overview' | 'user-feedback' | 'opportunities')}
      className={className}
    >
      {children}
    </Tabs>
  )
}
