/**
 * Unified Discussion Trends Combiner
 *
 * Combines AI Discussion Trends (from AI subreddits) and Discussion Velocity
 * (from pain signals) into a single unified metric for display.
 *
 * Priority logic:
 * - App Gap mode: Prefer pain signals (actual user pain)
 * - Hypothesis mode: Prefer AI trends (broader interest signal)
 * - Combined: Sum volumes when both available
 *
 * Confidence thresholds:
 * - high: >= 50 total volume
 * - medium: >= 15 total volume
 * - low: >= 5 total volume
 * - none: < 5 total volume
 */

import type { AITrendResult } from '@/lib/data-sources/ai-discussion-trends'
import type { DiscussionVelocity, UnifiedDiscussionTrends } from '@/types/research/core'

// Confidence thresholds
const CONFIDENCE_HIGH = 50
const CONFIDENCE_MEDIUM = 15
const CONFIDENCE_LOW = 5

/**
 * Map DiscussionVelocity trend to unified trend type
 */
function mapVelocityTrend(trend: DiscussionVelocity['trend']): UnifiedDiscussionTrends['trend'] {
  switch (trend) {
    case 'rising':
      return 'rising'
    case 'declining':
      return 'falling'
    case 'stable':
      return 'stable'
    case 'insufficient_data':
    default:
      return 'insufficient_data'
  }
}

/**
 * Calculate confidence level from volume
 */
function getConfidence(volume: number): UnifiedDiscussionTrends['confidence'] {
  if (volume >= CONFIDENCE_HIGH) return 'high'
  if (volume >= CONFIDENCE_MEDIUM) return 'medium'
  if (volume >= CONFIDENCE_LOW) return 'low'
  return 'none'
}

/**
 * Combine AI Discussion Trends and Discussion Velocity into unified metric
 */
export function combineDiscussionTrends(
  aiTrend: AITrendResult | null | undefined,
  painVelocity: DiscussionVelocity | undefined,
  mode: 'hypothesis' | 'app-analysis'
): UnifiedDiscussionTrends {
  const hasAiTrend = aiTrend && !aiTrend.insufficientData && aiTrend.dataAvailable
  const hasPainVelocity = painVelocity && !painVelocity.insufficientData

  // Neither source has data
  if (!hasAiTrend && !hasPainVelocity) {
    return {
      trend: 'insufficient_data',
      percentageChange: null,
      confidence: 'none',
      primarySource: 'ai_discussion',
      totalVolume: 0,
      volumeLabel: '0 discussions',
      recentCount: 0,
      previousCount: 0,
      insufficientData: true,
    }
  }

  // Determine which source to prioritize
  const preferAiTrend = mode === 'hypothesis'

  // Both available - combine volumes, use preferred source for trend
  if (hasAiTrend && hasPainVelocity) {
    const totalVolume = (aiTrend?.totalVolume || 0) + (painVelocity?.recentCount || 0)
    const confidence = getConfidence(totalVolume)

    if (preferAiTrend) {
      // Use AI trend direction, combined volume
      return {
        trend: aiTrend!.trend,
        percentageChange: aiTrend!.percentageChange,
        confidence,
        primarySource: 'combined',
        totalVolume,
        volumeLabel: `${totalVolume} discussions`,
        recentCount: (aiTrend!.current30d || 0) + (painVelocity!.recentCount || 0),
        previousCount: (aiTrend!.baseline30d || 0) + (painVelocity!.previousCount || 0),
        change30d: aiTrend!.change30d,
        change90d: aiTrend!.change90d,
        sources: aiTrend!.sources,
        insufficientData: false,
      }
    } else {
      // Use pain velocity direction, combined volume
      return {
        trend: mapVelocityTrend(painVelocity!.trend),
        percentageChange: painVelocity!.percentageChange,
        confidence,
        primarySource: 'combined',
        totalVolume,
        volumeLabel: `${totalVolume} discussions`,
        recentCount: (painVelocity!.recentCount || 0) + (aiTrend!.current30d || 0),
        previousCount: (painVelocity!.previousCount || 0) + (aiTrend!.baseline30d || 0),
        change30d: aiTrend!.change30d,
        change90d: aiTrend!.change90d,
        sources: aiTrend!.sources,
        insufficientData: false,
      }
    }
  }

  // Only AI trend available
  if (hasAiTrend) {
    const totalVolume = aiTrend!.totalVolume || 0
    return {
      trend: aiTrend!.trend,
      percentageChange: aiTrend!.percentageChange,
      confidence: getConfidence(totalVolume),
      primarySource: 'ai_discussion',
      totalVolume,
      volumeLabel: `${totalVolume} AI discussions`,
      recentCount: aiTrend!.current30d || 0,
      previousCount: aiTrend!.baseline30d || 0,
      change30d: aiTrend!.change30d,
      change90d: aiTrend!.change90d,
      sources: aiTrend!.sources,
      insufficientData: false,
    }
  }

  // Only pain velocity available
  if (hasPainVelocity) {
    const totalVolume = (painVelocity!.recentCount || 0) + (painVelocity!.previousCount || 0)
    return {
      trend: mapVelocityTrend(painVelocity!.trend),
      percentageChange: painVelocity!.percentageChange,
      confidence: getConfidence(totalVolume),
      primarySource: 'pain_signals',
      totalVolume,
      volumeLabel: `${totalVolume} filtered signals`,
      recentCount: painVelocity!.recentCount || 0,
      previousCount: painVelocity!.previousCount || 0,
      insufficientData: false,
    }
  }

  // Fallback (shouldn't reach here)
  return {
    trend: 'insufficient_data',
    percentageChange: null,
    confidence: 'none',
    primarySource: 'ai_discussion',
    totalVolume: 0,
    volumeLabel: '0 discussions',
    recentCount: 0,
    previousCount: 0,
    insufficientData: true,
  }
}

/**
 * Compute unified trends from legacy data (for backward compatibility)
 * Used when viewing old saved results that don't have unifiedTrends
 */
export function computeUnifiedTrendsFromLegacy(
  trendData: {
    dataAvailable?: boolean
    totalVolume?: number
    change30d?: number
    change90d?: number
    sources?: string[]
    insufficientData?: boolean
  } | null | undefined,
  trend: 'rising' | 'stable' | 'falling' | undefined,
  discussionVelocity: DiscussionVelocity | undefined,
  mode: 'hypothesis' | 'app-analysis'
): UnifiedDiscussionTrends {
  // Convert legacy trendData to AITrendResult-like shape
  const aiTrend: AITrendResult | null = trendData?.dataAvailable
    ? {
        keywords: [],
        current30d: 0,
        baseline30d: 0,
        change30d: trendData.change30d || 0,
        current90d: 0,
        baseline90d: 0,
        change90d: trendData.change90d || 0,
        trend: trend || 'stable',
        percentageChange: trendData.change30d || 0,
        confidence: 'medium',
        totalVolume: trendData.totalVolume || 0,
        dataAvailable: true,
        insufficientData: trendData.insufficientData || false,
        sources: trendData.sources || [],
      }
    : null

  return combineDiscussionTrends(aiTrend, discussionVelocity, mode)
}
