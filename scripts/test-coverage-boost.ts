/**
 * Test Dynamic Coverage Boost
 *
 * Runs two hypothesis searches and reports results
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { filterRelevantPosts } from '../src/lib/research/relevance-filter'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'
import * as fs from 'fs'

const arcticShift = new ArcticShiftSource()

// Gold nuggets from calibration (for Test 1)
const GOLD_NUGGET_IDS = new Set([
  '1px5iot', '1parsre', '1owz41k', '1ongage', '1nq3lam',
  '1nkiqld', '1nco4hk', '1n0oj8j', '1mq3koj', '1pzlrre',
  '1pyjfwu', '1pyhp94', '1nvbyjt', '1nvf4yv'
])

const output: string[] = []

function log(msg: string) {
  console.log(msg)
  output.push(msg)
}

async function main() {
  log(`# Dynamic Coverage Boost Test Results`)
  log(`Generated: ${new Date().toISOString()}`)
  log(``)

  // ========== TEST 1: Freelancers ==========
  log(`## Test 1: Freelancers Payment Hypothesis`)
  log(``)
  log(`**Hypothesis:** "Freelancers struggling to get paid on time by clients"`)
  log(``)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  console.log('Fetching posts for Test 1...')
  const posts1 = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log(`Fetched ${posts1.length} posts`)

  let phase2Triggered1 = false
  let boostKeywords1: string[] = []
  let phase1Count = 0
  let phase2RecoveredCount = 0

  const sendProgress1 = (msg: string) => {
    console.log(`[Progress] ${msg}`)
    if (msg.includes('Coverage boost: only')) {
      phase2Triggered1 = true
      const match = msg.match(/only (\d+) posts found/)
      if (match) phase1Count = parseInt(match[1])
    }
    if (msg.includes('Coverage boost: recovered')) {
      const match = msg.match(/recovered (\d+) posts/)
      if (match) phase2RecoveredCount = parseInt(match[1])
      const kwMatch = msg.match(/keywords: ([^)]+)\.\.\./)
      if (kwMatch) boostKeywords1 = kwMatch[1].split(', ')
    }
  }

  const result1 = await filterRelevantPosts(posts1, 'Freelancers struggling to get paid on time by clients', undefined, sendProgress1)

  // Check gold nugget hits
  const resultIds1 = new Set(result1.items.map(p => p.id))
  const goldHits = [...GOLD_NUGGET_IDS].filter(id => resultIds1.has(id))
  const hitRate = ((goldHits.length / GOLD_NUGGET_IDS.size) * 100).toFixed(0)

  log(`| Metric | Value |`)
  log(`|--------|-------|`)
  log(`| Total Signals | ${result1.items.length} |`)
  log(`| Phase 1 Initial Count | ${phase1Count > 0 ? phase1Count : result1.items.length} |`)
  log(`| Phase 2 Triggered | ${phase2Triggered1 ? 'Yes' : 'No'} |`)
  log(`| Phase 2 Recovered | ${phase2RecoveredCount} |`)
  log(`| Gold Nugget Hits | ${goldHits.length} / ${GOLD_NUGGET_IDS.size} (${hitRate}%) |`)
  log(``)

  if (boostKeywords1.length > 0) {
    log(`**Boost Keywords:** ${boostKeywords1.join(', ')}`)
    log(``)
  }

  log(`### Gold Nuggets Found`)
  for (const id of goldHits) {
    const post = result1.items.find(p => p.id === id)
    if (post) {
      log(`- ✓ [${id}] ${post.title.slice(0, 60)}...`)
    }
  }
  log(``)

  log(`### Gold Nuggets Missed`)
  const missedGold = [...GOLD_NUGGET_IDS].filter(id => !resultIds1.has(id))
  for (const id of missedGold) {
    log(`- ✗ [${id}]`)
  }
  log(``)

  log(`### Sample Titles (first 5)`)
  for (const post of result1.items.slice(0, 5)) {
    log(`- ${post.title}`)
  }
  log(``)

  // ========== TEST 2: Founders ==========
  log(`## Test 2: Founders First Customers Hypothesis`)
  log(``)
  log(`**Hypothesis:** "Founders struggling to get their first customers"`)
  log(``)

  console.log('Fetching posts for Test 2...')
  const posts2 = await arcticShift.searchPosts({
    subreddits: ['startups', 'Entrepreneur', 'SaaS', 'smallbusiness', 'indiehackers'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log(`Fetched ${posts2.length} posts`)

  let phase2Triggered2 = false
  let boostKeywords2: string[] = []
  let phase1Count2 = 0
  let phase2RecoveredCount2 = 0

  const sendProgress2 = (msg: string) => {
    console.log(`[Progress] ${msg}`)
    if (msg.includes('Coverage boost: only')) {
      phase2Triggered2 = true
      const match = msg.match(/only (\d+) posts found/)
      if (match) phase1Count2 = parseInt(match[1])
    }
    if (msg.includes('Coverage boost: recovered')) {
      const match = msg.match(/recovered (\d+) posts/)
      if (match) phase2RecoveredCount2 = parseInt(match[1])
      const kwMatch = msg.match(/keywords: ([^)]+)\.\.\./)
      if (kwMatch) boostKeywords2 = kwMatch[1].split(', ')
    }
  }

  const result2 = await filterRelevantPosts(posts2, 'Founders struggling to get their first customers', undefined, sendProgress2)

  log(`| Metric | Value |`)
  log(`|--------|-------|`)
  log(`| Total Signals | ${result2.items.length} |`)
  log(`| Phase 1 Initial Count | ${phase1Count2 > 0 ? phase1Count2 : result2.items.length} |`)
  log(`| Phase 2 Triggered | ${phase2Triggered2 ? 'Yes' : 'No'} |`)
  log(`| Phase 2 Recovered | ${phase2RecoveredCount2} |`)
  log(``)

  if (boostKeywords2.length > 0) {
    log(`**Generated Boost Keywords:** ${boostKeywords2.join(', ')}`)
    log(``)
  }

  log(`### Sample Titles (first 10)`)
  for (const post of result2.items.slice(0, 10)) {
    log(`- ${post.title}`)
  }
  log(``)

  // Write to file
  const outputPath = '/Users/julientorriani/Downloads/coverage-boost-test-results.md'
  fs.writeFileSync(outputPath, output.join('\n'))
  console.log(`\n✓ Results saved to: ${outputPath}`)
}

main().catch(console.error)
