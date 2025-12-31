/**
 * Test script for embedding service
 * Run with: npx tsx scripts/test-embeddings.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, generateEmbeddings, cosineSimilarity, classifySimilarity, isEmbeddingServiceAvailable, SIMILARITY_THRESHOLDS } from '../src/lib/embeddings'

async function testEmbeddings() {
  console.log('=== Embedding Service Test ===\n')
  console.log('Service available:', isEmbeddingServiceAvailable())
  console.log('Thresholds:', SIMILARITY_THRESHOLDS)

  if (!isEmbeddingServiceAvailable()) {
    console.log('\nOPENAI_API_KEY not set - cannot run test')
    process.exit(1)
  }

  // Test hypothesis
  const hypothesis = 'Freelancers struggling to get paid on time by clients'

  // Test posts - mix of relevant and irrelevant
  const posts = [
    // Should be HIGH similarity (relevant)
    'I hate chasing clients for payments. Been waiting 60 days for a $2000 invoice.',
    'My clients never pay on time. I sent 5 invoices last month, only got paid for 1.',
    'How do freelancers deal with late-paying clients? This is killing my cash flow.',

    // Should be MEDIUM similarity (related domain)
    'Looking for recommendations on accounting software for freelancers',
    'What invoicing tools do you use for your freelance business?',

    // Should be LOW similarity (irrelevant)
    'Best pizza recipes for a busy weeknight dinner',
    'How to train your dog to sit and stay',
    'The new iPhone release looks amazing, preordering today',
    'Anyone else watching the game tonight?',
  ]

  console.log('\n--- Generating hypothesis embedding ---')
  console.log(`Hypothesis: "${hypothesis}"`)

  const startTime = Date.now()
  const hypothesisEmb = await generateEmbedding(hypothesis)
  console.log(`Dimensions: ${hypothesisEmb?.length}`)
  console.log(`Time: ${Date.now() - startTime}ms`)

  if (!hypothesisEmb || hypothesisEmb.length === 0) {
    console.error('Failed to generate hypothesis embedding')
    process.exit(1)
  }

  console.log('\n--- Generating post embeddings (batch) ---')
  const batchStart = Date.now()
  const postEmbeddings = await generateEmbeddings(posts)
  console.log(`Batch time for ${posts.length} posts: ${Date.now() - batchStart}ms`)
  console.log(`Cached: ${postEmbeddings.filter(e => e.cached).length}/${posts.length}`)

  console.log('\n--- Similarity Results ---')
  console.log('Threshold HIGH:', SIMILARITY_THRESHOLDS.HIGH)
  console.log('Threshold MEDIUM:', SIMILARITY_THRESHOLDS.MEDIUM)
  console.log('')

  const results: Array<{ post: string; similarity: number; tier: string }> = []

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    const embedding = postEmbeddings[i]?.embedding

    if (!embedding || embedding.length === 0) {
      console.log(`[ERROR] ${post.slice(0, 50)}...`)
      continue
    }

    const similarity = cosineSimilarity(hypothesisEmb, embedding)
    const tier = classifySimilarity(similarity)

    results.push({ post, similarity, tier })
  }

  // Sort by similarity (descending)
  results.sort((a, b) => b.similarity - a.similarity)

  // Display results
  let highCount = 0, mediumCount = 0, lowCount = 0

  for (const { post, similarity, tier } of results) {
    const tierIcon = tier === 'HIGH' ? '✓' : tier === 'MEDIUM' ? '~' : '✗'
    console.log(`[${tier.padEnd(6)}] ${tierIcon} ${similarity.toFixed(3)} | ${post.slice(0, 60)}${post.length > 60 ? '...' : ''}`)

    if (tier === 'HIGH') highCount++
    else if (tier === 'MEDIUM') mediumCount++
    else lowCount++
  }

  console.log('\n--- Summary ---')
  console.log(`HIGH (>= ${SIMILARITY_THRESHOLDS.HIGH}): ${highCount} posts`)
  console.log(`MEDIUM (>= ${SIMILARITY_THRESHOLDS.MEDIUM}): ${mediumCount} posts`)
  console.log(`LOW (< ${SIMILARITY_THRESHOLDS.MEDIUM}): ${lowCount} posts (would be filtered)`)
  console.log(`\nFilter effectiveness: ${lowCount}/${posts.length} irrelevant posts filtered (${Math.round(lowCount/posts.length*100)}%)`)
}

testEmbeddings().catch(console.error)
