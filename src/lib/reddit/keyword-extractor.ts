// Keyword Extractor Module
// Extracts hypothesis-specific keywords for better search precision

import Anthropic from '@anthropic-ai/sdk'
import { getCurrentTracker } from '@/lib/anthropic'
import { trackUsage } from '@/lib/analysis/token-tracker'

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
 * @param hypothesis - The business hypothesis to extract keywords from
 * @returns Keywords categorized as primary, secondary, and exclude
 */
export async function extractSearchKeywords(
  hypothesis: string
): Promise<ExtractedKeywords> {
  const prompt = `Extract search keywords from this business hypothesis.

HYPOTHESIS: "${hypothesis}"

Your task:
1. PRIMARY keywords (3-5): Specific nouns and phrases that MUST appear in relevant posts. These should directly relate to the PROBLEM or DOMAIN.
2. SECONDARY keywords (3-5): Related terms that indicate relevance. These can be synonyms, related activities, or context words.
3. EXCLUDE keywords (2-3): Terms that indicate OFF-TOPIC posts. These help filter out noise.

Rules:
- Be SPECIFIC to this hypothesis
- Avoid generic business words: "startup", "business", "app", "solution", "help", "problem"
- Focus on the PROBLEM domain and USER activities
- Include specific pain language related to this domain
- Think about what words would appear in a Reddit post from someone experiencing this problem

Example for "App to find quiet cafes for remote work":
- PRIMARY: ["quiet cafe", "coworking space", "work from cafe", "workspace finder", "remote work spot"]
- SECONDARY: ["wifi cafe", "laptop friendly", "noise level", "digital nomad", "focus spot"]
- EXCLUDE: ["coffee recipe", "barista job", "coffee beans", "home office setup"]

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
      return getDefaultKeywords(hypothesis)
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('Keyword extraction: could not parse JSON response')
      return getDefaultKeywords(hypothesis)
    }

    const result = JSON.parse(jsonMatch[0]) as ExtractedKeywords

    // Validate the result has required fields
    if (!result.primary || !Array.isArray(result.primary)) {
      console.warn('Keyword extraction: invalid primary keywords')
      return getDefaultKeywords(hypothesis)
    }

    return {
      primary: result.primary.slice(0, 6),
      secondary: (result.secondary || []).slice(0, 6),
      exclude: (result.exclude || []).slice(0, 4),
    }
  } catch (error) {
    console.error('Keyword extraction failed:', error)
    return getDefaultKeywords(hypothesis)
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
