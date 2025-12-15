// Data Source Abstraction Layer - Shared Types
// Enables multiple Reddit data sources with automatic failover

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
