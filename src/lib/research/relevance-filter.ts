/**
 * 3-Stage Relevance Filter
 *
 * Stage 1 (Domain Gate): Fast AI filter - "Is this post about [domain]?"
 * Stage 2 (Problem Match): Detailed filter - "Does this discuss THIS SPECIFIC problem?"
 * Stage 3 (Quality Gate): Code-only filters - removed/deleted, short, non-English, spam
 *
 * Expected outcomes:
 * - Stage 3 filters 10-20% (garbage removal, no AI cost)
 * - Stage 1 filters 60-70% of remainder (domain mismatch, cheap AI)
 * - Stage 2 filters 30-40% of remainder (problem mismatch)
 * - Final: ~15-25% of original posts retained, but HIGH QUALITY
 */

import Anthropic from '@anthropic-ai/sdk'
import { RedditPost, RedditComment } from '@/lib/data-sources'
import { StructuredHypothesis } from '@/types/research'
import { getCurrentTracker } from '@/lib/anthropic'
import { trackUsage } from '@/lib/analysis/token-tracker'

const anthropic = new Anthropic()

export interface RelevanceDecision {
  reddit_id: string
  title?: string
  body_preview: string
  subreddit: string
  decision: 'Y' | 'N'
  stage?: 'quality' | 'domain' | 'problem'
  reason?: string
}

export interface FilterMetrics {
  before: number
  after: number
  filteredOut: number
  filterRate: number
  stage3Filtered: number  // Quality gate
  stage1Filtered: number  // Domain gate
  stage2Filtered: number  // Problem match
}

export interface FilterResult<T> {
  items: T[]
  metrics: FilterMetrics
  decisions: RelevanceDecision[]
}

// ============================================================================
// STAGE 3: Quality Gate (Code-Only Filters) - Run FIRST
// ============================================================================

const SPAM_PATTERNS = [
  /\b(free|discount|promo|sale|limited time|act now|click here)\b/i,
  /\b(subscribe|follow me|check out my|my youtube|my channel)\b/i,
  /\b(dm me|message me|link in bio)\b/i,
]

const REMOVED_PATTERNS = [
  '[removed]',
  '[deleted]',
  '[unavailable]',
]

/**
 * Detect if text is primarily non-English
 * Uses a simple heuristic: if >30% of characters are non-ASCII letters, likely non-English
 */
function isLikelyNonEnglish(text: string): boolean {
  if (!text || text.length < 20) return false

  // Count non-ASCII letters (excluding punctuation, numbers, spaces)
  const letters = text.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g, '')
  const nonAsciiLetters = letters.replace(/[a-zA-Z]/g, '')

  // If more than 30% non-ASCII letters, likely non-English
  return letters.length > 0 && (nonAsciiLetters.length / letters.length) > 0.3
}

/**
 * Check if post body contains spam patterns
 */
function hasSpamPatterns(title: string, body: string): boolean {
  const combined = `${title} ${body}`.toLowerCase()
  return SPAM_PATTERNS.some(pattern => pattern.test(combined))
}

/**
 * Check if post body is removed/deleted
 */
function isRemovedOrDeleted(body: string): boolean {
  const trimmed = (body || '').trim().toLowerCase()
  return REMOVED_PATTERNS.some(pattern => trimmed === pattern.toLowerCase() || trimmed.startsWith(pattern.toLowerCase()))
}

/**
 * Stage 3: Quality Gate - Fast code-only filtering
 * Removes garbage posts before any AI processing
 */
export function qualityGateFilter<T extends RedditPost | RedditComment>(
  items: T[],
  minBodyLength: number = 50
): { passed: T[]; filtered: T[]; decisions: RelevanceDecision[] } {
  const passed: T[] = []
  const filtered: T[] = []
  const decisions: RelevanceDecision[] = []

  for (const item of items) {
    const isPost = 'title' in item
    const body = isPost ? (item as RedditPost).body || '' : (item as RedditComment).body
    const title = isPost ? (item as RedditPost).title : ''

    let filterReason: string | null = null

    // Check 1: Removed/deleted content
    if (isRemovedOrDeleted(body)) {
      filterReason = 'removed_deleted'
    }
    // Check 2: Too short (less meaningful content)
    else if (body.length < minBodyLength) {
      filterReason = 'too_short'
    }
    // Check 3: Non-English content
    else if (isLikelyNonEnglish(body) || (title && isLikelyNonEnglish(title))) {
      filterReason = 'non_english'
    }
    // Check 4: Spam patterns
    else if (hasSpamPatterns(title, body)) {
      filterReason = 'spam'
    }

    if (filterReason) {
      filtered.push(item)
      decisions.push({
        reddit_id: item.id,
        title: isPost ? (item as RedditPost).title : undefined,
        body_preview: body.slice(0, 200),
        subreddit: item.subreddit,
        decision: 'N',
        stage: 'quality',
        reason: filterReason,
      })
    } else {
      passed.push(item)
    }
  }

  return { passed, filtered, decisions }
}

// ============================================================================
// STAGE 1: Domain Gate (Fast AI Filter)
// ============================================================================

/**
 * Extract the primary problem domain from a hypothesis
 * This is used for fast domain-level filtering
 */
export async function extractProblemDomain(
  hypothesis: string,
  structured?: StructuredHypothesis
): Promise<{ domain: string; antiDomains: string[] }> {
  // If we have structured input, use it to extract domain
  const contextText = structured
    ? `Audience: ${structured.audience}\nProblem: ${structured.problem}`
    : hypothesis

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Extract the PRIMARY PROBLEM DOMAIN from this business hypothesis.

${contextText}

The domain should be 1-3 words describing what topic/category the PROBLEM is about.
NOT the audience demographic - the actual problem category.

Examples:
- "Men in 50s struggling with aging skin" → domain: "skincare" or "skin aging"
- "Busy parents with picky eaters" → domain: "meal planning" or "child nutrition"
- "Remote workers with back pain" → domain: "ergonomics" or "back pain"

Also list 3-5 UNRELATED domains that might appear due to audience overlap but are NOT relevant.

Return JSON only:
{
  "domain": "primary problem domain",
  "antiDomains": ["unrelated domain 1", "unrelated domain 2", ...]
}`,
    }],
  })

  const tracker = getCurrentTracker()
  if (tracker && response.usage) {
    trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
  }

  const content = response.content[0]
  if (content.type !== 'text') {
    return { domain: '', antiDomains: [] }
  }

  try {
    const match = content.text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        domain: parsed.domain || '',
        antiDomains: parsed.antiDomains || [],
      }
    }
  } catch {
    console.warn('[extractProblemDomain] Failed to parse response:', content.text)
  }

  return { domain: '', antiDomains: [] }
}

/**
 * Stage 1: Domain Gate - Fast AI filter using extracted domain
 * Asks simple question: "Is this post about [domain]?"
 */
export async function domainGateFilter(
  posts: RedditPost[],
  domain: string,
  antiDomains: string[],
  sendProgress?: (msg: string) => void
): Promise<{ passed: RedditPost[]; filtered: RedditPost[]; decisions: RelevanceDecision[] }> {
  if (posts.length === 0 || !domain) {
    return { passed: posts, filtered: [], decisions: [] }
  }

  sendProgress?.(`Domain gate: checking ${posts.length} posts for "${domain}" relevance...`)

  const passed: RedditPost[] = []
  const filtered: RedditPost[] = []
  const decisions: RelevanceDecision[] = []

  // Process in larger batches since this is a simpler check
  const batchSize = 50

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const postSummaries = batch.map((post, idx) => {
      const body = (post.body || '').slice(0, 100)
      return `[${idx + 1}] ${post.title}${body ? ' - ' + body : ''}`
    }).join('\n')

    const antiDomainList = antiDomains.length > 0
      ? `\nREJECT posts about: ${antiDomains.join(', ')}`
      : ''

    const prompt = `DOMAIN CHECK: Is each post about "${domain}"?
${antiDomainList}

Posts:
${postSummaries}

Rules:
- Y = post discusses ${domain} (even tangentially)
- N = post is about something else (relationships, career, fitness, etc.)
- Be STRICT: when in doubt, say N

Respond with exactly ${batch.length} letters (Y or N), one per post:`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        const results = content.text.trim().toUpperCase().replace(/[^YN]/g, '')

        batch.forEach((post, idx) => {
          const decision = results[idx] === 'Y' ? 'Y' : 'N'
          if (decision === 'Y') {
            passed.push(post)
          } else {
            filtered.push(post)
            decisions.push({
              reddit_id: post.id,
              title: post.title,
              body_preview: (post.body || '').slice(0, 200),
              subreddit: post.subreddit,
              decision: 'N',
              stage: 'domain',
              reason: `not about ${domain}`,
            })
          }
        })
      }
    } catch (error) {
      console.error('[domainGateFilter] Batch failed, passing all:', error)
      passed.push(...batch)
    }
  }

  sendProgress?.(`Domain gate: ${passed.length}/${posts.length} posts passed (${filtered.length} filtered)`)
  return { passed, filtered, decisions }
}

// ============================================================================
// STAGE 2: Problem Match (Detailed Filter)
// ============================================================================

/**
 * Stage 2: Problem Match - Detailed relevance filter
 * For posts that passed domain gate, check if they discuss the SPECIFIC problem
 */
export async function problemMatchFilter(
  posts: RedditPost[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  sendProgress?: (msg: string) => void
): Promise<{ passed: RedditPost[]; filtered: RedditPost[]; decisions: RelevanceDecision[] }> {
  if (posts.length === 0) {
    return { passed: [], filtered: [], decisions: [] }
  }

  sendProgress?.(`Problem match: analyzing ${posts.length} posts for specific problem relevance...`)

  const passed: RedditPost[] = []
  const filtered: RedditPost[] = []
  const decisions: RelevanceDecision[] = []

  const batchSize = 20

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const postSummaries = batch.map((post, idx) => {
      const body = (post.body || '').slice(0, 150)
      return `[${idx + 1}] ${post.title}${body ? '\n' + body : ''}`
    }).join('\n\n')

    // Build detailed context from structured hypothesis
    const contextSection = structured ? `
TARGET AUDIENCE: ${structured.audience}
SPECIFIC PROBLEM: ${structured.problem}${structured.problemLanguage ? `
PHRASES TO LOOK FOR: ${structured.problemLanguage}` : ''}${structured.excludeTopics ? `
EXCLUDE POSTS ABOUT: ${structured.excludeTopics}` : ''}
` : ''

    const prompt = `PROBLEM MATCH: Does each post discuss THIS SPECIFIC problem?

${contextSection}HYPOTHESIS: "${hypothesis}"

CRITICAL: Match the PROBLEM, not just the audience.
- "Men in 50s with aging skin" → match posts about SKINCARE/AGING, not posts about dating or career
- Same person might post about many topics; only the problem-relevant posts matter

RELEVANT (Y):
- Post discusses the specific problem (${structured?.problem || 'the hypothesis problem'})
- Post is from someone experiencing this problem firsthand
- Post contains pain signals related to this exact issue

NOT RELEVANT (N):
- Post is from right audience but WRONG problem (e.g., skincare audience but post about dating)
- Post mentions keywords but isn't actually about the problem
- Post is asking for advice about unrelated issues${structured?.excludeTopics ? `
- Post is about: ${structured.excludeTopics}` : ''}

POSTS:
${postSummaries}

Respond with exactly ${batch.length} letters (Y or N):`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        const results = content.text.trim().toUpperCase().replace(/[^YN]/g, '')

        batch.forEach((post, idx) => {
          const decision = results[idx] === 'Y' ? 'Y' : 'N'
          if (decision === 'Y') {
            passed.push(post)
          } else {
            filtered.push(post)
            decisions.push({
              reddit_id: post.id,
              title: post.title,
              body_preview: (post.body || '').slice(0, 200),
              subreddit: post.subreddit,
              decision: 'N',
              stage: 'problem',
              reason: 'wrong problem',
            })
          }
        })
      }
    } catch (error) {
      console.error('[problemMatchFilter] Batch failed, passing all:', error)
      passed.push(...batch)
    }
  }

  sendProgress?.(`Problem match: ${passed.length}/${posts.length} posts passed (${filtered.length} filtered)`)
  return { passed, filtered, decisions }
}

// ============================================================================
// MAIN ENTRY POINT: 3-Stage Filter Pipeline
// ============================================================================

/**
 * Run the complete 3-stage relevance filter pipeline
 *
 * @param posts - Posts to filter
 * @param hypothesis - Business hypothesis string
 * @param structured - Structured hypothesis (optional, improves accuracy)
 * @param sendProgress - Progress callback (optional)
 * @returns Filtered posts with metrics and decisions
 */
export async function filterRelevantPosts(
  posts: RedditPost[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  sendProgress?: (msg: string, data?: Record<string, unknown>) => void
): Promise<FilterResult<RedditPost>> {
  const allDecisions: RelevanceDecision[] = []
  const metrics: FilterMetrics = {
    before: posts.length,
    after: 0,
    filteredOut: 0,
    filterRate: 0,
    stage3Filtered: 0,
    stage1Filtered: 0,
    stage2Filtered: 0,
  }

  if (posts.length === 0) {
    return { items: [], metrics, decisions: [] }
  }

  sendProgress?.(`Starting 3-stage relevance filter on ${posts.length} posts...`)

  // STAGE 3: Quality Gate (run first - free, removes garbage)
  const stage3 = qualityGateFilter(posts, 50)
  metrics.stage3Filtered = stage3.filtered.length
  allDecisions.push(...stage3.decisions)
  sendProgress?.(`Stage 3 (Quality): ${stage3.filtered.length} posts filtered (removed/short/non-English/spam)`)

  if (stage3.passed.length === 0) {
    metrics.after = 0
    metrics.filteredOut = metrics.before
    metrics.filterRate = 100
    return { items: [], metrics, decisions: allDecisions }
  }

  // STAGE 1: Domain Gate (fast, cheap AI filter)
  const { domain, antiDomains } = await extractProblemDomain(hypothesis, structured)
  sendProgress?.(`Extracted problem domain: "${domain}"`)

  const stage1 = await domainGateFilter(
    stage3.passed,
    domain,
    antiDomains,
    sendProgress
  )
  metrics.stage1Filtered = stage1.filtered.length
  allDecisions.push(...stage1.decisions)

  if (stage1.passed.length === 0) {
    metrics.after = 0
    metrics.filteredOut = metrics.before
    metrics.filterRate = 100
    return { items: [], metrics, decisions: allDecisions }
  }

  // STAGE 2: Problem Match (detailed filter)
  const stage2 = await problemMatchFilter(
    stage1.passed,
    hypothesis,
    structured,
    sendProgress
  )
  metrics.stage2Filtered = stage2.filtered.length
  allDecisions.push(...stage2.decisions)

  // Mark passed items with Y decision
  for (const post of stage2.passed) {
    allDecisions.push({
      reddit_id: post.id,
      title: post.title,
      body_preview: (post.body || '').slice(0, 200),
      subreddit: post.subreddit,
      decision: 'Y',
      stage: 'problem',
    })
  }

  // Final metrics
  metrics.after = stage2.passed.length
  metrics.filteredOut = metrics.before - metrics.after
  metrics.filterRate = metrics.before > 0 ? (metrics.filteredOut / metrics.before) * 100 : 0

  sendProgress?.(`Filter complete: ${metrics.after}/${metrics.before} posts retained (${Math.round(metrics.filterRate)}% filtered)`, {
    stage3Filtered: metrics.stage3Filtered,
    stage1Filtered: metrics.stage1Filtered,
    stage2Filtered: metrics.stage2Filtered,
  })

  return { items: stage2.passed, metrics, decisions: allDecisions }
}

/**
 * Filter comments using simplified 2-stage filter (Quality + Problem Match)
 * Comments skip domain gate since they're already from relevant posts
 */
export async function filterRelevantComments(
  comments: RedditComment[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  sendProgress?: (msg: string) => void
): Promise<FilterResult<RedditComment>> {
  const allDecisions: RelevanceDecision[] = []
  const metrics: FilterMetrics = {
    before: comments.length,
    after: 0,
    filteredOut: 0,
    filterRate: 0,
    stage3Filtered: 0,
    stage1Filtered: 0,
    stage2Filtered: 0,
  }

  if (comments.length === 0) {
    return { items: [], metrics, decisions: [] }
  }

  // Stage 3: Quality Gate (shorter min length for comments)
  const stage3 = qualityGateFilter(comments, 30)
  metrics.stage3Filtered = stage3.filtered.length
  allDecisions.push(...stage3.decisions)

  if (stage3.passed.length === 0) {
    return { items: [], metrics, decisions: allDecisions }
  }

  // Stage 2 directly (skip domain gate for comments)
  const passed: RedditComment[] = []
  const filtered: RedditComment[] = []
  const batchSize = 25

  for (let i = 0; i < stage3.passed.length; i += batchSize) {
    const batch = stage3.passed.slice(i, i + batchSize)

    const summaries = batch.map((c, idx) => `[${idx + 1}] ${c.body.slice(0, 200)}`).join('\n\n')

    const contextSection = structured ? `
TARGET: ${structured.audience} with ${structured.problem}${structured.problemLanguage ? `
PHRASES: ${structured.problemLanguage}` : ''}` : ''

    const prompt = `Does each comment discuss the problem: "${structured?.problem || hypothesis}"?
${contextSection}

Comments:
${summaries}

Y = discusses this problem, N = unrelated
Respond with ${batch.length} letters:`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        const results = content.text.trim().toUpperCase().replace(/[^YN]/g, '')
        batch.forEach((comment, idx) => {
          const decision = results[idx] === 'Y' ? 'Y' : 'N'
          if (decision === 'Y') {
            passed.push(comment)
          } else {
            filtered.push(comment)
            allDecisions.push({
              reddit_id: comment.id,
              body_preview: comment.body.slice(0, 200),
              subreddit: comment.subreddit,
              decision: 'N',
              stage: 'problem',
            })
          }
        })
      }
    } catch {
      passed.push(...batch)
    }
  }

  metrics.stage2Filtered = filtered.length
  metrics.after = passed.length
  metrics.filteredOut = metrics.before - metrics.after
  metrics.filterRate = metrics.before > 0 ? (metrics.filteredOut / metrics.before) * 100 : 0

  // Add Y decisions for passed comments
  for (const comment of passed) {
    allDecisions.push({
      reddit_id: comment.id,
      body_preview: comment.body.slice(0, 200),
      subreddit: comment.subreddit,
      decision: 'Y',
      stage: 'problem',
    })
  }

  return { items: passed, metrics, decisions: allDecisions }
}
