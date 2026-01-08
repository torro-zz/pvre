'use client'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VerdictHero } from '@/components/research/verdict-hero'
import { DualVerdictDisplay } from '@/components/research/dual-verdict-display'
import { getVerdictMessage } from '@/lib/utils/verdict-messages'
import { ViabilityVerdict } from '@/lib/analysis/viability-calculator'

const baseVerdict: ViabilityVerdict = {
  overallScore: 3.2,
  rawScore: 3.2,
  verdict: 'none',
  verdictLabel: 'No Signal',
  verdictDescription: 'No viable business signal detected. Pivot to a different problem or target audience.',
  calibratedVerdictLabel: 'No Signal',
  dimensions: [],
  weakestDimension: null,
  dealbreakers: ['Critical issue'],
  recommendations: [],
  confidence: 'low',
  isComplete: false,
  availableDimensions: 0,
  totalDimensions: 4,
  dataSufficiency: 'insufficient',
  dataSufficiencyReason: 'test',
}

describe('VerdictHero', () => {
  it('aligns the action banner with the shared verdict message', () => {
    const expectedAction = getVerdictMessage(baseVerdict.overallScore, true).action

    render(
      <VerdictHero
        verdict={baseVerdict}
        onSeeWhy={vi.fn()}
        onInterviewGuide={vi.fn()}
      />
    )

    expect(screen.getByText(expectedAction)).toBeTruthy()
  })
})

describe('DualVerdictDisplay', () => {
  const hypothesisConfidence = {
    score: 6.2,
    level: 'partial' as const,
    directSignalPercent: 45,
    signalVolume: 120,
    multiSourceConfirmation: true,
    factors: {
      directSignalScore: 4.5,
      volumeScore: 6.2,
      multiSourceScore: 5.8,
    },
  }

  const marketOpportunity = {
    score: 6.5,
    level: 'moderate' as const,
    marketSizeScore: 6.1,
    timingScore: 6.4,
    activityScore: 6.2,
    competitorPresence: true,
    factors: {
      marketSizeContribution: 1.8,
      timingContribution: 1.6,
      activityContribution: 1.7,
      competitorContribution: 1.4,
    },
  }

  it('toggles the hypothesis label for App Gap mode', () => {
    const { rerender } = render(
      <DualVerdictDisplay
        hypothesisConfidence={hypothesisConfidence}
        marketOpportunity={marketOpportunity}
        overallScore={6.1}
      />
    )

    expect(screen.getByText('Hypothesis Confidence')).toBeTruthy()

    rerender(
      <DualVerdictDisplay
        hypothesisConfidence={hypothesisConfidence}
        marketOpportunity={marketOpportunity}
        overallScore={6.1}
        isAppAnalysis
      />
    )

    expect(screen.getByText('Signal Quality')).toBeTruthy()
  })
})
