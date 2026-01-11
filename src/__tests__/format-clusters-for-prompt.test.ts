import { describe, it, expect } from 'vitest'
import { formatClustersForPrompt, type SignalCluster } from '@/lib/embeddings/clustering'

const makeCluster = (overrides: Partial<SignalCluster> = {}): SignalCluster => ({
  id: 'cluster-1',
  signals: [],
  representativeQuotes: [
    {
      text: 'Payment fails at checkout',
      source: 'reddit',
      subreddit: 'apps',
      score: 0.91,
    },
  ],
  avgSimilarity: 0.82,
  size: 3,
  sources: {
    appStore: 1,
    googlePlay: 0,
    reddit: 2,
    trustpilot: 0,
    other: 0,
  },
  label: 'Checkout friction',
  centroid: [0.1, 0.2],
  ...overrides,
})

describe('formatClustersForPrompt defensive guards (malformed App Gap clusters)', () => {
  it('handles missing sources with "unknown"', () => {
    const output = formatClustersForPrompt([
      makeCluster({ sources: undefined as unknown as SignalCluster['sources'] }),
    ])

    expect(output).toContain('Sources: unknown')
  })

  it('handles missing avgSimilarity with 0.00 cohesion', () => {
    const output = formatClustersForPrompt([makeCluster({ avgSimilarity: Number.NaN })])

    expect(output).toContain('Cohesion: 0.00 (moderate)')
  })

  it('handles missing representativeQuotes without emitting bullets', () => {
    const output = formatClustersForPrompt([
      makeCluster({
        representativeQuotes: undefined as unknown as SignalCluster['representativeQuotes'],
      }),
    ])

    expect(output).toContain('Representative quotes:')
    expect(output).not.toContain('• "')
  })

  it('handles missing size with 0 signals', () => {
    const output = formatClustersForPrompt([
      makeCluster({ size: undefined as unknown as number }),
    ])

    expect(output).toContain('(0 signals)')
  })

  it('handles a completely empty cluster object (worst case)', () => {
    const output = formatClustersForPrompt([{} as SignalCluster])

    expect(output).toContain('CLUSTER 1 (0 signals)')
    expect(output).toContain('Sources: unknown')
    expect(output).toContain('Cohesion: 0.00 (moderate)')
    expect(output).not.toContain('• "')
  })

  it('formats a normal, well-formed cluster (regression)', () => {
    const output = formatClustersForPrompt([makeCluster()])

    expect(output).toContain('CLUSTER 1: "Checkout friction" (3 signals)')
    expect(output).toContain('Sources: 1 App Store, 2 Reddit')
    expect(output).toContain('Cohesion: 0.82 (very tight)')
    expect(output).toContain('• "Payment fails at checkout" [r/apps]')
  })
})
