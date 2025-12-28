'use client'

import { PainSummary } from '@/lib/analysis/pain-detector'

interface PainScoreDisplayProps {
  score: number
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  summary: PainSummary
  postsAnalyzed: number
  strongestSignal?: { text: string; subreddit: string; intensity: 'high' | 'medium' | 'low' } | string  // Can be quote object or legacy keyword string
  strongestSignalCount?: number
  wtpQuote?: { text: string; subreddit: string }
  oldDataPercentage?: number
  totalSignals?: number  // For clarity on posts vs signals
  coreSignals?: number   // Core/high-relevance signals
}

function getConfidenceLabel(confidence: 'very_low' | 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'low': return 'Low'
    case 'very_low': return 'Very Low'
  }
}

// P2 Fix 6: Proper singular/plural handling
function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

// ASCII-style bar using block characters
function AsciiBar({ value, maxValue }: { value: number; maxValue: number }) {
  const percentage = maxValue > 0 ? Math.min(1, value / maxValue) : 0
  const totalBlocks = 20
  const filledBlocks = Math.round(percentage * totalBlocks)

  return (
    <span className="font-mono text-sm tracking-tighter">
      {Array(filledBlocks).fill('▌').join('')}
      <span className="text-muted-foreground/30">
        {Array(totalBlocks - filledBlocks).fill('▌').join('')}
      </span>
    </span>
  )
}

export function PainScoreDisplay({
  score,
  confidence,
  summary,
  postsAnalyzed,
  strongestSignal,
  strongestSignalCount,
  wtpQuote,
  oldDataPercentage,
  totalSignals,
  coreSignals,
}: PainScoreDisplayProps) {
  const maxCount = Math.max(
    summary.highIntensityCount,
    summary.mediumIntensityCount,
    summary.solutionSeekingCount,
    summary.willingnessToPayCount,
    1
  )

  // P0 Fix 1: Handle strongest signal - can be object with quote or legacy keyword string
  const strongestSignalObj = typeof strongestSignal === 'object' && strongestSignal !== null
    ? strongestSignal
    : null

  // Fall back to keyword if no quote object provided
  const topSignalKeyword = typeof strongestSignal === 'string'
    ? strongestSignal
    : summary.strongestSignals?.[0]

  // P0 Fix 2: Validate WTP quote actually contains purchase intent language
  const wtpKeywords = ['pay', 'paid', 'spend', 'buy', 'purchase', 'price', 'cost', 'worth', 'money', 'subscription', 'premium']
  const hasValidWtpQuote = wtpQuote && wtpKeywords.some(kw => wtpQuote.text.toLowerCase().includes(kw))

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-5 bg-card">
      {/* Header - P1 Fix 4: Clarify posts vs signals distinction */}
      <div className="space-y-1">
        <p className="text-base">
          <span className="font-semibold tracking-wide">PAIN SCORE: </span>
          <span className="font-bold">{score.toFixed(1)}/10</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Confidence: {getConfidenceLabel(confidence)}
          {totalSignals !== undefined && coreSignals !== undefined ? (
            <span> ({totalSignals} {pluralize(totalSignals, 'signal', 'signals')} from {coreSignals} core {pluralize(coreSignals, 'post', 'posts')})</span>
          ) : (
            <span> ({postsAnalyzed} {pluralize(postsAnalyzed, 'post', 'posts')} analyzed)</span>
          )}
        </p>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* What Drove This Score - P2 Fix 6: Grammar fixes for singular/plural */}
      <div className="space-y-4">
        <p className="text-sm font-semibold tracking-wide">WHAT DROVE THIS SCORE:</p>

        <div className="space-y-2.5 font-mono text-sm">
          {/* High-intensity pain words */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.highIntensityCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              High-intensity pain alerts: <span className="text-foreground font-medium">{summary.highIntensityCount} {pluralize(summary.highIntensityCount, 'post', 'posts')}</span>
            </span>
          </div>

          {/* Medium-intensity signals */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.mediumIntensityCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Medium-intensity signals: <span className="text-foreground font-medium">{summary.mediumIntensityCount} {pluralize(summary.mediumIntensityCount, 'post', 'posts')}</span>
            </span>
          </div>

          {/* Solution-seeking language */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.solutionSeekingCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Solution-seeking language: <span className="text-foreground font-medium">{summary.solutionSeekingCount} {pluralize(summary.solutionSeekingCount, 'post', 'posts')}</span>
            </span>
          </div>

          {/* Willingness-to-pay signals */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.willingnessToPayCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Willingness-to-pay signals: <span className="text-foreground font-medium">{summary.willingnessToPayCount} {pluralize(summary.willingnessToPayCount, 'post', 'posts')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-2 pt-1">
        {/* P0 Fix 1: Strongest Signal - show actual quote when available, fall back to keyword count */}
        {strongestSignalObj ? (
          <p className="text-sm">
            <span className="mr-2">🔥</span>
            <span className="font-semibold tracking-wide">STRONGEST SIGNAL: </span>
            <span className="text-muted-foreground">
              &quot;{strongestSignalObj.text.length > 100 ? strongestSignalObj.text.slice(0, 100) + '...' : strongestSignalObj.text}&quot;
            </span>
            <span className="text-xs text-muted-foreground/70 ml-2">
              — r/{strongestSignalObj.subreddit}, {strongestSignalObj.intensity === 'high' ? 'High' : strongestSignalObj.intensity === 'medium' ? 'Medium' : 'Low'} intensity
            </span>
          </p>
        ) : topSignalKeyword && topSignalKeyword.toLowerCase() !== 'unclear' ? (
          <p className="text-sm">
            <span className="mr-2">🔥</span>
            <span className="font-semibold tracking-wide">TOP SIGNALS: </span>
            <span className="text-muted-foreground">
              Multiple high-intensity signals detected across {summary.highIntensityCount} {pluralize(summary.highIntensityCount, 'post', 'posts')}
            </span>
          </p>
        ) : summary.highIntensityCount > 0 ? (
          <p className="text-sm">
            <span className="mr-2">🔥</span>
            <span className="font-semibold tracking-wide">TOP SIGNALS: </span>
            <span className="text-muted-foreground">
              {summary.highIntensityCount} high-intensity {pluralize(summary.highIntensityCount, 'signal', 'signals')} detected
            </span>
          </p>
        ) : null}

        {/* P0 Fix 2: WTP Quote - only show if it actually contains purchase intent language */}
        {hasValidWtpQuote && wtpQuote ? (
          <p className="text-sm">
            <span className="mr-2">💰</span>
            <span className="font-semibold tracking-wide">WTP QUOTE: </span>
            <span className="text-muted-foreground">
              &quot;{wtpQuote.text.length > 80 ? wtpQuote.text.slice(0, 80) + '...' : wtpQuote.text}&quot;
            </span>
            {wtpQuote.subreddit && (
              <span className="text-xs text-muted-foreground/70 ml-2">— r/{wtpQuote.subreddit}</span>
            )}
          </p>
        ) : summary.willingnessToPayCount > 0 ? (
          <p className="text-sm">
            <span className="mr-2">💰</span>
            <span className="font-semibold tracking-wide">WTP SIGNALS: </span>
            <span className="text-muted-foreground">
              {summary.willingnessToPayCount} potential {pluralize(summary.willingnessToPayCount, 'indicator', 'indicators')} found
              {!hasValidWtpQuote && <span className="text-amber-600 dark:text-amber-400"> (weak signal — no explicit quote)</span>}
            </span>
          </p>
        ) : null}

        {/* Caveat - Old Data */}
        {oldDataPercentage !== undefined && oldDataPercentage > 50 && (
          <p className="text-sm">
            <span className="mr-2">⚠️</span>
            <span className="font-semibold tracking-wide">CAVEAT: </span>
            <span className="text-muted-foreground">
              {oldDataPercentage}% of posts are 6+ months old
            </span>
          </p>
        )}

        {/* Caveat - Limited Data */}
        {summary.totalSignals < 30 && (
          <p className="text-sm">
            <span className="mr-2">⚠️</span>
            <span className="font-semibold tracking-wide">CAVEAT: </span>
            <span className="text-muted-foreground">
              Limited data ({summary.totalSignals} signals). Consider expanding search.
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
