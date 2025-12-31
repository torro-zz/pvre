import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, cosineSimilarity } from '../src/lib/embeddings/embedding-service'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const hypothesis = 'Freelancers struggling to get paid on time by clients'
const arcticShift = new ArcticShiftSource()

async function main() {
  console.log('=== SCORE DISCREPANCY CHECK ===')
  console.log('Hypothesis:', hypothesis)
  console.log('')

  const hypothesisEmbedding = await generateEmbedding(hypothesis)

  // Fetch posts to find 1pzlrre
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['smallbusiness'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  const post = posts.find(p => p.id === '1pzlrre')
  if (post) {
    console.log('Post ID:', post.id)
    console.log('Title:', post.title)
    console.log('Body length:', (post.selftext || '').length)
    console.log('Body preview:', (post.selftext || '[empty]').slice(0, 200))
    console.log('')

    // Score with title only
    const titleOnlyEmb = await generateEmbedding(post.title)
    const titleOnlyScore = cosineSimilarity(hypothesisEmbedding, titleOnlyEmb)
    console.log('Title-only score:', titleOnlyScore.toFixed(3))

    // Score with title + body
    const fullText = `${post.title} ${post.selftext || ''}`.slice(0, 500)
    const fullEmb = await generateEmbedding(fullText)
    const fullScore = cosineSimilarity(hypothesisEmbedding, fullEmb)
    console.log('Full text score:', fullScore.toFixed(3))
  } else {
    console.log('Post 1pzlrre not found')
  }

  // Also check "first client" noise post
  console.log('')
  console.log('=== NOISE POST CHECK ===')
  const allPosts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  const noisePost = allPosts.find(p => p.title.includes('real skill') && p.title.includes('first client'))
  if (noisePost) {
    console.log('Title:', noisePost.title)
    const noiseEmb = await generateEmbedding(noisePost.title)
    const noiseScore = cosineSimilarity(hypothesisEmbedding, noiseEmb)
    console.log('Score:', noiseScore.toFixed(3))
    console.log('Above 0.34:', noiseScore >= 0.34 ? 'YES' : 'NO')
  }
}

main()
