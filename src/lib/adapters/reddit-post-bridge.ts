/**
 * Bridge Adapter: RedditPost → NormalizedPost
 *
 * This adapter bridges the gap between:
 * - Production pipeline (RedditPost format from all data sources)
 * - Two-stage filter (NormalizedPost format)
 *
 * All existing data source adapters (Reddit, HN, Play Store, App Store, Trustpilot)
 * output RedditPost format. This bridge converts them to NormalizedPost for filtering.
 */

import { NormalizedPost, DataSource, PostMetadata } from './types'
import type { VerifiedSignal } from '../filter/ai-verifier'
import type { RedditPost } from '../data-sources/types'

// Re-export the type for convenience
export type { RedditPost } from '../data-sources/types'

/**
 * Detect the data source from the subreddit field.
 *
 * The production pipeline stores:
 * - Reddit posts: subreddit name (e.g., "freelance", "Entrepreneur")
 * - HN posts: "hackernews"
 * - App reviews: app name (e.g., "Asana", "Slack")
 * - Trustpilot: "trustpilot"
 */
function detectSource(subreddit: string): DataSource {
  // Special markers
  if (subreddit === 'hackernews' || subreddit === 'HackerNews') return 'other'
  if (subreddit === 'trustpilot' || subreddit === 'Trustpilot') return 'trustpilot'

  // Reddit subreddits typically don't have spaces and use underscores/camelCase
  // App names often have spaces, parentheses, or special chars
  // This is a heuristic - not perfect but good enough

  // If it looks like an app name (has spaces, or is capitalized with no common Reddit patterns)
  if (subreddit.includes(' ') || /^[A-Z][a-z]+$/.test(subreddit)) {
    return 'other'  // Could be app store or play store
  }

  return 'reddit'
}

/**
 * Convert a RedditPost to NormalizedPost format.
 *
 * @param post - RedditPost from any data source adapter
 * @param sourceHint - Optional source override (useful if you know the source)
 * @returns NormalizedPost for the two-stage filter
 */
export function bridgeRedditPostToNormalized(
  post: RedditPost,
  sourceHint?: DataSource
): NormalizedPost {
  const source = sourceHint ?? detectSource(post.subreddit)

  const body = post.body || ''
  const titleOnly = !body || body === '[removed]' || body === '[deleted]' || body.length < 50

  // For embedding: combine title + body (truncated to 500 chars)
  // Title-only posts just use title
  const textForEmbedding = titleOnly
    ? post.title
    : `${post.title} ${body}`.slice(0, 500)

  const metadata: PostMetadata = {
    subreddit: post.subreddit,
    author: post.author,
    score: post.score,
    numComments: post.numComments,
    titleOnly,
  }

  return {
    id: post.id,
    source,
    title: post.title,
    body,
    textForEmbedding,
    timestamp: new Date(post.createdUtc * 1000),
    metadata,
  }
}

/**
 * Batch convert RedditPosts to NormalizedPosts.
 *
 * @param posts - Array of RedditPosts from production pipeline
 * @param sourceHint - Optional source override for all posts
 * @returns Array of NormalizedPosts for the two-stage filter
 */
export function bridgeRedditPostsToNormalized(
  posts: RedditPost[],
  sourceHint?: DataSource
): NormalizedPost[] {
  return posts.map(post => bridgeRedditPostToNormalized(post, sourceHint))
}

/**
 * Map verified signals back to RedditPosts for downstream compatibility.
 *
 * The production pipeline expects RedditPost[] after filtering.
 * This function maps the verified signals back to the original posts.
 *
 * @param verified - VerifiedSignals from the two-stage filter
 * @param originalPosts - Original RedditPosts before filtering
 * @returns Filtered RedditPosts (only those that passed verification)
 */
export function mapVerifiedToRedditPosts(
  verified: VerifiedSignal[],
  originalPosts: RedditPost[]
): RedditPost[] {
  // Build a map for O(1) lookups
  const postMap = new Map(originalPosts.map(p => [p.id, p]))

  return verified
    .filter(v => v.verified)
    .map(v => postMap.get(v.post.id))
    .filter((p): p is RedditPost => p !== undefined)
}

/**
 * Get verification metrics from a pipeline result.
 * Useful for logging and debugging.
 */
export interface BridgeMetrics {
  inputCount: number
  normalizedCount: number
  verifiedCount: number
  mappedBackCount: number
}

export function getBridgeMetrics(
  originalPosts: RedditPost[],
  normalizedPosts: NormalizedPost[],
  verified: VerifiedSignal[],
  mappedBack: RedditPost[]
): BridgeMetrics {
  return {
    inputCount: originalPosts.length,
    normalizedCount: normalizedPosts.length,
    verifiedCount: verified.filter(v => v.verified).length,
    mappedBackCount: mappedBack.length,
  }
}
