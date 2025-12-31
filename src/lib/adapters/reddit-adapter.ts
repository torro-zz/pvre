/**
 * Reddit Adapter
 *
 * Converts Reddit posts and comments to NormalizedPost format
 * for use with the universal filter.
 */

import { RedditPost, RedditComment } from '@/lib/data-sources'
import { NormalizedPost, DataSourceAdapter, PostMetadata } from './types'

/**
 * Reddit post adapter
 */
export class RedditPostAdapter implements DataSourceAdapter<RedditPost> {
  readonly sourceType = 'reddit' as const
  readonly sourceName = 'Reddit'

  /**
   * Convert a Reddit post to normalized format
   */
  normalize(post: RedditPost): NormalizedPost {
    const body = post.body || ''
    const titleOnly = !body || body === '[removed]' || body === '[deleted]' || body.length < 50

    // For embedding, use title + body (truncated to 500 chars)
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
      source: 'reddit',
      title: post.title,
      body,
      textForEmbedding,
      timestamp: new Date(post.createdUtc * 1000),
      metadata,
    }
  }

  /**
   * Batch normalize for efficiency
   */
  normalizeBatch(posts: RedditPost[]): NormalizedPost[] {
    return posts.map(post => this.normalize(post))
  }
}

/**
 * Reddit comment adapter
 */
export class RedditCommentAdapter implements DataSourceAdapter<RedditComment> {
  readonly sourceType = 'reddit' as const
  readonly sourceName = 'Reddit Comments'

  /**
   * Convert a Reddit comment to normalized format
   */
  normalize(comment: RedditComment): NormalizedPost {
    const body = comment.body || ''

    const metadata: PostMetadata = {
      subreddit: comment.subreddit,
      author: comment.author,
      score: comment.score,
    }

    return {
      id: comment.id,
      source: 'reddit',
      title: '', // Comments don't have titles
      body,
      textForEmbedding: body.slice(0, 500),
      timestamp: new Date(comment.createdUtc * 1000),
      metadata,
    }
  }

  /**
   * Batch normalize for efficiency
   */
  normalizeBatch(comments: RedditComment[]): NormalizedPost[] {
    return comments.map(comment => this.normalize(comment))
  }
}

// Singleton instances for convenience
export const redditPostAdapter = new RedditPostAdapter()
export const redditCommentAdapter = new RedditCommentAdapter()

/**
 * Helper function to convert Reddit posts to normalized format
 */
export function normalizeRedditPosts(posts: RedditPost[]): NormalizedPost[] {
  return redditPostAdapter.normalizeBatch(posts)
}

/**
 * Helper function to convert Reddit comments to normalized format
 */
export function normalizeRedditComments(comments: RedditComment[]): NormalizedPost[] {
  return redditCommentAdapter.normalizeBatch(comments)
}
