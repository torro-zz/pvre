import { config } from 'dotenv'
config({ path: '.env.local' })

import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

async function main() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  // Find all posts with "deflated" in title
  const deflatedPosts = posts.filter(p => p.title.toLowerCase().includes('deflated'))

  console.log('Posts with "deflated" in title:', deflatedPosts.length)
  for (const p of deflatedPosts) {
    console.log('---')
    console.log('ID:', p.id)
    console.log('Title:', p.title)
    console.log('Body length:', (p.selftext || '').length)
    console.log('Subreddit:', p.subreddit)
    if ((p.selftext || '').length > 0) {
      console.log('Body preview:', (p.selftext || '').slice(0, 300))
    }
  }
}

main()
