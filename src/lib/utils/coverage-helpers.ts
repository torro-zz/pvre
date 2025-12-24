/**
 * Helper functions for creating coverage data from research results.
 * These are pure functions that can be used in both server and client components.
 */

export interface SourceCoverageData {
  name: string
  iconType: 'reddit' | 'google_play' | 'app_store' | 'hacker_news' | 'g2' | 'capterra' | 'default'
  scope: string  // e.g., "8 communities", "5 apps"
  volume: string  // e.g., "692 posts", "250 reviews"
  signals: number
}

function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    reddit: 'Reddit',
    google_play: 'Google Play',
    app_store: 'App Store',
    hacker_news: 'Hacker News',
    g2: 'G2 Reviews',
    capterra: 'Capterra',
  }
  return names[source.toLowerCase()] || source
}

function getIconType(source: string): SourceCoverageData['iconType'] {
  const iconMap: Record<string, SourceCoverageData['iconType']> = {
    reddit: 'reddit',
    google_play: 'google_play',
    app_store: 'app_store',
    hacker_news: 'hacker_news',
    g2: 'g2',
    capterra: 'capterra',
  }
  return iconMap[source.toLowerCase()] || 'default'
}

/**
 * Creates coverage data from filtering metrics for display in SearchCoverageSection
 */
export function createSourceCoverageData(
  filteringMetrics: {
    postsFound?: number
    postsAnalyzed?: number
    coreSignals?: number
    relatedSignals?: number
    communitiesSearched?: string[]
    sources?: string[]
  },
  totalSignals: number
): SourceCoverageData[] {
  const sources: SourceCoverageData[] = []

  // Reddit is always included if we have posts
  if (filteringMetrics.postsAnalyzed && filteringMetrics.postsAnalyzed > 0) {
    const communityCount = filteringMetrics.communitiesSearched?.length || 0
    sources.push({
      name: 'Reddit',
      iconType: 'reddit',
      scope: `${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`,
      volume: `${filteringMetrics.postsFound || filteringMetrics.postsAnalyzed} posts`,
      signals: filteringMetrics.coreSignals || 0,
    })
  }

  // Note: We no longer add sources with 0 signals - only show sources that actually returned data
  // The sources list from filteringMetrics may include sources that were queried but returned nothing

  return sources
}

/**
 * Interface for adjacent opportunity data
 */
export interface AdjacentOpportunityData {
  name: string
  description: string
  signalCount: number
  sources: string[]
  representativeQuote?: string
  quoteSource?: string
  pivotAngle?: string
  intensity: 'low' | 'medium' | 'high'
}

/**
 * Extract adjacent opportunities from theme data
 */
export function extractAdjacentOpportunitiesData(
  themes: Array<{
    name: string
    description: string
    frequency: number
    intensity: 'low' | 'medium' | 'high'
    tier?: 'core' | 'contextual'
    sources?: string[]
    examples?: string[]
  }>,
  keyQuotes?: Array<{
    quote: string
    source: string
    painScore: number
  }>
): AdjacentOpportunityData[] {
  // Get contextual (non-core) themes, sorted by frequency
  const contextualThemes = themes
    .filter(t => t.tier === 'contextual')
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3)  // Top 3

  return contextualThemes.map(theme => {
    // Try to find a relevant quote for this theme
    const relevantQuote = keyQuotes?.find(q =>
      q.quote.toLowerCase().includes(theme.name.toLowerCase().split(' ')[0]) ||
      theme.examples?.some(ex => q.quote.includes(ex))
    )

    return {
      name: theme.name,
      description: theme.description,
      signalCount: theme.frequency,
      sources: theme.sources || ['reddit'],
      representativeQuote: relevantQuote?.quote || theme.examples?.[0],
      quoteSource: relevantQuote?.source,
      intensity: theme.intensity,
    }
  })
}

/**
 * Extracts emotional language terms from pain signal text
 */
export function extractEmotionalTerms(
  painSignals: Array<{
    text: string
    signals?: string[]
  }>
): string[] {
  const emotionalTerms = new Set<string>()
  const emotionalPatterns = [
    /\b(frustrat\w*|annoy\w*|hate|terrible|awful|horrible|nightmare|pain|suffer\w*|struggle\w*|difficult|hard|stress\w*|overwhelm\w*|confus\w*|lost|stuck|exhausted|tired of|fed up|can't stand|sick of|impossible|hopeless)\b/gi
  ]

  for (const signal of painSignals) {
    // Check main text
    for (const pattern of emotionalPatterns) {
      const matches = signal.text.match(pattern)
      if (matches) {
        matches.forEach(m => emotionalTerms.add(m.toLowerCase()))
      }
    }
    // Check signal descriptions
    if (signal.signals) {
      for (const signalText of signal.signals) {
        for (const pattern of emotionalPatterns) {
          const matches = signalText.match(pattern)
          if (matches) {
            matches.forEach(m => emotionalTerms.add(m.toLowerCase()))
          }
        }
      }
    }
  }

  return Array.from(emotionalTerms).slice(0, 10)
}
