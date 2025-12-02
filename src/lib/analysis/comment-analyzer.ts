// Comment Mining Enhancement
// Deeper analysis of Reddit comments for richer pain signals
// v1.0: Introduced for Phase 2 platform improvements

import { RedditComment } from '../data-sources/types'
import {
  calculatePainScore,
  PainSignal,
  getRecencyMultiplier,
} from './pain-detector'

export interface CommentAnalysis {
  comment: {
    id: string
    body: string
    subreddit: string
    score: number
    createdUtc: number
    parentId: string
    postId: string
  }
  painScore: number
  wtpSignals: string[]
  isReply: boolean // Replies often contain more specific pain
  recencyMultiplier: number
}

export interface CommentInsights {
  highPainComments: CommentAnalysis[]
  wtpComments: CommentAnalysis[]
  topPainQuotes: {
    text: string
    subreddit: string
    score: number
  }[]
  totalCommentsAnalyzed: number
  commentsWithPain: number
  commentsWithWTP: number
  avgPainScore: number
}

/**
 * WTP (Willingness to Pay) signal keywords for comment mining
 */
const WTP_SIGNALS = [
  'would pay', 'willing to pay', 'happy to pay',
  "i'd pay", 'take my money', 'worth paying',
  'shut up and take', 'budget', 'pricing',
  'how much', 'cost', 'subscription', 'premium',
]

/**
 * Detect WTP signals in comment text
 */
function detectWTPSignals(text: string): string[] {
  const lowerText = text.toLowerCase()
  return WTP_SIGNALS.filter(signal => lowerText.includes(signal))
}

/**
 * Analyze comments for pain signals and WTP indicators
 */
export function analyzeCommentsDeep(comments: RedditComment[]): CommentInsights {
  const analyzed: CommentAnalysis[] = []

  for (const comment of comments) {
    // Skip very short comments
    if (!comment.body || comment.body.length < 20) continue

    // Skip deleted/removed
    if (comment.body === '[deleted]' || comment.body === '[removed]') continue

    const scoreResult = calculatePainScore(comment.body, comment.score, comment.createdUtc)
    const wtpSignals = detectWTPSignals(comment.body)
    const isReply = comment.parentId?.startsWith('t1_') || false // t1_ = comment, t3_ = post
    const recencyMultiplier = getRecencyMultiplier(comment.createdUtc)

    analyzed.push({
      comment: {
        id: comment.id,
        body: comment.body,
        subreddit: comment.subreddit,
        score: comment.score,
        createdUtc: comment.createdUtc,
        parentId: comment.parentId,
        postId: comment.postId || '',
      },
      painScore: scoreResult.score,
      wtpSignals,
      isReply,
      recencyMultiplier,
    })
  }

  // Filter for high-value comments
  const highPainComments = analyzed
    .filter(c => c.painScore >= 5)
    .sort((a, b) => b.painScore - a.painScore)
    .slice(0, 20)

  const wtpComments = analyzed
    .filter(c => c.wtpSignals.length > 0)
    .slice(0, 10)

  // Extract top quotes
  const topPainQuotes = highPainComments
    .slice(0, 5)
    .map(c => ({
      text: c.comment.body.slice(0, 300) + (c.comment.body.length > 300 ? '...' : ''),
      subreddit: c.comment.subreddit,
      score: c.painScore,
    }))

  // Calculate averages
  const commentsWithPain = analyzed.filter(c => c.painScore > 0).length
  const commentsWithWTP = analyzed.filter(c => c.wtpSignals.length > 0).length
  const totalPainScore = analyzed.reduce((sum, c) => sum + c.painScore, 0)
  const avgPainScore = analyzed.length > 0 ? totalPainScore / analyzed.length : 0

  return {
    highPainComments,
    wtpComments,
    topPainQuotes,
    totalCommentsAnalyzed: comments.length,
    commentsWithPain,
    commentsWithWTP,
    avgPainScore: Math.round(avgPainScore * 10) / 10,
  }
}

/**
 * Merge comment insights into main analysis results
 */
export function enrichAnalysisWithComments(
  existingAnalysis: { painSignals?: PainSignal[]; painSummary?: Record<string, unknown> },
  commentInsights: CommentInsights
): {
  commentInsights: {
    topPainQuotes: { text: string; subreddit: string; score: number }[]
    wtpSignalsFromComments: number
    commentsAnalyzed: number
    avgCommentPainScore: number
  }
  dataConfidenceBoost: 'high' | 'medium' | 'none'
} {
  // Calculate confidence boost based on comment quality
  let dataConfidenceBoost: 'high' | 'medium' | 'none' = 'none'

  if (commentInsights.highPainComments.length > 10) {
    dataConfidenceBoost = 'high'
  } else if (commentInsights.highPainComments.length > 5) {
    dataConfidenceBoost = 'medium'
  }

  return {
    commentInsights: {
      topPainQuotes: commentInsights.topPainQuotes,
      wtpSignalsFromComments: commentInsights.commentsWithWTP,
      commentsAnalyzed: commentInsights.totalCommentsAnalyzed,
      avgCommentPainScore: commentInsights.avgPainScore,
    },
    dataConfidenceBoost,
  }
}

/**
 * Convert CommentAnalysis to PainSignal format for merging
 */
export function commentAnalysisToPainSignals(
  commentAnalysis: CommentAnalysis[]
): PainSignal[] {
  return commentAnalysis.map(ca => ({
    text: ca.comment.body,
    score: ca.painScore,
    intensity: ca.painScore >= 7 ? 'high' : ca.painScore >= 4 ? 'medium' : 'low',
    signals: ca.wtpSignals,
    solutionSeeking: false, // Would need to detect separately
    willingnessToPaySignal: ca.wtpSignals.length > 0,
    wtpConfidence: ca.wtpSignals.length > 2 ? 'high' : ca.wtpSignals.length > 0 ? 'medium' : 'none',
    source: {
      type: 'comment' as const,
      id: ca.comment.id,
      subreddit: ca.comment.subreddit,
      author: 'unknown', // Not available in CommentAnalysis
      url: `https://reddit.com/r/${ca.comment.subreddit}/comments/${ca.comment.postId}/_/${ca.comment.id}`,
      createdUtc: ca.comment.createdUtc,
      engagementScore: Math.log10(Math.max(1, ca.comment.score + 1)) * 2,
    },
  }))
}
