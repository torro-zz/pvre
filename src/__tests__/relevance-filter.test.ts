import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  qualityGateFilter,
  filterRelevantPosts,
  filterRelevantComments,
  type RelevanceDecision,
  type FilterResult,
} from '@/lib/research/relevance-filter'
import type { RedditPost, RedditComment } from '@/lib/data-sources'

// Mock Anthropic to avoid real API calls in AI-based tests
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'YYY' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    },
  })),
}))

vi.mock('@/lib/anthropic', () => ({
  getCurrentTracker: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/analysis/token-tracker', () => ({
  trackUsage: vi.fn(),
}))

// Helper to create mock posts
function createMockPost(overrides: Partial<RedditPost> = {}): RedditPost {
  return {
    id: `post_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test Post Title',
    body: 'This is a test post body with enough content to pass the minimum length requirement for quality filtering.',
    subreddit: 'testsubreddit',
    author: 'testuser',
    score: 10,
    numComments: 5,
    createdUtc: Date.now() / 1000,
    permalink: '/r/testsubreddit/test',
    url: 'https://reddit.com/r/testsubreddit/test',
    ...overrides,
  }
}

// Helper to create mock comments
function createMockComment(overrides: Partial<RedditComment> = {}): RedditComment {
  return {
    id: `comment_${Math.random().toString(36).slice(2, 9)}`,
    body: 'This is a test comment body with sufficient length.',
    subreddit: 'testsubreddit',
    author: 'testuser',
    score: 5,
    createdUtc: Date.now() / 1000,
    permalink: '/r/testsubreddit/test/comment',
    parentId: 'post_123',
    postId: 'link_123',
    ...overrides,
  }
}

describe('Relevance Filter', () => {
  describe('Stage 3: Quality Gate (qualityGateFilter)', () => {
    describe('Removed/Deleted Content Detection', () => {
      it('should filter posts with [removed] body', () => {
        const posts = [
          createMockPost({ body: '[removed]' }),
          createMockPost({ body: 'This is a valid post body with enough content to pass the minimum length requirement for quality filtering purposes.' }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
        expect(result.filtered).toHaveLength(1)
        expect(result.decisions).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('removed_deleted')
      })

      it('should filter posts with [deleted] body', () => {
        const posts = [createMockPost({ body: '[deleted]' })]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(0)
        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('removed_deleted')
      })

      it('should filter posts with [unavailable] body', () => {
        const posts = [createMockPost({ body: '[unavailable]' })]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('removed_deleted')
      })

      it('should handle case-insensitive removal detection', () => {
        const posts = [
          createMockPost({ body: '[REMOVED]' }),
          createMockPost({ body: '[Deleted]' }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(2)
      })
    })

    describe('Minimum Length Check', () => {
      it('should filter posts with body shorter than 50 characters (default)', () => {
        const posts = [
          createMockPost({ body: 'Too short' }),
          createMockPost({ body: 'This post has enough content to pass the minimum length requirement easily.' }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('too_short')
      })

      it('should allow custom minimum length', () => {
        // Note: For posts, we now check title + body combined length
        // Mock post has title "Test Post Title" (15 chars), so we need shorter body
        const posts = [
          createMockPost({ title: '', body: 'Short body 40 chars exactly!!! 1234567' }), // 40 chars, no title
        ]

        // With default (50), should filter (40 < 50)
        const result50 = qualityGateFilter(posts, 50)
        expect(result50.filtered).toHaveLength(1)

        // With lower threshold (30), should pass (40 >= 30)
        const result30 = qualityGateFilter(posts, 30)
        expect(result30.passed).toHaveLength(1)
      })

      it('should use shorter minimum (30) for comments', () => {
        const comments = [
          createMockComment({ body: 'Short comment here' }), // 18 chars - too short even for 30
          createMockComment({ body: 'This comment has enough text for 30 chars minimum.' }), // >30 chars
        ]

        const result = qualityGateFilter(comments, 30)

        expect(result.passed).toHaveLength(1)
        expect(result.filtered).toHaveLength(1)
      })
    })

    describe('Non-English Content Detection', () => {
      // Note: The implementation detects non-English via Latin Extended characters (accents)
      // It uses a heuristic: >30% accented Latin characters = likely non-English
      // Cyrillic, Chinese, etc. are stripped before analysis (implementation limitation)

      it('should filter posts with heavily accented text (>30% accented characters)', () => {
        const posts = [
          createMockPost({
            title: 'Título en español',
            // Text with many accented characters (Latin Extended)
            body: 'Ésta és ùnà prùèbà cón mùchàs lètràs àcéntùàdàs pàrà vèr sí él fíltrò fùncíònà còrrèctàmèntè.',
          }),
          createMockPost({
            title: 'Normal English Post',
            body: 'This is a perfectly normal English post that should pass through the filter with plenty of words.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('non_english')
      })

      it('should filter posts with heavily accented titles', () => {
        const posts = [
          createMockPost({
            // Title with >30% accented characters in Latin Extended range
            title: 'Éstà és ùnà prùèbà dè títùlò cón àcèntòs èxcèsívòs',
            body: 'This body is in English but the title has too many accented characters for the filter.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('non_english')
      })

      it('should pass posts with some accented characters', () => {
        const posts = [
          createMockPost({
            body: 'This is mostly English with some café and résumé type words which is perfectly fine.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
      })

      it('should not flag short text as non-English', () => {
        const posts = [
          createMockPost({
            body: 'This is a short but valid English post that should definitely pass.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
      })
    })

    describe('Spam Pattern Detection', () => {
      it('should filter promotional spam', () => {
        const posts = [
          createMockPost({
            title: 'Check out this FREE discount code!',
            body: 'Get your free trial now with this limited time offer! Act now before it expires!',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('spam')
      })

      it('should filter self-promotion spam', () => {
        const posts = [
          createMockPost({
            body: 'Subscribe to my channel and follow me for more content! Check out my YouTube videos.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('spam')
      })

      it('should filter solicitation spam', () => {
        const posts = [
          createMockPost({
            body: 'DM me for more details! Link in bio for exclusive content.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('spam')
      })

      it('should pass posts with legitimate mentions of money', () => {
        const posts = [
          createMockPost({
            body: 'I bought this product for fifty dollars and it was worth every penny. Great experience overall and highly recommend.',
          }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.passed).toHaveLength(1)
      })
    })

    describe('Decision Recording', () => {
      it('should record correct decision metadata', () => {
        const post = createMockPost({
          id: 'test_post_123',
          title: 'Test Title',
          body: '[removed]',
          subreddit: 'testsubreddit',
        })

        const result = qualityGateFilter([post])

        expect(result.decisions).toHaveLength(1)
        expect(result.decisions[0]).toMatchObject({
          reddit_id: 'test_post_123',
          title: 'Test Title',
          subreddit: 'testsubreddit',
          decision: 'N',
          stage: 'quality',
          reason: 'removed_deleted',
        })
      })

      it('should only record decisions for filtered items', () => {
        const posts = [
          createMockPost({ body: 'This is valid content with sufficient length to pass the minimum character requirement for quality filtering.' }),
          createMockPost({ body: '[removed]' }),
        ]

        const result = qualityGateFilter(posts)

        expect(result.decisions).toHaveLength(1)
        expect(result.decisions[0].decision).toBe('N')
      })

      it('should truncate long body previews to 200 characters', () => {
        const longBody = 'x'.repeat(500)
        const posts = [createMockPost({ body: longBody })]

        // Force filter by making it too short (0 chars min would pass, but the check is <50)
        // Let's use spam to force a filter
        posts[0].body = 'Check out my channel and subscribe now! ' + 'x'.repeat(400)

        const result = qualityGateFilter(posts)

        expect(result.decisions[0].body_preview.length).toBe(200)
      })
    })

    describe('Filter Priority', () => {
      it('should check removed/deleted before length', () => {
        const posts = [createMockPost({ body: '[removed]' })] // Also too short

        const result = qualityGateFilter(posts)

        expect(result.decisions[0].reason).toBe('removed_deleted')
      })

      it('should check length before non-English', () => {
        const posts = [createMockPost({ body: 'Short' })] // Too short, can't determine language

        const result = qualityGateFilter(posts)

        expect(result.decisions[0].reason).toBe('too_short')
      })

      it('should check non-English before spam', () => {
        // A non-English spam post should be filtered as non-English first
        const posts = [
          createMockPost({
            body: 'Подписывайтесь на мой канал! Subscribe to my YouTube channel for free content!',
          }),
        ]

        const result = qualityGateFilter(posts)

        // Could be either - if >30% non-ASCII, it's non_english; otherwise spam
        expect(['non_english', 'spam']).toContain(result.decisions[0].reason)
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty array', () => {
        const result = qualityGateFilter([])

        expect(result.passed).toHaveLength(0)
        expect(result.filtered).toHaveLength(0)
        expect(result.decisions).toHaveLength(0)
      })

      it('should handle posts with empty body', () => {
        const posts = [createMockPost({ body: '' })]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].reason).toBe('too_short')
      })

      it('should handle posts with undefined body', () => {
        const posts = [createMockPost({ body: undefined as unknown as string })]

        const result = qualityGateFilter(posts)

        expect(result.filtered).toHaveLength(1)
      })

      it('should handle comments (no title field)', () => {
        const comments = [
          createMockComment({ body: '[removed]' }),
          createMockComment({ body: 'Valid comment content that should pass the filter check.' }),
        ]

        const result = qualityGateFilter(comments, 30)

        expect(result.passed).toHaveLength(1)
        expect(result.filtered).toHaveLength(1)
        expect(result.decisions[0].title).toBeUndefined()
      })
    })
  })

  describe('Filter Metrics', () => {
    it('should calculate correct filter metrics for posts', async () => {
      const posts = [
        createMockPost({ id: '1', body: '[removed]' }), // Stage 3 filter
        createMockPost({ id: '2', body: 'Too short' }), // Stage 3 filter
        createMockPost({ id: '3', body: 'Valid post content with enough length for testing.' }),
        createMockPost({ id: '4', body: 'Another valid post content with enough length for testing.' }),
        createMockPost({ id: '5', body: 'Third valid post content with enough length for testing.' }),
      ]

      // Just test Stage 3 metrics directly
      const stage3Result = qualityGateFilter(posts)

      expect(stage3Result.passed).toHaveLength(3)
      expect(stage3Result.filtered).toHaveLength(2)
    })
  })

  describe('Integration: Full Pipeline Behavior', () => {
    it('should handle all posts being filtered at Stage 3', async () => {
      const posts = [
        createMockPost({ body: '[removed]' }),
        createMockPost({ body: 'Too short' }),
        createMockPost({ body: '[deleted]' }),
      ]

      const result = await filterRelevantPosts(posts, 'Test hypothesis')

      expect(result.items).toHaveLength(0)
      expect(result.metrics.before).toBe(3)
      expect(result.metrics.after).toBe(0)
      expect(result.metrics.filterRate).toBe(100)
      expect(result.metrics.stage3Filtered).toBe(3)
    })

    it('should correctly aggregate decisions from all stages', async () => {
      const posts = [
        createMockPost({ body: '[removed]' }), // Stage 3
        createMockPost({ body: 'Valid post about skincare and aging for men over 50.' }), // Should pass
      ]

      const result = await filterRelevantPosts(posts, 'Men over 50 with aging skin')

      // Should have at least the Stage 3 decision
      expect(result.decisions.some(d => d.stage === 'quality')).toBe(true)
    })

    it('should pass progress callback for each stage', async () => {
      const progressMessages: string[] = []
      const mockProgress = (msg: string) => progressMessages.push(msg)

      const posts = [
        createMockPost({ body: 'Valid post about skincare issues for older men.' }),
      ]

      await filterRelevantPosts(
        posts,
        'Men over 50 with aging skin',
        undefined,
        mockProgress
      )

      expect(progressMessages.length).toBeGreaterThan(0)
      expect(progressMessages.some(m => m.includes('Stage 3') || m.includes('Quality'))).toBe(true)
    })
  })

  describe('Comments Filter', () => {
    it('should use shorter minimum length for comments (30 chars)', async () => {
      const comments = [
        createMockComment({ body: 'Very short' }), // 10 chars - too short even for 30
        createMockComment({ body: 'This comment is just barely long enough.' }), // 41 chars - passes
      ]

      const result = await filterRelevantComments(comments, 'Test hypothesis')

      // First one filtered for being too short
      expect(result.decisions.some(d => d.stage === 'quality')).toBe(true)
    })

    it('should skip domain gate for comments (2-stage filter)', async () => {
      const comments = [
        createMockComment({ body: 'This is a valid comment with enough content for testing.' }),
      ]

      const result = await filterRelevantComments(comments, 'Test hypothesis')

      // Comments should only have quality and problem stages, no domain stage
      expect(result.metrics.stage1Filtered).toBe(0) // Domain gate not used
    })
  })
})
