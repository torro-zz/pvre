/**
 * Theme Resonance Calculator
 *
 * Calculates resonance (engagement quality) for themes based on signal engagement.
 * Resonance = how much people engage with this topic relative to average.
 * High resonance = people care deeply about this issue (lots of discussion/engagement)
 * Low resonance = topic is mentioned but doesn't generate much engagement
 */

// Minimal types needed for resonance calculation (to avoid circular imports)
interface ThemeInput {
  name: string
  intensity: 'low' | 'medium' | 'high'
  resonance?: 'low' | 'medium' | 'high'
}

interface SignalInput {
  text: string
  title?: string
  signals: string[]
  source: {
    engagementScore: number
  }
}

export function calculateThemeResonance<T extends ThemeInput>(
  themes: T[],
  painSignals: SignalInput[]
): T[] {
  if (painSignals.length === 0 || themes.length === 0) {
    return themes
  }

  // Calculate overall average engagement
  const totalEngagement = painSignals.reduce(
    (sum, signal) => sum + (signal.source.engagementScore || 0),
    0
  )
  const avgEngagement = totalEngagement / painSignals.length

  // For each theme, find matching signals and calculate their average engagement
  return themes.map((theme) => {
    // Extract keywords from theme name (lowercase, split by spaces/punctuation)
    const themeKeywords = theme.name
      .toLowerCase()
      .replace(/\[contextual\]\s*/i, '') // Remove contextual prefix
      .split(/[\s\-_,]+/)
      .filter((word) => word.length > 3) // Only meaningful words

    // Find signals that mention any of the theme keywords
    const matchingSignals = painSignals.filter((signal) => {
      const signalText = (signal.text + ' ' + (signal.title || '')).toLowerCase()
      return themeKeywords.some(
        (keyword) =>
          signalText.includes(keyword) ||
          signal.signals.some((s) => s.toLowerCase().includes(keyword))
      )
    })

    // Calculate resonance score for this theme
    let resonance: 'low' | 'medium' | 'high' = 'medium' // default

    if (matchingSignals.length > 0) {
      const themeEngagement =
        matchingSignals.reduce(
          (sum, s) => sum + (s.source.engagementScore || 0),
          0
        ) / matchingSignals.length

      // Calculate resonance relative to average
      // High: >1.5x average engagement
      // Medium: 0.7x - 1.5x average
      // Low: <0.7x average
      const engagementRatio = avgEngagement > 0 ? themeEngagement / avgEngagement : 1

      if (engagementRatio > 1.5) {
        resonance = 'high'
      } else if (engagementRatio < 0.7) {
        resonance = 'low'
      } else {
        resonance = 'medium'
      }
    } else {
      // No matching signals found - use intensity as proxy
      resonance = theme.intensity
    }

    return {
      ...theme,
      resonance,
    }
  })
}
