/**
 * Check title-only embedding scores for missing gold nuggets
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, cosineSimilarity } from '../src/lib/embeddings/embedding-service'

const hypothesis = 'Freelancers struggling to get paid on time by clients'

const MISSING_GOLD = [
  { id: '1parsre', calibrationScore: 0.510, title: 'lost hours and money to bad clients how do you spot red flags' },
  { id: '1nkiqld', calibrationScore: 0.341, title: '6 months of work. $0 payment. Here\'s what I learned.' },
  { id: '1nco4hk', calibrationScore: 0.400, title: 'Stuck in a stalled ghostwriting project. What are my options?' },
  { id: '1nvbyjt', calibrationScore: 0.521, title: 'We Lost $120k to Client Nonpayment: our story' },
]

async function main() {
  console.log('=== TITLE-ONLY EMBEDDING SCORES ===')
  console.log('Hypothesis:', hypothesis)
  console.log('Threshold: 0.34')
  console.log('')

  const hypothesisEmbedding = await generateEmbedding(hypothesis)

  for (const gold of MISSING_GOLD) {
    const titleEmbedding = await generateEmbedding(gold.title)
    const score = cosineSimilarity(hypothesisEmbedding, titleEmbedding)

    const pass = score >= 0.34
    console.log(`${gold.id}:`)
    console.log(`  Calibration score (title+body): ${gold.calibrationScore.toFixed(3)}`)
    console.log(`  Title-only score: ${score.toFixed(3)}`)
    console.log(`  Passes 0.34: ${pass ? 'YES' : 'NO'}`)
    console.log(`  Title: ${gold.title}`)
    console.log('')
  }
}

main()
