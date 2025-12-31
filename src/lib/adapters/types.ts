/**
 * Adapter Types
 *
 * This file defines the normalized interfaces that all data source adapters
 * must produce. The universal filter operates on these normalized types,
 * making it source-agnostic.
 *
 * ARCHITECTURE:
 * - Data sources (Reddit, App Store, etc.) → Adapter → NormalizedPost
 * - NormalizedPost → Universal Filter → ScoredSignal
 * - Adding new data sources = new adapter only, filter unchanged
 */

/**
 * Normalized post/signal from any data source.
 * All adapters must convert their source data to this format.
 */
export interface NormalizedPost {
  /** Unique identifier (source-specific format, e.g., Reddit post ID) */
  id: string

  /** Source type for tracking origin */
  source: DataSource

  /** Primary text content (title for Reddit, review title for App Store, etc.) */
  title: string

  /** Secondary text content (body for Reddit, review body for App Store) */
  body: string

  /** Combined text for embedding (adapter decides how to combine) */
  textForEmbedding: string

  /** Original timestamp */
  timestamp: Date

  /** Source-specific metadata */
  metadata: PostMetadata
}

/**
 * Supported data sources
 */
export type DataSource = 'reddit' | 'appstore' | 'playstore' | 'trustpilot' | 'g2' | 'other'

/**
 * Source-specific metadata.
 * Each source can add its own fields.
 */
export interface PostMetadata {
  /** Reddit: subreddit name */
  subreddit?: string

  /** Reddit: author username */
  author?: string

  /** Reddit: upvote count */
  score?: number

  /** Reddit: comment count */
  numComments?: number

  /** App Store: app name */
  appName?: string

  /** App Store: rating (1-5) */
  rating?: number

  /** App Store: app version */
  appVersion?: string

  /** Trustpilot: company name */
  companyName?: string

  /** Flag for posts with removed/empty body (title-only analysis) */
  titleOnly?: boolean

  /** Any other source-specific data */
  [key: string]: unknown
}

/**
 * Scored signal after filtering.
 * This is what the universal filter produces.
 */
export interface ScoredSignal {
  /** The normalized post */
  post: NormalizedPost

  /** Embedding similarity score (0-1) */
  embeddingScore: number

  /** Tier based on score: HIGH (≥0.50), MEDIUM (≥0.34), LOW (<0.34) */
  tier: 'HIGH' | 'MEDIUM' | 'LOW'

  /** Whether it passed the threshold (0.34 for standard, 0.28 for boosted) */
  passed: boolean

  /** Keywords that matched (if keyword gate was used) */
  matchedKeywords?: string[]
}

/**
 * Filter result with metrics
 */
export interface FilterResult {
  /** Signals that passed the filter */
  signals: ScoredSignal[]

  /** Signals that were filtered out */
  filtered: ScoredSignal[]

  /** Filter metrics */
  metrics: FilterMetrics
}

/**
 * Metrics from the filtering process
 */
export interface FilterMetrics {
  /** Total input posts */
  totalInput: number

  /** Posts that passed keyword gate */
  passedKeywordGate: number

  /** Posts that passed embedding threshold */
  passedEmbedding: number

  /** Final signal count */
  finalCount: number

  /** High similarity count (≥0.50) */
  highSimilarity: number

  /** Medium similarity count (≥0.34) */
  mediumSimilarity: number

  /** Low similarity count (filtered) */
  lowSimilarity: number

  /** Processing time in ms */
  processingTimeMs: number
}

/**
 * Adapter interface - all data source adapters must implement this
 */
export interface DataSourceAdapter<TRaw = unknown> {
  /** Unique identifier for this adapter */
  readonly sourceType: DataSource

  /** Human-readable name */
  readonly sourceName: string

  /**
   * Convert raw source data to normalized format
   */
  normalize(raw: TRaw): NormalizedPost

  /**
   * Batch normalize for efficiency
   */
  normalizeBatch(raws: TRaw[]): NormalizedPost[]
}
