/**
 * Universal Filter Validation Test
 *
 * Runs 3 test hypotheses through the filter and reports results.
 * Used to validate filter calibration before shipping.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { filterRelevantPosts } from '../src/lib/research/relevance-filter'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

// Gold nuggets for Test A (Freelancers)
const GOLD_NUGGETS = [
  { id: '1parsre', title: 'lost hours and money to bad clients how do you spot red flags' },
  { id: '1nkiqld', title: "6 months of work. $0 payment. Here's what I learned." },
  { id: '1nco4hk', title: 'Stuck in a stalled ghostwriting project. What are my options?' },
  { id: '1nvbyjt', title: 'We Lost $120k to Client Nonpayment: our story' },
  { id: '1owz41k', title: 'Ghosted After a Large Project - Lesson Learned' },
  { id: '1ongage', title: 'Non-payment from client after 6-months of work' },
  { id: '1n0oj8j', title: 'How to handle clients who delay payment?' },
  { id: '1mq3koj', title: 'Client refusing to pay final invoice - options?' },
]

interface TestResult {
  hypothesis: string
  totalSignals: number
  sampleTitles: string[]
  goldNuggetResults?: { id: string; title: string; found: boolean }[]
  goldNuggetHitRate?: string
}

async function runTest(
  hypothesis: string,
  subreddits: string[],
  goldNuggets?: typeof GOLD_NUGGETS
): Promise<TestResult> {
  console.log(`\n=== Testing: "${hypothesis.slice(0, 50)}..." ===`)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits,
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  console.log(`Fetched ${posts.length} posts from ${subreddits.join(', ')}`)

  const result = await filterRelevantPosts(posts, hypothesis, undefined, (msg) => {
    if (msg.includes('passed') || msg.includes('filtered') || msg.includes('complete')) {
      console.log(`  ${msg}`)
    }
  })

  console.log(`Final result: ${result.items.length} signals`)

  // Check gold nuggets if provided
  let goldResults: { id: string; title: string; found: boolean }[] | undefined
  let hitRate: string | undefined

  if (goldNuggets) {
    goldResults = goldNuggets.map(gn => ({
      id: gn.id,
      title: gn.title,
      found: result.items.some(item => item.id === gn.id)
    }))

    const found = goldResults.filter(g => g.found).length
    hitRate = `${found}/${goldNuggets.length} (${Math.round(found / goldNuggets.length * 100)}%)`
    console.log(`Gold nugget hit rate: ${hitRate}`)
  }

  // Get sample titles
  const sampleTitles = result.items
    .slice(0, 10)
    .map(item => item.title)

  return {
    hypothesis,
    totalSignals: result.items.length,
    sampleTitles,
    goldNuggetResults: goldResults,
    goldNuggetHitRate: hitRate,
  }
}

async function main() {
  const results: TestResult[] = []

  // Test A: Freelancers
  console.log('\n' + '='.repeat(60))
  console.log('TEST A: FREELANCERS')
  console.log('='.repeat(60))

  const testA = await runTest(
    'Freelancers struggling to get paid on time by clients',
    ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    GOLD_NUGGETS
  )
  results.push(testA)

  // Test B: Founders
  console.log('\n' + '='.repeat(60))
  console.log('TEST B: FOUNDERS')
  console.log('='.repeat(60))

  const testB = await runTest(
    'Founders struggling to get their first customers',
    ['startups', 'SaaS', 'Entrepreneur', 'smallbusiness', 'indiehackers']
  )
  results.push(testB)

  // Test C: CI/CD (Edge Case)
  console.log('\n' + '='.repeat(60))
  console.log('TEST C: CI/CD (EDGE CASE)')
  console.log('='.repeat(60))

  const testC = await runTest(
    'Developers frustrated with slow CI/CD pipelines',
    ['devops', 'programming', 'webdev', 'softwaredevelopment', 'aws']
  )
  results.push(testC)

  // Output JSON for parsing
  console.log('\n' + '='.repeat(60))
  console.log('RESULTS JSON')
  console.log('='.repeat(60))
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
