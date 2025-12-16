// Data Source Abstraction Layer - Shared Types
// Enables multiple data sources (Reddit, HN, App Stores, etc.) with automatic failover

// =============================================================================
// UNIFIED SIGNAL SCHEMA (Phase 3 Architecture)
// All adapters normalize their data to this format
// =============================================================================

export type SourceType = 'reddit' | 'hacker_news' | 'youtube' | 'google_play' | 'app_store' | 'tiktok'
export type SignalType = 'discussion' | 'review' | 'video' | 'comment'

export interface UnifiedSignal {
  id: string
  source: SourceType
  sourceType: SignalType

  // Content
  title: string
  body: string
  url: string

  // Metadata
  author: string
  community: string        // subreddit, "hackernews", channel name, app name
  createdAt: Date

  // Engagement (normalized 0-100)
  engagementScore: number
  rawEngagement: {         // Original metrics for transparency
    upvotes?: number
    comments?: number
    views?: number
    points?: number
    rating?: number        // For reviews: 1-5 stars
  }
}

export interface SearchOptions {
  maxResults?: number
  dateRange?: { start: Date; end: Date }
  sortBy?: 'relevance' | 'date' | 'engagement'
}

/**
 * Interface for all data source adapters (Phase 3 Architecture)
 * Each source (Reddit, HN, App Store, etc.) implements this interface
 */
export interface DataSourceAdapter {
  /** Unique identifier for this source */
  source: SourceType

  /** Human-readable name */
  name: string

  /** Search for content matching the query */
  search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]>

  /** Get comments for a specific item (optional) */
  getComments?(itemId: string): Promise<UnifiedSignal[]>

  /** Check if the data source API is available */
  healthCheck(): Promise<boolean>

  /** Get estimated post count for coverage check */
  getPostCount(query: string): Promise<number>

  /** Get sample posts for preview */
  getSamplePosts(query: string, limit?: number): Promise<SamplePost[]>

  /** Get app details from app ID or URL (app stores only) */
  getAppDetails?(appIdOrUrl: string): Promise<AppDetails | null>
}

// =============================================================================
// APP DETAILS (for App-Centric Analysis Mode)
// Used when user pastes an app store URL instead of a hypothesis
// =============================================================================

export interface AppDetails {
  appId: string
  store: 'google_play' | 'app_store'  // Which store this came from
  name: string
  developer: string
  category: string
  description: string          // Full description text
  rating: number               // 1-5 stars
  reviewCount: number
  price: string                // "Free", "$4.99", etc.
  hasIAP: boolean
  installs?: string            // Google Play only: "10M+"
  lastUpdated: string
  iconUrl?: string
  url: string
}

// =============================================================================
// LEGACY REDDIT-SPECIFIC TYPES (kept for backward compatibility)
// These are used by the existing relevance filter and analysis pipeline
// =============================================================================

export interface RedditPost {
  id: string
  title: string
  body: string // normalized from selftext
  author: string
  subreddit: string
  score: number
  numComments: number // normalized from num_comments
  createdUtc: number // normalized from created_utc
  permalink: string
  url?: string
}

export interface RedditComment {
  id: string
  body: string
  author: string
  subreddit: string
  score: number
  createdUtc: number
  parentId: string // normalized from parent_id
  postId: string // extracted from link_id
  permalink?: string
}

export interface SearchParams {
  subreddits: string[]
  keywords?: string[]
  limit?: number | 'auto'  // 'auto' allows API to return up to 1000 results based on capacity
  sort?: 'relevance' | 'new' | 'top' | 'score'
  timeRange?: {
    after?: Date
    before?: Date
  }
}

export interface SearchResult {
  posts: RedditPost[]
  comments: RedditComment[]
  metadata: SearchMetadata
}

export interface SearchMetadata {
  source: string
  fetchedAt: Date
  isStale: boolean
  warning?: string
  postsFromCache?: boolean
  commentsFromCache?: boolean
}

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore?: 'high' | 'medium' | 'low'
}

export interface CoverageResult {
  subreddits: SubredditCoverage[]
  totalEstimatedPosts: number
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  recommendation: 'proceed' | 'caution' | 'refine'
  refinementSuggestions?: string[]
  samplePosts?: SamplePost[] // Live preview of actual posts
}

export interface SamplePost {
  title: string
  subreddit: string
  score: number
  permalink: string
}

export interface DataSource {
  name: string
  isAvailable(): Promise<boolean>
  searchPosts(params: SearchParams): Promise<RedditPost[]>
  searchComments(params: SearchParams): Promise<RedditComment[]>
  getPostCount(subreddit: string, keywords?: string[]): Promise<number>
  getSamplePosts(subreddit: string, limit?: number, keywords?: string[]): Promise<SamplePost[]>
}

// Cache entry structure
export interface CachedData {
  posts: RedditPost[]
  comments: RedditComment[]
  fetchedAt: string
  expiresAt: string
  isExpired?: boolean
}
