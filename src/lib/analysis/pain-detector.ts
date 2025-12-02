// Pain Signal Detection
// Analyzes Reddit posts/comments to identify and score pain signals
// Based on PVRE Scoring Framework - Pain Score (35% weight in Viability Verdict)
//
// v2.0 - Enhanced scoring with negative context patterns and WTP exclusions

import { RedditPost, RedditComment } from '../data-sources/types'

// =============================================================================
// NEGATIVE CONTEXT PATTERNS - Reduce false positives
// =============================================================================
// These patterns indicate the pain keyword is used in a non-pain context
// e.g., "hate the competition" is about competitors, not user pain

const NEGATIVE_CONTEXT_PATTERNS = [
  // Talking about competition, not personal pain
  /hate\s+(?:the\s+)?(?:competition|competitor|rivals?)/i,
  /frustrated\s+(?:with\s+)?(?:the\s+)?(?:competition|competitor)/i,

  // General statements, not personal experience
  /it's\s+(?:not\s+)?(?:terrible|awful|horrible)\s+(?:that|when)/i,
  /(?:some|many|most)\s+people\s+(?:are\s+)?(?:frustrated|struggling)/i,

  // Asking about others' experience, not expressing own pain
  /(?:is\s+it|are\s+you)\s+(?:frustrated|struggling|having\s+trouble)/i,
  /anyone\s+else\s+(?:frustrated|struggling|tired\s+of)/i,

  // Hypothetical or conditional statements
  /(?:would|could|might)\s+be\s+(?:frustrated|terrible|awful)/i,
  /if\s+(?:you|they|one)\s+(?:were|are)\s+(?:frustrated|struggling)/i,

  // Past tense resolved issues
  /used\s+to\s+(?:be\s+)?(?:frustrated|struggle|hate)/i,
  /was\s+(?:frustrated|struggling)\s+(?:but|until)/i,

  // Talking about a product they like having issues
  /(?:love|like)\s+(?:it|this|the\s+app)\s+(?:but|even\s+though)/i,
]

// =============================================================================
// WTP EXCLUSION PATTERNS - Reduce false positives for willingness to pay
// =============================================================================
// These patterns contain WTP keywords but don't indicate actual purchase intent

const WTP_EXCLUSION_PATTERNS = [
  // Budget as organizational/planning term
  /budget\s+(?:cut|meeting|review|planning|approval|constraint|limit)/i,
  /(?:company|department|team)\s+budget/i,
  /budget\s+(?:was|is|has\s+been)\s+(?:cut|reduced|slashed)/i,

  // Pricing complaints (opposite of WTP)
  /pricing\s+is\s+(?:crazy|insane|ridiculous|absurd)/i,
  /(?:too\s+)?expensive\s+(?:for|to)/i,
  /(?:can't|cannot)\s+afford/i,
  /(?:price|cost)\s+(?:is\s+)?(?:too\s+)?(?:high|steep)/i,

  // ROI skepticism
  /(?:not\s+)?(?:sure|certain)\s+(?:about\s+)?(?:the\s+)?roi/i,
  /roi\s+(?:is|seems)\s+(?:unclear|questionable|not\s+clear)/i,

  // Investment as general term (not purchase intent)
  /(?:time|emotional)\s+investment/i,
  /invest(?:ing)?\s+(?:in\s+)?(?:yourself|learning|skills)/i,

  // Subscription complaints
  /(?:too\s+many|another)\s+subscription/i,
  /subscription\s+fatigue/i,
  /(?:cancel|cancelled|canceling)\s+(?:my\s+)?subscription/i,

  // Worth/value in negative context
  /(?:not|isn't|wasn't)\s+worth\s+(?:it|the\s+money|paying)/i,
]

// =============================================================================
// KEYWORD TIERS - Comprehensive pain signal detection
// =============================================================================

// Tier 3: High intensity (weight: 3 points) - Strong emotional pain signals
const HIGH_INTENSITY_KEYWORDS = [
  // Frustration cluster
  'nightmare', 'nightmarish', 'hate', 'hated', 'hating',
  'frustrated', 'frustrating', 'frustration',
  'desperate', 'desperately', 'furious', 'infuriating',
  'fed up', 'sick of', 'tired of', 'done with',
  "can't stand", 'cannot stand', 'at my wit\'s end',

  // Extreme negative
  'terrible', 'terribly', 'awful', 'awfully', 'horrible', 'horrendous',
  'worst', 'impossible', 'impossibly', 'unbearable',
  'broken', 'useless', 'worthless', 'pointless',

  // Exhaustion/burnout
  'exhausted', 'exhausting', 'overwhelmed', 'overwhelms',
  'burning out', 'burnt out', 'burned out',
  'killing me', 'driving me crazy', 'driving me insane',

  // Giving up signals
  'giving up', 'gave up', 'give up', 'about to quit',
  'ready to quit', 'breaking point', 'last straw',

  // Value negative
  'waste of time', 'waste of money', 'total waste',
  'complete disaster', 'absolute mess', 'utter failure',
]

// Tier 2: Medium intensity (weight: 2 points) - Clear problem signals
const MEDIUM_INTENSITY_KEYWORDS = [
  // Struggle cluster
  'struggle', 'struggling', 'struggled', 'struggles',
  'difficult', 'difficulty', 'difficulties',
  'hard', 'harder', 'hardest',
  'challenging', 'challenge', 'challenges',

  // Problem/issue cluster
  'problem', 'problems', 'problematic',
  'issue', 'issues', 'issues with',
  'concern', 'concerned', 'concerning', 'concerns',
  'worried', 'worry', 'worrying',

  // Confusion cluster
  'confusing', 'confused', 'confusion',
  'unclear', 'complicated', 'complex',
  'overwhelming', 'overwhelming amount',

  // Annoyance cluster
  'annoying', 'annoyed', 'annoyance', 'irritating', 'irritated',
  'disappointing', 'disappointed', 'disappointment',
  'lacking', 'missing', 'incomplete', 'inadequate',

  // Blocked/stuck
  'stuck', 'blocked', 'blocking', 'obstacle',
  'failing', 'failed', 'fail', 'failure',
  'not working', "doesn't work", "won't work", "isn't working",
  "can't figure out", 'cannot figure out',
  'no idea how', "don't know how", "don't understand",

  // Time/effort negative
  'takes too long', 'time consuming', 'tedious',
  'manual process', 'repetitive', 'cumbersome',
]

// Tier 1: Low intensity (weight: 1 point) - Mild interest/exploration signals
const LOW_INTENSITY_KEYWORDS = [
  'wondering', 'curious', 'curious about',
  'thinking about', 'considering', 'contemplating',
  'looking into', 'exploring', 'researching',
  'might', 'maybe', 'perhaps',
  'sometimes', 'occasionally', 'once in a while',
  'wish there was', 'wish I could', 'would be nice',
  'could be better', 'room for improvement',
]

// Solution-seeking (weight: 2 points) - Shows active demand
const SOLUTION_SEEKING_KEYWORDS = [
  // Direct asks
  'looking for', 'searching for', 'seeking',
  'in search of', 'trying to find', 'need to find',

  // Recommendation requests
  'anyone know', 'does anyone know', 'anybody know',
  'recommendations', 'recommend', 'recommended',
  'suggestions', 'suggest', 'suggested',
  'advice', 'advise', 'guidance',

  // Help requests
  'help with', 'need help', 'please help', 'can someone help',
  'how do i', 'how can i', 'how should i', 'how would i',
  'what do you use', 'what should i use', 'what would you recommend',
  'best way to', 'better way to', 'easier way to',

  // Alternatives
  'alternatives', 'alternative to', 'instead of',
  'similar to', 'like but',

  // Tips/ideas
  'tips', 'tip for', 'tricks', 'hacks',
  'any ideas', 'any thoughts', 'any suggestions',
  'would appreciate', 'greatly appreciate',
]

// Willingness to Pay signals (weight: 4 points) - STRONGEST signal
const WILLINGNESS_TO_PAY_KEYWORDS = {
  // Strong intent (high confidence)
  strongIntent: [
    'would pay', 'willing to pay', 'happy to pay',
    "i'd pay", 'i would pay', "i'll pay",
    'take my money', 'shut up and take',
    'worth paying', 'worth every penny',
    'money is no object', 'whatever it costs',
  ],
  // Financial discussion (medium confidence)
  financialDiscussion: [
    'budget', 'budgeting', 'budget for',
    'pricing', 'price point', 'price range',
    'how much does', 'how much would', 'cost of',
    'investment', 'invest in', 'roi',
    'subscription', 'subscribe', 'monthly fee',
    'premium', 'upgrade', 'pro version', 'paid version',
  ],
  // Purchase intent (medium confidence)
  purchaseIntent: [
    'where can i buy', 'where to buy', 'how to purchase',
    'looking to invest', 'ready to invest',
    'considering paying', 'thinking of paying',
  ],
  // Value signals (lower confidence but still relevant)
  valueSignals: [
    'worth the money', 'worth it', 'value for money',
    'save time', 'save money', 'save hours',
    'pay for convenience', 'pay for quality',
  ],
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface PainSignal {
  text: string
  title?: string
  score: number
  intensity: 'low' | 'medium' | 'high'
  signals: string[]
  solutionSeeking: boolean
  willingnessToPaySignal: boolean
  wtpConfidence: 'none' | 'low' | 'medium' | 'high'
  source: {
    type: 'post' | 'comment'
    id: string
    subreddit: string
    author: string
    url: string
    createdUtc: number
    engagementScore: number
  }
}

export interface ScoreResult {
  score: number
  signals: string[]
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  wtpConfidence: 'none' | 'low' | 'medium' | 'high'
  strongestSignal: string | null
  // v2.0: Context flags for debugging
  hasNegativeContext: boolean
  hasWTPExclusion: boolean
}

export interface PainSummary {
  totalSignals: number
  averageScore: number
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  topSubreddits: { name: string; count: number }[]
  // Transparency metrics
  dataConfidence: 'very_low' | 'low' | 'medium' | 'high'
  strongestSignals: string[]
  wtpQuotes: { text: string; subreddit: string }[]
  // v3.0: Temporal distribution for recency awareness
  temporalDistribution: {
    last30Days: number
    last90Days: number
    last180Days: number
    older: number
  }
  // Date range of data analyzed
  dateRange?: {
    oldest: string // ISO date string
    newest: string // ISO date string
  }
  // Average recency score (0-1, higher = more recent)
  recencyScore: number
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a keyword exists in text with word boundaries
 * Prevents false positives like "hard" matching "hardly"
 */
function matchKeyword(text: string, keyword: string): boolean {
  // For multi-word phrases, use simple includes
  if (keyword.includes(' ')) {
    return text.includes(keyword)
  }

  // For single words, use word boundary regex
  // Escape special regex characters in keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

/**
 * Check if text matches any negative context pattern
 * These patterns indicate false positive scenarios
 */
function hasNegativeContext(text: string): boolean {
  const lowerText = text.toLowerCase()
  return NEGATIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(lowerText))
}

/**
 * Check if text matches any WTP exclusion pattern
 * These patterns indicate false positive WTP signals
 */
function hasWTPExclusion(text: string): boolean {
  const lowerText = text.toLowerCase()
  return WTP_EXCLUSION_PATTERNS.some((pattern) => pattern.test(lowerText))
}

/**
 * Calculate engagement multiplier based on upvotes
 * High engagement = more people relate to this pain
 * v2.0: Capped at 1.2x to prevent engagement from inflating scores too much
 */
function getEngagementMultiplier(upvotes: number): number {
  // Logarithmic scale - much more conservative than before
  // score of 100 = 1.1x, score of 1000 = 1.15x
  if (upvotes <= 1) return 1.0
  const multiplier = 1 + Math.log10(upvotes) * 0.05
  return Math.min(1.2, multiplier) // Cap at 1.2x (was 2.0x)
}

/**
 * Calculate recency multiplier based on post age
 * Recent posts are weighted higher because they indicate current pain
 * v3.0: Added recency weighting for temporal relevance
 */
export function getRecencyMultiplier(createdUtc: number): number {
  if (!createdUtc || createdUtc <= 0) return 1.0

  const nowSeconds = Date.now() / 1000
  const ageInDays = (nowSeconds - createdUtc) / (60 * 60 * 24)

  // Posts from last 30 days: 1.5x multiplier (recent = highly relevant)
  if (ageInDays <= 30) return 1.5

  // Posts from last 90 days: 1.25x (still very relevant)
  if (ageInDays <= 90) return 1.25

  // Posts from last 180 days: 1.0x (baseline)
  if (ageInDays <= 180) return 1.0

  // Posts from last year: 0.75x (slightly dated)
  if (ageInDays <= 365) return 0.75

  // Posts older than 1 year: 0.5x (potentially stale pain)
  return 0.5
}

/**
 * Get age bucket for temporal distribution tracking
 */
function getAgeBucket(createdUtc: number): 'last30Days' | 'last90Days' | 'last180Days' | 'older' {
  if (!createdUtc || createdUtc <= 0) return 'older'

  const nowSeconds = Date.now() / 1000
  const ageInDays = (nowSeconds - createdUtc) / (60 * 60 * 24)

  if (ageInDays <= 30) return 'last30Days'
  if (ageInDays <= 90) return 'last90Days'
  if (ageInDays <= 180) return 'last180Days'
  return 'older'
}

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

/**
 * Calculate pain score for a given text
 * Implements the PVRE Scoring Framework methodology
 * v2.0: Enhanced with negative context filtering and stricter scoring
 * v3.0: Added recency weighting for temporal relevance
 */
export function calculatePainScore(
  text: string,
  engagementScore: number = 0,
  createdUtc: number = 0
): ScoreResult {
  const lowerText = text.toLowerCase()
  const signals: string[] = []
  let highIntensityCount = 0
  let mediumIntensityCount = 0
  let lowIntensityCount = 0
  let solutionSeekingCount = 0
  let willingnessToPayCount = 0
  let wtpConfidence: 'none' | 'low' | 'medium' | 'high' = 'none'
  let strongestSignal: string | null = null

  // v2.0: Check for negative context patterns first
  const hasNegContext = hasNegativeContext(text)
  const hasWTPExcl = hasWTPExclusion(text)

  // Track which tier had the first match (for strongest signal)
  let firstHighMatch: string | null = null
  let firstMediumMatch: string | null = null

  // Check high intensity keywords (weight: 3 points each)
  for (const keyword of HIGH_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      highIntensityCount++
      if (!firstHighMatch) firstHighMatch = keyword
    }
  }

  // Check medium intensity keywords (weight: 2 points each)
  for (const keyword of MEDIUM_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      mediumIntensityCount++
      if (!firstMediumMatch) firstMediumMatch = keyword
    }
  }

  // Check low intensity keywords (weight: 1 point each)
  for (const keyword of LOW_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      lowIntensityCount++
    }
  }

  // Check solution seeking keywords (weight: 2 points each)
  for (const keyword of SOLUTION_SEEKING_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      solutionSeekingCount++
    }
  }

  // Check willingness to pay signals with confidence levels
  // v2.0: Skip WTP detection if exclusion patterns match
  let wtpStrongCount = 0
  let wtpMediumCount = 0
  let wtpLowCount = 0

  if (!hasWTPExcl) {
    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.strongIntent) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpStrongCount++
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.financialDiscussion) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpMediumCount++
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.purchaseIntent) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpMediumCount++
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.valueSignals) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpLowCount++
      }
    }
  }

  // Determine WTP confidence level
  if (wtpStrongCount > 0) {
    wtpConfidence = 'high'
  } else if (wtpMediumCount > 0) {
    wtpConfidence = 'medium'
  } else if (wtpLowCount > 0) {
    wtpConfidence = 'low'
  }

  // Determine strongest signal
  strongestSignal = firstHighMatch || firstMediumMatch || null

  // Calculate raw score with updated weights
  const rawScore =
    highIntensityCount * 3 +
    mediumIntensityCount * 2 +
    lowIntensityCount * 1 +
    solutionSeekingCount * 2 +
    willingnessToPayCount * 4 // WTP is the strongest signal

  // Apply engagement multiplier (now capped at 1.2x)
  const engagementMultiplier = getEngagementMultiplier(engagementScore)

  // v3.0: Apply recency multiplier
  const recencyMultiplier = getRecencyMultiplier(createdUtc)

  const adjustedScore = rawScore * engagementMultiplier * recencyMultiplier

  // Normalize to 0-10 scale
  // Target: a post with 2 high-intensity + 1 solution-seeking = ~8/10
  let normalizedScore = Math.min(10, adjustedScore)

  // v2.0: Apply score ceiling for low-quality signals
  // If ONLY low intensity keywords, cap score at 4.0 max
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && lowIntensityCount > 0) {
    normalizedScore = Math.min(4.0, normalizedScore)
  }

  // If ONLY low + solution seeking (no pain), cap at 5.0
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && solutionSeekingCount > 0) {
    normalizedScore = Math.min(5.0, normalizedScore)
  }

  // Apply bonuses for signal combinations
  let finalScore = normalizedScore

  // Bonus: High WTP confidence (only if not excluded)
  if (wtpConfidence === 'high' && !hasWTPExcl) {
    finalScore = Math.min(10, finalScore + 1)
  }

  // Bonus: High pain + solution seeking combo
  if (highIntensityCount > 0 && solutionSeekingCount > 0) {
    finalScore = Math.min(10, finalScore + 0.5)
  }

  // v2.0: Penalty for negative context patterns
  if (hasNegContext) {
    finalScore = Math.max(0, finalScore * 0.6) // 40% reduction
  }

  // v2.0: Stronger penalty for ONLY low intensity signals
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && lowIntensityCount > 0) {
    finalScore = Math.max(0, finalScore - 1.0) // Stronger penalty (was -0.5)
  }

  return {
    score: Math.round(finalScore * 10) / 10,
    signals: [...new Set(signals)], // Remove duplicates
    highIntensityCount,
    mediumIntensityCount,
    lowIntensityCount,
    solutionSeekingCount,
    willingnessToPayCount,
    wtpConfidence,
    strongestSignal,
    hasNegativeContext: hasNegContext,
    hasWTPExclusion: hasWTPExcl,
  }
}

/**
 * Determine intensity level from score
 */
function getIntensity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

/**
 * Calculate engagement score (normalized combination of upvotes and comments)
 */
function calculateEngagementScore(score: number, numComments: number): number {
  // Logarithmic scale to prevent outliers from dominating
  const upvoteScore = Math.log10(Math.max(1, score + 1)) * 2
  const commentScore = Math.log10(Math.max(1, numComments + 1)) * 3
  return Math.round((upvoteScore + commentScore) * 10) / 10
}

/**
 * Determine data confidence based on post count
 * v2.0: This is the volume-based confidence (used for basic summary)
 */
function getDataConfidence(postCount: number): 'very_low' | 'low' | 'medium' | 'high' {
  if (postCount >= 200) return 'high'
  if (postCount >= 100) return 'medium'
  if (postCount >= 50) return 'low'
  return 'very_low'
}

/**
 * Calculate quality-weighted confidence
 * v2.0: Considers both volume AND signal quality
 * Higher-quality signals (high/medium intensity) contribute more to confidence
 */
function getQualityWeightedConfidence(summary: PainSummary): {
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  qualityScore: number
  reasoning: string
} {
  // Calculate quality score: weighted sum of signal types
  // High intensity = 3 points, Medium = 2 points, Low = 0.5 points, WTP = 4 points
  const qualityScore =
    summary.highIntensityCount * 3 +
    summary.mediumIntensityCount * 2 +
    summary.lowIntensityCount * 0.5 +
    summary.willingnessToPayCount * 4

  // Normalize by total signals to get quality ratio
  const qualityRatio = summary.totalSignals > 0 ? qualityScore / summary.totalSignals : 0

  // Volume factor (diminishing returns after 100 signals)
  const volumeFactor = Math.min(1, Math.log10(Math.max(1, summary.totalSignals)) / 2)

  // Combined confidence score (0-10)
  const confidenceScore = qualityRatio * 3 * volumeFactor

  // Penalties
  const lowIntensityRatio = summary.lowIntensityCount / Math.max(1, summary.totalSignals)
  const highIntensityRatio = summary.highIntensityCount / Math.max(1, summary.totalSignals)

  let adjustedScore = confidenceScore

  // Penalty if mostly low-intensity signals
  if (lowIntensityRatio > 0.7 && summary.highIntensityCount < 5) {
    adjustedScore *= 0.6 // 40% reduction
  }

  // Bonus for strong high-intensity presence
  if (highIntensityRatio > 0.3 || summary.highIntensityCount > 20) {
    adjustedScore *= 1.2
  }

  // Map to confidence level
  let confidence: 'very_low' | 'low' | 'medium' | 'high'
  if (adjustedScore >= 6) {
    confidence = 'high'
  } else if (adjustedScore >= 3) {
    confidence = 'medium'
  } else if (adjustedScore >= 1) {
    confidence = 'low'
  } else {
    confidence = 'very_low'
  }

  // Generate reasoning
  const parts: string[] = []
  if (summary.highIntensityCount > 0) {
    parts.push(`${summary.highIntensityCount} high-intensity signals`)
  }
  if (summary.willingnessToPayCount > 0) {
    parts.push(`${summary.willingnessToPayCount} WTP signals`)
  }
  if (lowIntensityRatio > 0.7) {
    parts.push(`mostly low-intensity (${Math.round(lowIntensityRatio * 100)}%)`)
  }

  return {
    confidence,
    qualityScore: Math.round(adjustedScore * 10) / 10,
    reasoning: parts.join(', ') || 'Insufficient quality signals',
  }
}

// =============================================================================
// POST/COMMENT ANALYSIS
// =============================================================================

/**
 * Analyze an array of Reddit posts for pain signals
 */
export function analyzePosts(posts: RedditPost[]): PainSignal[] {
  const painSignals: PainSignal[] = []

  for (const post of posts) {
    // Combine title and body for analysis
    const fullText = `${post.title} ${post.body || ''}`
    const engagement = calculateEngagementScore(post.score, post.numComments)
    // v3.0: Pass createdUtc for recency weighting
    const scoreResult = calculatePainScore(fullText, post.score, post.createdUtc)

    // Only include posts with some pain signals
    if (scoreResult.score > 0 || scoreResult.signals.length > 0) {
      painSignals.push({
        text: post.body || post.title,
        title: post.title,
        score: scoreResult.score,
        intensity: getIntensity(scoreResult.score),
        signals: scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        wtpConfidence: scoreResult.wtpConfidence,
        source: {
          type: 'post',
          id: post.id,
          subreddit: post.subreddit,
          author: post.author,
          url: post.permalink
            ? `https://reddit.com${post.permalink}`
            : `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
          createdUtc: post.createdUtc,
          engagementScore: engagement,
        },
      })
    }
  }

  // Sort by pain score (descending)
  return painSignals.sort((a, b) => b.score - a.score)
}

/**
 * Analyze an array of Reddit comments for pain signals
 */
export function analyzeComments(comments: RedditComment[]): PainSignal[] {
  const painSignals: PainSignal[] = []

  for (const comment of comments) {
    // v3.0: Pass createdUtc for recency weighting
    const scoreResult = calculatePainScore(comment.body, comment.score, comment.createdUtc)

    // Only include comments with some pain signals
    if (scoreResult.score > 0 || scoreResult.signals.length > 0) {
      const postId = comment.postId || ''

      painSignals.push({
        text: comment.body,
        score: scoreResult.score,
        intensity: getIntensity(scoreResult.score),
        signals: scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        wtpConfidence: scoreResult.wtpConfidence,
        source: {
          type: 'comment',
          id: comment.id,
          subreddit: comment.subreddit,
          author: comment.author,
          url: comment.permalink
            ? `https://reddit.com${comment.permalink}`
            : `https://reddit.com/r/${comment.subreddit}/comments/${postId}/_/${comment.id}`,
          createdUtc: comment.createdUtc,
          engagementScore: Math.log10(Math.max(1, comment.score + 1)) * 2,
        },
      })
    }
  }

  // Sort by pain score (descending)
  return painSignals.sort((a, b) => b.score - a.score)
}

/**
 * Combine and deduplicate pain signals from posts and comments
 */
export function combinePainSignals(
  postSignals: PainSignal[],
  commentSignals: PainSignal[]
): PainSignal[] {
  // Combine both arrays
  const allSignals = [...postSignals, ...commentSignals]

  // Sort by score (descending), then by engagement score
  return allSignals.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.source.engagementScore - a.source.engagementScore
  })
}

// =============================================================================
// SUMMARY STATISTICS (with Transparency Metrics)
// =============================================================================

/**
 * Get summary statistics for pain signals with transparency metrics
 * Provides the data needed for the PVRE transparency display
 */
export function getPainSummary(signals: PainSignal[]): PainSummary {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      averageScore: 0,
      highIntensityCount: 0,
      mediumIntensityCount: 0,
      lowIntensityCount: 0,
      solutionSeekingCount: 0,
      willingnessToPayCount: 0,
      topSubreddits: [],
      dataConfidence: 'very_low',
      strongestSignals: [],
      wtpQuotes: [],
      temporalDistribution: {
        last30Days: 0,
        last90Days: 0,
        last180Days: 0,
        older: 0,
      },
      recencyScore: 0,
    }
  }

  const subredditCounts: Record<string, number> = {}
  const signalCounts: Record<string, number> = {}
  const wtpQuotes: { text: string; subreddit: string }[] = []

  let totalScore = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let solutionCount = 0
  let wtpCount = 0

  // v3.0: Track temporal distribution
  const temporalDistribution = {
    last30Days: 0,
    last90Days: 0,
    last180Days: 0,
    older: 0,
  }
  let oldestTimestamp = Infinity
  let newestTimestamp = 0
  let totalRecencyMultiplier = 0

  for (const signal of signals) {
    totalScore += signal.score
    if (signal.intensity === 'high') highCount++
    else if (signal.intensity === 'medium') mediumCount++
    else lowCount++

    if (signal.solutionSeeking) solutionCount++
    if (signal.willingnessToPaySignal) {
      wtpCount++
      // Collect WTP quotes for display
      if (wtpQuotes.length < 5) {
        wtpQuotes.push({
          text: signal.text.slice(0, 200) + (signal.text.length > 200 ? '...' : ''),
          subreddit: signal.source.subreddit,
        })
      }
    }

    subredditCounts[signal.source.subreddit] =
      (subredditCounts[signal.source.subreddit] || 0) + 1

    // Count individual signal keywords
    for (const keyword of signal.signals) {
      signalCounts[keyword] = (signalCounts[keyword] || 0) + 1
    }

    // v3.0: Track temporal distribution and date range
    const createdUtc = signal.source.createdUtc
    if (createdUtc && createdUtc > 0) {
      const bucket = getAgeBucket(createdUtc)
      temporalDistribution[bucket]++

      // Track date range
      if (createdUtc < oldestTimestamp) oldestTimestamp = createdUtc
      if (createdUtc > newestTimestamp) newestTimestamp = createdUtc

      // Accumulate recency multipliers for average
      totalRecencyMultiplier += getRecencyMultiplier(createdUtc)
    }
  }

  const topSubreddits = Object.entries(subredditCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Get strongest signals (most frequently appearing keywords)
  const strongestSignals = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword)

  // Calculate date range
  const dateRange =
    oldestTimestamp !== Infinity && newestTimestamp > 0
      ? {
          oldest: new Date(oldestTimestamp * 1000).toISOString().split('T')[0],
          newest: new Date(newestTimestamp * 1000).toISOString().split('T')[0],
        }
      : undefined

  // Calculate average recency score (normalized 0-1, where 1 = all posts from last 30 days)
  const avgRecencyMultiplier = totalRecencyMultiplier / signals.length
  const recencyScore = Math.round(((avgRecencyMultiplier - 0.5) / 1.0) * 100) / 100 // Normalize 0.5-1.5 to 0-1

  return {
    totalSignals: signals.length,
    averageScore: Math.round((totalScore / signals.length) * 10) / 10,
    highIntensityCount: highCount,
    mediumIntensityCount: mediumCount,
    lowIntensityCount: lowCount,
    solutionSeekingCount: solutionCount,
    willingnessToPayCount: wtpCount,
    topSubreddits,
    dataConfidence: getDataConfidence(signals.length),
    strongestSignals,
    wtpQuotes,
    temporalDistribution,
    dateRange,
    recencyScore: Math.max(0, Math.min(1, recencyScore)),
  }
}

// =============================================================================
// OVERALL PAIN SCORE CALCULATION (for Viability Verdict)
// =============================================================================

/**
 * Calculate overall pain score (0-10) for the Viability Verdict
 * This is the weighted average considering all signals with bonuses/penalties
 * v2.0: Uses quality-weighted confidence instead of volume-only
 */
export function calculateOverallPainScore(summary: PainSummary): {
  score: number
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  reasoning: string
} {
  if (summary.totalSignals === 0) {
    return {
      score: 0,
      confidence: 'very_low',
      reasoning: 'No pain signals found. Insufficient data to assess pain.',
    }
  }

  // Start with average score
  let score = summary.averageScore

  // Calculate ratios
  const wtpRatio = summary.willingnessToPayCount / summary.totalSignals
  const highRatio = summary.highIntensityCount / summary.totalSignals
  const lowRatio = summary.lowIntensityCount / summary.totalSignals
  const solutionRatio = summary.solutionSeekingCount / summary.totalSignals

  // v2.0: Apply score adjustments based on signal quality distribution

  // Bonus: High concentration of WTP signals (>5% of posts)
  if (wtpRatio > 0.05) {
    score = Math.min(10, score + 1)
  }

  // Bonus: High pain concentration (>30% high intensity)
  if (highRatio > 0.3) {
    score = Math.min(10, score + 0.5)
  }

  // Bonus: Strong solution-seeking (>20% actively looking)
  if (solutionRatio > 0.2) {
    score = Math.min(10, score + 0.5)
  }

  // v2.0: Stronger penalty for low-quality signal distribution
  // If mostly low-intensity (>60%) and few high-intensity (<10%), reduce score
  if (lowRatio > 0.6 && highRatio < 0.1) {
    score = Math.max(0, score - 1.5)
  }

  // v2.0: Penalty if no high OR medium intensity signals
  if (summary.highIntensityCount === 0 && summary.mediumIntensityCount === 0) {
    score = Math.max(0, score * 0.5) // 50% reduction
  }

  // v2.0: Use quality-weighted confidence
  const qualityConfidence = getQualityWeightedConfidence(summary)

  // Generate reasoning
  const reasoningParts: string[] = []

  if (highRatio > 0.3) {
    reasoningParts.push(`Strong pain signals (${Math.round(highRatio * 100)}% high intensity)`)
  } else if (highRatio > 0.1) {
    reasoningParts.push(`Moderate pain signals (${Math.round(highRatio * 100)}% high intensity)`)
  } else if (summary.highIntensityCount === 0) {
    reasoningParts.push('No high-intensity pain signals detected')
  }

  if (wtpRatio > 0.05) {
    reasoningParts.push(`WTP signals in ${Math.round(wtpRatio * 100)}% of posts`)
  }

  if (solutionRatio > 0.2) {
    reasoningParts.push(`High solution-seeking (${Math.round(solutionRatio * 100)}%)`)
  }

  if (lowRatio > 0.6) {
    reasoningParts.push(`Mostly exploratory signals (${Math.round(lowRatio * 100)}% low intensity)`)
  }

  if (summary.strongestSignals.length > 0) {
    reasoningParts.push(`Top signals: "${summary.strongestSignals.slice(0, 3).join('", "')}"`)
  }

  // Add quality confidence info
  if (qualityConfidence.reasoning) {
    reasoningParts.push(`Confidence: ${qualityConfidence.reasoning}`)
  }

  return {
    score: Math.round(score * 10) / 10,
    confidence: qualityConfidence.confidence,
    reasoning: reasoningParts.join('. ') || 'Moderate pain signals detected.',
  }
}
