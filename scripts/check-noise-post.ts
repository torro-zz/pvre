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

  const noisePost = posts.find(p => p.title.includes('real skill') && p.title.includes('first client'))
  if (noisePost) {
    console.log('ID:', noisePost.id)
    console.log('Title:', noisePost.title)
    console.log('Body length:', (noisePost.selftext || '').length)
    console.log('Body preview:', (noisePost.selftext || '').slice(0, 300))
    console.log('Has body (>50):', !!(noisePost.selftext && noisePost.selftext.length > 50))
  } else {
    console.log('Post not found in current fetch')
  }
}

main()
