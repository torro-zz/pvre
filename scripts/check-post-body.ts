import { config } from 'dotenv'
config({ path: '.env.local' })

import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

async function main() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  const target = posts.find(p => p.id === '1pzlrre')
  if (target) {
    console.log('=== POST 1pzlrre ===')
    console.log('Title:', target.title)
    console.log('Has body:', target.selftext ? 'YES' : 'NO')
    console.log('Body length:', (target.selftext || '').length)
    console.log('Body preview:', (target.selftext || '[EMPTY]').slice(0, 500))
  } else {
    console.log('Post 1pzlrre not found in fetched posts')
  }
}

main()
