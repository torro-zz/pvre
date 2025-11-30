// Theme Extractor
// Uses Claude to synthesize themes from pain signals

import { anthropic } from '../anthropic'
import { PainSignal } from './pain-detector'

export interface Theme {
  name: string
  description: string
  frequency: number
  intensity: 'low' | 'medium' | 'high'
  examples: string[]
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

export interface ThemeAnalysis {
  themes: Theme[]
  customerLanguage: string[]
  alternativesMentioned: string[]
  competitorInsights?: CompetitorInsight[] // Enhanced competitor data
  willingnessToPaySignals: string[]
  overallPainScore: number
  keyQuotes: {
    quote: string
    source: string
    painScore: number
  }[]
  summary: string
}

/**
 * Extract themes from pain signals using Claude
 */
export async function extractThemes(
  painSignals: PainSignal[],
  hypothesis: string
): Promise<ThemeAnalysis> {
  // Take top 30 signals for analysis to manage token usage
  const topSignals = painSignals.slice(0, 30)

  if (topSignals.length === 0) {
    return getEmptyAnalysis()
  }

  // Prepare signals for Claude
  const signalTexts = topSignals.map((signal, index) => ({
    index: index + 1,
    text: truncateText(signal.text, 500),
    title: signal.title || '',
    painScore: signal.score,
    subreddit: signal.source.subreddit,
    signals: signal.signals.slice(0, 5).join(', '),
    solutionSeeking: signal.solutionSeeking,
    willingnessToPaySignal: signal.willingnessToPaySignal,
  }))

  const systemPrompt = `You are a market research analyst helping entrepreneurs understand customer pain points and needs.

Your task is to analyze Reddit posts/comments and extract actionable insights for validating a business hypothesis.

Focus on:
- Identifying recurring pain themes
- Extracting the exact language customers use
- Finding mentions of existing solutions, alternatives, competitors, tools, products, or services (be thorough - these are critical for competitive analysis)
- Identifying signals that people would pay for a solution
- Selecting powerful quotes that illustrate key pain points

When identifying alternatives/competitors:
- Look for product names, tool names, app names, service names
- Include both direct competitors and adjacent solutions
- Include both positive and negative mentions (e.g., "I tried X but it didn't work", "I use Y for this")
- Include generic category terms if no specific names are found (e.g., "spreadsheets", "manual tracking")

Be specific and actionable. Avoid generic observations.`

  const userPrompt = `Business Hypothesis: "${hypothesis}"

Analyze these ${topSignals.length} Reddit posts/comments about problems and needs related to this hypothesis:

${JSON.stringify(signalTexts, null, 2)}

Provide a structured analysis in JSON format:
{
  "themes": [
    {
      "name": "Short theme name (3-6 words)",
      "description": "1-2 sentence description of this pain theme",
      "frequency": <number of posts mentioning this theme>,
      "intensity": "low" | "medium" | "high",
      "examples": ["Brief example 1", "Brief example 2"]
    }
  ],
  "customerLanguage": ["exact phrases customers use to describe their problems"],
  "alternativesMentioned": ["Product Name", "Tool Name", "Service Name" - list ALL products, tools, apps, services, or solutions mentioned in the discussions, even if mentioned negatively],
  "willingnessToPaySignals": ["quotes or signals showing people would pay for a solution"],
  "overallPainScore": <0-10 assessment of overall pain intensity>,
  "keyQuotes": [
    {
      "quote": "Powerful quote from the data (max 150 chars)",
      "source": "r/subreddit",
      "painScore": <pain score of this quote>
    }
  ],
  "summary": "2-3 sentence executive summary of the key findings for this hypothesis"
}

Identify 3-7 themes, 5-10 customer language phrases, and 3-5 key quotes.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    })

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as ThemeAnalysis

    // Validate and clean up the response
    return {
      themes: parsed.themes || [],
      customerLanguage: parsed.customerLanguage || [],
      alternativesMentioned: parsed.alternativesMentioned || [],
      willingnessToPaySignals: parsed.willingnessToPaySignals || [],
      overallPainScore: Math.min(10, Math.max(0, parsed.overallPainScore || 0)),
      keyQuotes: parsed.keyQuotes || [],
      summary: parsed.summary || 'Analysis complete.',
    }
  } catch (error) {
    console.error('Theme extraction failed:', error)
    // Return fallback analysis based on pain signals
    return getFallbackAnalysis(painSignals, hypothesis)
  }
}

/**
 * Get empty analysis for when there are no pain signals
 */
function getEmptyAnalysis(): ThemeAnalysis {
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

  // Get key quotes
  const keyQuotes = painSignals
    .slice(0, 5)
    .map((signal) => ({
      quote: truncateText(signal.text, 150),
      source: `r/${signal.source.subreddit}`,
      painScore: signal.score,
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
 */
export async function generateInterviewQuestions(
  themeAnalysis: ThemeAnalysis,
  hypothesis: string
): Promise<{
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
}> {
  const systemPrompt = `You are an expert customer interviewer following "The Mom Test" principles.

Generate interview questions that:
- Focus on past behavior, not hypotheticals
- Avoid leading questions
- Get specific stories and examples
- Uncover the true severity of problems
- Identify current solutions and workarounds`

  const userPrompt = `Based on this research for the hypothesis: "${hypothesis}"

Top Pain Themes:
${themeAnalysis.themes.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Customer Language:
${themeAnalysis.customerLanguage.join(', ')}

Alternatives Mentioned:
${themeAnalysis.alternativesMentioned.join(', ') || 'None identified'}

Generate interview questions in JSON format:
{
  "contextQuestions": ["5 questions to understand the person's context and background"],
  "problemQuestions": ["5 questions to explore the problem deeply"],
  "solutionQuestions": ["5 questions to test solution ideas without leading"]
}

Questions should directly relate to the themes and use customer language where appropriate.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response')
    }

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Interview question generation failed:', error)
    return getFallbackQuestions(themeAnalysis)
  }
}

/**
 * Fallback interview questions
 */
function getFallbackQuestions(themeAnalysis: ThemeAnalysis): {
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
} {
  const topTheme = themeAnalysis.themes[0]?.name || 'this topic'

  return {
    contextQuestions: [
      'Tell me about your typical day/week related to this area.',
      'How long have you been dealing with this?',
      'What first got you interested in solving this problem?',
      'Who else in your life is affected by this?',
      'What does success look like for you in this area?',
    ],
    problemQuestions: [
      `When was the last time you experienced ${topTheme}? Walk me through what happened.`,
      'What have you tried so far to solve this problem?',
      'How much time/money have you spent trying to fix this?',
      'What would happen if you never solved this problem?',
      "What's the most frustrating part of dealing with this?",
    ],
    solutionQuestions: [
      'If you could wave a magic wand, what would the ideal solution look like?',
      'What would make you switch from your current approach?',
      'How much would you expect to pay for something that solved this?',
      'Who would you want to build this solution?',
      'What features would be must-haves vs nice-to-haves?',
    ],
  }
}
