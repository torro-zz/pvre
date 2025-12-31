/**
 * Diagnose Gold Nugget Losses
 *
 * Traces exactly where each gold nugget is filtered out in the pipeline.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import {
  generateEmbedding,
  cosineSimilarity,
  extractProblemFocus,
  passesKeywordGate,
  SIMILARITY_THRESHOLDS,
} from '../src/lib/embeddings/embedding-service'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'
import * as fs from 'fs'

const arcticShift = new ArcticShiftSource()

// Gold nuggets from calibration
const GOLD_NUGGET_IDS = [
  '1px5iot', '1parsre', '1owz41k', '1ongage', '1nq3lam',
  '1nkiqld', '1nco4hk', '1n0oj8j', '1mq3koj', '1pzlrre',
  '1pyjfwu', '1pyhp94', '1nvbyjt', '1nvf4yv'
]

const hypothesis = 'Freelancers struggling to get paid on time by clients'

interface GoldNuggetDiagnosis {
  id: string
  title: string
  found: boolean
  passedKeywordGate: boolean
  keywordGateReason: string
  similarityScore: number | null
  passedEmbeddingThreshold: boolean
  embeddingThreshold: number
}

async function main() {
  console.log('# Gold Nugget Diagnostic Report')
  console.log(`Generated: ${new Date().toISOString()}`)
  console.log(`Hypothesis: "${hypothesis}"`)
  console.log('')

  // Step 1: Extract problem focus (keywords)
  console.log('## Step 1: Extract Problem Focus')
  const problemFocus = await extractProblemFocus(hypothesis)
  console.log(`Keywords (${problemFocus.keywords.length}): ${problemFocus.keywords.join(', ')}`)
  console.log(`Problem Text: "${problemFocus.problemText}"`)
  console.log('')

  // Step 2: Generate hypothesis embedding using DETERMINISTIC method
  // Dec 2025: Use hypothesis + keywords (not problemFocus.problemText which varies)
  console.log('## Step 2: Generate Hypothesis Embedding (DETERMINISTIC)')
  const embeddingText = `${hypothesis}. ${problemFocus.keywords.join(', ')}`
  console.log(`Embedding text: "${embeddingText}"`)
  const hypothesisEmbedding = await generateEmbedding(embeddingText)
  console.log(`Embedding generated: ${hypothesisEmbedding.length} dimensions`)
  console.log('')

  // Step 3: Fetch posts from Arctic Shift
  console.log('## Step 3: Fetch Posts')
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log(`Fetched ${posts.length} posts`)
  console.log('')

  // Step 4: Find gold nuggets and diagnose each
  console.log('## Step 4: Gold Nugget Diagnosis')
  console.log('')

  const diagnoses: GoldNuggetDiagnosis[] = []

  for (const goldId of GOLD_NUGGET_IDS) {
    const post = posts.find(p => p.id === goldId)

    if (!post) {
      console.log(`### ${goldId}: NOT FOUND IN FETCHED POSTS`)
      diagnoses.push({
        id: goldId,
        title: '[NOT FOUND]',
        found: false,
        passedKeywordGate: false,
        keywordGateReason: 'Post not in fetched data',
        similarityScore: null,
        passedEmbeddingThreshold: false,
        embeddingThreshold: SIMILARITY_THRESHOLDS.MEDIUM
      })
      continue
    }

    const postText = `${post.title} ${post.selftext || ''}`

    // Check keyword gate
    const passedKG = passesKeywordGate(postText, problemFocus.keywords)

    // Determine keyword gate reason
    let kgReason = ''
    if (passedKG) {
      // Find which check passed
      const lowerText = postText.toLowerCase()
      const phrases = problemFocus.keywords.filter(k => k.includes(' '))
      const singleWords = problemFocus.keywords.filter(k => !k.includes(' '))

      const matchedPhrases = phrases.filter(phrase => lowerText.includes(phrase))
      if (matchedPhrases.length > 0) {
        kgReason = `PASSED: Contains phrase "${matchedPhrases[0]}"`
      } else {
        const matchedWords = singleWords.filter(word => lowerText.includes(word))
        kgReason = `PASSED: Contains keywords [${matchedWords.slice(0, 5).join(', ')}]`
      }
    } else {
      kgReason = 'FAILED: No matching keywords or phrases found'
    }

    // Calculate embedding similarity
    let similarityScore: number | null = null
    let passedEmbedding = false

    if (passedKG) {
      const postEmbedding = await generateEmbedding(postText)
      similarityScore = cosineSimilarity(hypothesisEmbedding, postEmbedding)
      passedEmbedding = similarityScore >= SIMILARITY_THRESHOLDS.MEDIUM
    }

    const diagnosis: GoldNuggetDiagnosis = {
      id: goldId,
      title: post.title.slice(0, 70),
      found: true,
      passedKeywordGate: passedKG,
      keywordGateReason: kgReason,
      similarityScore,
      passedEmbeddingThreshold: passedEmbedding,
      embeddingThreshold: SIMILARITY_THRESHOLDS.MEDIUM
    }

    diagnoses.push(diagnosis)

    // Print diagnosis
    const status = passedKG && passedEmbedding ? '✓ PASS' : '✗ FAIL'
    console.log(`### ${goldId}: ${status}`)
    console.log(`Title: "${diagnosis.title}"`)
    console.log(`Keyword Gate: ${kgReason}`)
    if (similarityScore !== null) {
      console.log(`Similarity Score: ${similarityScore.toFixed(3)} (threshold: ${SIMILARITY_THRESHOLDS.MEDIUM})`)
      console.log(`Embedding Check: ${passedEmbedding ? 'PASSED' : 'FAILED'}`)
    }
    console.log('')
  }

  // Summary
  console.log('## Summary')
  const found = diagnoses.filter(d => d.found).length
  const passedKG = diagnoses.filter(d => d.passedKeywordGate).length
  const passedEmbed = diagnoses.filter(d => d.passedEmbeddingThreshold).length

  console.log(`| Stage | Passed | Failed |`)
  console.log(`|-------|--------|--------|`)
  console.log(`| Found in data | ${found} | ${GOLD_NUGGET_IDS.length - found} |`)
  console.log(`| Keyword Gate | ${passedKG} | ${found - passedKG} |`)
  console.log(`| Embedding (0.35) | ${passedEmbed} | ${passedKG - passedEmbed} |`)
  console.log('')

  console.log('### Failure Breakdown')
  const notFound = diagnoses.filter(d => !d.found)
  const failedKG = diagnoses.filter(d => d.found && !d.passedKeywordGate)
  const failedEmbed = diagnoses.filter(d => d.passedKeywordGate && !d.passedEmbeddingThreshold)

  if (notFound.length > 0) {
    console.log(`Not in fetched data (${notFound.length}): ${notFound.map(d => d.id).join(', ')}`)
  }
  if (failedKG.length > 0) {
    console.log(`Failed Keyword Gate (${failedKG.length}): ${failedKG.map(d => d.id).join(', ')}`)
  }
  if (failedEmbed.length > 0) {
    console.log(`Failed Embedding (${failedEmbed.length}): ${failedEmbed.map(d => d.id).join(', ')}`)
    for (const d of failedEmbed) {
      console.log(`  - ${d.id}: score ${d.similarityScore?.toFixed(3)} < ${d.embeddingThreshold}`)
    }
  }

  // Write results to file
  const outputPath = '/Users/julientorriani/Downloads/gold-nugget-diagnosis.md'
  const output = [
    `# Gold Nugget Diagnostic Report`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `**Hypothesis:** "${hypothesis}"`,
    ``,
    `## Keywords Extracted`,
    `${problemFocus.keywords.join(', ')}`,
    ``,
    `## Problem Text`,
    `"${problemFocus.problemText}"`,
    ``,
    `## Summary`,
    `| Stage | Passed | Failed |`,
    `|-------|--------|--------|`,
    `| Found in data | ${found} | ${GOLD_NUGGET_IDS.length - found} |`,
    `| Keyword Gate | ${passedKG} | ${found - passedKG} |`,
    `| Embedding (0.35) | ${passedEmbed} | ${passedKG - passedEmbed} |`,
    ``,
    `## Individual Diagnoses`,
    ``
  ]

  for (const d of diagnoses) {
    const status = d.passedKeywordGate && d.passedEmbeddingThreshold ? '✓' : '✗'
    output.push(`### ${status} ${d.id}`)
    output.push(`**Title:** ${d.title}`)
    output.push(`**Found:** ${d.found}`)
    output.push(`**Keyword Gate:** ${d.keywordGateReason}`)
    if (d.similarityScore !== null) {
      output.push(`**Similarity:** ${d.similarityScore.toFixed(3)} (threshold: ${d.embeddingThreshold})`)
    }
    output.push(``)
  }

  fs.writeFileSync(outputPath, output.join('\n'))
  console.log(`\n✓ Results saved to: ${outputPath}`)
}

main().catch(console.error)
