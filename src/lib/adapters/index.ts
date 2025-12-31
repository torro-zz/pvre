/**
 * Adapters Index
 *
 * Export all data source adapters and types.
 * Each adapter converts source-specific data to NormalizedPost format.
 */

// Types
export * from './types'

// Reddit adapter
export {
  RedditPostAdapter,
  RedditCommentAdapter,
  redditPostAdapter,
  redditCommentAdapter,
  normalizeRedditPosts,
  normalizeRedditComments,
} from './reddit-adapter'

// Future adapters:
// export { AppStoreAdapter } from './appstore-adapter'
// export { PlayStoreAdapter } from './playstore-adapter'
// export { TrustpilotAdapter } from './trustpilot-adapter'
// export { G2Adapter } from './g2-adapter'
