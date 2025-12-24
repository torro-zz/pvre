'use client'

import { useLayoutPreference } from '@/hooks/use-layout-preference'
import { useResearchData } from '@/components/research/research-data-provider'
import { TabbedView } from './tabbed-view'
import { ScrollView } from './scroll-view'

export function ResultsLayout() {
  const { isScrollLayout, isLoaded } = useLayoutPreference()
  const data = useResearchData()

  // Show tabbed view while loading to match server render
  if (!isLoaded) {
    return <TabbedView />
  }

  // Render based on user preference
  if (isScrollLayout) {
    return <ScrollView />
  }

  return <TabbedView />
}
