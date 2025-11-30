'use client'

import { PainSummary } from '@/lib/analysis/pain-detector'

interface PainScoreDisplayProps {
  score: number
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  summary: PainSummary
  postsAnalyzed: number
  strongestSignal?: string
  strongestSignalCount?: number
  wtpQuote?: { text: string; subreddit: string }
  oldDataPercentage?: number
}

function getConfidenceLabel(confidence: 'very_low' | 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'low': return 'Low'
    case 'very_low': return 'Very Low'
  }
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
}: PainScoreDisplayProps) {
  const maxCount = Math.max(
    summary.highIntensityCount,
    summary.mediumIntensityCount,
    summary.solutionSeekingCount,
    summary.willingnessToPayCount,
    1
  )

  // Find the most frequent signal word
  const topSignal = strongestSignal || summary.strongestSignals?.[0]

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-5 bg-card">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-base">
          <span className="font-semibold tracking-wide">PAIN SCORE: </span>
          <span className="font-bold">{score.toFixed(1)}/10</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Confidence: {getConfidenceLabel(confidence)} ({postsAnalyzed} posts analyzed)
        </p>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* What Drove This Score */}
      <div className="space-y-4">
        <p className="text-sm font-semibold tracking-wide">WHAT DROVE THIS SCORE:</p>

        <div className="space-y-2.5 font-mono text-sm">
          {/* High-intensity pain words */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.highIntensityCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              High-intensity pain words: <span className="text-foreground font-medium">{summary.highIntensityCount} posts</span>
            </span>
          </div>

          {/* Medium-intensity signals */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.mediumIntensityCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Medium-intensity signals: <span className="text-foreground font-medium">{summary.mediumIntensityCount} posts</span>
            </span>
          </div>

          {/* Solution-seeking language */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.solutionSeekingCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Solution-seeking language: <span className="text-foreground font-medium">{summary.solutionSeekingCount} posts</span>
            </span>
          </div>

          {/* Willingness-to-pay signals */}
          <div className="flex items-center gap-3">
            <AsciiBar value={summary.willingnessToPayCount} maxValue={maxCount} />
            <span className="text-muted-foreground">
              Willingness-to-pay signals: <span className="text-foreground font-medium">{summary.willingnessToPayCount} posts</span>
            </span>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-2 pt-1">
        {/* Strongest Signal */}
        {topSignal && (
          <p className="text-sm">
            <span className="mr-2">🔥</span>
            <span className="font-semibold tracking-wide">STRONGEST SIGNAL: </span>
            <span className="text-muted-foreground">
              "{topSignal}" appeared {strongestSignalCount || 'multiple'} times
            </span>
          </p>
        )}

        {/* WTP Quote */}
        {wtpQuote && (
          <p className="text-sm">
            <span className="mr-2">💰</span>
            <span className="font-semibold tracking-wide">WTP QUOTE: </span>
            <span className="text-muted-foreground">
              "{wtpQuote.text.length > 50 ? wtpQuote.text.slice(0, 50) + '...' : wtpQuote.text}"
            </span>
          </p>
        )}

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
