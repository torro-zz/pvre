/**
 * Signal Categorizer
 *
 * Semantically categorizes user feedback signals using embeddings.
 * Replaces keyword-based matching with embedding similarity for better accuracy.
 *
 * Jan 2026: Part of App Store-First Architecture Phase 3
 */

import { generateEmbedding } from '@/lib/embeddings/embedding-service'

/**
 * Category definitions for user feedback
 * These descriptions are used to generate category embeddings
 */
export const CATEGORY_DEFINITIONS = {
  pricing: {
    label: 'Pricing',
    description: `User complaints about pricing, cost, value for money, subscription fees,
      expensive, overpriced, pricing tiers, payment issues, billing problems,
      too costly, not worth the price, pricing changes, price increases,
      free tier limitations, premium costs, monthly fees, annual subscription`,
  },
  ads: {
    label: 'Ads',
    description: `User complaints about advertisements, commercials, banners, popups,
      intrusive ads, ad-free requests, too many ads, video ads, interstitial ads,
      ad interruptions, sponsored content, promotional content, advertising overload`,
  },
  content: {
    label: 'Content',
    description: `User complaints about content quality, moderation, inappropriate content,
      missing content, outdated content, content organization, catalog limitations,
      content removal, library size, content availability, regional restrictions,
      content variety, new releases, updates to content`,
  },
  performance: {
    label: 'Performance',
    description: `User complaints about technical performance, bugs, crashes, slow loading,
      freezing, battery drain, memory usage, stability issues, app hangs,
      connection problems, sync issues, loading times, lag, responsiveness,
      update problems, compatibility issues, error messages`,
  },
  features: {
    label: 'Features',
    description: `User requests for missing features, feature gaps, functionality wishes,
      capability limitations, desired improvements, feature requests,
      missing functionality, would like to see, needs improvement,
      should add, want the ability to, feature suggestions`,
  },
} as const

export type CategoryKey = keyof typeof CATEGORY_DEFINITIONS

/**
 * Category with computed embedding
 */
interface CategoryWithEmbedding {
  key: CategoryKey
  label: string
  embedding: number[]
}

/**
 * Categorization result for a signal
 */
export interface CategorizationResult {
  category: CategoryKey
  confidence: number
  label: string
}

/**
 * Signal Categorizer class
 *
 * Pre-computes category embeddings on initialization and uses them
 * to categorize signals via cosine similarity.
 */
export class SignalCategorizer {
  private categoryEmbeddings: CategoryWithEmbedding[] | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize category embeddings (called once, cached)
   */
  private async init(): Promise<void> {
    if (this.categoryEmbeddings) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      console.log('[SignalCategorizer] Computing category embeddings...')

      const categories = Object.entries(CATEGORY_DEFINITIONS) as [CategoryKey, typeof CATEGORY_DEFINITIONS[CategoryKey]][]
      const results: CategoryWithEmbedding[] = []

      // Compute embeddings for all categories
      for (const [key, def] of categories) {
        const embedding = await generateEmbedding(def.description)
        if (!embedding) {
          console.warn(`[SignalCategorizer] Failed to generate embedding for category: ${key}`)
          continue
        }
        results.push({
          key,
          label: def.label,
          embedding,
        })
      }

      this.categoryEmbeddings = results
      console.log(`[SignalCategorizer] Initialized ${this.categoryEmbeddings.length} category embeddings`)
    })()

    return this.initPromise
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) return 0

    return dotProduct / denominator
  }

  /**
   * Categorize a single text signal
   */
  async categorize(text: string): Promise<CategorizationResult> {
    await this.init()

    if (!this.categoryEmbeddings || this.categoryEmbeddings.length === 0) {
      // Fallback to first category if embeddings failed
      return {
        category: 'features',
        confidence: 0,
        label: 'Features',
      }
    }

    // Get embedding for the signal text
    const signalEmbedding = await generateEmbedding(text)

    // If embedding failed, return default category
    if (!signalEmbedding) {
      return {
        category: 'features',
        confidence: 0,
        label: 'Features',
      }
    }

    // Find best matching category
    let bestMatch: CategorizationResult = {
      category: 'features',
      confidence: 0,
      label: 'Features',
    }

    for (const cat of this.categoryEmbeddings) {
      const similarity = this.cosineSimilarity(signalEmbedding, cat.embedding)

      if (similarity > bestMatch.confidence) {
        bestMatch = {
          category: cat.key,
          confidence: similarity,
          label: cat.label,
        }
      }
    }

    return bestMatch
  }

  /**
   * Categorize multiple signals efficiently
   *
   * @param signals Array of objects with a text field to categorize
   * @param textField Field name containing the text to categorize
   * @returns Original signals with added 'semanticCategory' field
   */
  async categorizeMany<T extends Record<string, unknown>>(
    signals: T[],
    textField: keyof T
  ): Promise<(T & { semanticCategory: CategorizationResult })[]> {
    await this.init()

    if (signals.length === 0) return []

    console.log(`[SignalCategorizer] Categorizing ${signals.length} signals...`)

    // Get embeddings for all signals in batches
    const batchSize = 20
    const results: (T & { semanticCategory: CategorizationResult })[] = []

    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize)

      const categorized = await Promise.all(
        batch.map(async (signal) => {
          const text = String(signal[textField] || '')
          const category = await this.categorize(text)
          return {
            ...signal,
            semanticCategory: category,
          }
        })
      )

      results.push(...categorized)
    }

    console.log(`[SignalCategorizer] Categorized ${results.length} signals`)

    return results
  }

  /**
   * Get all available categories
   */
  getCategories(): Array<{ key: CategoryKey; label: string }> {
    return Object.entries(CATEGORY_DEFINITIONS).map(([key, def]) => ({
      key: key as CategoryKey,
      label: def.label,
    }))
  }
}

// Singleton instance for reuse
let categorizerInstance: SignalCategorizer | null = null

/**
 * Get the singleton categorizer instance
 */
export function getSignalCategorizer(): SignalCategorizer {
  if (!categorizerInstance) {
    categorizerInstance = new SignalCategorizer()
  }
  return categorizerInstance
}

/**
 * Categorize a single text (convenience function)
 */
export async function categorizeSignal(text: string): Promise<CategorizationResult> {
  return getSignalCategorizer().categorize(text)
}

/**
 * Categorize multiple signals (convenience function)
 */
export async function categorizeSignals<T extends Record<string, unknown>>(
  signals: T[],
  textField: keyof T
): Promise<(T & { semanticCategory: CategorizationResult })[]> {
  return getSignalCategorizer().categorizeMany(signals, textField)
}
