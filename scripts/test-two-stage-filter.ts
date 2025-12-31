/**
 * Two-Stage Filter Test
 *
 * Tests the new pipeline:
 * Stage 1: Embedding filter (0.28 threshold)
 * Stage 2: Rank + cap at 50
 * Stage 3: Haiku AI verification
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'
import { normalizeRedditPosts } from '../src/lib/adapters/reddit-adapter'
import { filterSignals, PipelineResult } from '../src/lib/filter'

const arcticShift = new ArcticShiftSource()

interface TestResult {
  hypothesis: string
  stage1Candidates: number
  stage2Candidates: number
  stage3Verified: number
  verificationRate: string
  sampleTitles: string[]
  processingTimeMs: number
}

async function runTest(
  hypothesis: string,
  subreddits: string[]
): Promise<TestResult> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Testing: "${hypothesis}"`)
  console.log('='.repeat(70))

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Fetch posts
  console.log(`\nFetching posts from: ${subreddits.join(', ')}`)
  const posts = await arcticShift.searchPosts({
    subreddits,
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log(`Fetched ${posts.length} posts`)

  // Normalize to NormalizedPost format
  const normalizedPosts = normalizeRedditPosts(posts)
  console.log(`Normalized ${normalizedPosts.length} posts`)

  // Run two-stage pipeline
  const result = await filterSignals(normalizedPosts, hypothesis, {
    onProgress: (msg) => console.log(msg)
  })

  // Get sample titles from verified signals
  const sampleTitles = result.verified
    .slice(0, 10)
    .map(signal => signal.post.title)

  return {
    hypothesis,
    stage1Candidates: result.stage1Candidates,
    stage2Candidates: result.stage2Candidates,
    stage3Verified: result.stage3Verified,
    verificationRate: `${Math.round(result.verificationRate * 100)}%`,
    sampleTitles,
    processingTimeMs: result.processingTimeMs,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const results: TestResult[] = []

  // Test A: Freelancers
  console.log('\n' + '█'.repeat(70))
  console.log('TEST A: FREELANCERS')
  console.log('█'.repeat(70))

  const testA = await runTest(
    'Freelancers struggling to get paid on time by clients',
    ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting']
  )
  results.push(testA)

  // Wait 60 seconds to reset rate limit
  console.log('\n[Rate limit cooldown: waiting 60 seconds...]')
  await sleep(60000)

  // Test B: Founders
  console.log('\n' + '█'.repeat(70))
  console.log('TEST B: FOUNDERS')
  console.log('█'.repeat(70))

  const testB = await runTest(
    'Founders struggling to get their first customers',
    ['startups', 'SaaS', 'Entrepreneur', 'smallbusiness', 'indiehackers']
  )
  results.push(testB)

  // Wait 60 seconds to reset rate limit
  console.log('\n[Rate limit cooldown: waiting 60 seconds...]')
  await sleep(60000)

  // Test C: CI/CD
  console.log('\n' + '█'.repeat(70))
  console.log('TEST C: CI/CD (EDGE CASE)')
  console.log('█'.repeat(70))

  const testC = await runTest(
    'Developers frustrated with slow CI/CD pipelines',
    ['devops', 'programming', 'webdev', 'softwaredevelopment', 'aws']
  )
  results.push(testC)

  // Output summary
  console.log('\n' + '█'.repeat(70))
  console.log('SUMMARY')
  console.log('█'.repeat(70))
  console.log(JSON.stringify(results, null, 2))

  // Calculate cost estimate
  const totalAICalls = results.reduce((sum, r) => sum + r.stage2Candidates, 0)
  const estimatedCost = (totalAICalls * 0.001) + (3 * 0.01) // Haiku + embeddings
  console.log(`\nEstimated total cost: $${estimatedCost.toFixed(3)}`)
  console.log(`Cost per search: ~$${(estimatedCost / 3).toFixed(3)}`)
}

main().catch(console.error)
