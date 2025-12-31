/**
 * Export raw Reddit posts for manual review
 * NO AI CALLS - just Arctic Shift data dump
 *
 * Usage: npx tsx scripts/export-raw-posts.ts
 */

import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

const SUBREDDITS = [
  'freelance',
  'freelancewriters',
  'clients_from_hell',
  'consulting',
  'webdev',
  'smallbusiness',
  'entrepreneur',
  'personalfinance'
]

async function exportPosts() {
  console.log('Fetching posts from Arctic Shift (no AI calls)...\n')

  const allPosts: Array<{
    id: string
    title: string
    body: string
    subreddit: string
    url: string
    score: number
    created: string
  }> = []

  console.log(`Fetching from: ${SUBREDDITS.join(', ')}...`)

  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const posts = await arcticShift.searchPosts({
      subreddits: SUBREDDITS,
      limit: 800,
      timeRange: { start: sixMonthsAgo, end: new Date() }
    })

    console.log(`Got ${posts.length} posts from Arctic Shift`)

    for (const post of posts) {
      // Skip removed/deleted
      if (post.body === '[removed]' || post.body === '[deleted]') continue
      if (!post.body || post.body.length < 50) continue

      const createdDate = post.created_utc
        ? new Date(post.created_utc * 1000).toISOString().split('T')[0]
        : 'unknown'

      allPosts.push({
        id: post.id,
        title: post.title,
        body: (post.body || '').slice(0, 300),
        subreddit: post.subreddit,
        url: `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
        score: post.score || 0,
        created: createdDate
      })
    }
  } catch (error) {
    console.log(`Error: ${error}`)
  }

  // Write to Downloads
  const outputPath = '/Users/julientorriani/Downloads/pvre-raw-posts.json'
  const fs = await import('fs')
  fs.writeFileSync(outputPath, JSON.stringify(allPosts, null, 2))

  console.log(`\n✓ Exported ${allPosts.length} posts to ${outputPath}`)
  console.log('\nNext: Open the JSON and search for posts about "late payment", "client won\'t pay", etc.')
}

exportPosts().catch(console.error)
