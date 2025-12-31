/**
 * Deterministic Calibration Test
 *
 * Tests the new deterministic embedding method against gold nuggets.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, cosineSimilarity } from '../src/lib/embeddings/embedding-service'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'
import * as fs from 'fs'

const arcticShift = new ArcticShiftSource()

const GOLD_NUGGET_IDS = [
  '1px5iot', '1parsre', '1owz41k', '1ongage', '1nq3lam',
  '1nkiqld', '1nco4hk', '1n0oj8j', '1mq3koj', '1pzlrre',
  '1pyjfwu', '1pyhp94', '1nvbyjt', '1nvf4yv'
]

const hypothesis = 'Freelancers struggling to get paid on time by clients'

async function main() {
  console.log('=== DETERMINISTIC CALIBRATION ===')
  console.log('Hypothesis:', hypothesis)
  console.log('')

  // Use hypothesis ONLY for embedding (no keywords - they vary between runs)
  const embeddingText = hypothesis
  console.log('Embedding text (hypothesis only):', embeddingText)
  console.log('')

  // Generate hypothesis embedding
  const hypothesisEmbedding = await generateEmbedding(embeddingText)
  console.log('Hypothesis embedding generated:', hypothesisEmbedding.length, 'dimensions')

  // Fetch posts
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log('Fetched', posts.length, 'posts')
  console.log('')

  // Find gold nuggets and calculate scores
  console.log('=== GOLD NUGGET SCORES ===')
  console.log('| ID        | Score  | Threshold | Pass | Title')
  console.log('|-----------|--------|-----------|------|------------------------------------------')

  let passed = 0
  let found = 0
  const scores: number[] = []
  const results: Array<{id: string, score: number, pass: boolean, title: string}> = []

  for (const goldId of GOLD_NUGGET_IDS) {
    const post = posts.find(p => p.id === goldId)
    if (!post) {
      console.log(`| ${goldId.padEnd(9)} | N/A    | 0.35      | -    | [NOT FOUND]`)
      continue
    }
    found++

    const postText = `${post.title} ${post.selftext || ''}`.slice(0, 500)
    const postEmbedding = await generateEmbedding(postText)
    const score = cosineSimilarity(hypothesisEmbedding, postEmbedding)
    scores.push(score)

    const pass = score >= 0.35
    if (pass) passed++

    results.push({ id: goldId, score, pass, title: post.title })
    console.log(`| ${goldId.padEnd(9)} | ${score.toFixed(3).padEnd(6)} | 0.35      | ${(pass ? 'YES' : 'NO ').padEnd(4)} | ${post.title.slice(0, 40)}...`)
  }

  console.log('')
  console.log('=== CALIBRATION SUMMARY ===')
  console.log('Gold nuggets found in data:', found, '/', GOLD_NUGGET_IDS.length)
  console.log('Passed threshold (0.35):', passed, '/', found)
  console.log('Hit rate:', (passed / found * 100).toFixed(1) + '%')
  console.log('')
  console.log('Score statistics:')
  console.log('  Min:', Math.min(...scores).toFixed(3))
  console.log('  Max:', Math.max(...scores).toFixed(3))
  console.log('  Avg:', (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(3))
  console.log('')

  // Threshold recommendations
  const thresholds = [0.25, 0.30, 0.35, 0.40]
  console.log('=== THRESHOLD ANALYSIS ===')
  for (const t of thresholds) {
    const passCount = scores.filter(s => s >= t).length
    console.log(`Threshold ${t.toFixed(2)}: ${passCount}/${scores.length} pass (${(passCount/scores.length*100).toFixed(0)}%)`)
  }

  // Save results
  const output = {
    hypothesis,
    embeddingText,
    timestamp: new Date().toISOString(),
    goldNuggetsFound: found,
    passedThreshold: passed,
    hitRate: `${(passed / found * 100).toFixed(1)}%`,
    results,
    statistics: {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: scores.reduce((a,b)=>a+b,0)/scores.length
    }
  }

  fs.writeFileSync('/Users/julientorriani/Downloads/calibration-deterministic-results.json', JSON.stringify(output, null, 2))
  console.log('')
  console.log('✓ Results saved to /Users/julientorriani/Downloads/calibration-deterministic-results.json')
}

main().catch(console.error)
