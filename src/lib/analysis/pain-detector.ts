// Pain Signal Detection
// Analyzes Reddit posts/comments to identify and score pain signals

import { RedditPost, RedditComment } from '../arctic-shift/types'

// Pain signal intensity categories
const HIGH_INTENSITY_KEYWORDS = [
  'frustrated', 'frustrating', 'frustration',
  'hate', 'hated', 'hating',
  'nightmare', 'nightmarish',
  'terrible', 'terribly',
  'awful', 'awfully',
  'impossible', 'impossibly',
  'worst', 'horrible', 'horrendous',
  'desperate', 'desperately',
  'furious', 'infuriating',
  'exhausted', 'exhausting',
  'fed up', 'sick of', 'tired of',
  'can\'t stand', 'cannot stand',
  'giving up', 'gave up', 'give up',
  'broken', 'useless', 'worthless',
  'waste of time', 'waste of money',
]

const MEDIUM_INTENSITY_KEYWORDS = [
  'struggle', 'struggling', 'struggled',
  'difficult', 'difficulty', 'difficulties',
  'hard', 'harder', 'hardest',
  'problem', 'problems', 'problematic',
  'issue', 'issues',
  'challenge', 'challenges', 'challenging',
  'confusing', 'confused', 'confusion',
  'annoying', 'annoyed', 'annoyance',
  'disappointing', 'disappointed', 'disappointment',
  'concern', 'concerned', 'concerning',
  'worried', 'worry', 'worrying',
  'stuck', 'blocked', 'blocking',
  'failing', 'failed', 'fail',
  'not working', 'doesn\'t work', 'won\'t work',
  'can\'t figure out', 'cannot figure out',
  'no idea how', 'don\'t know how',
]

const SOLUTION_SEEKING_KEYWORDS = [
  'looking for', 'searching for',
  'anyone know', 'does anyone know',
  'recommendations', 'recommend', 'recommended',
  'suggestions', 'suggest', 'suggested',
  'advice', 'advise',
  'help with', 'need help', 'please help',
  'how do i', 'how can i', 'how should i',
  'what do you use', 'what should i use',
  'best way to', 'better way to',
  'alternatives', 'alternative to',
  'tips', 'tip for',
  'any ideas', 'any thoughts',
  'would appreciate',
  'seeking', 'in search of',
]

const WILLINGNESS_TO_PAY_SIGNALS = [
  'would pay', 'willing to pay', 'happy to pay',
  'worth paying', 'worth the money',
  'budget', 'pricing', 'how much',
  'investment', 'invest in',
  'subscription', 'subscribe',
  'premium', 'upgrade',
  'take my money', 'shut up and take',
  'where can i buy', 'where to buy',
  'price range', 'cost',
]

export interface PainSignal {
  text: string
  title?: string
  score: number
  intensity: 'low' | 'medium' | 'high'
  signals: string[]
  solutionSeeking: boolean
  willingnessToPaySignal: boolean
  source: {
    type: 'post' | 'comment'
    id: string
    subreddit: string
    author: string
    url: string
    created_utc: number
    engagementScore: number
  }
}

interface ScoreResult {
  score: number
  signals: string[]
  highIntensityCount: number
  mediumIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
}

/**
 * Calculate pain score for a given text
 */
export function calculatePainScore(text: string): ScoreResult {
  const lowerText = text.toLowerCase()
  const signals: string[] = []
  let highIntensityCount = 0
  let mediumIntensityCount = 0
  let solutionSeekingCount = 0
  let willingnessToPayCount = 0

  // Check high intensity keywords (weight: 3 points each)
  for (const keyword of HIGH_INTENSITY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      signals.push(keyword)
      highIntensityCount++
    }
  }

  // Check medium intensity keywords (weight: 2 points each)
  for (const keyword of MEDIUM_INTENSITY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      signals.push(keyword)
      mediumIntensityCount++
    }
  }

  // Check solution seeking keywords (weight: 1.5 points each)
  for (const keyword of SOLUTION_SEEKING_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      signals.push(keyword)
      solutionSeekingCount++
    }
  }

  // Check willingness to pay signals (weight: 2 points each)
  for (const keyword of WILLINGNESS_TO_PAY_SIGNALS) {
    if (lowerText.includes(keyword)) {
      signals.push(keyword)
      willingnessToPayCount++
    }
  }

  // Calculate raw score
  const rawScore =
    highIntensityCount * 3 +
    mediumIntensityCount * 2 +
    solutionSeekingCount * 1.5 +
    willingnessToPayCount * 2

  // Normalize to 0-10 scale (cap at 10)
  const normalizedScore = Math.min(10, rawScore)

  return {
    score: Math.round(normalizedScore * 10) / 10,
    signals: [...new Set(signals)], // Remove duplicates
    highIntensityCount,
    mediumIntensityCount,
    solutionSeekingCount,
    willingnessToPayCount,
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
 * Analyze an array of Reddit posts for pain signals
 */
export function analyzePosts(posts: RedditPost[]): PainSignal[] {
  const painSignals: PainSignal[] = []

  for (const post of posts) {
    // Combine title and body for analysis
    const fullText = `${post.title} ${post.selftext || ''}`
    const scoreResult = calculatePainScore(fullText)

    // Only include posts with some pain signals
    if (scoreResult.score > 0 || scoreResult.signals.length > 0) {
      painSignals.push({
        text: post.selftext || post.title,
        title: post.title,
        score: scoreResult.score,
        intensity: getIntensity(scoreResult.score),
        signals: scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        source: {
          type: 'post',
          id: post.id,
          subreddit: post.subreddit,
          author: post.author,
          url: post.permalink
            ? `https://reddit.com${post.permalink}`
            : `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
          created_utc: post.created_utc,
          engagementScore: calculateEngagementScore(post.score, post.num_comments),
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
    const scoreResult = calculatePainScore(comment.body)

    // Only include comments with some pain signals
    if (scoreResult.score > 0 || scoreResult.signals.length > 0) {
      const postId = comment.link_id?.replace('t3_', '') || ''

      painSignals.push({
        text: comment.body,
        score: scoreResult.score,
        intensity: getIntensity(scoreResult.score),
        signals: scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        source: {
          type: 'comment',
          id: comment.id,
          subreddit: comment.subreddit,
          author: comment.author,
          url: comment.permalink
            ? `https://reddit.com${comment.permalink}`
            : `https://reddit.com/r/${comment.subreddit}/comments/${postId}/_/${comment.id}`,
          created_utc: comment.created_utc,
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

/**
 * Get summary statistics for pain signals
 */
export function getPainSummary(signals: PainSignal[]): {
  totalSignals: number
  averageScore: number
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  topSubreddits: { name: string; count: number }[]
} {
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
    }
  }

  const subredditCounts: Record<string, number> = {}

  let totalScore = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let solutionCount = 0
  let wtpCount = 0

  for (const signal of signals) {
    totalScore += signal.score
    if (signal.intensity === 'high') highCount++
    else if (signal.intensity === 'medium') mediumCount++
    else lowCount++

    if (signal.solutionSeeking) solutionCount++
    if (signal.willingnessToPaySignal) wtpCount++

    subredditCounts[signal.source.subreddit] =
      (subredditCounts[signal.source.subreddit] || 0) + 1
  }

  const topSubreddits = Object.entries(subredditCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    totalSignals: signals.length,
    averageScore: Math.round((totalScore / signals.length) * 10) / 10,
    highIntensityCount: highCount,
    mediumIntensityCount: mediumCount,
    lowIntensityCount: lowCount,
    solutionSeekingCount: solutionCount,
    willingnessToPayCount: wtpCount,
    topSubreddits,
  }
}
