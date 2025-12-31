/**
 * Gold Nugget Calibration Script
 *
 * Calculates embedding similarity scores for verified relevant posts.
 * Used to set threshold based on GROUND TRUTH, not guesses.
 *
 * Cost: ~$0.0002 (one batch embedding call for 15 texts)
 *
 * Usage: npx tsx scripts/calibrate-embeddings.ts
 */

// Load environment variables
import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbeddings, cosineSimilarity } from '../src/lib/embeddings'
import * as fs from 'fs'

const GOLD_FILE = '/Users/julientorriani/Downloads/Gold Nuggets Calibration.json'

interface GoldNugget {
  id: string
  subreddit: string
  title: string
  body: string
  full_text: string
  url: string
  score: number
}

interface GoldData {
  hypothesis: string
  expanded_hypothesis: string
  gold_nuggets: GoldNugget[]
  total_gold: number
}

async function main() {
  console.log('=== Gold Nugget Calibration ===\n')

  // Load gold nuggets
  const data: GoldData = JSON.parse(fs.readFileSync(GOLD_FILE, 'utf-8'))
  console.log(`Loaded ${data.gold_nuggets.length} gold nuggets`)
  console.log(`Hypothesis: "${data.hypothesis}"`)
  console.log(`Expanded: "${data.expanded_hypothesis.slice(0, 100)}..."\n`)

  // Prepare all texts for batch embedding (1 API call)
  const allTexts = [
    data.expanded_hypothesis,
    ...data.gold_nuggets.map(g => g.full_text)
  ]

  console.log(`Generating embeddings for ${allTexts.length} texts (1 API call)...`)
  const embeddings = await generateEmbeddings(allTexts)

  // Check for failures
  const hypothesisEmb = embeddings[0]?.embedding
  if (!hypothesisEmb || hypothesisEmb.length === 0) {
    console.error('ERROR: Failed to generate hypothesis embedding')
    process.exit(1)
  }

  // Calculate similarities
  console.log('\n' + '='.repeat(80))
  console.log('| ID        | Subreddit          | Score  | Title (truncated)')
  console.log('|' + '-'.repeat(78) + '|')

  const scores: { id: string; title: string; similarity: number }[] = []

  for (let i = 0; i < data.gold_nuggets.length; i++) {
    const nugget = data.gold_nuggets[i]
    const emb = embeddings[i + 1]?.embedding

    if (!emb || emb.length === 0) {
      console.log(`| ${nugget.id.padEnd(9)} | ${nugget.subreddit.padEnd(18)} | FAIL   | ${nugget.title.slice(0, 40)}`)
      continue
    }

    const similarity = cosineSimilarity(hypothesisEmb, emb)
    scores.push({ id: nugget.id, title: nugget.title, similarity })

    const scoreStr = similarity.toFixed(3).padStart(6)
    console.log(`| ${nugget.id.padEnd(9)} | ${nugget.subreddit.padEnd(18)} | ${scoreStr} | ${nugget.title.slice(0, 40)}`)
  }

  console.log('=' .repeat(80))

  // Statistics
  if (scores.length > 0) {
    const similarities = scores.map(s => s.similarity)
    const min = Math.min(...similarities)
    const max = Math.max(...similarities)
    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length
    const sorted = [...similarities].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    console.log('\n=== CALIBRATION RESULTS ===')
    console.log(`Lowest score:  ${min.toFixed(3)}`)
    console.log(`Highest score: ${max.toFixed(3)}`)
    console.log(`Average:       ${avg.toFixed(3)}`)
    console.log(`Median:        ${median.toFixed(3)}`)
    console.log(`Range:         ${(max - min).toFixed(3)}`)

    console.log('\n=== THRESHOLD RECOMMENDATION ===')
    const recommendedThreshold = Math.max(0.10, min - 0.05)
    console.log(`Lowest gold nugget: ${min.toFixed(3)}`)
    console.log(`Safety margin:      -0.05`)
    console.log(`RECOMMENDED:        ${recommendedThreshold.toFixed(3)}`)

    // Show which posts would be at risk
    const atRisk = scores.filter(s => s.similarity < min + 0.05)
    if (atRisk.length > 0) {
      console.log('\n=== POSTS AT THRESHOLD EDGE ===')
      for (const s of atRisk) {
        console.log(`  ${s.similarity.toFixed(3)} - ${s.title.slice(0, 50)}`)
      }
    }

    // Interpretation guidance
    console.log('\n=== INTERPRETATION ===')
    if (min >= 0.35) {
      console.log('✓ All gold nuggets score >= 0.35')
      console.log('  → Threshold at 0.30 should work well')
    } else if (min >= 0.25) {
      console.log('⚠ Some gold nuggets score between 0.25-0.35')
      console.log('  → Need lower threshold, watch for false positives')
    } else {
      console.log('✗ Some gold nuggets score < 0.25')
      console.log('  → Embedding approach may need rethinking')
      console.log('  → Check if those posts use unusual language')
    }
  }
}

main().catch(console.error)
