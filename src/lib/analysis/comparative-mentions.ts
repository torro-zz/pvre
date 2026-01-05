/**
 * Comparative Mentions Extractor
 *
 * Extracts real user comparisons from reviews/posts.
 * Pattern examples:
 * - "Hinge is so much better for relationships"
 * - "Unlike Bumble, this doesn't..."
 * - "Switched from OkCupid because..."
 * - "Compared to Match, the..."
 *
 * Returns sentiment-scored comparison data based on REAL user opinions.
 */

export interface ComparativeMention {
  competitor: string
  sentiment: 'positive' | 'negative' | 'neutral'
  quote: string
  source: 'app_store' | 'google_play' | 'reddit'
  context: string // Why user mentioned the competitor
}

export interface ComparativeSummary {
  competitor: string
  positiveMentions: number
  negativeMentions: number
  neutralMentions: number
  netSentiment: number // positive - negative
  sampleQuotes: {
    positive: string[]
    negative: string[]
  }
}

export interface ComparativeMentionsResult {
  analyzedApp: string
  totalMentions: number
  competitorsSummary: ComparativeSummary[]
  rawMentions: ComparativeMention[]
  metadata: {
    signalsAnalyzed: number
    extractionTimeMs: number
  }
}

// Patterns that indicate comparison to another app
// Using (?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) to capture multi-word app names
const COMPARISON_PATTERNS = [
  // Direct comparisons
  /(?:compared to|vs\.?|versus|unlike)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // Better/worse than
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|was|are|were)\s+(?:so much\s+)?(?:better|worse|easier|harder)/gi,
  // Switching from
  /(?:switched|switch|moved|came)\s+(?:from|over from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // Used to use
  /(?:used to use|was using|tried)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // Has/doesn't have like
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:has|doesn't have|does not have|lacks)/gi,
  // Similar to / like [App]
  /(?:similar to|just like|same as|reminds me of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // [App] alternative
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+alternative/gi,
  // Better than [App]
  /better\s+than\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // Worse than [App]
  /worse\s+than\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
]

// Positive sentiment indicators around competitor mentions
const POSITIVE_INDICATORS = [
  'better', 'best', 'prefer', 'love', 'great', 'amazing',
  'switched to', 'moved to', 'much better', 'way better',
  'easier', 'smoother', 'cleaner', 'nicer', 'superior'
]

// Negative sentiment indicators around competitor mentions
const NEGATIVE_INDICATORS = [
  'worse', 'worst', 'hate', 'terrible', 'awful', 'bad',
  'switched from', 'left', 'quit', 'gave up on', 'abandoned',
  'harder', 'clunky', 'buggy', 'broken', 'inferior', 'unlike'
]

// Known app names to match (expand as needed)
const KNOWN_APPS = [
  // Dating
  'Tinder', 'Bumble', 'Hinge', 'OkCupid', 'Match', 'Plenty of Fish', 'POF',
  'Coffee Meets Bagel', 'CMB', 'eHarmony', 'Grindr', 'Her', 'Feeld', 'Raya',
  // Messaging
  'WhatsApp', 'Telegram', 'Signal', 'Discord', 'Slack', 'Teams', 'Messenger',
  // Video
  'Loom', 'Zoom', 'Google Meet', 'Vidyard', 'Sendspark', 'BombBomb',
  // Productivity
  'Notion', 'Asana', 'Monday', 'Trello', 'ClickUp', 'Jira', 'Linear',
  // Generic patterns
  'the app', 'this app', 'other apps', 'similar apps'
]

/**
 * Extract competitor name from text, handling common variations
 */
function normalizeCompetitorName(raw: string): string | null {
  const cleaned = raw.trim()

  // Skip generic terms (case insensitive)
  const skipTerms = ['the app', 'this app', 'other apps', 'similar apps', 'it', 'they', 'them', 'app', 'apps']
  if (skipTerms.some(term => cleaned.toLowerCase() === term.toLowerCase())) {
    return null
  }

  // Skip if it's a generic phrase containing "app"
  if (/^(the|this|other|similar|an?)\s+app/i.test(cleaned)) {
    return null
  }

  // Find closest match in known apps
  const lowerCleaned = cleaned.toLowerCase()

  // Exact match first
  for (const app of KNOWN_APPS) {
    if (app.toLowerCase() === lowerCleaned) {
      return app
    }
  }

  // Check if this is part of a known multi-word app name
  // e.g., "Coffee Meets Bagel" should match if we captured "Coffee Meets Bagel"
  // But also handle partial captures like "Plenty Of Fish" → "Plenty of Fish"
  for (const app of KNOWN_APPS) {
    const appWords = app.toLowerCase().split(/\s+/)
    const cleanedWords = lowerCleaned.split(/\s+/)

    // If first word matches and is a known multi-word app
    if (appWords.length > 1 && cleanedWords.length >= 1 &&
        appWords[0] === cleanedWords[0]) {
      // Check if this could be the start of the known app
      return app
    }
  }

  // Return as-is if it looks like an app name (capitalized word(s), first word 4+ chars to avoid short false positives)
  const firstWord = cleaned.split(/\s+/)[0]
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(cleaned) && firstWord.length >= 4) {
    return cleaned
  }

  return null
}

/**
 * Determine sentiment of a competitor mention based on surrounding context
 */
function analyzeSentiment(
  text: string,
  competitorName: string,
  analyzedAppName: string
): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase()
  const lowerCompetitor = competitorName.toLowerCase()
  const lowerAnalyzed = analyzedAppName.toLowerCase()

  // Find the mention position
  const mentionIndex = lowerText.indexOf(lowerCompetitor)
  if (mentionIndex === -1) return 'neutral'

  // Get surrounding context (100 chars before and after)
  const contextStart = Math.max(0, mentionIndex - 100)
  const contextEnd = Math.min(lowerText.length, mentionIndex + lowerCompetitor.length + 100)
  const context = lowerText.slice(contextStart, contextEnd)

  // Check for "switched from [competitor]" = negative about competitor
  if (context.includes(`switched from ${lowerCompetitor}`) ||
      context.includes(`left ${lowerCompetitor}`) ||
      context.includes(`quit ${lowerCompetitor}`)) {
    return 'negative' // Negative about competitor = they left it
  }

  // Check for "switched to [competitor]" = positive about competitor
  if (context.includes(`switched to ${lowerCompetitor}`) ||
      context.includes(`moved to ${lowerCompetitor}`)) {
    return 'positive' // Positive about competitor = they're going to it
  }

  // Check for "[competitor] is better" patterns
  if (context.includes(`${lowerCompetitor} is better`) ||
      context.includes(`${lowerCompetitor} is much better`) ||
      context.includes(`${lowerCompetitor} was better`) ||
      context.includes(`prefer ${lowerCompetitor}`)) {
    return 'positive' // Positive about competitor
  }

  // Check for "better than [competitor]" = negative about competitor (analyzed app is better)
  if (context.includes(`better than ${lowerCompetitor}`)) {
    return 'negative' // Competitor is worse
  }

  // Check for "worse than [competitor]" = positive about competitor (analyzed app is worse)
  if (context.includes(`worse than ${lowerCompetitor}`)) {
    return 'positive' // Competitor is better
  }

  // Check for "unlike [competitor]" - usually negative about competitor
  if (context.includes(`unlike ${lowerCompetitor}`)) {
    // "Unlike X, this actually works" = negative about X
    return 'negative'
  }

  // Count positive vs negative indicators in context
  let positiveCount = 0
  let negativeCount = 0

  for (const indicator of POSITIVE_INDICATORS) {
    if (context.includes(indicator)) positiveCount++
  }

  for (const indicator of NEGATIVE_INDICATORS) {
    if (context.includes(indicator)) negativeCount++
  }

  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'

  return 'neutral'
}

/**
 * Extract context around a competitor mention
 */
function extractContext(text: string, competitorName: string): string {
  const lowerText = text.toLowerCase()
  const mentionIndex = lowerText.indexOf(competitorName.toLowerCase())

  if (mentionIndex === -1) return ''

  // Get sentence containing the mention
  const sentences = text.split(/[.!?]+/)
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(competitorName.toLowerCase())) {
      return sentence.trim().slice(0, 200)
    }
  }

  // Fallback: get 100 chars around mention
  const start = Math.max(0, mentionIndex - 50)
  const end = Math.min(text.length, mentionIndex + competitorName.length + 100)
  return text.slice(start, end).trim()
}

/**
 * Main extraction function - processes signals and extracts comparative mentions
 */
export function extractComparativeMentions(
  signals: Array<{
    text: string
    source?: 'app_store' | 'google_play' | 'reddit' | string
  }>,
  analyzedAppName: string
): ComparativeMentionsResult {
  const startTime = Date.now()
  const mentions: ComparativeMention[] = []

  // Normalize the analyzed app name for exclusion
  const normalizedAnalyzedName = analyzedAppName.toLowerCase().split(/[\s:]/)[0]

  for (const signal of signals) {
    const text = signal.text || ''
    if (text.length < 20) continue // Skip very short texts

    // Try each pattern
    for (const pattern of COMPARISON_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0

      let match
      while ((match = pattern.exec(text)) !== null) {
        const rawName = match[1]
        const competitor = normalizeCompetitorName(rawName)

        if (!competitor) continue

        // Skip self-references
        if (competitor.toLowerCase().startsWith(normalizedAnalyzedName)) continue

        const sentiment = analyzeSentiment(text, competitor, analyzedAppName)
        const context = extractContext(text, competitor)

        // Determine source
        let source: 'app_store' | 'google_play' | 'reddit' = 'reddit'
        if (signal.source === 'app_store' || signal.source === 'apple') {
          source = 'app_store'
        } else if (signal.source === 'google_play' || signal.source === 'google') {
          source = 'google_play'
        }

        mentions.push({
          competitor,
          sentiment,
          quote: context,
          source,
          context: `Mentioned in ${source.replace('_', ' ')} review`
        })
      }
    }
  }

  // Aggregate by competitor
  const competitorMap = new Map<string, ComparativeSummary>()

  for (const mention of mentions) {
    const key = mention.competitor.toLowerCase()

    if (!competitorMap.has(key)) {
      competitorMap.set(key, {
        competitor: mention.competitor, // Keep original casing from first mention
        positiveMentions: 0,
        negativeMentions: 0,
        neutralMentions: 0,
        netSentiment: 0,
        sampleQuotes: { positive: [], negative: [] }
      })
    }

    const summary = competitorMap.get(key)!

    if (mention.sentiment === 'positive') {
      summary.positiveMentions++
      if (summary.sampleQuotes.positive.length < 3 && mention.quote.length > 30) {
        summary.sampleQuotes.positive.push(mention.quote)
      }
    } else if (mention.sentiment === 'negative') {
      summary.negativeMentions++
      if (summary.sampleQuotes.negative.length < 3 && mention.quote.length > 30) {
        summary.sampleQuotes.negative.push(mention.quote)
      }
    } else {
      summary.neutralMentions++
    }

    summary.netSentiment = summary.positiveMentions - summary.negativeMentions
  }

  // Sort by total mentions (most mentioned first)
  // Filter out generic terms that slipped through and entries with no sentiment
  const genericTerms = ['the app', 'this app', 'other apps', 'similar apps', 'app', 'apps', 'it', 'they']
  const competitorsSummary = Array.from(competitorMap.values())
    .filter(comp => {
      // Filter out generic terms
      if (genericTerms.some(term => comp.competitor.toLowerCase() === term)) {
        return false
      }
      // Filter out entries with no positive or negative mentions (only neutral)
      const total = comp.positiveMentions + comp.negativeMentions
      return total > 0
    })
    .sort((a, b) => {
      const totalA = a.positiveMentions + a.negativeMentions + a.neutralMentions
      const totalB = b.positiveMentions + b.negativeMentions + b.neutralMentions
      return totalB - totalA
    })
    .slice(0, 10) // Top 10 competitors

  return {
    analyzedApp: analyzedAppName,
    totalMentions: mentions.length,
    competitorsSummary,
    rawMentions: mentions,
    metadata: {
      signalsAnalyzed: signals.length,
      extractionTimeMs: Date.now() - startTime
    }
  }
}

/**
 * Format comparative mentions for display
 */
export function formatComparativeMentionsTable(result: ComparativeMentionsResult): string {
  if (result.competitorsSummary.length === 0) {
    return 'No comparative mentions found in reviews.'
  }

  let output = `| Competitor | Positive | Negative | Net |\n`
  output += `|------------|----------|----------|-----|\n`

  for (const comp of result.competitorsSummary) {
    const total = comp.positiveMentions + comp.negativeMentions + comp.neutralMentions
    const net = comp.netSentiment >= 0 ? `+${comp.netSentiment}` : `${comp.netSentiment}`
    output += `| ${comp.competitor} | ${comp.positiveMentions} | ${comp.negativeMentions} | ${net} |\n`
  }

  output += `\n*Based on ${result.totalMentions} comparative mentions from ${result.metadata.signalsAnalyzed} signals*`

  return output
}
