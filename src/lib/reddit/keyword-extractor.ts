// Keyword Extractor Module
// Extracts hypothesis-specific keywords for better search precision
// CRITICAL: Only extracts from audience/problem fields, NEVER from solution

import Anthropic from '@anthropic-ai/sdk'
import { getCurrentTracker } from '@/lib/anthropic'
import { trackUsage } from '@/lib/analysis/token-tracker'
import { StructuredHypothesis, formatHypothesisForSearch } from '@/types/research'

const anthropic = new Anthropic()

export interface ExtractedKeywords {
  primary: string[]   // Must match (specific to problem domain)
  secondary: string[] // Nice to have (related terms)
  exclude: string[]   // Filter out if present (off-topic indicators)
}

/**
 * Extracts hypothesis-specific keywords for searching.
 * Uses Claude Haiku for cost efficiency.
 *
 * CRITICAL: When structured hypothesis is provided, we ONLY extract from:
 * - audience field
 * - problem field
 * - problemLanguage field
 * We NEVER include terms from the solution field to prevent polluting search results.
 *
 * @param hypothesis - The business hypothesis string (may contain solution words - avoid if possible)
 * @param structuredHypothesis - Optional structured hypothesis (preferred - excludes solution)
 * @returns Keywords categorized as primary, secondary, and exclude
 */
export async function extractSearchKeywords(
  hypothesis: string,
  structuredHypothesis?: StructuredHypothesis
): Promise<ExtractedKeywords> {
  // CRITICAL: Use search-optimized context when structured hypothesis available
  // This excludes solution field which would pollute search results
  const searchContext = structuredHypothesis
    ? formatHypothesisForSearch(structuredHypothesis)
    : hypothesis
  const prompt = `Extract search keywords from this business hypothesis for Reddit search.

HYPOTHESIS: "${searchContext}"

Your task:
1. PRIMARY keywords (2-4): The most distinctive 1-2 word terms that identify THIS SPECIFIC problem domain. These will be used for search, so pick words that are:
   - Unique to this domain (not generic like "app", "tool", "help")
   - Likely to appear in Reddit post titles or bodies
   - Concrete nouns or compound terms (e.g., "meal prep", "invoice", "remote work")

2. SECONDARY keywords (3-5): Related activity or pain words. These help identify relevant discussions.

3. EXCLUDE keywords (3-5): Terms that would make a post CLEARLY off-topic, even if it contains primary keywords. Be specific.

CRITICAL RULES:
- PRIMARY keywords should be 1-2 words maximum, not phrases
- Avoid vague words: "struggle", "need", "want", "help", "problem", "solution", "app", "tool", "startup", "entrepreneur", "business"
- For "workout app for entrepreneurs short on time":
  - GOOD primary: ["workout", "exercise", "fitness"]
  - BAD primary: ["entrepreneurs", "short on time", "busy schedule"] - these are too vague
- Think: "What NOUN describes the activity or domain?"

Example for "Tool to help freelance designers manage client invoices":
- PRIMARY: ["invoice", "freelance", "client payment"]
- SECONDARY: ["billing", "contract", "overdue", "accounts receivable"]
- EXCLUDE: ["job posting", "salary", "full-time", "employee benefits"]

Respond with JSON only:
{
  "primary": ["keyword1", "keyword2", ...],
  "secondary": ["keyword1", "keyword2", ...],
  "exclude": ["keyword1", "keyword2", ...]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    // Track token usage
    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const content = response.content[0]
    if (content.type !== 'text') {
      console.warn('Keyword extraction: unexpected response type')
      return getDefaultKeywords(searchContext)
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('Keyword extraction: could not parse JSON response')
      return getDefaultKeywords(searchContext)
    }

    const result = JSON.parse(jsonMatch[0]) as ExtractedKeywords

    // Validate the result has required fields
    if (!result.primary || !Array.isArray(result.primary)) {
      console.warn('Keyword extraction: invalid primary keywords')
      return getDefaultKeywords(searchContext)
    }

    return {
      primary: result.primary.slice(0, 6),
      secondary: (result.secondary || []).slice(0, 6),
      exclude: (result.exclude || []).slice(0, 4),
    }
  } catch (error) {
    console.error('Keyword extraction failed:', error)
    return getDefaultKeywords(searchContext)
  }
}

/**
 * Fallback keyword extraction using simple word extraction
 */
function getDefaultKeywords(hypothesis: string): ExtractedKeywords {
  // Simple extraction: get significant words from hypothesis
  const words = hypothesis
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['with', 'that', 'this', 'from', 'have', 'will', 'been', 'were', 'they', 'their', 'about', 'would', 'could', 'should'].includes(w))

  return {
    primary: words.slice(0, 5),
    secondary: [],
    exclude: [],
  }
}

/**
 * Pre-filters posts using exclude keywords before expensive relevance filtering
 * This is a cheap local operation that reduces the number of posts sent to Claude
 *
 * @param posts - Array of posts to filter
 * @param excludeKeywords - Keywords that indicate off-topic content
 * @returns Posts that don't contain exclude keywords
 */
export function preFilterByExcludeKeywords<T extends { title?: string; body?: string }>(
  posts: T[],
  excludeKeywords: string[]
): T[] {
  if (excludeKeywords.length === 0) return posts

  return posts.filter(post => {
    const content = ((post.title || '') + ' ' + (post.body || '')).toLowerCase()
    return !excludeKeywords.some(keyword =>
      content.includes(keyword.toLowerCase())
    )
  })
}
