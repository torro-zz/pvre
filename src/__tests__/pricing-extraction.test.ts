import { describe, it, expect } from 'vitest'
import { extractMonthlyPrice, extractCompetitorPricing } from '@/lib/analysis/pricing-utils'

describe('extractMonthlyPrice', () => {
  it('extracts simple monthly price', () => {
    expect(extractMonthlyPrice('$29/month')).toBe(29)
    expect(extractMonthlyPrice('$49/mo')).toBe(49)
    expect(extractMonthlyPrice('$99/month')).toBe(99)
  })

  it('extracts from price ranges', () => {
    expect(extractMonthlyPrice('$9-$49/month')).toBe(29) // average
    expect(extractMonthlyPrice('$0-$99/month')).toBe(99) // skips free tier
  })

  it('handles freemium pricing', () => {
    expect(extractMonthlyPrice('Free - $29/month')).toBe(29)
    expect(extractMonthlyPrice('Freemium, $49/mo paid tier')).toBe(49)
  })

  it('converts annual to monthly', () => {
    expect(extractMonthlyPrice('$348/year')).toBe(29) // 348/12 = 29
    expect(extractMonthlyPrice('$588/annual')).toBe(49) // 588/12 = 49
  })

  it('handles null and invalid input', () => {
    expect(extractMonthlyPrice(null)).toBeNull()
    expect(extractMonthlyPrice('')).toBeNull()
    expect(extractMonthlyPrice('Contact us')).toBeNull()
    expect(extractMonthlyPrice('Custom pricing')).toBeNull()
  })

  it('handles complex pricing strings', () => {
    expect(extractMonthlyPrice('$15/user/month')).toBe(15)
    expect(extractMonthlyPrice('Starting at $29/month')).toBe(29)
  })
})

describe('extractCompetitorPricing', () => {
  it('calculates median from multiple competitors', () => {
    const competitors = [
      { name: 'A', pricingModel: 'Subscription', pricingRange: '$19/month' },
      { name: 'B', pricingModel: 'Subscription', pricingRange: '$29/month' },
      { name: 'C', pricingModel: 'Subscription', pricingRange: '$99/month' },
    ]
    const result = extractCompetitorPricing(competitors)

    expect(result.medianPrice).toBe(29)
    expect(result.competitorsWithPricing).toBe(3)
    expect(result.source).toBe('competitors')
  })

  it('returns default when no pricing data', () => {
    const competitors = [
      { name: 'A', pricingModel: null, pricingRange: null },
      { name: 'B', pricingModel: 'Custom', pricingRange: 'Contact us' },
    ]
    const result = extractCompetitorPricing(competitors)

    expect(result.suggestedPrice).toBe(29) // default
    expect(result.source).toBe('default')
    expect(result.competitorsWithPricing).toBe(0)
  })

  it('calculates confidence based on data coverage', () => {
    // High confidence: 70%+ coverage, 3+ prices
    const highConfidence = extractCompetitorPricing([
      { name: 'A', pricingModel: 'Sub', pricingRange: '$29/mo' },
      { name: 'B', pricingModel: 'Sub', pricingRange: '$49/mo' },
      { name: 'C', pricingModel: 'Sub', pricingRange: '$39/mo' },
      { name: 'D', pricingModel: 'Sub', pricingRange: '$59/mo' },
    ])
    expect(highConfidence.confidence).toBe('high')

    // Low confidence: few prices
    const lowConfidence = extractCompetitorPricing([
      { name: 'A', pricingModel: null, pricingRange: '$29/mo' },
      { name: 'B', pricingModel: null, pricingRange: null },
      { name: 'C', pricingModel: null, pricingRange: null },
      { name: 'D', pricingModel: null, pricingRange: null },
    ])
    expect(lowConfidence.confidence).toBe('low')
  })

  it('collects unique pricing models', () => {
    const competitors = [
      { name: 'A', pricingModel: 'Subscription', pricingRange: '$29/mo' },
      { name: 'B', pricingModel: 'Freemium', pricingRange: '$49/mo' },
      { name: 'C', pricingModel: 'Subscription', pricingRange: '$39/mo' }, // duplicate
    ]
    const result = extractCompetitorPricing(competitors)

    expect(result.pricingModels).toContain('Subscription')
    expect(result.pricingModels).toContain('Freemium')
    expect(result.pricingModels.length).toBe(2)
  })

  it('calculates price range correctly', () => {
    const competitors = [
      { name: 'A', pricingModel: 'Sub', pricingRange: '$15/mo' },
      { name: 'B', pricingModel: 'Sub', pricingRange: '$29/mo' },
      { name: 'C', pricingModel: 'Sub', pricingRange: '$99/mo' },
    ]
    const result = extractCompetitorPricing(competitors)

    expect(result.priceRange?.min).toBe(15)
    expect(result.priceRange?.max).toBe(99)
    expect(result.averagePrice).toBe(48) // (15+29+99)/3 ≈ 48
  })
})
