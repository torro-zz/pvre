/**
 * Opportunity Detector
 *
 * Identifies market gaps, unmet demand, and pivot opportunities using:
 * - Main themes (from CORE + STRONG signals)
 * - ADJACENT signals (nearby problems that could inform pivots)
 *
 * This is a Phase 2 component of the tiered filter redesign.
 * Only used when USE_TIERED_FILTER = true.
 */

import { anthropic, getCurrentTracker } from '../anthropic'
import { trackUsage } from './token-tracker'
import { parseClaudeJSON } from '../json-parse'
import { TieredSignals, TieredScoredSignal } from '@/lib/adapters/types'
import { Theme } from './theme-extractor'

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single identified market opportunity
 */
export interface Opportunity {
  /** Short title for the opportunity */
  title: string

  /** Type of opportunity */
  type: 'gap' | 'unmet_demand' | 'pivot' | 'positioning'

  /** Detailed description */
  description: string

  /** Evidence from user signals */
  evidence: string[]

  /** Confidence level based on signal strength */
  confidence: 'high' | 'medium' | 'low'

  /** Suggested action */
  action: string
}

/**
 * Full opportunity analysis result
 */
export interface OpportunityAnalysis {
  /** Gaps - what users want that current solutions don't provide */
  gaps: Opportunity[]

  /** Unmet demand - where demand exceeds supply */
  unmetDemand: Opportunity[]

  /** Pivot options - based on adjacent signals */
  pivotOptions: Opportunity[]

  /** Positioning recommendations - how to differentiate */
  positioning: Opportunity[]

  /** Overall assessment */
  summary: string

  /** Top opportunity (if any) */
  topOpportunity: Opportunity | null

  /** Metadata */
  metadata: {
    themesAnalyzed: number
    adjacentSignalsUsed: number
    processingTimeMs: number
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Identify market opportunities from tiered signals and themes.
 *
 * Uses ADJACENT signals (tier 0.15-0.25) to find pivot opportunities
 * that may not be obvious from the main hypothesis.
 *
 * @param themes - Extracted themes from CORE + STRONG signals
 * @param tieredSignals - Full tiered signal output
 * @param hypothesis - Original business hypothesis
 * @returns OpportunityAnalysis with gaps, pivots, and positioning
 */
export async function identifyOpportunities(
  themes: Theme[],
  tieredSignals: TieredSignals,
  hypothesis: string
): Promise<OpportunityAnalysis> {
  const startTime = Date.now()

  // Use top 30 adjacent signals for pivot analysis
  const adjacentSample = tieredSignals.adjacent.slice(0, 30)

  // If no themes or signals, return empty analysis
  if (themes.length === 0 && adjacentSample.length === 0) {
    return getEmptyAnalysis(startTime)
  }

  const systemPrompt = `You are a market opportunity analyst helping entrepreneurs find gaps and pivot opportunities.

Your task is to analyze pain themes and ADJACENT signals (problems NEAR the hypothesis but not directly matching) to identify:
1. GAPS: What users want that current solutions don't provide
2. UNMET DEMAND: Where demand clearly exceeds supply
3. PIVOT OPTIONS: Related problems (from adjacent signals) worth exploring
4. POSITIONING: How a new solution should differentiate

ADJACENT SIGNALS CONTEXT:
Adjacent signals are problems mentioned alongside the main hypothesis. They may reveal:
- Related problems worth solving
- Features users wish existed
- Adjacent markets to enter
- Pivot opportunities if the main hypothesis is weak

Be specific and reference actual user language. Avoid generic advice.`

  const userPrompt = `Hypothesis: "${hypothesis}"

MAIN THEMES (from high-relevance signals):
${themes.map(t => `- ${t.name}: ${t.description} (intensity: ${t.intensity}, frequency: ${t.frequency})`).join('\n')}

ADJACENT SIGNALS (nearby problems users also mention):
${adjacentSample.map(s => `- "${truncateText(getSignalText(s), 200)}" [score: ${s.score.toFixed(2)}, source: ${s.post.source}]`).join('\n')}

Identify opportunities in JSON format:
{
  "gaps": [
    {
      "title": "Short title (3-5 words)",
      "type": "gap",
      "description": "What users want that doesn't exist",
      "evidence": ["User quote 1", "User quote 2"],
      "confidence": "high" | "medium" | "low",
      "action": "Specific action to take"
    }
  ],
  "unmetDemand": [
    {
      "title": "Short title",
      "type": "unmet_demand",
      "description": "Where demand exceeds supply",
      "evidence": ["User quote 1"],
      "confidence": "high" | "medium" | "low",
      "action": "Specific action"
    }
  ],
  "pivotOptions": [
    {
      "title": "Related problem to consider",
      "type": "pivot",
      "description": "Adjacent problem worth exploring",
      "evidence": ["From adjacent signals"],
      "confidence": "high" | "medium" | "low",
      "action": "How to pivot"
    }
  ],
  "positioning": [
    {
      "title": "Differentiation angle",
      "type": "positioning",
      "description": "How to stand out",
      "evidence": ["User language to leverage"],
      "confidence": "high" | "medium" | "low",
      "action": "Positioning tactic"
    }
  ],
  "summary": "2-3 sentence summary of the biggest opportunities",
  "topOpportunity": <the single best opportunity object, or null if none are strong>
}

Find 1-3 opportunities per category. Quality over quantity.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    })

    // Track token usage
    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-sonnet-4-20250514')
    }

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    const parsed = parseClaudeJSON<Partial<OpportunityAnalysis>>(textContent.text, 'opportunity detection')

    return {
      gaps: parsed.gaps || [],
      unmetDemand: parsed.unmetDemand || [],
      pivotOptions: parsed.pivotOptions || [],
      positioning: parsed.positioning || [],
      summary: parsed.summary || 'Opportunity analysis complete.',
      topOpportunity: parsed.topOpportunity || null,
      metadata: {
        themesAnalyzed: themes.length,
        adjacentSignalsUsed: adjacentSample.length,
        processingTimeMs: Date.now() - startTime,
      },
    }
  } catch (error) {
    console.error('Opportunity detection failed:', error)
    return getEmptyAnalysis(startTime, 'Opportunity analysis could not be completed.')
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get empty analysis for error cases or no data.
 */
function getEmptyAnalysis(startTime: number, summary?: string): OpportunityAnalysis {
  return {
    gaps: [],
    unmetDemand: [],
    pivotOptions: [],
    positioning: [],
    summary: summary || 'No opportunities identified. More data needed.',
    topOpportunity: null,
    metadata: {
      themesAnalyzed: 0,
      adjacentSignalsUsed: 0,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Get text content from a tiered signal.
 */
function getSignalText(signal: TieredScoredSignal): string {
  const post = signal.post
  if (post.title && post.body) {
    return `${post.title}: ${post.body}`
  }
  return post.title || post.body || post.textForEmbedding
}

/**
 * Truncate text to max length.
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// =============================================================================
// QUICK OPPORTUNITY SCAN
// =============================================================================

/**
 * Quick opportunity scan without AI - just finds keywords and patterns.
 * Use for preview or when AI is unavailable.
 *
 * @param tieredSignals - Tiered signal output
 * @returns Basic opportunity indicators
 */
export function quickOpportunityScan(
  tieredSignals: TieredSignals
): { hasGapSignals: boolean; hasPivotPotential: boolean; keyIndicators: string[] } {
  const allSignals = [
    ...tieredSignals.core,
    ...tieredSignals.strong,
    ...tieredSignals.related,
    ...tieredSignals.adjacent,
  ]

  const gapKeywords = [
    'wish there was',
    'nobody offers',
    'doesn\'t exist',
    'can\'t find',
    'looking for',
    'need something',
    'why isn\'t there',
    'someone should build',
  ]

  const pivotKeywords = [
    'instead of',
    'switched to',
    'gave up on',
    'works better',
    'found a workaround',
  ]

  const keyIndicators: string[] = []
  let hasGapSignals = false
  let hasPivotPotential = false

  for (const signal of allSignals.slice(0, 100)) {
    const text = getSignalText(signal).toLowerCase()

    for (const keyword of gapKeywords) {
      if (text.includes(keyword)) {
        hasGapSignals = true
        keyIndicators.push(`Gap signal: "${keyword}"`)
        break
      }
    }

    for (const keyword of pivotKeywords) {
      if (text.includes(keyword)) {
        hasPivotPotential = true
        keyIndicators.push(`Pivot indicator: "${keyword}"`)
        break
      }
    }
  }

  // Adjacent signals existing is itself a pivot indicator
  if (tieredSignals.adjacent.length > 10) {
    hasPivotPotential = true
    keyIndicators.push(`${tieredSignals.adjacent.length} adjacent signals found`)
  }

  return {
    hasGapSignals,
    hasPivotPotential,
    keyIndicators: [...new Set(keyIndicators)].slice(0, 5),
  }
}
