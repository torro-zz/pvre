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

export type RelevanceTier = 'CORE' | 'RELATED' | 'N'

// =============================================================================
// TRANSITION DETECTION (for audience-aware tiering)
// =============================================================================

// Patterns that indicate the hypothesis is about TRANSITIONING to something
const TRANSITION_PATTERNS = {
  career: [
    /\b(want(?:ing|s)? to|trying to|considering|thinking about|planning to)\s+(start|launch|build|create|begin|open)\s+(\w+\s+)?(a\s+)?(\w+\s+)?(business|company|startup|side hustle|freelance)/i,
    /\b(escape|leave|quit)\s+(my\s+)?(\w+\s+)?(job|9-5|corporate|career)/i,
    /\b(become|becoming)\s+(an?\s+)?(\w+\s+)?(entrepreneur|freelancer|founder|business owner|self-employed|independent)/i,
    /\b(transition(?:ing)?|switch(?:ing)?|move|moving)\s+(from|to|into)\s+/i,
    /\b(build|start|launch|create)\s+(\w+\s+)?(own\s+)?(business|company)/i,  // "build their own business"
  ],
}

// Audience indicators that suggest CURRENT state (not goal achieved)
const EMPLOYED_AUDIENCE_PATTERNS = [
  /\b(employed|employee|corporate|9-5|nine-to-five|office job|day job|full-time job|w-2|salaried)\b/i,
  /\b(stuck in|trapped in|escape from)\s+(a\s+)?(job|career|corporate)/i,
  /\b(working professional|office worker|desk job)\b/i,
]

interface TransitionContext {
  isTransition: boolean
  currentState?: string
  desiredState?: string
}

/**
 * Detect if a hypothesis describes an employed→entrepreneur transition
 */
function detectTransitionContext(hypothesis: string, structured?: StructuredHypothesis): TransitionContext {
  const combinedText = structured
    ? `${structured.audience} ${structured.problem} ${structured.problemLanguage || ''}`
    : hypothesis

  const hasTransitionPattern = TRANSITION_PATTERNS.career.some(p => p.test(combinedText))
  const hasEmployedAudience = EMPLOYED_AUDIENCE_PATTERNS.some(p => p.test(combinedText))

  if (hasTransitionPattern && hasEmployedAudience) {
    return {
      isTransition: true,
      currentState: 'employed',
      desiredState: 'entrepreneur/business owner',
    }
  }

  return { isTransition: false }
}

export interface RelevanceDecision {
  reddit_id: string
  title?: string
  body_preview: string
  subreddit: string
  decision: 'Y' | 'N'
  tier?: RelevanceTier  // CORE = intersection match, RELATED = single-domain match, N = no match
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
  titleOnlyPosts: number  // Posts recovered via title-only analysis
  coreSignals: number     // CORE tier: intersection match (problem + context)
  relatedSignals: number  // RELATED tier: single-domain match
  // P0 FIX: Track Stage 2 filter rate separately for narrow problem detection
  stage2FilterRate: number  // % of Stage 1 passes that failed Stage 2
  narrowProblemWarning: boolean  // True if >50% of Stage 1 passes failed Stage 2
}

// Minimum posts before triggering title-only recovery
const SPARSE_DATA_THRESHOLD = 10
// Minimum title length to consider for title-only analysis
const MIN_TITLE_LENGTH_FOR_RECOVERY = 30

export interface FilterResult<T> {
  items: T[]
  metrics: FilterMetrics
  decisions: RelevanceDecision[]
}

// ============================================================================
// STAGE 3: Quality Gate (Code-Only Filters) - Run FIRST
// ============================================================================

// Spam patterns - be conservative to avoid false positives
// Only match clear promotional/self-promo content
const SPAM_PATTERNS = [
  /\b(limited time offer|act now|click here|buy now)\b/i,
  /\b(check out my|my youtube channel|subscribe to my|follow me on)\b/i,
  /\b(dm me for|message me for|link in bio)\b/i,
  /\b(promo code|discount code|use code)\b/i,
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
 * Check if a post title is substantive enough for title-only analysis
 */
function hasSubstantiveTitle(title: string): boolean {
  if (!title || title.length < MIN_TITLE_LENGTH_FOR_RECOVERY) return false
  // Reject generic titles
  const genericTitlePatterns = [
    /^(help|question|advice|thoughts|opinions|ideas)\s*$/i,
    /^(anyone|somebody|can someone)\s/i,
    /^(quick question|simple question)/i,
  ]
  return !genericTitlePatterns.some(p => p.test(title.trim()))
}

/**
 * Stage 3: Quality Gate - Fast code-only filtering
 * Removes garbage posts before any AI processing
 * Also tracks removed posts with substantive titles for title-only analysis
 */
export function qualityGateFilter<T extends RedditPost | RedditComment>(
  items: T[],
  minContentLength: number = 50
): { passed: T[]; filtered: T[]; titleOnly: T[]; decisions: RelevanceDecision[] } {
  const passed: T[] = []
  const filtered: T[] = []
  const titleOnly: T[] = [] // Posts with [removed] body - analyzed by title only
  const decisions: RelevanceDecision[] = []

  for (const item of items) {
    const isPost = 'title' in item
    const body = isPost ? (item as RedditPost).body || '' : (item as RedditComment).body
    const title = isPost ? (item as RedditPost).title : ''

    // For posts: combine title + body for length check (many posts have content in title)
    const totalContent = isPost ? `${title} ${body}`.trim() : body

    let filterReason: string | null = null

    // Check 1: Removed/deleted content
    if (isRemovedOrDeleted(body)) {
      // For posts with substantive titles, analyze by title only
      if (isPost && hasSubstantiveTitle(title)) {
        titleOnly.push(item)
        decisions.push({
          reddit_id: item.id,
          title: title,
          body_preview: '[removed] - title only',
          subreddit: item.subreddit,
          decision: 'N',
          stage: 'quality',
          reason: 'title_only',
        })
        continue // Don't add to filtered
      }
      filterReason = 'removed_deleted'
    }
    // Check 2: Too short - check total content (title + body for posts)
    else if (totalContent.length < minContentLength) {
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

  return { passed, filtered, titleOnly, decisions }
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

    const prompt = `DOMAIN CHECK: Is each post related to "${domain}"?
${antiDomainList}

Posts:
${postSummaries}

Rules:
- Y = post discusses or relates to ${domain} (even tangentially or as context)
- N = post is clearly about a completely different topic
- When in doubt, say Y (we filter more precisely in the next stage)

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

export interface TieredFilterResult {
  core: RedditPost[]      // CORE: intersection match (problem + context)
  related: RedditPost[]   // RELATED: single-domain match
  filtered: RedditPost[]  // N: no match
  decisions: RelevanceDecision[]
}

/**
 * Stage 2: Problem Match - Tiered relevance filter
 * For posts that passed domain gate, classify into CORE/RELATED/N tiers
 *
 * CORE: Post discusses the PROBLEM within the PRIMARY CONTEXT (intersection)
 * RELATED: Post discusses PROBLEM but not context, OR context but not problem
 * N: No match to either domain
 */
export async function problemMatchFilter(
  posts: RedditPost[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  sendProgress?: (msg: string) => void
): Promise<TieredFilterResult> {
  if (posts.length === 0) {
    return { core: [], related: [], filtered: [], decisions: [] }
  }

  sendProgress?.(`Problem match: analyzing ${posts.length} posts with tiered relevance...`)

  const core: RedditPost[] = []
  const related: RedditPost[] = []
  const filtered: RedditPost[] = []
  const decisions: RelevanceDecision[] = []

  const batchSize = 20

  // Extract primary context from hypothesis for multi-domain detection
  // Context = setting/environment (gym, workplace, etc.)
  // Problem = the actual pain point
  const problemDescription = structured?.problem || hypothesis
  const audienceDescription = structured?.audience || ''

  // Detect if hypothesis has a SETTING context (gym, workplace, school, etc.)
  const settingPatterns = /\b(gym|fitness|workout|office|workplace|work|school|classroom|home|restaurant|bar|club|church|community|online|remote|virtual)\b/i
  const hasSettingContext = settingPatterns.test(hypothesis) || settingPatterns.test(audienceDescription)

  // Detect if hypothesis is a TRANSITION (employed → entrepreneur)
  const transitionContext = detectTransitionContext(hypothesis, structured)
  const isEmployedTransition = transitionContext.isTransition && transitionContext.currentState === 'employed'

  // Determine which tiering mode to use
  const useTieredClassification = hasSettingContext || isEmployedTransition

  if (isEmployedTransition) {
    sendProgress?.(`Transition hypothesis detected: audience-aware tiering enabled (CORE = employed seeking transition)`)
  }

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const postSummaries = batch.map((post, idx) => {
      const body = (post.body || '').slice(0, 150)
      return `[${idx + 1}] ${post.title}${body ? '\n' + body : ''}`
    }).join('\n\n')

    // Use tiered prompt if there's a setting context OR transition hypothesis, otherwise standard
    let prompt: string
    if (isEmployedTransition) {
      prompt = buildTransitionTieredPrompt(problemDescription, audienceDescription, structured, postSummaries, batch.length)
    } else if (hasSettingContext) {
      prompt = buildTieredPrompt(problemDescription, audienceDescription, structured, postSummaries, batch.length)
    } else {
      prompt = buildStandardPrompt(problemDescription, audienceDescription, structured, postSummaries, batch.length)
    }

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
        // Parse results - expect C/R/N for tiered, Y/N for standard
        const rawResults = content.text.trim().toUpperCase()
        const results = useTieredClassification
          ? rawResults.replace(/[^CRN]/g, '')
          : rawResults.replace(/[^YN]/g, '')

        batch.forEach((post, idx) => {
          const result = results[idx]

          if (useTieredClassification) {
            // Tiered classification
            if (result === 'C') {
              core.push(post)
              decisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'Y',
                tier: 'CORE',
                stage: 'problem',
                reason: 'intersection match',
              })
            } else if (result === 'R') {
              related.push(post)
              decisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'Y',
                tier: 'RELATED',
                stage: 'problem',
                reason: 'single-domain match',
              })
            } else {
              filtered.push(post)
              decisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'N',
                tier: 'N',
                stage: 'problem',
                reason: 'no match',
              })
            }
          } else {
            // Standard binary classification - all passes are CORE
            if (result === 'Y') {
              core.push(post)
              decisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'Y',
                tier: 'CORE',
                stage: 'problem',
              })
            } else {
              filtered.push(post)
              decisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'N',
                tier: 'N',
                stage: 'problem',
                reason: 'wrong problem',
              })
            }
          }
        })
      }
    } catch (error) {
      console.error('[problemMatchFilter] Batch failed, passing all as RELATED:', error)
      // On error, pass as RELATED (conservative - don't want to lose data)
      related.push(...batch)
    }
  }

  const totalPassed = core.length + related.length
  sendProgress?.(`Problem match: ${totalPassed}/${posts.length} posts passed (${core.length} CORE, ${related.length} RELATED, ${filtered.length} filtered)`)
  return { core, related, filtered, decisions }
}

/**
 * Build tiered prompt for multi-domain hypotheses (e.g., "gym socialization")
 * Returns C (CORE), R (RELATED), or N
 *
 * P0 FIX: Now stricter about matching the SPECIFIC problem, not just the domain.
 */
function buildTieredPrompt(
  problem: string,
  audience: string,
  structured: StructuredHypothesis | undefined,
  postSummaries: string,
  batchLength: number
): string {
  // Extract the setting/context from hypothesis
  const settingMatch = (audience + ' ' + problem).match(/\b(gym|fitness|workout|office|workplace|work|school|classroom|home|restaurant|bar|club|church|community|online|remote|virtual)\b/i)
  const settingContext = settingMatch ? settingMatch[1].toLowerCase() : 'the specific context'
  const specificProblem = structured?.problem || problem

  return `TIERED RELEVANCE CHECK for multi-domain hypothesis.

THE SPECIFIC PROBLEM TO MATCH:
"${specificProblem}"

HYPOTHESIS BREAKDOWN:
- PRIMARY CONTEXT: ${settingContext} environment/setting
- TARGET AUDIENCE: ${audience}${structured?.problemLanguage ? `
- PHRASES THAT INDICATE A MATCH: ${structured.problemLanguage}` : ''}${structured?.excludeTopics ? `
- EXCLUDE: ${structured.excludeTopics}` : ''}

For each post, classify as C (CORE), R (RELATED), or N:

C (CORE - exact problem + context match):
- Post describes someone experiencing THE SPECIFIC PROBLEM within the ${settingContext} CONTEXT
- Must be about THIS problem, not just any ${settingContext}-related issue
- Example: "How do I approach people at the gym to chat?" for socialization at gym → C

R (RELATED - partial match, still useful context):
- Post discusses THE SPECIFIC PROBLEM but NOT in ${settingContext} context, OR
- Post is about ${settingContext} AND mentions social aspects (related topic)
- Example: "I can't make friends as an adult, any tips?" (problem, no gym) → R
- Example: "Anyone else feel awkward talking to regulars at the gym?" (gym, social, but different angle) → R

N (no match - DIFFERENT problem or off-topic):
- Post is about ${settingContext} but a COMPLETELY DIFFERENT issue (equipment, exercises, nutrition, etc.)
- Post is about the domain but NOT this specific problem
- Example: "Best gym exercises for beginners" (gym, but NOT socialization) → N
- Example: "Protein shake recommendations?" (gym, but NOT socialization) → N
- Example: "How much water should I drink at the gym?" (gym, but NOT socialization) → N${structured?.excludeTopics ? `
- Post about ${structured.excludeTopics} → N` : ''}

Be STRICT about N: If the post is about the context but NOT the specific problem, it's N.
Be generous with R only if the post is genuinely about the problem (even without context).

POSTS:
${postSummaries}

Respond with exactly ${batchLength} letters (C, R, or N):`
}

/**
 * Build tiered prompt for TRANSITION hypotheses (employed → entrepreneur)
 * Classifies based on AUDIENCE (who is posting), not just topic
 *
 * CORE = Post is FROM the target audience (employed people discussing transition desires)
 * RELATED = Post is about the topic but from WRONG audience (established entrepreneurs)
 */
function buildTransitionTieredPrompt(
  problem: string,
  audience: string,
  structured: StructuredHypothesis | undefined,
  postSummaries: string,
  batchLength: number
): string {
  return `AUDIENCE-AWARE RELEVANCE CHECK for transition hypothesis.

⚠️ THIS IS A TRANSITION HYPOTHESIS ⚠️
The hypothesis is about EMPLOYED PEOPLE wanting to START a business.
We need signals from people CURRENTLY EMPLOYED, not established entrepreneurs.

HYPOTHESIS:
- TARGET AUDIENCE: ${audience} (people currently employed, considering transition)
- PROBLEM/DESIRE: ${problem}${structured?.problemLanguage ? `
- PHRASES: ${structured.problemLanguage}` : ''}${structured?.excludeTopics ? `
- EXCLUDE: ${structured.excludeTopics}` : ''}

For each post, classify as C (CORE), R (RELATED), or N:

C (CORE - right audience + right topic):
- Post is FROM an EMPLOYED person discussing wanting to start a business
- Signals: "thinking of quitting my job", "want to escape 9-5", "building a side hustle while employed"
- The poster is CURRENTLY EMPLOYED and talking about the desire/fear/challenges of transitioning
- Example: "I want to quit my job and start a business but I'm scared" → C

R (RELATED - wrong audience but related topic):
- Post is FROM an ESTABLISHED entrepreneur giving advice or sharing their story
- Post is about business/entrepreneurship but the poster is NOT currently employed
- Signals: "when I started my business...", "as a business owner...", "my company does X"
- Example: "Here's how I quit my job 5 years ago" (helpful but wrong perspective) → R
- Example: "Running my own business is hard" (established owner, not transition-seeker) → R

N (no match):
- Post is about unrelated topics
- Post has demographics that explicitly conflict with target audience${structured?.excludeTopics ? `
- Post about ${structured.excludeTopics}` : ''}

KEY DISTINCTION:
- CORE = "I want to quit my job and start X" (employed person seeking transition)
- RELATED = "I quit my job 3 years ago and here's what happened" (already transitioned)
- RELATED = "Running a business is hard, here's my experience" (established entrepreneur)

POSTS:
${postSummaries}

Respond with exactly ${batchLength} letters (C, R, or N):`
}

/**
 * Build standard prompt for single-domain hypotheses
 * Returns Y or N (all passes become CORE)
 *
 * P0 FIX: This prompt now requires the SPECIFIC PROBLEM to match, not just the domain.
 * Example: For "forgetting to drink water", posts about "taste of water" or "water filters" should be rejected.
 */
function buildStandardPrompt(
  problem: string,
  audience: string,
  structured: StructuredHypothesis | undefined,
  postSummaries: string,
  batchLength: number
): string {
  // Extract the core problem action/experience for clearer matching
  const specificProblem = structured?.problem || problem

  return `SPECIFIC PROBLEM MATCH: The post must describe someone experiencing THIS EXACT problem.

THE SPECIFIC PROBLEM TO MATCH:
"${specificProblem}"

TARGET AUDIENCE: ${audience}${structured?.problemLanguage ? `
PHRASES THAT INDICATE A MATCH: ${structured.problemLanguage}` : ''}${structured?.excludeTopics ? `
EXCLUDE POSTS ABOUT: ${structured.excludeTopics}` : ''}

DECISION RULE - Be STRICT about problem matching:

Y = Post describes someone experiencing the SPECIFIC PROBLEM above
- The person is struggling with THIS EXACT issue
- The post expresses frustration, seeks help, or discusses THIS problem specifically

N = Post is about a DIFFERENT problem, even if it's in the same general domain
- Post is about a related but DIFFERENT issue
- Post discusses the topic generally but not THIS specific problem

EXAMPLES (for "forgetting to drink water during busy workdays"):
- "I get so absorbed in work I realize at 5pm I haven't had water all day" → Y (exact problem)
- "How do you remember to drink water when you're in meetings all day?" → Y (exact problem)
- "I don't like the taste of plain water" → N (taste preference, NOT forgetting)
- "Best water bottle recommendations?" → N (product shopping, NOT the problem)
- "Water filter vs bottled water?" → N (water quality, NOT forgetting to drink)
- "I drink too much water, is that bad?" → N (opposite problem)

Also reject if demographics EXPLICITLY conflict with "${audience}".

POSTS:
${postSummaries}

Respond with exactly ${batchLength} letters (Y or N). Be strict - only Y for posts about THE SPECIFIC PROBLEM:`
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
export interface TieredFilteredPosts {
  items: RedditPost[]
  coreItems: RedditPost[]     // CORE tier posts
  relatedItems: RedditPost[]  // RELATED tier posts
  metrics: FilterMetrics
  decisions: RelevanceDecision[]
}

export async function filterRelevantPosts(
  posts: RedditPost[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  sendProgress?: (msg: string, data?: Record<string, unknown>) => void
): Promise<TieredFilteredPosts> {
  const allDecisions: RelevanceDecision[] = []
  const metrics: FilterMetrics = {
    before: posts.length,
    after: 0,
    filteredOut: 0,
    filterRate: 0,
    stage3Filtered: 0,
    stage1Filtered: 0,
    stage2Filtered: 0,
    titleOnlyPosts: 0,
    coreSignals: 0,
    relatedSignals: 0,
    stage2FilterRate: 0,
    narrowProblemWarning: false,
  }

  if (posts.length === 0) {
    return { items: [], coreItems: [], relatedItems: [], metrics, decisions: [] }
  }

  sendProgress?.(`Starting 3-stage relevance filter on ${posts.length} posts...`)

  // STAGE 3: Quality Gate (run first - free, removes garbage)
  const stage3 = qualityGateFilter(posts, 50)
  metrics.stage3Filtered = stage3.filtered.length
  allDecisions.push(...stage3.decisions)

  const titleOnlyCount = stage3.titleOnly.length
  sendProgress?.(`Stage 3 (Quality): ${stage3.filtered.length} posts filtered, ${titleOnlyCount} title only`)

  if (stage3.passed.length === 0 && stage3.titleOnly.length === 0) {
    metrics.after = 0
    metrics.filteredOut = metrics.before
    metrics.filterRate = 100
    return { items: [], coreItems: [], relatedItems: [], metrics, decisions: allDecisions }
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

  // STAGE 2: Problem Match (tiered filter) - for full posts
  let stage2Core: RedditPost[] = []
  let stage2Related: RedditPost[] = []
  if (stage1.passed.length > 0) {
    const stage2 = await problemMatchFilter(
      stage1.passed,
      hypothesis,
      structured,
      sendProgress
    )
    metrics.stage2Filtered = stage2.filtered.length
    allDecisions.push(...stage2.decisions)
    stage2Core = stage2.core
    stage2Related = stage2.related
  }

  // P0 FIX: ALWAYS include removed posts (not just when sparse)
  // These are analyzed by title only and weighted at 0.7x
  let titleOnlyCore: RedditPost[] = []
  let titleOnlyRelated: RedditPost[] = []
  if (stage3.titleOnly.length > 0) {
    sendProgress?.(`Including ${stage3.titleOnly.length} posts with [removed] bodies (title only)...`)

    // Run domain gate on title-only posts
    const titleOnlyDomain = await domainGateFilter(
      stage3.titleOnly as RedditPost[],
      domain,
      antiDomains,
      (msg) => sendProgress?.(`[Title-only] ${msg}`)
    )

    if (titleOnlyDomain.passed.length > 0) {
      // Run problem match on domain-passed title-only posts
      const titleOnlyProblem = await problemMatchFilter(
        titleOnlyDomain.passed,
        hypothesis,
        structured,
        (msg) => sendProgress?.(`[Title-only] ${msg}`)
      )

      // Mark title-only posts - they'll be weighted at 0.7x in pain detection
      const markAsTitleOnly = (post: RedditPost): RedditPost => ({
        ...post,
        body: `[Title-only analysis] ${post.title}`,
        _titleOnly: true,
      } as RedditPost)

      titleOnlyCore = titleOnlyProblem.core.map(markAsTitleOnly)
      titleOnlyRelated = titleOnlyProblem.related.map(markAsTitleOnly)

      metrics.titleOnlyPosts = titleOnlyCore.length + titleOnlyRelated.length

      // Update decisions for title-only posts with tier info
      for (const post of titleOnlyCore) {
        allDecisions.push({
          reddit_id: post.id,
          title: post.title,
          body_preview: '[title-only analysis]',
          subreddit: post.subreddit,
          decision: 'Y',
          tier: 'CORE',
          stage: 'problem',
          reason: 'title_only',
        })
      }
      for (const post of titleOnlyRelated) {
        allDecisions.push({
          reddit_id: post.id,
          title: post.title,
          body_preview: '[title-only analysis]',
          subreddit: post.subreddit,
          decision: 'Y',
          tier: 'RELATED',
          stage: 'problem',
          reason: 'title_only',
        })
      }

      sendProgress?.(`Title-only: ${titleOnlyCore.length} CORE + ${titleOnlyRelated.length} RELATED posts included`)
    }
  }

  // Combine full posts and title-only posts by tier
  const allCore = [...stage2Core, ...titleOnlyCore]
  const allRelated = [...stage2Related, ...titleOnlyRelated]
  const finalPosts = [...allCore, ...allRelated]

  // Update metrics
  metrics.coreSignals = allCore.length
  metrics.relatedSignals = allRelated.length
  metrics.after = finalPosts.length
  metrics.filteredOut = metrics.before - metrics.after
  metrics.filterRate = metrics.before > 0 ? (metrics.filteredOut / metrics.before) * 100 : 0

  // P0 FIX: Calculate Stage 2 filter rate and narrow problem warning
  // Stage 2 filter rate = % of Stage 1 passes that failed Stage 2
  const stage1PassedCount = stage1.passed.length
  if (stage1PassedCount > 0) {
    metrics.stage2FilterRate = (metrics.stage2Filtered / stage1PassedCount) * 100
    // If >50% of domain-relevant posts fail problem matching, flag as narrow problem
    metrics.narrowProblemWarning = metrics.stage2FilterRate > 50
  }

  const narrowWarning = metrics.narrowProblemWarning
    ? ` ⚠️ NARROW PROBLEM: ${Math.round(metrics.stage2FilterRate)}% of domain-relevant posts didn't match specific problem`
    : ''

  sendProgress?.(`Filter complete: ${metrics.after}/${metrics.before} posts retained (${metrics.coreSignals} CORE, ${metrics.relatedSignals} RELATED)${metrics.titleOnlyPosts > 0 ? ` [${metrics.titleOnlyPosts} via title-only]` : ''}${narrowWarning}`, {
    stage3Filtered: metrics.stage3Filtered,
    stage1Filtered: metrics.stage1Filtered,
    stage2Filtered: metrics.stage2Filtered,
    stage2FilterRate: Math.round(metrics.stage2FilterRate),
    narrowProblemWarning: metrics.narrowProblemWarning,
    titleOnlyPosts: metrics.titleOnlyPosts,
    coreSignals: metrics.coreSignals,
    relatedSignals: metrics.relatedSignals,
  })

  return { items: finalPosts, coreItems: allCore, relatedItems: allRelated, metrics, decisions: allDecisions }
}

/**
 * Filter comments using simplified 2-stage filter (Quality + Problem Match)
 * Comments skip domain gate since they're already from relevant posts
 */
export async function filterRelevantComments(
  comments: RedditComment[],
  hypothesis: string,
  structured?: StructuredHypothesis,
  _sendProgress?: (msg: string) => void
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
    titleOnlyPosts: 0,  // Not applicable for comments
    coreSignals: 0,     // Comments don't use tiering yet
    relatedSignals: 0,
    stage2FilterRate: 0,  // Not tracked for comments
    narrowProblemWarning: false,  // Not tracked for comments
  }

  if (comments.length === 0) {
    return { items: [], metrics, decisions: [] }
  }

  // Stage 3: Quality Gate (shorter min length for comments)
  // Note: titleOnly is not used for comments since they don't have titles
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

    // Use asymmetric matching: STRICT on problem, LOOSE on audience
    const problemDescription = structured?.problem || hypothesis
    const audienceDescription = structured?.audience || ''

    const prompt = `ASYMMETRIC RELEVANCE CHECK for comments:

PROBLEM (must match): ${problemDescription}
TARGET AUDIENCE: ${audienceDescription}${structured?.problemLanguage ? `
PHRASES: ${structured.problemLanguage}` : ''}

DECISION RULE:
- Y if comment discusses the problem (even if demographics unstated)
- N if comment is about a different topic
- N if comment explicitly states conflicting demographics (e.g., "23F" for "men in 40s")

CRITICAL: Accept comments about the problem even if author doesn't state their demographics.

Comments:
${summaries}

Respond with ${batch.length} letters (Y or N):`

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
