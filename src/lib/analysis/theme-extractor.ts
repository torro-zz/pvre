// Theme Extractor
// Uses Claude to synthesize themes from pain signals

import { anthropic, getCurrentTracker } from '../anthropic'
import { trackUsage } from './token-tracker'
import { PainSignal } from './pain-detector'
import { parseClaudeJSON } from '../json-parse'

// Re-export resonance calculation from dedicated module
export { calculateThemeResonance } from './theme-resonance'

export interface Theme {
  name: string
  description: string
  frequency: number
  intensity: 'low' | 'medium' | 'high'
  examples: string[]
  resonance?: 'low' | 'medium' | 'high'  // Engagement quality - how much people care about this topic
  tier?: 'core' | 'contextual'  // core = from intersection signals, contextual = from related/broader signals
  sources?: string[]  // Which data sources contributed to this theme (e.g., ['reddit', 'google_play'])
}

/**
 * Parse tier from theme name and clean the name
 * Claude may prefix themes with "[CONTEXTUAL]" for themes derived from RELATED signals
 */
function parseThemeTier(theme: Theme): Theme {
  const contextualPrefix = /^\[CONTEXTUAL\]\s*/i
  if (contextualPrefix.test(theme.name)) {
    return {
      ...theme,
      name: theme.name.replace(contextualPrefix, '').trim(),
      tier: 'contextual',
    }
  }
  // Default to core if no contextual prefix
  return {
    ...theme,
    tier: 'core',
  }
}

/**
 * Determine WTP source reliability based on source type
 * App reviews > Hacker News > Reddit for purchase intent signals
 */
function getWtpSourceReliability(source: string): 'high' | 'medium' | 'low' {
  const lower = source.toLowerCase()

  // High reliability: App store reviews (actual purchase context)
  if (lower === 'google_play' || lower === 'app_store' || lower === 'trustpilot') {
    return 'high'
  }

  // Medium reliability: Hacker News (tech-savvy, more specific discussions)
  if (lower === 'hackernews' || lower === 'hacker news' || lower === 'askhn' || lower === 'showhn') {
    return 'medium'
  }

  // Low reliability: Reddit (generic discussions, often hypothetical)
  return 'low'
}

/**
 * Enrich WTP signals with source reliability
 */
function enrichWtpSignals(signals: (string | WtpSignal)[]): (string | WtpSignal)[] {
  return signals.map(signal => {
    if (typeof signal === 'string') {
      return signal  // Legacy string format, can't enrich
    }
    return {
      ...signal,
      sourceReliability: getWtpSourceReliability(signal.source),
    }
  })
}

export interface CompetitorInsight {
  name: string
  type: 'direct_competitor' | 'adjacent_solution' | 'workaround'
  mentionCount: number
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  context: string // Why users mention it
  isActualProduct: boolean // AI-determined if this is a real product/company
  confidence: 'high' | 'medium' | 'low'
}

export interface StrategicRecommendation {
  action: string // Action verb + specific tactic
  rationale: string // Why this recommendation (based on evidence)
}

// WTP signal with source and type info
export interface WtpSignal {
  quote: string
  source: string  // Actual subreddit name like "entrepreneur" or "google_play"
  type: 'explicit' | 'inferred'  // explicit = clear payment language, inferred = AI interpretation
  url?: string  // Original post/comment URL
  sourceReliability?: 'high' | 'medium' | 'low'  // high=app reviews, medium=HN, low=Reddit
}

export interface ThemeAnalysis {
  themes: Theme[]
  customerLanguage: string[]
  alternativesMentioned: string[]
  competitorInsights?: CompetitorInsight[] // Enhanced competitor data
  willingnessToPaySignals: (string | WtpSignal)[]  // Support both legacy strings and new objects
  overallPainScore: number
  keyQuotes: {
    quote: string
    source: string  // Actual subreddit name like "entrepreneur" or "google_play"
    painScore: number
    relevanceScore?: number  // Phase 0: How relevant is this quote to the hypothesis (0-10)
    url?: string  // Original post/comment URL
    isDeleted?: boolean  // Whether the original post was deleted
    // Engagement metrics for data transparency
    upvotes?: number      // Reddit score / HN points / app review thumbsUp
    numComments?: number  // Comment count (Reddit/HN only)
  }[]
  summary: string
  strategicRecommendations?: StrategicRecommendation[] // Actionable next steps
  keyOpportunity?: string // High-signal opportunity based on data
}

/**
 * Extract themes from pain signals using Claude
 */
export async function extractThemes(
  painSignals: PainSignal[],
  hypothesis: string
): Promise<ThemeAnalysis> {
  // Sort signals: CORE first, then RELATED, then untagged
  // This ensures themes are primarily derived from CORE signals
  const sortedSignals = [...painSignals].sort((a, b) => {
    const tierOrder = { CORE: 0, RELATED: 1, undefined: 2 }
    const aOrder = tierOrder[a.tier as keyof typeof tierOrder] ?? 2
    const bOrder = tierOrder[b.tier as keyof typeof tierOrder] ?? 2
    if (aOrder !== bOrder) return aOrder - bOrder
    return b.score - a.score // Secondary sort by score
  })

  // Take top 30 signals for analysis to manage token usage
  const topSignals = sortedSignals.slice(0, 30)

  if (topSignals.length === 0) {
    return getEmptyAnalysis()
  }

  // Count CORE vs RELATED for context
  const coreCount = topSignals.filter(s => s.tier === 'CORE').length
  const relatedCount = topSignals.filter(s => s.tier === 'RELATED').length

  // Helper to get human-readable source name
  const getSourceType = (subreddit: string): string => {
    if (subreddit === 'google_play') return 'Google Play review'
    if (subreddit === 'app_store') return 'App Store review'
    return `r/${subreddit}`
  }

  // Count sources for context
  const redditCount = topSignals.filter(s =>
    s.source.subreddit !== 'google_play' && s.source.subreddit !== 'app_store'
  ).length
  const googlePlayCount = topSignals.filter(s => s.source.subreddit === 'google_play').length
  const appStoreCount = topSignals.filter(s => s.source.subreddit === 'app_store').length

  // Prepare signals for Claude with tier and source information
  const signalTexts = topSignals.map((signal, index) => ({
    index: index + 1,
    tier: signal.tier || 'CORE', // Default to CORE if not specified
    source: getSourceType(signal.source.subreddit),
    subreddit: signal.source.subreddit, // Raw subreddit name for accurate mapping
    url: signal.source.url, // Original post/comment URL
    text: truncateText(signal.text, 500),
    title: signal.title || '',
    painScore: signal.score,
    signals: signal.signals.slice(0, 5).join(', '),
    solutionSeeking: signal.solutionSeeking,
    willingnessToPaySignal: signal.willingnessToPaySignal,
    rating: signal.source.rating, // Include star rating for app store reviews
  }))

  // Build source summary for prompt
  const sourceSummary = []
  if (redditCount > 0) sourceSummary.push(`${redditCount} Reddit posts/comments`)
  if (googlePlayCount > 0) sourceSummary.push(`${googlePlayCount} Google Play reviews`)
  if (appStoreCount > 0) sourceSummary.push(`${appStoreCount} App Store reviews`)

  const systemPrompt = `You are a market research analyst helping entrepreneurs understand customer pain points and needs.

Your task is to analyze user feedback from MULTIPLE SOURCES (Reddit discussions, Google Play reviews, and/or App Store reviews) and extract actionable insights for validating a business hypothesis.

DATA SOURCES:
- Reddit posts/comments: Discussion-style, often detailed context about problems
- Google Play reviews: Android app user feedback, often mentions specific features
- App Store reviews: iOS app user feedback, similar to Google Play
- The "source" field tells you where each piece of feedback came from

SIGNAL TIER SYSTEM:
- CORE signals: Directly about the hypothesis intersection (most valuable - weight heavily)
- RELATED signals: About the general problem space but not the specific context (useful context)
- Prioritize themes that emerge from CORE signals. Label themes derived mainly from RELATED signals as "[CONTEXTUAL]"

CRITICAL REQUIREMENTS FOR THEMES:
- Each theme name MUST be a descriptive phrase of 3-6 words
- Theme names must describe SPECIFIC pain points, not generic categories
- Themes must connect directly to the business hypothesis
- CORE-derived themes should appear FIRST in your list
- If a theme is derived mainly from RELATED signals, prefix with "[CONTEXTUAL] "
- For each theme, track which sources it appears in (reddit, google_play, app_store)

BAD THEME EXAMPLES (NEVER produce these):
- "Pain point: concerns" (too vague, uses bad prefix)
- "Problems" (single word, not descriptive)
- "Issues with things" (too generic)
- Names starting with "Pain point:" prefix

GOOD THEME EXAMPLES:
- "Difficulty finding reliable contractors"
- "Time-consuming manual invoicing process"
- "[CONTEXTUAL] General social anxiety in public spaces"

Focus on:
- Identifying recurring pain themes from CORE signals first (3-6 word descriptive names)
- Tracking which sources (Reddit, Google Play, App Store) each theme appears in
- Extracting the exact language customers use
- Finding mentions of existing solutions, alternatives, competitors, tools, products, or services (be thorough - these are critical for competitive analysis)
- Identifying signals that people would pay for a solution
- Providing 2-3 STRATEGIC RECOMMENDATIONS with specific, actionable tactics
- Identifying a KEY OPPORTUNITY if there's a high-frequency, high-intensity signal

CRITICAL: QUOTE SELECTION CRITERIA (Phase 0 Data Quality Fix)
Select quotes that describe problems THE HYPOTHESIS SOLUTION could plausibly solve.
DO NOT select quotes based only on emotional intensity - they must be RELEVANT.

Quote Value Formula:
- Hypothesis Relevance (60% weight): Does this quote describe a problem the hypothesis addresses?
- Pain Specificity (25% weight): Is the pain specific and actionable (not generic complaining)?
- First-Person Language (15% weight): Is this a firsthand experience ("I struggle with...") not observation?

HARD EXCLUSIONS for quotes:
- Generic complaints without specifics (e.g., "life is hard")
- Problems UNRELATED to the hypothesis (e.g., "$18 to my name" for a meditation app)
- Extreme emotional states unrelated to product category
- Third-person observations (e.g., "People often struggle with...")

GOOD quote examples for "freelancer invoicing tool":
✓ "I spend hours every month chasing invoices" (relevant, specific, first-person)
✓ "My clients pay 30-60 days late and it kills my cash flow" (relevant, specific)
✓ "Tried Wave but it doesn't track time" (relevant, mentions competitor)

BAD quote examples for "freelancer invoicing tool":
✗ "I have $18 to my name" (high pain but NOT about invoicing)
✗ "Freelancing is stressful" (generic, not specific to invoicing)
✗ "Many freelancers struggle with finances" (third-person observation)

When identifying alternatives/competitors:
- Look for product names, tool names, app names, service names
- Include both direct competitors and adjacent solutions
- Include both positive and negative mentions (e.g., "I tried X but it didn't work", "I use Y for this")
- Include generic category terms if no specific names are found (e.g., "spreadsheets", "manual tracking")

STRATEGIC RECOMMENDATIONS should:
- Start with an action verb (Position, Target, Address, Build, Focus on)
- Include a specific tactic (not vague suggestions)
- Reference evidence from the data (e.g., "based on 12 mentions of...")

Be specific and actionable. Avoid generic observations.`

  const userPrompt = `Business Hypothesis: "${hypothesis}"

Analyze these ${topSignals.length} pieces of user feedback (${sourceSummary.join(', ')}, ${coreCount} CORE tier, ${relatedCount} RELATED tier) about problems and needs related to this hypothesis:

${JSON.stringify(signalTexts, null, 2)}

Provide a structured analysis in JSON format:
{
  "themes": [
    {
      "name": "Short theme name (3-6 words)",
      "description": "1-2 sentence description of this pain theme",
      "frequency": <number of posts mentioning this theme>,
      "intensity": "low" | "medium" | "high",
      "examples": ["Brief example 1", "Brief example 2"],
      "sources": ["reddit", "google_play", "app_store"] // which sources this theme appears in
    }
  ],
  "customerLanguage": ["exact phrases customers use to describe their problems"],
  "alternativesMentioned": ["Product Name", "Tool Name", "Service Name" - list ALL products, tools, apps, services, or solutions mentioned in the discussions, even if mentioned negatively],
  "willingnessToPaySignals": [
    {
      "quote": "The exact quote showing willingness to pay",
      "source": "Copy EXACT subreddit value from input (e.g., 'entrepreneur', 'startups', 'google_play')",
      "type": "explicit" or "inferred" - "explicit" = contains payment words (pay, spend, buy, purchase, price, worth, money), "inferred" = AI interpretation of behavior,
      "url": "Copy EXACT url from input data for this quote"
    }
  ],
  "overallPainScore": <0-10 assessment of overall pain intensity>,
  "keyQuotes": [
    {
      "quote": "Quote that is RELEVANT to hypothesis (max 150 chars)",
      "source": "Copy EXACT subreddit value from input (e.g., 'entrepreneur', 'startups', 'google_play')",
      "painScore": <pain score of this quote>,
      "relevanceScore": <0-10 how relevant is this to the hypothesis - MUST be 7+ to include>,
      "url": "Copy EXACT url from input data for this quote"
    }
  ],
  "summary": "2-3 sentence executive summary of the key findings for this hypothesis",
  "strategicRecommendations": [
    {
      "action": "Action verb + specific tactic (e.g., Position around 'hassle-free' messaging)",
      "rationale": "Why this matters based on data (e.g., mentioned 23 times with high frustration)"
    }
  ],
  "keyOpportunity": "One sentence describing the biggest product opportunity identified from the data (only if there's strong signal)"
}

Identify 3-7 themes, 5-10 customer language phrases, 3-5 key quotes, and 2-3 strategic recommendations.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
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
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response with repair capability
    const parsed = parseClaudeJSON<ThemeAnalysis>(textContent.text, 'theme extraction')

    // Validate and clean up the response
    // Parse tier from theme names (Claude prefixes contextual themes with "[CONTEXTUAL]")

    // Build URL -> engagement lookup from painSignals for enrichment
    const engagementByUrl = new Map<string, { upvotes?: number; numComments?: number }>()
    for (const signal of painSignals) {
      if (signal.source.url) {
        engagementByUrl.set(signal.source.url, {
          upvotes: signal.source.upvotes,
          numComments: signal.source.numComments,
        })
      }
    }

    // Enrich AI-returned keyQuotes with engagement data from painSignals
    const enrichedKeyQuotes = (parsed.keyQuotes || []).map(quote => {
      const engagement = quote.url ? engagementByUrl.get(quote.url) : undefined
      return {
        ...quote,
        upvotes: engagement?.upvotes,
        numComments: engagement?.numComments,
      }
    })

    const result: ThemeAnalysis = {
      themes: (parsed.themes || []).map(parseThemeTier),
      customerLanguage: parsed.customerLanguage || [],
      alternativesMentioned: parsed.alternativesMentioned || [],
      willingnessToPaySignals: enrichWtpSignals(parsed.willingnessToPaySignals || []),
      overallPainScore: Math.min(10, Math.max(0, parsed.overallPainScore || 0)),
      keyQuotes: enrichedKeyQuotes,
      summary: parsed.summary || 'Analysis complete.',
      strategicRecommendations: parsed.strategicRecommendations || [],
      keyOpportunity: parsed.keyOpportunity || undefined,
    }

    // Validate theme quality - reject if themes look like word frequencies
    const hasLowQualityThemes = result.themes.some(
      (t) =>
        t.name.startsWith('Pain point:') ||
        t.description.includes('frequently express') ||
        t.description.includes('Users frequently') ||
        /^[A-Za-z]+$/.test(t.name) // Single word only (allows 2+ word themes)
    )

    if (hasLowQualityThemes && result.themes.length > 0) {
      console.warn('Theme extraction produced low-quality results, retrying...')
      // Retry once with explicit instruction
      const retryResult = await retryThemeExtraction(painSignals, hypothesis)

      // Check if retry also produced low-quality themes
      const retryHasLowQuality = retryResult.themes.some(
        (t) =>
          t.name.startsWith('Pain point:') ||
          t.description.includes('frequently express') ||
          t.description.includes('Users frequently') ||
          /^[A-Za-z]+$/.test(t.name) // Single word only (allows 2+ word themes)
      )

      if (retryHasLowQuality || retryResult.themes.length === 0) {
        // Throw error to trigger refund - don't show garbage to users
        throw new Error(
          'Unable to extract meaningful themes from the data. Our AI analysis service may be experiencing issues. Your credit has been refunded.'
        )
      }

      return retryResult
    }

    return result
  } catch (error) {
    // Log detailed error for debugging
    console.error('Theme extraction failed:', error)

    // Provide more specific error messages based on error type
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check for common error patterns
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new Error(
        'Theme analysis rate limited. Your credit has been refunded. Please try again in a few minutes.'
      )
    } else if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
      throw new Error(
        'Theme analysis authentication error. Please contact support.'
      )
    } else if (errorMessage.includes('Could not parse JSON')) {
      throw new Error(
        'Theme analysis parsing error. Your credit has been refunded. Please try again.'
      )
    }

    // Generic fallback with original error details logged
    console.error(`[Theme extraction] Original error: ${errorMessage}`)
    throw new Error(
      'Theme analysis failed. Your credit has been refunded. Please try again later.'
    )
  }
}

/**
 * Get empty analysis for when there are no pain signals
 */
export function getEmptyAnalysis(): ThemeAnalysis {
  return {
    themes: [],
    customerLanguage: [],
    alternativesMentioned: [],
    willingnessToPaySignals: [],
    overallPainScore: 0,
    keyQuotes: [],
    summary: 'No pain signals were found in the analyzed content. Consider broadening your search to more subreddits or adjusting your hypothesis.',
  }
}

/**
 * Get empty analysis with custom message
 */
function getEmptyAnalysisWithMessage(message: string): ThemeAnalysis {
  return {
    themes: [],
    customerLanguage: [],
    alternativesMentioned: [],
    willingnessToPaySignals: [],
    overallPainScore: 0,
    keyQuotes: [],
    summary: message,
  }
}

/**
 * Retry theme extraction with more explicit instructions
 */
async function retryThemeExtraction(
  painSignals: PainSignal[],
  hypothesis: string
): Promise<ThemeAnalysis> {
  const topSignals = painSignals.slice(0, 30)

  const signalTexts = topSignals.map((signal, index) => ({
    index: index + 1,
    text: truncateText(signal.text, 500),
    title: signal.title || '',
    painScore: signal.score,
    subreddit: signal.source.subreddit,
    url: signal.source.url,
  }))

  const systemPrompt = `You are a market research analyst. Your task is to synthesize pain themes from Reddit discussions.

CRITICAL: Each theme must be:
- A descriptive phrase of 3-6 words (NOT single words like "concerns" or "problem")
- A specific pain point, not a generic category
- Connected to the business hypothesis

BAD EXAMPLES (do NOT produce these):
- "Pain point: concerns"
- "Pain point: problem"
- "Users frequently express X"

GOOD EXAMPLES:
- "Difficulty finding reliable contractors"
- "Time-consuming manual invoicing process"
- "Lack of client communication tools"

QUOTE SELECTION: Select quotes RELEVANT to hypothesis (not just high pain).
- Relevance (60%): Does the problem relate to the hypothesis solution?
- Specificity (25%): Is it specific and actionable?
- First-person (15%): Is it firsthand experience?
EXCLUDE: generic complaints, unrelated problems, third-person observations.`

  const userPrompt = `Business Hypothesis: "${hypothesis}"

Analyze these ${topSignals.length} Reddit posts and extract 3-7 SPECIFIC pain themes:

${JSON.stringify(signalTexts, null, 2)}

Return JSON:
{
  "themes": [
    {
      "name": "Descriptive 3-6 word theme name",
      "description": "1-2 sentence description of this specific pain",
      "frequency": <count>,
      "intensity": "low" | "medium" | "high",
      "examples": ["example 1", "example 2"]
    }
  ],
  "customerLanguage": ["exact phrases from posts"],
  "alternativesMentioned": ["products/tools mentioned"],
  "willingnessToPaySignals": [{"quote": "...", "source": "subreddit_name", "type": "explicit"|"inferred", "url": "from input"}],
  "overallPainScore": <0-10>,
  "keyQuotes": [{"quote": "RELEVANT quote", "source": "subreddit_name", "painScore": <n>, "relevanceScore": <0-10, must be 7+>, "url": "from input"}],
  "summary": "2-3 sentence summary",
  "strategicRecommendations": [{"action": "Verb + tactic", "rationale": "Why based on data"}],
  "keyOpportunity": "Biggest opportunity if strong signal exists"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const parsed = parseClaudeJSON<ThemeAnalysis>(textContent.text, 'theme extraction retry')

    // Build URL -> engagement lookup from painSignals for enrichment
    const engagementByUrl = new Map<string, { upvotes?: number; numComments?: number }>()
    for (const signal of painSignals) {
      if (signal.source.url) {
        engagementByUrl.set(signal.source.url, {
          upvotes: signal.source.upvotes,
          numComments: signal.source.numComments,
        })
      }
    }

    // Enrich AI-returned keyQuotes with engagement data
    const enrichedKeyQuotes = (parsed.keyQuotes || []).map(quote => {
      const engagement = quote.url ? engagementByUrl.get(quote.url) : undefined
      return {
        ...quote,
        upvotes: engagement?.upvotes,
        numComments: engagement?.numComments,
      }
    })

    return {
      themes: (parsed.themes || []).map(parseThemeTier),
      customerLanguage: parsed.customerLanguage || [],
      alternativesMentioned: parsed.alternativesMentioned || [],
      willingnessToPaySignals: enrichWtpSignals(parsed.willingnessToPaySignals || []),
      overallPainScore: Math.min(10, Math.max(0, parsed.overallPainScore || 0)),
      keyQuotes: enrichedKeyQuotes,
      summary: parsed.summary || 'Analysis complete.',
      strategicRecommendations: parsed.strategicRecommendations || [],
      keyOpportunity: parsed.keyOpportunity || undefined,
    }
  } catch (error) {
    console.error('Theme extraction retry failed:', error)
    return getEmptyAnalysisWithMessage(
      `Theme analysis could not be completed after retry. Found ${painSignals.length} pain signals but synthesis failed.`
    )
  }
}

/**
 * Generate fallback analysis when Claude fails
 */
function getFallbackAnalysis(
  painSignals: PainSignal[],
  hypothesis: string
): ThemeAnalysis {
  // Extract common words from signals
  const wordFrequency: Record<string, number> = {}
  const allSignals: string[] = []

  for (const signal of painSignals.slice(0, 20)) {
    allSignals.push(...signal.signals)

    // Count words in text
    const words = signal.text.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length > 4) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1
      }
    }
  }

  // Get most common signal keywords
  const signalFrequency: Record<string, number> = {}
  for (const signal of allSignals) {
    signalFrequency[signal] = (signalFrequency[signal] || 0) + 1
  }

  const topSignalKeywords = Object.entries(signalFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword)

  // Build themes from signal keywords
  const themes: Theme[] = topSignalKeywords.map((keyword, index) => ({
    name: `Pain point: ${keyword}`,
    description: `Users frequently express ${keyword} in their discussions.`,
    frequency: signalFrequency[keyword],
    intensity: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
    examples: painSignals
      .filter((s) => s.signals.includes(keyword))
      .slice(0, 2)
      .map((s) => truncateText(s.text, 100)),
  }))

  // Get key quotes with engagement data
  const keyQuotes = painSignals
    .slice(0, 5)
    .map((signal) => ({
      quote: truncateText(signal.text, 150),
      source: signal.source.subreddit,  // Raw subreddit name, formatted by UI
      painScore: signal.score,
      url: signal.source.url,
      // Include engagement metrics for transparency
      upvotes: signal.source.upvotes,
      numComments: signal.source.numComments,
    }))

  // Calculate average pain score
  const avgScore =
    painSignals.length > 0
      ? painSignals.reduce((sum, s) => sum + s.score, 0) / painSignals.length
      : 0

  return {
    themes,
    customerLanguage: topSignalKeywords,
    alternativesMentioned: [],
    willingnessToPaySignals: painSignals
      .filter((s) => s.willingnessToPaySignal)
      .slice(0, 3)
      .map((s) => truncateText(s.text, 100)),
    overallPainScore: Math.round(avgScore * 10) / 10,
    keyQuotes,
    summary: `Analysis found ${painSignals.length} pain signals related to "${hypothesis}". Top pain indicators include ${topSignalKeywords.slice(0, 3).join(', ')}.`,
  }
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Generate interview questions based on theme analysis
 *
 * Phase 0 Data Quality: Added prioritization
 * - Questions ordered by importance (most critical first)
 * - Top 2 questions in each category marked with ⭐ prefix (must-ask)
 * - Questions tied to high-intensity themes get priority
 */
export async function generateInterviewQuestions(
  themeAnalysis: ThemeAnalysis,
  hypothesis: string
): Promise<{
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
}> {
  // Get high-intensity themes to inform prioritization
  const highIntensityThemes = themeAnalysis.themes
    .filter(t => t.intensity === 'high')
    .map(t => t.name)
  const topTheme = themeAnalysis.themes[0]?.name || ''

  const systemPrompt = `You are an expert customer interviewer following "The Mom Test" principles.

Generate interview questions that:
- Focus on past behavior, not hypotheticals
- Avoid leading questions
- Get specific stories and examples
- Uncover the true severity of problems
- Identify current solutions and workarounds

PRIORITIZATION RULES:
1. Questions about HIGH-INTENSITY pain themes come first
2. Questions that can quickly validate/invalidate the hypothesis come first
3. Specific behavior questions beat vague opinion questions
4. Mark the TOP 2 questions in each category with "⭐ " prefix (these are MUST-ASK)
5. Order remaining questions by importance (most important first)`

  const userPrompt = `Based on this research for the hypothesis: "${hypothesis}"

Top Pain Themes (${highIntensityThemes.length > 0 ? `HIGH INTENSITY: ${highIntensityThemes.join(', ')}` : 'none marked high intensity'}):
${themeAnalysis.themes.map((t) => `- ${t.name} (${t.intensity}): ${t.description}`).join('\n')}

Customer Language:
${themeAnalysis.customerLanguage.join(', ')}

Alternatives Mentioned:
${themeAnalysis.alternativesMentioned.join(', ') || 'None identified'}

Generate interview questions in JSON format:
{
  "contextQuestions": ["5 questions ORDERED by importance - first 2 prefixed with ⭐"],
  "problemQuestions": ["5 questions ORDERED by importance - first 2 prefixed with ⭐, focus on ${topTheme || 'top theme'}"],
  "solutionQuestions": ["5 questions ORDERED by importance - first 2 prefixed with ⭐"]
}

CRITICAL:
- Prefix the 2 MOST IMPORTANT questions in each category with "⭐ " (star + space)
- Order all questions by importance (most critical first, nice-to-have last)
- Questions about high-intensity themes (${highIntensityThemes.join(', ') || 'N/A'}) should be prioritized
- Questions should directly relate to the themes and use customer language`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1024,
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
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return parseClaudeJSON<{
      contextQuestions: string[]
      problemQuestions: string[]
      solutionQuestions: string[]
    }>(textContent.text, 'interview questions')
  } catch (error) {
    console.error('Interview question generation failed:', error)
    return getFallbackQuestions(themeAnalysis)
  }
}

/**
 * Fallback interview questions (with prioritization markers)
 */
function getFallbackQuestions(themeAnalysis: ThemeAnalysis): {
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
} {
  const topTheme = themeAnalysis.themes[0]?.name || 'this topic'

  return {
    contextQuestions: [
      '⭐ Tell me about your typical day/week related to this area.',
      '⭐ How long have you been dealing with this?',
      'What first got you interested in solving this problem?',
      'Who else in your life is affected by this?',
      'What does success look like for you in this area?',
    ],
    problemQuestions: [
      `⭐ When was the last time you experienced ${topTheme}? Walk me through what happened.`,
      '⭐ What have you tried so far to solve this problem?',
      'How much time/money have you spent trying to fix this?',
      'What would happen if you never solved this problem?',
      "What's the most frustrating part of dealing with this?",
    ],
    solutionQuestions: [
      '⭐ If you could wave a magic wand, what would the ideal solution look like?',
      '⭐ What would make you switch from your current approach?',
      'How much would you expect to pay for something that solved this?',
      'Who would you want to build this solution?',
      'What features would be must-haves vs nice-to-haves?',
    ],
  }
}

// =============================================================================
// TIERED FILTER INTEGRATION (Phase 2)
// =============================================================================

import { TieredSignals, TieredScoredSignal, getSignalsForAnalysis } from '@/lib/filter'

/**
 * Extract themes from TieredSignals (Phase 2 tiered filter integration).
 *
 * Uses CORE + STRONG signals only for theme extraction, with source weighting.
 * This is the preferred entry point when USE_TIERED_FILTER = true.
 *
 * @param tieredSignals - Output from filterSignalsTiered()
 * @param hypothesis - Business hypothesis
 * @returns ThemeAnalysis with source-weighted themes
 */
export async function extractThemesFromTiered(
  tieredSignals: TieredSignals,
  hypothesis: string
): Promise<ThemeAnalysis> {
  // Get CORE + STRONG signals for analysis
  const signalsForAnalysis = getSignalsForAnalysis(tieredSignals)

  if (signalsForAnalysis.length === 0) {
    return getEmptyAnalysis()
  }

  // Convert TieredScoredSignal to PainSignal format
  const painSignals = signalsForAnalysis.map((signal) => convertToPainSignal(signal))

  // Sort by weighted score (embedding score * source weight * tier weight)
  painSignals.sort((a, b) => b.score - a.score)

  // Use existing extractThemes with converted signals
  return extractThemes(painSignals, hypothesis)
}

/**
 * Convert a TieredScoredSignal to PainSignal format for theme extraction.
 * Applies tier and source weighting to the score.
 */
function convertToPainSignal(signal: TieredScoredSignal): PainSignal {
  const post = signal.post

  // Calculate weighted score
  // Tier weight: CORE = 1.0, STRONG = 0.7
  const tierWeight = signal.tier === 'core' ? 1.0 : 0.7
  const weightedScore = signal.score * signal.sourceWeight * tierWeight

  // Detect WTP keywords
  const text = `${post.title} ${post.body}`.toLowerCase()
  const wtpKeywords = ['would pay', 'willing to pay', 'take my money', 'worth paying', 'paid for']
  const hasWtp = wtpKeywords.some(kw => text.includes(kw))

  // Detect pain signals from text
  const painIndicators = detectPainIndicators(text)

  // Determine intensity from score
  const intensity: 'low' | 'medium' | 'high' =
    weightedScore >= 0.6 ? 'high' : weightedScore >= 0.4 ? 'medium' : 'low'

  // Determine WTP confidence from source weight
  const wtpConfidence: 'none' | 'low' | 'medium' | 'high' =
    !hasWtp ? 'none' :
    signal.wtpWeight >= 0.8 ? 'high' :
    signal.wtpWeight >= 0.5 ? 'medium' : 'low'

  // Determine primary emotion from pain indicators
  // EmotionType: 'frustration' | 'anxiety' | 'disappointment' | 'confusion' | 'hope' | 'neutral'
  const emotion: 'frustration' | 'anxiety' | 'disappointment' | 'confusion' | 'hope' | 'neutral' =
    painIndicators.includes('frustration') ? 'frustration' :
    painIndicators.includes('strong_negative') ? 'frustration' :
    painIndicators.includes('struggle') ? 'frustration' :
    painIndicators.includes('difficulty') ? 'confusion' :
    painIndicators.includes('annoyance') ? 'disappointment' :
    painIndicators.includes('wish') ? 'hope' : 'neutral'

  return {
    text: post.body || post.title,
    title: post.title,
    score: weightedScore,
    intensity,
    signals: painIndicators,
    solutionSeeking: text.includes('looking for') || text.includes('need') || text.includes('want'),
    willingnessToPaySignal: hasWtp,
    wtpConfidence,
    wtpSourceReliability: signal.wtpWeight >= 0.8 ? 'high' : signal.wtpWeight >= 0.5 ? 'medium' : 'low',
    tier: signal.tier.toUpperCase() as 'CORE' | 'RELATED',
    emotion,
    source: {
      type: 'post' as const,
      id: post.id,
      subreddit: getSourceName(post),
      author: (post.metadata?.author as string) || 'unknown',
      url: (post.metadata?.url as string) || '',
      createdUtc: post.timestamp.getTime() / 1000,
      engagementScore: (post.metadata?.score as number) || 0,
      rating: post.metadata?.rating as number | undefined,
      upvotes: post.metadata?.score as number | undefined,
      numComments: post.metadata?.numComments as number | undefined,
    },
  }
}

/**
 * Get human-readable source name from post.
 */
function getSourceName(post: TieredScoredSignal['post']): string {
  if (post.source === 'appstore') return 'app_store'
  if (post.source === 'playstore') return 'google_play'
  if (post.source === 'reddit' && post.metadata?.subreddit) {
    return post.metadata.subreddit as string
  }
  return post.source
}

/**
 * Detect pain indicators in text.
 */
function detectPainIndicators(text: string): string[] {
  const indicators: string[] = []

  const patterns: { pattern: RegExp; label: string }[] = [
    { pattern: /frustrat/i, label: 'frustration' },
    { pattern: /annoying|annoy/i, label: 'annoyance' },
    { pattern: /struggle|struggling/i, label: 'struggle' },
    { pattern: /difficult|hard to/i, label: 'difficulty' },
    { pattern: /waste|wasting/i, label: 'waste' },
    { pattern: /expensive|cost/i, label: 'cost_concern' },
    { pattern: /time.consuming|takes too long/i, label: 'time_consuming' },
    { pattern: /broken|doesn't work/i, label: 'broken' },
    { pattern: /hate|can't stand/i, label: 'strong_negative' },
    { pattern: /wish|if only/i, label: 'wish' },
  ]

  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) {
      indicators.push(label)
    }
  }

  return indicators
}

