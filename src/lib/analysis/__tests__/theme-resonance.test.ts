import { describe, it, expect } from 'vitest'
import { calculateThemeResonance } from '../theme-resonance'

// Minimal mock types for testing (avoiding Anthropic import chain)
interface MockTheme {
  name: string
  intensity: 'low' | 'medium' | 'high'
  resonance?: 'low' | 'medium' | 'high'
}

interface MockSignal {
  text: string
  title?: string
  signals: string[]
  source: {
    engagementScore: number
  }
}

describe('calculateThemeResonance', () => {
  const createMockSignal = (
    text: string,
    engagementScore: number,
    signals: string[] = []
  ): MockSignal => ({
    text,
    signals,
    source: {
      engagementScore,
    },
  })

  const createMockTheme = (name: string): MockTheme => ({
    name,
    intensity: 'medium',
  })

  it('should return themes unchanged when no signals', () => {
    const themes = [createMockTheme('Test theme')]
    const result = calculateThemeResonance(themes, [])
    expect(result).toEqual(themes)
  })

  it('should return empty array when no themes', () => {
    const signals = [createMockSignal('test text', 5)]
    const result = calculateThemeResonance([], signals)
    expect(result).toEqual([])
  })

  it('should calculate high resonance for above-average engagement', () => {
    const themes = [createMockTheme('invoicing problems')]
    const signals = [
      createMockSignal('I hate invoicing problems', 10, ['invoicing']),  // High engagement
      createMockSignal('Other random text', 2),  // Low engagement
      createMockSignal('Another random post', 3),  // Low engagement
    ]

    // Average engagement = (10 + 2 + 3) / 3 = 5
    // Theme engagement = 10 (only matching signal)
    // Ratio = 10 / 5 = 2.0 > 1.5 => HIGH

    const result = calculateThemeResonance(themes, signals)
    expect(result[0].resonance).toBe('high')
  })

  it('should calculate low resonance for below-average engagement', () => {
    const themes = [createMockTheme('invoicing problems')]
    const signals = [
      createMockSignal('I hate invoicing problems', 2, ['invoicing']),  // Low engagement
      createMockSignal('Other random text', 10),  // High engagement
      createMockSignal('Another hot topic', 9),  // High engagement
    ]

    // Average engagement = (2 + 10 + 9) / 3 = 7
    // Theme engagement = 2 (only matching signal)
    // Ratio = 2 / 7 = 0.29 < 0.7 => LOW

    const result = calculateThemeResonance(themes, signals)
    expect(result[0].resonance).toBe('low')
  })

  it('should calculate medium resonance for average engagement', () => {
    const themes = [createMockTheme('invoicing problems')]
    const signals = [
      createMockSignal('I hate invoicing problems', 5, ['invoicing']),
      createMockSignal('Other random text', 5),
      createMockSignal('Another post', 5),
    ]

    // All same engagement = medium resonance

    const result = calculateThemeResonance(themes, signals)
    expect(result[0].resonance).toBe('medium')
  })

  it('should match themes by keyword in signal text', () => {
    const themes = [createMockTheme('freelancer struggles')]
    const signals = [
      createMockSignal('As a freelancer, I struggle with this daily', 8),
    ]

    const result = calculateThemeResonance(themes, signals)
    expect(result[0].resonance).toBeDefined()
  })
})
