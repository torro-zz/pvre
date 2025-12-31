/**
 * 4-Stage Relevance Filter (with Embeddings)
 *
 * Stage 0 (Embedding Gate): Semantic similarity filter using OpenAI embeddings
 * Stage 1 (Domain Gate): Fast AI filter - "Is this post about [domain]?"
 * Stage 2 (Problem Match): Detailed filter - "Does this discuss THIS SPECIFIC problem?"
 * Stage 3 (Quality Gate): Code-only filters - removed/deleted, short, non-English, spam
 *
 * Pipeline flow:
 * 1. Quality Gate (FREE) - removes deleted, short, spam
 * 2. PreFilter Rank (FREE) - engagement + first-person sort
 * 3. Embedding Gate (~$0.01) - semantic similarity to hypothesis
 * 4. Domain Gate (cheap Haiku) - only on high-similarity posts
 * 5. Problem Match (Haiku) - final relevance check
 *
 * Expected outcomes:
 * - Stage 3 filters 10-20% (garbage removal, no AI cost)
 * - Stage 0 filters 50-70% (embedding similarity, ~$0.01)
 * - Stage 1 filters 30-50% of remainder (domain mismatch)
 * - Stage 2 filters 20-30% of remainder (problem mismatch)
 * - Final: ~15-25% of original posts retained, but HIGH QUALITY + RELEVANT
 */

import Anthropic from '@anthropic-ai/sdk'
import { RedditPost, RedditComment } from '@/lib/data-sources'
import { StructuredHypothesis } from '@/types/research'
import { getCurrentTracker } from '@/lib/anthropic'
import { trackUsage } from '@/lib/analysis/token-tracker'
import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  classifySimilarity,
  classifySimilarityWithThreshold,
  isEmbeddingServiceAvailable,
  SIMILARITY_THRESHOLDS,
  // Problem-focused embedding functions (Dec 2025)
  extractProblemFocus,
  passesKeywordGate,
  // Coverage boost for thin-data hypotheses (Dec 2025)
  COVERAGE_BOOST_CONFIG,
  generateHypothesisKeywords,
  calculateBoostedSimilarity,
} from '@/lib/embeddings'

// =============================================================================
// SKIP AI GATES FLAG (Dec 2025 Ground Truth Calibration)
// =============================================================================
// After calibrating embeddings against 14 verified "gold nugget" posts:
// - Threshold set to 0.35 (lowest gold nugget scored 0.399)
// - Keyword boost +0.08 for explicit payment terms
// - AI gates (Domain Gate, Problem Match) are now optional
//
// With properly calibrated embeddings, AI gates add cost without benefit.
// Set to false only for debugging or if relevance drops.
export const SKIP_AI_GATES = true

const anthropic = new Anthropic()

export type RelevanceTier = 'CORE' | 'RELATED' | 'N'

// =============================================================================
// FIRST-PERSON LANGUAGE DETECTION (Phase 0: Data Quality Initiative)
// =============================================================================
// Professional social listening tools add first-person pronouns to filter for
// firsthand experiences rather than generic observations.
//
// "I can't get my clients to pay" = real pain signal ✓
// "Freelancers often struggle with payments" = generic observation ✗

const FIRST_PERSON_MARKERS = [
  // Strong first-person (most valuable)
  'I', 'me', 'my', 'mine', 'myself',
  "I'm", "I've", "I'd", "I'll",
  // Plural first-person (still valuable, group experience)
  'we', 'our', 'us', 'ourselves',
  "we're", "we've", "we'd", "we'll",
]

// Patterns that indicate firsthand experience even without pronouns
const FIRSTHAND_EXPERIENCE_PATTERNS = [
  /\b(my\s+experience|from\s+experience|personally|speaking\s+from)\b/i,
  /\b(happened\s+to\s+me|this\s+happened|when\s+this\s+happened)\b/i,
  /\b(as\s+a\s+\w+,?\s+I|being\s+a\s+\w+,?\s+I)\b/i,
  /\b(just\s+happened|currently\s+dealing|struggling\s+with)\b/i,
]

// Patterns that indicate third-person observation (lower value)
const THIRD_PERSON_OBSERVATION_PATTERNS = [
  /\b(people\s+often|many\s+people|some\s+people|most\s+people)\b/i,
  /\b(users\s+typically|customers\s+tend|freelancers\s+usually)\b/i,
  /\b(it's\s+common\s+for|it\s+is\s+common\s+to|research\s+shows)\b/i,
  /\b(according\s+to|studies\s+show|data\s+suggests)\b/i,
]

// =============================================================================
// PAIN LANGUAGE DETECTION (Part 2: Signal Quality Enhancement)
// =============================================================================
// Posts expressing frustration, struggle, or actively seeking solutions
// are more valuable signals than neutral discussions or curiosity questions.

const PAIN_MARKERS = [
  // Frustration
  'frustrated', 'frustrating', 'annoying', 'annoyed', 'hate', 'hating',
  // Struggle
  'struggling', 'struggle', 'difficult', 'hard time', "can't figure",
  // Failure
  'failing', 'failed', 'broken', "doesn't work", 'not working',
  // Desperation
  'help me', 'please help', 'desperate', "at my wit's end",
  // Intensity
  'driving me crazy', 'killing me', 'nightmare', 'impossible', 'stuck',
  // Solution seeking
  'looking for', 'need a solution', 'any recommendations', 'what do you use',
  // Pain language
  'pain', 'painful', 'exhausted', 'overwhelmed', 'burned out', 'burnout',
]

const CURIOSITY_MARKERS = [
  // Questions without pain
  'what do you think', 'opinions on', 'thoughts on', 'curious about',
  'wondering if', 'does anyone know', "what's the difference",
  // Polls/surveys
  'poll:', 'survey:', "what's your favorite", 'rank these',
  // General questions
  'how does', 'what is', 'eli5', 'explain like',
]

/**
 * Calculate pain language boost factor for pre-scoring
 * @returns number - multiplier (0.7 = curiosity penalty, 1.0 = neutral, 1.2-1.5 = pain boost)
 */
export function getPainLanguageBoost(text: string): number {
  const lowerText = text.toLowerCase()

  // Check for curiosity markers (reduce priority)
  const hasCuriosity = CURIOSITY_MARKERS.some(marker => lowerText.includes(marker))
  if (hasCuriosity && !PAIN_MARKERS.some(marker => lowerText.includes(marker))) {
    return 0.7  // Curiosity without pain = lower priority
  }

  // Count pain markers
  const painCount = PAIN_MARKERS.filter(marker => lowerText.includes(marker)).length

  if (painCount >= 3) return 1.5  // High pain expression
  if (painCount >= 1) return 1.2  // Some pain expression
  return 1.0  // Neutral
}

/**
 * Check if text contains first-person language (indicating firsthand experience)
 * @returns boolean - true if first-person language is detected
 */
export function hasFirstPersonLanguage(text: string): boolean {
  if (!text || text.length < 10) return false

  // Check for first-person markers with word boundaries
  for (const marker of FIRST_PERSON_MARKERS) {
    // For contractions, use case-sensitive check at word boundaries
    if (marker.includes("'")) {
      const escapedMarker = marker.replace(/'/g, "'")
      const regex = new RegExp(`\\b${escapedMarker}\\b`, 'i')
      if (regex.test(text)) return true
    } else {
      // For regular pronouns, check word boundaries
      const regex = new RegExp(`\\b${marker}\\b`, 'i')
      if (regex.test(text)) return true
    }
  }

  // Check for firsthand experience patterns
  for (const pattern of FIRSTHAND_EXPERIENCE_PATTERNS) {
    if (pattern.test(text)) return true
  }

  return false
}

/**
 * Check if text is primarily a third-person observation (lower signal value)
 * @returns boolean - true if text appears to be generic observation, not personal experience
 */
export function isThirdPersonObservation(text: string): boolean {
  if (!text || text.length < 20) return false

  // If it has strong first-person language, it's not purely third-person
  if (hasFirstPersonLanguage(text)) return false

  // Check for third-person observation patterns
  for (const pattern of THIRD_PERSON_OBSERVATION_PATTERNS) {
    if (pattern.test(text)) return true
  }

  return false
}

/**
 * Calculate first-person boost factor for pre-scoring
 * @returns number - multiplier (1.0 = no boost, 1.3 = strong first-person boost)
 */
export function getFirstPersonBoost(text: string): number {
  if (hasFirstPersonLanguage(text)) {
    return 1.3  // 30% boost for firsthand experience
  }
  if (isThirdPersonObservation(text)) {
    return 0.7  // 30% penalty for generic observations
  }
  return 1.0  // Neutral
}

// =============================================================================
// PRE-SCORE CALCULATION (Phase 0: Two-Stage Filtering)
// =============================================================================
// Before spending Claude tokens on relevance filtering, rank posts by:
// - Engagement (upvotes, comments) = community has validated this resonates
// - First-person language = firsthand experience, not generic observation
// - Recency = fresher posts are more relevant

export interface PreScoreResult {
  score: number         // 0-1 normalized score
  hasFirstPerson: boolean
  normalizedUpvotes: number
  normalizedComments: number
  recencyBonus: number
}

/**
 * Calculate pre-score for a Reddit post to rank before AI filtering
 * This is a FREE filter (no API calls) that helps select the best candidates
 *
 * Phase 0 Data Quality Initiative: Strengthened first-person requirement
 * - First-person language gets 35% weight (up from 25%)
 * - Third-person observations get 40% penalty (new)
 * - Posts without any perspective markers get 15% penalty
 *
 * Formula: preScore = baseScore * painBoost * firstPersonMultiplier
 * where baseScore = (
 *   normalizedUpvotes * 0.30 +
 *   normalizedComments * 0.20 +
 *   (hasFirstPerson ? 0.35 : 0) +
 *   recencyBonus * 0.15
 * )
 * and painBoost = 0.7 (curiosity) to 1.5 (high pain)
 * and firstPersonMultiplier = 1.0 (first person), 0.6 (third person), 0.85 (neutral)
 */
export function calculatePreScore(post: RedditPost): PreScoreResult {
  const text = `${post.title} ${post.body || ''}`
  const hasFirstPerson = hasFirstPersonLanguage(text)
  const hasThirdPerson = isThirdPersonObservation(text)

  // Normalize upvotes: logarithmic scale (1 upvote = 0.0, 1000+ = 1.0)
  // Using log10: 1 → 0, 10 → 0.33, 100 → 0.67, 1000 → 1.0
  const normalizedUpvotes = Math.min(1, Math.log10(Math.max(1, post.score + 1)) / 3)

  // Normalize comments: logarithmic scale (0 comments = 0.0, 100+ = 1.0)
  const normalizedComments = Math.min(1, Math.log10(Math.max(1, post.numComments + 1)) / 2)

  // Recency bonus: posts from last 30 days get full bonus, decays over time
  let recencyBonus = 0
  if (post.createdUtc && post.createdUtc > 0) {
    const nowSeconds = Date.now() / 1000
    const ageInDays = (nowSeconds - post.createdUtc) / (60 * 60 * 24)

    if (ageInDays <= 30) {
      recencyBonus = 1.0  // Full bonus for recent posts
    } else if (ageInDays <= 90) {
      recencyBonus = 0.7  // Good bonus for somewhat recent
    } else if (ageInDays <= 180) {
      recencyBonus = 0.4  // Some bonus for moderately recent
    } else if (ageInDays <= 365) {
      recencyBonus = 0.2  // Small bonus for within a year
    } else {
      recencyBonus = 0    // No bonus for older posts
    }
  }

  // Calculate base score (weighted sum of factors)
  // First-person gets higher weight (35% vs 25% before)
  const baseScore =
    normalizedUpvotes * 0.30 +
    normalizedComments * 0.20 +
    (hasFirstPerson ? 0.35 : 0) +
    recencyBonus * 0.15

  // Apply pain language boost (0.7 - 1.5 multiplier)
  const painBoost = getPainLanguageBoost(text)

  // Apply first-person perspective multiplier (new in Phase 0)
  // First-person = 1.0 (no change)
  // Third-person observations = 0.6 (40% penalty - these are rarely useful)
  // Neutral (no clear perspective) = 0.85 (15% penalty)
  let firstPersonMultiplier = 1.0
  if (hasThirdPerson) {
    firstPersonMultiplier = 0.6  // Strong penalty for "people say..." style posts
  } else if (!hasFirstPerson) {
    firstPersonMultiplier = 0.85  // Mild penalty for ambiguous perspective
  }

  const score = baseScore * painBoost * firstPersonMultiplier

  return {
    score,
    hasFirstPerson,
    normalizedUpvotes,
    normalizedComments,
    recencyBonus,
  }
}

/**
 * Pre-filter and rank posts by pre-score before AI filtering
 * Takes a large pool of posts and returns the top N candidates for AI processing
 *
 * @param posts - All fetched posts
 * @param maxCandidates - Maximum number to pass to AI filter (default 300)
 * @returns Ranked posts (best candidates first) with pre-scores
 */
export function preFilterAndRank(
  posts: RedditPost[],
  maxCandidates: number = 300
): { posts: RedditPost[]; preScores: Map<string, PreScoreResult> } {
  // Calculate pre-scores for all posts
  const postsWithScores = posts.map(post => ({
    post,
    preScore: calculatePreScore(post),
  }))

  // Sort by pre-score (highest first)
  postsWithScores.sort((a, b) => b.preScore.score - a.preScore.score)

  // Take top candidates
  const topCandidates = postsWithScores.slice(0, maxCandidates)

  // Build pre-score map for reference
  const preScores = new Map<string, PreScoreResult>()
  for (const { post, preScore } of topCandidates) {
    preScores.set(post.id, preScore)
  }

  return {
    posts: topCandidates.map(({ post }) => post),
    preScores,
  }
}

/**
 * Calculate pre-score for a Reddit comment to rank before AI filtering
 * Similar to posts but without title/numComments
 * Includes pain language boost for better signal quality
 */
export function calculateCommentPreScore(comment: RedditComment): PreScoreResult {
  const text = comment.body || ''
  const hasFirstPerson = hasFirstPersonLanguage(text)

  // Normalize upvotes: logarithmic scale (1 upvote = 0.0, 1000+ = 1.0)
  const normalizedUpvotes = Math.min(1, Math.log10(Math.max(1, comment.score + 1)) / 3)

  // Recency bonus: comments from last 30 days get full bonus
  let recencyBonus = 0
  if (comment.createdUtc && comment.createdUtc > 0) {
    const nowSeconds = Date.now() / 1000
    const ageInDays = (nowSeconds - comment.createdUtc) / (60 * 60 * 24)

    if (ageInDays <= 30) {
      recencyBonus = 1.0
    } else if (ageInDays <= 90) {
      recencyBonus = 0.7
    } else if (ageInDays <= 180) {
      recencyBonus = 0.4
    } else if (ageInDays <= 365) {
      recencyBonus = 0.2
    }
  }

  // Calculate base score (comments don't have numComments field)
  // Increase weight of first-person language for comments since they're personal
  const baseScore =
    normalizedUpvotes * 0.35 +
    (hasFirstPerson ? 0.45 : 0) +  // Higher weight for first-person in comments
    recencyBonus * 0.2

  // Apply pain language boost (0.7 - 1.5 multiplier)
  const painBoost = getPainLanguageBoost(text)
  const score = baseScore * painBoost

  return {
    score,
    hasFirstPerson,
    normalizedUpvotes,
    normalizedComments: 0,  // Not applicable for comments
    recencyBonus,
  }
}

/**
 * Pre-filter and rank comments by pre-score before AI filtering
 * Takes a large pool of comments and returns the top N candidates for AI processing
 */
export function preFilterAndRankComments(
  comments: RedditComment[],
  maxCandidates: number = 200
): { comments: RedditComment[]; preScores: Map<string, PreScoreResult> } {
  // Calculate pre-scores for all comments
  const commentsWithScores = comments.map(comment => ({
    comment,
    preScore: calculateCommentPreScore(comment),
  }))

  // Sort by pre-score (highest first)
  commentsWithScores.sort((a, b) => b.preScore.score - a.preScore.score)

  // Take top candidates
  const topCandidates = commentsWithScores.slice(0, maxCandidates)

  // Build pre-score map for reference
  const preScores = new Map<string, PreScoreResult>()
  for (const { comment, preScore } of topCandidates) {
    preScores.set(comment.id, preScore)
  }

  return {
    comments: topCandidates.map(({ comment }) => comment),
    preScores,
  }
}

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
  preFilterSkipped: number  // Low-quality posts skipped before AI processing
  embeddingFiltered: number  // Embedding gate (Stage 0)
  embeddingHighSimilarity: number  // Posts with HIGH similarity
  embeddingMediumSimilarity: number  // Posts with MEDIUM similarity
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

    // Check 0: AutoModerator and bot content (skip AI processing for bot messages)
    if (item.author === 'AutoModerator' || item.author === '[deleted]') {
      filterReason = 'bot_content'
    }
    // Check 1: Removed/deleted content
    else if (isRemovedOrDeleted(body)) {
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
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Extract the PRIMARY PROBLEM DOMAIN from this business hypothesis.

${contextText}

The domain should be 2-4 words describing the SPECIFIC problem space.

IMPORTANT: Include audience context when it's ESSENTIAL to defining the problem:
- "Expats feeling lonely" → domain: "expat loneliness" or "expat social isolation" (NOT just "loneliness")
- "New mothers struggling with sleep deprivation" → domain: "postpartum sleep" (NOT just "sleep")
- "Remote workers with back pain" → domain: "work from home ergonomics" (NOT just "back pain")

Only exclude audience when it's a pure demographic filter that doesn't change the problem:
- "Men in 50s struggling with aging skin" → domain: "skin aging" (problem is same for all ages)
- "Busy parents with picky eaters" → domain: "child nutrition" (problem is same for all parents)

Also list 3-5 UNRELATED domains that might appear due to audience overlap but are NOT relevant.

Return JSON only:
{
  "domain": "specific problem domain (2-4 words)",
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
      const result = {
        domain: parsed.domain || '',
        antiDomains: parsed.antiDomains || [],
      }
      console.log(`[extractProblemDomain] Extracted domain: "${result.domain}" (antiDomains: ${result.antiDomains.join(', ')})`)
      return result
    }
  } catch {
    console.warn('[extractProblemDomain] Failed to parse response:', content.text)
  }

  return { domain: '', antiDomains: [] }
}

/**
 * Stage 1: Domain Gate - Fast AI filter using extracted domain
 * Asks simple question: "Is this post about [domain]?"
 * @param lenientMode - Use more lenient filtering (for title-only posts with less context)
 */
export async function domainGateFilter(
  posts: RedditPost[],
  domain: string,
  antiDomains: string[],
  sendProgress?: (msg: string) => void,
  lenientMode: boolean = false
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
      // Increase body preview for better context (helps catch payment mentions in body)
      const body = (post.body || '').slice(0, 250)
      return `[${idx + 1}] ${post.title}${body ? '\n' + body : ''}`
    }).join('\n\n')

    const antiDomainList = antiDomains.length > 0
      ? `\nREJECT posts about: ${antiDomains.join(', ')}`
      : ''

    // Check if domain is compound (contains multiple concepts like "expat loneliness")
    const isCompoundDomain = domain.includes(' ') && domain.split(' ').length >= 2

    // Domain Gate is now just a spam filter - embedding already ensures relevance
    // Only reject obvious spam like gaming, recipes, etc.
    const prompt = `PASS ALMOST EVERYTHING. Only reject obvious spam.

Posts have ALREADY been filtered for semantic relevance.
Your job: reject gaming, recipes, sports, entertainment.

Posts:
${postSummaries}

Y = ANY work/business/freelance content (pass it)
Y = ANY mention of clients, invoices, payments, money, stress (pass it)
Y = frustrated posts, venting posts, advice posts (pass it)
Y = if unsure, say Y

N = ONLY for: gaming, recipes, sports, TV, entertainment, memes

Respond with ${batch.length} Y's unless you see obvious spam.`

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
 *
 * Phase 0 Data Quality Initiative: Upgraded to Sonnet for better relevance judgment.
 * Sonnet is significantly better at understanding nuanced hypothesis matching.
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

  sendProgress?.(`Problem match: analyzing ${posts.length} posts with tiered relevance (using Sonnet)...`)

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
      // Phase 0 Data Quality Initiative: Upgraded to Sonnet for better relevance judgment
      // Sonnet is much better at understanding nuanced hypothesis matching than Haiku
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-sonnet-4-20250514')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        // Parse results - expect C/R/N for tiered, Y/N for standard
        const rawResults = content.text.trim().toUpperCase()
        let results = useTieredClassification
          ? rawResults.replace(/[^CRN]/g, '')
          : rawResults.replace(/[^YN]/g, '')

        // Safety check: if model returned extra chars (e.g., "Yes I'll..." prefix),
        // take the LAST expected number of characters
        if (results.length > batch.length) {
          console.warn(`[problemMatchFilter] Response has ${results.length} chars for ${batch.length} posts, taking last ${batch.length}`)
          results = results.slice(-batch.length)
        } else if (results.length < batch.length) {
          console.warn(`[problemMatchFilter] Response has ${results.length} chars for ${batch.length} posts, missing will be filtered`)
        }

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
 * P0 FIX (Dec 25): Tightened criteria - CORE requires firsthand experience + explicit problem match.
 * General discussions about the domain are now filtered out to improve signal quality.
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

  return `STRICT FILTER: Is this post about a CLIENT who WON'T PAY or is LATE PAYING for delivered work?

HYPOTHESIS: "${specificProblem}"

ONLY say Y if the post is about:
- A specific client who owes money and hasn't paid
- Being "ghosted" after delivering work
- Chasing payment from a non-paying client
- Invoice payment being overdue from a specific client

Say N for everything else, including:
- Publishing strategies, spec work, Substack decisions
- Getting clients, finding work, marketing
- Invoice software, templates, accounting questions
- General business advice, pricing, rates
- Customer satisfaction, reviews, feedback
- Personal debt, loans, credit cards
- "How do I survive" posts about money in general
- Plumbing, construction, or trade business general advice
- Contract disputes NOT specifically about payment

CRITICAL: If the post is about anything OTHER than a real client not paying for completed work, answer N.

POSTS:
${postSummaries}

Output format: ${batchLength} letters only. No explanation. Example: NNYNNN
Your response:`
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
    preFilterSkipped: 0,
    embeddingFiltered: 0,
    embeddingHighSimilarity: 0,
    embeddingMediumSimilarity: 0,
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

  sendProgress?.(`Starting 4-stage relevance filter on ${posts.length} posts...`)

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

  // PRE-FILTER: Rank posts by pre-score before AI processing
  // This prioritizes first-person language, engagement, and recency
  // Reduces AI costs by only sending top candidates to embedding gate
  const MAX_CANDIDATES_FOR_EMBEDDING = 300  // Increased since embeddings are cheap
  const { posts: rankedPosts } = preFilterAndRank(stage3.passed, MAX_CANDIDATES_FOR_EMBEDDING)
  metrics.preFilterSkipped = stage3.passed.length - rankedPosts.length
  if (metrics.preFilterSkipped > 0) {
    sendProgress?.(`Pre-filter: ranked ${stage3.passed.length} posts, sending top ${rankedPosts.length} to embedding gate (${metrics.preFilterSkipped} low-quality skipped)`)
  }

  // STAGE 0: Problem-Focused Embedding Gate (Dec 2025 Quality Improvement)
  // TWO-STAGE filter:
  // 1. KEYWORD GATE: Posts must contain at least one problem-specific keyword
  // 2. EMBEDDING GATE: Compare against problem-focused embeddings (not full hypothesis)
  //
  // This solves the 64% irrelevance problem by separating AUDIENCE from PROBLEM:
  // - Old: "Freelancers struggling to get paid" → "freelancer" vocabulary dominates embedding
  // - New: Extract "paid, payment, invoice, late" keywords + "not getting paid" problem text
  let postsForDomainGate = rankedPosts

  // Extract problem focus BEFORE embedding check - we need keywords for title-only posts too
  sendProgress?.(`Stage 0 (Embedding): extracting problem focus from hypothesis...`)
  const problemFocus = await extractProblemFocus(hypothesis)
  sendProgress?.(`Stage 0 (Embedding): extracted ${problemFocus.keywords.length} keywords: ${problemFocus.keywords.slice(0, 5).join(', ')}...`)

  if (isEmbeddingServiceAvailable()) {

    // Step 2: KEYWORD GATE - filter posts that don't mention the problem at all
    // This is a FREE filter that removes posts about "freelancer + wrong problem"
    let keywordGateFiltered = 0
    const postsWithKeywords: RedditPost[] = []

    for (const post of rankedPosts) {
      const postText = `${post.title} ${post.body || ''}`.toLowerCase()
      if (passesKeywordGate(postText, problemFocus.keywords)) {
        postsWithKeywords.push(post)
      } else {
        keywordGateFiltered++
        allDecisions.push({
          reddit_id: post.id,
          title: post.title,
          body_preview: (post.body || '').slice(0, 200),
          subreddit: post.subreddit,
          decision: 'N',
          stage: 'quality',
          reason: 'no_problem_keywords',
        })
      }
    }

    const phrases = problemFocus.keywords.filter(k => k.includes(' '))
    const singleWords = problemFocus.keywords.filter(k => !k.includes(' '))
    console.log(`[KeywordGate] Posts: ${postsWithKeywords.length}/${rankedPosts.length} passed (${keywordGateFiltered} filtered)`)
    console.log(`[KeywordGate] Phrases (${phrases.length}): ${phrases.slice(0, 5).join(', ')}...`)
    console.log(`[KeywordGate] SingleWords (${singleWords.length}): ${singleWords.join(', ')}`)
    sendProgress?.(`Stage 0 (Keyword Gate): ${postsWithKeywords.length}/${rankedPosts.length} posts contain problem keywords (${keywordGateFiltered} filtered)`)

    // Step 3: Generate a SINGLE problem-focused embedding
    // Dec 2025: Simplified from 3-facet to single embedding after research showed
    // text-embedding-3-large scores lower and multi-facet max() didn't help
    const hypothesisEmbedding = await generateEmbedding(problemFocus.problemText)

    if (hypothesisEmbedding && hypothesisEmbedding.length > 0 && postsWithKeywords.length > 0) {
      // Generate embeddings for posts that passed keyword gate
      const postTexts = postsWithKeywords.map(p => `${p.title} ${p.body || ''}`.slice(0, 500))
      sendProgress?.(`Stage 0 (Embedding): generating embeddings for ${postTexts.length} posts...`)

      const postEmbeddings = await generateEmbeddings(postTexts)

      // PHASE 1: Initial filter at standard threshold (0.35)
      let highSimilarity: RedditPost[] = []
      let mediumSimilarity: RedditPost[] = []
      let lowFiltered = 0
      const lowSimilarityPosts: { post: RedditPost; embedding: number[]; similarity: number }[] = []

      for (let i = 0; i < postsWithKeywords.length; i++) {
        const embedding = postEmbeddings[i]?.embedding
        if (!embedding || embedding.length === 0) {
          mediumSimilarity.push(postsWithKeywords[i])
          continue
        }

        // Pure cosine similarity (no boost in phase 1)
        const postText = `${postsWithKeywords[i].title} ${postsWithKeywords[i].body || ''}`
        const similarity = cosineSimilarity(hypothesisEmbedding, embedding)
        const tier = classifySimilarity(similarity)

        if (tier === 'HIGH') {
          highSimilarity.push(postsWithKeywords[i])
          console.log(`[Phase1] HIGH (${similarity.toFixed(3)}) "${postsWithKeywords[i].title?.slice(0, 50)}..."`)
        } else if (tier === 'MEDIUM') {
          mediumSimilarity.push(postsWithKeywords[i])
          console.log(`[Phase1] MEDIUM (${similarity.toFixed(3)}) "${postsWithKeywords[i].title?.slice(0, 50)}..."`)
        } else {
          // Track low-similarity posts for potential boost
          lowSimilarityPosts.push({ post: postsWithKeywords[i], embedding, similarity })
          lowFiltered++
        }
      }

      const initialCoverage = highSimilarity.length + mediumSimilarity.length
      console.log(`[Phase1] Initial coverage: ${initialCoverage} posts (MIN_COVERAGE: ${COVERAGE_BOOST_CONFIG.MIN_COVERAGE})`)

      // PHASE 2: Coverage boost if initial results < MIN_COVERAGE
      let boostKeywords: string[] = []
      if (initialCoverage < COVERAGE_BOOST_CONFIG.MIN_COVERAGE && lowSimilarityPosts.length > 0) {
        sendProgress?.(`Coverage boost: only ${initialCoverage} posts found, generating hypothesis keywords...`)

        // Generate dynamic keywords for this hypothesis
        boostKeywords = await generateHypothesisKeywords(hypothesis)

        if (boostKeywords.length > 0) {
          console.log(`[CoverageBoost] Generated ${boostKeywords.length} keywords: ${boostKeywords.slice(0, 5).join(', ')}...`)

          // Re-score low-similarity posts with keyword boost
          let boosted = 0
          for (const { post, embedding, similarity: baseSimilarity } of lowSimilarityPosts) {
            const postText = `${post.title} ${post.body || ''}`
            const boostedSimilarity = calculateBoostedSimilarity(hypothesisEmbedding, embedding, postText, boostKeywords)
            const tier = classifySimilarityWithThreshold(boostedSimilarity, SIMILARITY_THRESHOLDS.BOOSTED_MEDIUM)

            if (tier === 'HIGH') {
              highSimilarity.push(post)
              boosted++
              console.log(`[CoverageBoost] RECOVERED HIGH (${baseSimilarity.toFixed(3)} → ${boostedSimilarity.toFixed(3)}) "${post.title?.slice(0, 50)}..."`)
            } else if (tier === 'MEDIUM') {
              mediumSimilarity.push(post)
              boosted++
              console.log(`[CoverageBoost] RECOVERED MEDIUM (${baseSimilarity.toFixed(3)} → ${boostedSimilarity.toFixed(3)}) "${post.title?.slice(0, 50)}..."`)
            } else {
              // Still too low even with boost
              allDecisions.push({
                reddit_id: post.id,
                title: post.title,
                body_preview: (post.body || '').slice(0, 200),
                subreddit: post.subreddit,
                decision: 'N',
                stage: 'quality',
                reason: `low_similarity_${boostedSimilarity.toFixed(2)}`,
              })
            }
          }

          lowFiltered = lowFiltered - boosted
          sendProgress?.(`Coverage boost: recovered ${boosted} posts with keyword boost (keywords: ${boostKeywords.slice(0, 3).join(', ')}...)`)
        }
      } else {
        // No boost needed - add decisions for filtered posts
        for (const { post, similarity } of lowSimilarityPosts) {
          allDecisions.push({
            reddit_id: post.id,
            title: post.title,
            body_preview: (post.body || '').slice(0, 200),
            subreddit: post.subreddit,
            decision: 'N',
            stage: 'quality',
            reason: `low_similarity_${similarity.toFixed(2)}`,
          })
        }
      }

      metrics.embeddingHighSimilarity = highSimilarity.length
      metrics.embeddingMediumSimilarity = mediumSimilarity.length
      metrics.embeddingFiltered = keywordGateFiltered + lowFiltered

      // Combine HIGH and MEDIUM for next stage (HIGH first for priority)
      postsForDomainGate = [...highSimilarity, ...mediumSimilarity]

      const boostNote = boostKeywords.length > 0 ? ` [coverage boost applied]` : ''
      sendProgress?.(`Stage 0 (Embedding): ${highSimilarity.length} HIGH + ${mediumSimilarity.length} MEDIUM, ${lowFiltered} filtered${boostNote}`)
    } else if (postsWithKeywords.length > 0) {
      // Embedding failed but keyword gate passed - use keyword-filtered posts
      postsForDomainGate = postsWithKeywords
      metrics.embeddingFiltered = keywordGateFiltered
      sendProgress?.(`Stage 0 (Embedding): embedding failed, using ${postsWithKeywords.length} keyword-filtered posts`)
    } else {
      // No posts passed keyword gate
      postsForDomainGate = []
      metrics.embeddingFiltered = keywordGateFiltered
      sendProgress?.(`Stage 0 (Embedding): no posts contain problem keywords - check hypothesis specificity`)
    }
  } else {
    sendProgress?.(`Stage 0 (Embedding): OPENAI_API_KEY not set, skipping embedding filter`)
  }

  // STAGE 1 & 2: AI Gates (Domain Gate + Problem Match)
  // Dec 2025: These are now optional - calibrated embeddings handle relevance
  let stage2Core: RedditPost[] = []
  let stage2Related: RedditPost[] = []
  let domain = ''
  let antiDomains: string[] = []

  if (SKIP_AI_GATES) {
    // BYPASS: Trust calibrated embeddings, skip Haiku/Sonnet calls
    // All embedding-passed posts go to CORE tier (they already passed 0.35 threshold)
    sendProgress?.(`AI Gates: SKIPPED (SKIP_AI_GATES=true) - ${postsForDomainGate.length} posts passed to CORE tier`)
    console.log(`[AI Gates] SKIPPED - trusting calibrated embeddings (threshold 0.35 + keyword boost)`)

    stage2Core = postsForDomainGate
    stage2Related = []
    metrics.stage1Filtered = 0
    metrics.stage2Filtered = 0
  } else {
    // STAGE 1: Domain Gate (fast, cheap AI filter)
    const domainResult = await extractProblemDomain(hypothesis, structured)
    domain = domainResult.domain
    antiDomains = domainResult.antiDomains
    sendProgress?.(`Extracted problem domain: "${domain}"`)

    const stage1 = await domainGateFilter(
      postsForDomainGate,
      domain,
      antiDomains,
      sendProgress
    )
    metrics.stage1Filtered = stage1.filtered.length
    allDecisions.push(...stage1.decisions)

    // Log Domain Gate results
    console.log(`[DomainGate] ${stage1.passed.length} passed, ${stage1.filtered.length} filtered`)
    for (const post of stage1.passed) {
      console.log(`[DomainGate] PASS: "${post.title?.slice(0, 60)}..."`)
    }
    for (const post of stage1.filtered.slice(0, 5)) {
      const decision = stage1.decisions.find(d => d.reddit_id === post.id)
      console.log(`[DomainGate] FAIL: "${post.title?.slice(0, 60)}..." reason=${decision?.reason || 'unknown'}`)
    }

    // STAGE 2: Problem Match (tiered filter) - for full posts
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

      // Log Problem Match results
      console.log(`[ProblemMatch] ${stage2.core.length} CORE, ${stage2.related.length} RELATED, ${stage2.filtered.length} filtered`)
      for (const post of stage2.core) {
        console.log(`[ProblemMatch] CORE: "${post.title?.slice(0, 60)}..."`)
      }
      for (const post of stage2.related) {
        console.log(`[ProblemMatch] RELATED: "${post.title?.slice(0, 60)}..."`)
      }
      for (const post of stage2.filtered.slice(0, 3)) {
        const decision = stage2.decisions.find(d => d.reddit_id === post.id)
        console.log(`[ProblemMatch] FAIL: "${post.title?.slice(0, 60)}..." reason=${decision?.reason || 'unknown'}`)
      }
    }
  }

  // P0 FIX: ALWAYS include removed posts (not just when sparse)
  // These are analyzed by title only and weighted at 0.7x
  let titleOnlyCore: RedditPost[] = []
  let titleOnlyRelated: RedditPost[] = []
  if (stage3.titleOnly.length > 0) {
    sendProgress?.(`Including ${stage3.titleOnly.length} posts with [removed] bodies (title only)...`)

    // Dec 2025: Add keyword gate for title-only posts to close loophole
    // Title-only posts were bypassing embedding filter and letting irrelevant signals through
    const titleOnlyWithKeywords = (stage3.titleOnly as RedditPost[]).filter(post =>
      passesKeywordGate(post.title, problemFocus.keywords)
    )
    const titleOnlyKeywordFiltered = stage3.titleOnly.length - titleOnlyWithKeywords.length
    if (titleOnlyKeywordFiltered > 0) {
      console.log(`[Title-only] Keyword gate: ${titleOnlyWithKeywords.length}/${stage3.titleOnly.length} passed (${titleOnlyKeywordFiltered} filtered)`)
    }

    // Mark title-only posts - they'll be weighted at 0.7x in pain detection
    const markAsTitleOnly = (post: RedditPost): RedditPost => ({
      ...post,
      body: `[Title-only analysis] ${post.title}`,
      _titleOnly: true,
    } as RedditPost)

    if (SKIP_AI_GATES) {
      // BYPASS: Trust keyword gate for title-only posts
      titleOnlyCore = titleOnlyWithKeywords.map(markAsTitleOnly)
      titleOnlyRelated = []
      metrics.titleOnlyPosts = titleOnlyCore.length
      sendProgress?.(`Title-only: ${titleOnlyCore.length} posts passed keyword gate (AI gates skipped)`)
    } else {
      // Run domain gate on title-only posts with lenient mode (titles have less context)
      const titleOnlyDomain = await domainGateFilter(
        titleOnlyWithKeywords,
        domain,
        antiDomains,
        (msg) => sendProgress?.(`[Title-only] ${msg}`),
        true  // lenientMode for title-only posts
      )

      if (titleOnlyDomain.passed.length > 0) {
        // Run problem match on domain-passed title-only posts
        const titleOnlyProblem = await problemMatchFilter(
          titleOnlyDomain.passed,
          hypothesis,
          structured,
          (msg) => sendProgress?.(`[Title-only] ${msg}`)
        )

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
  // When SKIP_AI_GATES=true, use embedding-passed count; otherwise use domain gate passed count
  const stage1PassedCount = SKIP_AI_GATES ? postsForDomainGate.length : (stage2Core.length + stage2Related.length + metrics.stage2Filtered)
  if (stage1PassedCount > 0 && !SKIP_AI_GATES) {
    metrics.stage2FilterRate = (metrics.stage2Filtered / stage1PassedCount) * 100
    // Only flag as narrow problem if BOTH:
    // 1. >70% of domain-relevant posts fail problem matching (raised from 50% to reduce false positives)
    // 2. We ended up with very few relevant posts (< 15), so the narrowness actually hurts the analysis
    metrics.narrowProblemWarning = metrics.stage2FilterRate > 70 && metrics.after < 15
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
    preFilterSkipped: 0,  // Low-quality comments skipped before AI processing
    embeddingFiltered: 0,  // Not used for comments yet
    embeddingHighSimilarity: 0,
    embeddingMediumSimilarity: 0,
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

  // PRE-FILTER: Rank comments by pre-score before AI processing
  // This prioritizes first-person language and engagement
  // Reduces AI costs by only sending top candidates
  const MAX_COMMENT_CANDIDATES_FOR_AI = 200
  const { comments: rankedComments } = preFilterAndRankComments(stage3.passed, MAX_COMMENT_CANDIDATES_FOR_AI)
  metrics.preFilterSkipped = stage3.passed.length - rankedComments.length

  // STAGE 0: Problem-Focused Embedding Gate for comments (Dec 2025 Quality Improvement)
  // Same two-stage approach as posts: keyword gate + problem-focused embeddings
  let commentsForAI = rankedComments

  if (isEmbeddingServiceAvailable()) {
    // Step 1: Extract problem keywords and problem-focused text
    const problemFocus = await extractProblemFocus(hypothesis)

    // Step 2: KEYWORD GATE - filter comments that don't mention the problem
    let keywordGateFiltered = 0
    const commentsWithKeywords: RedditComment[] = []

    for (const comment of rankedComments) {
      if (passesKeywordGate(comment.body, problemFocus.keywords)) {
        commentsWithKeywords.push(comment)
      } else {
        keywordGateFiltered++
        allDecisions.push({
          reddit_id: comment.id,
          body_preview: comment.body.slice(0, 200),
          subreddit: comment.subreddit,
          decision: 'N',
          stage: 'quality',
          reason: 'no_problem_keywords',
        })
      }
    }

    // Step 3: Generate a SINGLE problem-focused embedding (simplified from 3-facet)
    const commentHypothesisEmbedding = await generateEmbedding(problemFocus.problemText)

    if (commentHypothesisEmbedding && commentHypothesisEmbedding.length > 0 && commentsWithKeywords.length > 0) {
      const commentTexts = commentsWithKeywords.map(c => c.body.slice(0, 500))
      const commentEmbeddings = await generateEmbeddings(commentTexts)

      // PHASE 1: Initial filter at standard threshold (0.35)
      let highSimilarity: RedditComment[] = []
      let mediumSimilarity: RedditComment[] = []
      let embeddingFiltered = 0
      const lowSimilarityComments: { comment: RedditComment; embedding: number[]; similarity: number }[] = []

      for (let i = 0; i < commentsWithKeywords.length; i++) {
        const embedding = commentEmbeddings[i]?.embedding
        if (!embedding || embedding.length === 0) {
          mediumSimilarity.push(commentsWithKeywords[i])
          continue
        }

        // Pure cosine similarity (no boost in phase 1)
        const similarity = cosineSimilarity(commentHypothesisEmbedding, embedding)
        const tier = classifySimilarity(similarity)

        if (tier === 'HIGH') {
          highSimilarity.push(commentsWithKeywords[i])
        } else if (tier === 'MEDIUM') {
          mediumSimilarity.push(commentsWithKeywords[i])
        } else {
          lowSimilarityComments.push({ comment: commentsWithKeywords[i], embedding, similarity })
          embeddingFiltered++
        }
      }

      const initialCoverage = highSimilarity.length + mediumSimilarity.length

      // PHASE 2: Coverage boost if initial results < MIN_COVERAGE
      if (initialCoverage < COVERAGE_BOOST_CONFIG.MIN_COVERAGE && lowSimilarityComments.length > 0) {
        const boostKeywords = await generateHypothesisKeywords(hypothesis)

        if (boostKeywords.length > 0) {
          let boosted = 0
          for (const { comment, embedding, similarity: baseSimilarity } of lowSimilarityComments) {
            const boostedSimilarity = calculateBoostedSimilarity(commentHypothesisEmbedding, embedding, comment.body, boostKeywords)
            const tier = classifySimilarityWithThreshold(boostedSimilarity, SIMILARITY_THRESHOLDS.BOOSTED_MEDIUM)

            if (tier === 'HIGH') {
              highSimilarity.push(comment)
              boosted++
            } else if (tier === 'MEDIUM') {
              mediumSimilarity.push(comment)
              boosted++
            } else {
              allDecisions.push({
                reddit_id: comment.id,
                body_preview: comment.body.slice(0, 200),
                subreddit: comment.subreddit,
                decision: 'N',
                stage: 'quality',
                reason: `low_similarity_${boostedSimilarity.toFixed(2)}`,
              })
            }
          }
          embeddingFiltered = embeddingFiltered - boosted
        }
      } else {
        // No boost needed - add decisions for filtered comments
        for (const { comment, similarity } of lowSimilarityComments) {
          allDecisions.push({
            reddit_id: comment.id,
            body_preview: comment.body.slice(0, 200),
            subreddit: comment.subreddit,
            decision: 'N',
            stage: 'quality',
            reason: `low_similarity_${similarity.toFixed(2)}`,
          })
        }
      }

      metrics.embeddingHighSimilarity = highSimilarity.length
      metrics.embeddingMediumSimilarity = mediumSimilarity.length
      metrics.embeddingFiltered = keywordGateFiltered + embeddingFiltered

      commentsForAI = [...highSimilarity, ...mediumSimilarity]
    } else if (commentsWithKeywords.length > 0) {
      // Embedding failed but keyword gate passed
      commentsForAI = commentsWithKeywords
      metrics.embeddingFiltered = keywordGateFiltered
    } else {
      // No comments passed keyword gate
      commentsForAI = []
      metrics.embeddingFiltered = keywordGateFiltered
    }
  }

  // Stage 2: AI relevance check (optional when SKIP_AI_GATES=true)
  let passed: RedditComment[] = []
  const filtered: RedditComment[] = []

  if (SKIP_AI_GATES) {
    // BYPASS: Trust calibrated embeddings, skip Haiku calls
    console.log(`[Comments AI Gate] SKIPPED - ${commentsForAI.length} comments passed to output`)
    passed = commentsForAI
    metrics.stage2Filtered = 0
  } else {
    const batchSize = 25

    for (let i = 0; i < commentsForAI.length; i += batchSize) {
      const batch = commentsForAI.slice(i, i + batchSize)

      const summaries = batch.map((c, idx) => `[${idx + 1}] ${c.body.slice(0, 200)}`).join('\n\n')

      // Phase 0 Data Quality Initiative: Tightened from loose "discusses problem"
      // to strict first-person + explicit problem expression matching
      const problemDescription = structured?.problem || hypothesis
      const audienceDescription = structured?.audience || ''

      const prompt = `STRICT RELEVANCE CHECK for comments - require FIRSTHAND EXPERIENCE.

THE SPECIFIC PROBLEM: ${problemDescription}
TARGET AUDIENCE: ${audienceDescription}${structured?.problemLanguage ? `
PHRASES THAT INDICATE A MATCH: ${structured.problemLanguage}` : ''}

Y (PASS) REQUIRES ALL:
1. First-person language ("I", "we", "my") describing their OWN experience
2. EXPLICIT expression of THIS SPECIFIC PROBLEM (not just related topics)
3. Evidence of pain, frustration, or active solution-seeking

N (REJECT) IF:
- Generic advice or opinions ("you should...", "people usually...")
- Third-party observations ("many users say...", "it's common to...")
- Related topic but DIFFERENT problem
- Curiosity questions without personal experience
- Explicitly conflicting demographics (e.g., "23F" for hypothesis about "men in 40s")

When in doubt, classify as N - only pass comments with clear firsthand pain signals.

Comments:
${summaries}

Respond with ${batch.length} letters (Y or N):`

      try {
        // Embeddings pre-filter handles semantic relevance (Stage 0 above)
        // Haiku does final strict problem-match pass
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
  }

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

// ============================================================================
// QUALITY SAMPLING (for pre-research quality prediction)
// ============================================================================

export interface BroadeningSuggestion {
  phrase: string           // The narrow phrase detected (e.g., "christmas and new years")
  suggestion: string       // The suggestion text
  broaderHypothesis?: string  // Optional: the hypothesis without this phrase
}

export interface QualitySampleResult {
  predictedRelevance: number  // 0-100 percentage
  predictedConfidence: 'very_low' | 'low' | 'medium' | 'high'
  qualityWarning: 'none' | 'caution' | 'strong_warning'

  // Actual sample size used for prediction (UI only shows subset)
  sampleSize: number

  // Rate of removed/unavailable posts in selected communities (0-100)
  removedPostRate?: number

  // Sample posts for user to see (subset of actual sample)
  sampleRelevant: Array<{
    title: string
    body_preview: string
    subreddit: string
  }>
  sampleFiltered: Array<{
    title: string
    body_preview: string
    subreddit: string
    filterReason: string
  }>

  // What topics were filtered (for "Your audience talks more about X")
  filteredTopics: Array<{ topic: string; count: number }>

  // Suggestion if quality is low
  suggestion?: string

  // Broadening suggestions when hypothesis is too narrow
  broadenings?: BroadeningSuggestion[]
}

/**
 * Detect narrow qualifiers in a hypothesis that could be removed to broaden the search
 */
function detectNarrowQualifiers(hypothesis: string): BroadeningSuggestion[] {
  const suggestions: BroadeningSuggestion[] = []
  const lowerHypothesis = hypothesis.toLowerCase()

  // Temporal/seasonal patterns - order matters! More specific patterns should come first
  const temporalPatterns: Array<{pattern: RegExp, suggestion: string, category: string}> = [
    {
      // MOST SPECIFIC: Catch "during major holidays (especially ...)" as a complete phrase
      // Must come first so it captures the whole phrase, not just the parenthetical
      pattern: /during\s+(major\s+)?holidays?\s*\((especially\s+)?(christmas(\s+(and|&)\s+new\s*year'?s?)?|new\s*year'?s?)\)/gi,
      suggestion: 'Remove holiday timing to find year-round discussions',
      category: 'seasonal'
    },
    {
      // Catch full phrases like "especially during christmas and new years"
      pattern: /\b(especially|particularly|specifically)?\s*(during)\s+(the\s+)?(christmas(\s+and\s+new\s*year'?s?)?|new\s*year'?s?(\s+and\s+christmas)?|holidays?|holiday\s+season|winter|summer|spring|fall|autumn)\b/gi,
      suggestion: 'Remove seasonal timing to find year-round discussions',
      category: 'seasonal'
    },
    {
      // Catch Claude's rephrased versions like "major holidays like Christmas"
      pattern: /\b(major\s+)?holidays?\s*(like|such as)\s+(christmas(\s+(and|&)\s+new\s*year'?s?)?|new\s*year'?s?)/gi,
      suggestion: 'Remove holiday timing to find year-round discussions',
      category: 'seasonal'
    },
    {
      // Catch parenthetical holiday references from Claude's interpretations
      // Matches: "(Christmas and New Year's)", "(especially Christmas and New Year's)"
      pattern: /\((especially\s+)?(christmas(\s+(and|&)\s+new\s*year'?s?)?|new\s*year'?s?(\s+(and|&)\s+christmas)?)\)/gi,
      suggestion: 'Remove holiday reference to find year-round discussions',
      category: 'seasonal'
    },
    {
      // Only match standalone holiday references if not caught above
      pattern: /\b(thanksgiving|black friday|valentine'?s?\s+day|mother'?s?\s+day|father'?s?\s+day)\b/gi,
      suggestion: 'Remove holiday reference to find year-round discussions',
      category: 'holiday'
    },
    {
      pattern: /\b(in the (morning|evening|night|afternoon)|at night|during (work|business) hours)\b/gi,
      suggestion: 'Remove time-of-day constraint to broaden results',
      category: 'time_of_day'
    },
    {
      pattern: /\b(first\s+time|for the first time|when starting|just started|new to)\b/gi,
      suggestion: 'Remove "first time" to include experienced users too',
      category: 'experience'
    },
  ]

  // Geographic/location patterns
  const geoPatterns: Array<{pattern: RegExp, suggestion: string}> = [
    {
      pattern: /\b(in (europe|asia|america|africa|australia|canada|uk|us|usa))\b/gi,
      suggestion: 'Remove geographic restriction to find global discussions',
    },
    {
      pattern: /\b(moving to|relocating to|living in)\s+[A-Z][a-z]+/g,
      suggestion: 'Remove specific destination to find broader relocation discussions',
    },
  ]

  // Very specific demographic patterns
  const demographicPatterns: Array<{pattern: RegExp, suggestion: string}> = [
    {
      pattern: /\b(in their\s+)?(20s|30s|40s|50s|60s|70s)\b/gi,
      suggestion: 'Remove age range to find discussions from all ages',
    },
    {
      pattern: /\b(who (work|works) (in|at|for)\s+[a-z]+)\b/gi,
      suggestion: 'Remove specific job type to broaden audience',
    },
  ]

  // Helper to escape regex special characters for use in new RegExp()
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Check temporal patterns (with category deduplication)
  const foundCategories = new Set<string>()
  for (const {pattern, suggestion, category} of temporalPatterns) {
    const match = lowerHypothesis.match(pattern)
    if (match && !foundCategories.has(category)) {
      foundCategories.add(category)
      const phrase = match[0]
      suggestions.push({
        phrase,
        suggestion,
        broaderHypothesis: hypothesis.replace(new RegExp(escapeRegex(phrase), 'gi'), '').replace(/\s+/g, ' ').trim()
      })
    }
  }

  // Check geographic patterns
  for (const {pattern, suggestion} of geoPatterns) {
    const match = lowerHypothesis.match(pattern)
    if (match) {
      suggestions.push({
        phrase: match[0],
        suggestion,
      })
    }
  }

  // Check demographic patterns
  for (const {pattern, suggestion} of demographicPatterns) {
    const match = lowerHypothesis.match(pattern)
    if (match) {
      suggestions.push({
        phrase: match[0],
        suggestion,
      })
    }
  }

  // Return up to 3 suggestions
  return suggestions.slice(0, 3)
}

/**
 * Quick quality sampling for coverage-check
 * Runs relevance filter on a sample of posts to predict final quality
 *
 * Cost: ~$0.01 (40 posts through Haiku domain gate)
 */
export async function sampleQualityCheck(
  posts: RedditPost[],
  hypothesis: string,
  structured?: StructuredHypothesis
): Promise<QualitySampleResult> {
  // Take up to 40 random posts for sampling
  const sampleSize = Math.min(40, posts.length)
  const shuffled = [...posts].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, sampleSize)

  if (sample.length < 10) {
    return {
      predictedRelevance: 0,
      predictedConfidence: 'very_low',
      qualityWarning: 'strong_warning',
      sampleSize: sample.length,
      sampleRelevant: [],
      sampleFiltered: [],
      filteredTopics: [],
      suggestion: 'Very few posts found. Try different keywords or communities.',
    }
  }

  // Stage 1: Quality gate (free, code-only)
  const { passed: qualityPassed, filtered: qualityFiltered, titleOnly, decisions: qualityDecisions } = qualityGateFilter(sample)

  // Calculate removed post rate (title-only + removed_deleted = unavailable content)
  const removedCount = qualityDecisions.filter(d =>
    d.reason === 'title_only' || d.reason === 'removed_deleted'
  ).length
  const removedPostRate = sample.length > 0 ? Math.round((removedCount / sample.length) * 100) : 0

  // Stage 2: Extract domain for gate filter
  const { domain, antiDomains } = await extractProblemDomain(hypothesis, structured)

  // Stage 3: Domain gate filter (cheap Haiku call)
  const { passed: domainPassed, filtered: domainFiltered, decisions: domainDecisions } =
    await domainGateFilter(qualityPassed, domain, antiDomains)

  // Calculate predicted relevance
  const predictedRelevance = sample.length > 0
    ? Math.round((domainPassed.length / sample.length) * 100)
    : 0

  // Determine confidence level based on expected final signals
  // If 40 samples → X% pass → expect (totalPosts * X%) relevant
  // We'll estimate conservatively since problem match filter will reduce further
  const estimatedSignals = domainPassed.length * 0.6  // ~40% filtered by problem match

  let predictedConfidence: QualitySampleResult['predictedConfidence']
  if (estimatedSignals < 10) {
    predictedConfidence = 'very_low'
  } else if (estimatedSignals < 20) {
    predictedConfidence = 'low'
  } else if (estimatedSignals < 40) {
    predictedConfidence = 'medium'
  } else {
    predictedConfidence = 'high'
  }

  // Determine warning level
  // Note: Sample uses title-only posts, so actual relevance is typically higher
  // Only show strong warning for very low relevance (< 8%)
  let qualityWarning: QualitySampleResult['qualityWarning'] = 'none'
  if (predictedRelevance < 8) {
    qualityWarning = 'strong_warning'
  } else if (predictedRelevance < 20) {
    qualityWarning = 'caution'
  }

  // Prepare sample relevant posts (up to 3)
  const sampleRelevant = domainPassed.slice(0, 3).map(post => ({
    title: post.title,
    body_preview: (post.body || '').slice(0, 150) + ((post.body || '').length > 150 ? '...' : ''),
    subreddit: post.subreddit,
  }))

  // Prepare sample filtered posts with reasons (up to 5)
  const sampleFiltered = domainFiltered.slice(0, 5).map(post => {
    const decision = domainDecisions.find(d => d.reddit_id === post.id)
    return {
      title: post.title,
      body_preview: (post.body || '').slice(0, 100) + ((post.body || '').length > 100 ? '...' : ''),
      subreddit: post.subreddit,
      filterReason: decision?.reason || 'Off-topic',
    }
  })

  // Analyze filtered topics - group by apparent topic
  const filteredTopics = analyzeFilteredTopics(domainFiltered, domain)

  // Detect narrow qualifiers that could be broadened
  const broadenings = predictedRelevance < 30 ? detectNarrowQualifiers(hypothesis) : []

  // Generate suggestion based on results
  // Only show suggestions for truly problematic relevance levels
  let suggestion: string | undefined
  if (removedPostRate >= 50) {
    // High removed rate is a bigger issue than low relevance
    suggestion = `${removedPostRate}% of posts in these communities have been removed by moderators. Consider trying different communities with more active discussions.`
  } else if (predictedRelevance < 8) {
    if (broadenings.length > 0) {
      suggestion = `Your hypothesis may be too specific. Consider broadening to find more discussions.`
    } else {
      suggestion = 'Very few matching posts found. Try different communities or broaden your hypothesis.'
    }
  } else if (predictedRelevance < 15 && broadenings.length > 0) {
    suggestion = 'You can broaden your hypothesis to find more discussions.'
  }
  // Don't show suggestions for 15%+ - that's actually normal/fine

  return {
    predictedRelevance,
    predictedConfidence,
    qualityWarning,
    sampleSize: sample.length,
    removedPostRate: removedPostRate > 0 ? removedPostRate : undefined,
    sampleRelevant,
    sampleFiltered,
    filteredTopics,
    suggestion,
    broadenings: broadenings.length > 0 ? broadenings : undefined,
  }
}

/**
 * Analyze filtered posts to find common off-topic themes
 */
function analyzeFilteredTopics(
  filteredPosts: RedditPost[],
  targetDomain: string
): Array<{ topic: string; count: number }> {
  if (filteredPosts.length < 3) return []

  // Simple keyword extraction from filtered posts
  const topicCounts = new Map<string, number>()

  // Common topic patterns by subreddit type
  const topicPatterns: Array<{ pattern: RegExp; topic: string }> = [
    { pattern: /\b(honey|harvest|extract|jar|sell)\b/i, topic: 'honey harvesting' },
    { pattern: /\b(photo|pic|look at|check out|show off)\b/i, topic: 'sharing photos' },
    { pattern: /\b(identify|what is|what kind|species)\b/i, topic: 'identification' },
    { pattern: /\b(buy|purchase|where to get|recommend|best)\b/i, topic: 'product recommendations' },
    { pattern: /\b(beginner|started|new to|first time)\b/i, topic: 'getting started' },
    { pattern: /\b(recipe|cook|food|meal|eat)\b/i, topic: 'recipes/food' },
    { pattern: /\b(sell|business|money|income|profit)\b/i, topic: 'business/selling' },
  ]

  for (const post of filteredPosts) {
    const text = `${post.title} ${post.body || ''}`.toLowerCase()

    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(text) && !topic.toLowerCase().includes(targetDomain.toLowerCase())) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      }
    }
  }

  // Sort by count and return top 3, but only if count >= 3 (meaningful signal)
  return Array.from(topicCounts.entries())
    .filter(([, count]) => count >= 3) // Require minimum 3 posts to be meaningful
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}
