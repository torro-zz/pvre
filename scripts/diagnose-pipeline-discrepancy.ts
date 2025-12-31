/**
 * Pipeline Discrepancy Diagnostic
 *
 * Traces the 8 found gold nuggets through EVERY stage of the pipeline
 * to find where the discrepancy occurs.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { generateEmbedding, cosineSimilarity, passesKeywordGate } from '../src/lib/embeddings/embedding-service'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

// The 8 gold nuggets that WERE found in the data (from calibration)
const FOUND_GOLD_NUGGETS = [
  '1px5iot', '1parsre', '1nq3lam', '1nkiqld',
  '1nco4hk', '1pzlrre', '1nvbyjt', '1nvf4yv'
]

const hypothesis = 'Freelancers struggling to get paid on time by clients'

// Keywords that would be generated (from the test output)
const KEYWORDS = [
  'late payment', 'not paid', 'unpaid invoice', 'owed money', "won't pay",
  'payment delay', 'chasing payment', 'outstanding balance', 'invoice ignored',
  'payment overdue', 'late', 'unpaid', 'owed', 'overdue', 'delay'
]

async function main() {
  console.log('=== PIPELINE DISCREPANCY DIAGNOSTIC ===')
  console.log('Hypothesis:', hypothesis)
  console.log('Threshold: 0.34')
  console.log('')

  // Fetch posts
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })
  console.log('Fetched', posts.length, 'posts from Arctic Shift')
  console.log('')

  // Generate hypothesis embedding (hypothesis only - as per new logic)
  const hypothesisEmbedding = await generateEmbedding(hypothesis)
  console.log('Generated hypothesis embedding')
  console.log('')

  // Analyze each gold nugget
  console.log('=== GOLD NUGGET PIPELINE TRACE ===')
  console.log('')

  for (const goldId of FOUND_GOLD_NUGGETS) {
    const post = posts.find(p => p.id === goldId)

    console.log(`--- ${goldId} ---`)

    if (!post) {
      console.log('STATUS: NOT FOUND IN FETCH')
      console.log('REASON: Outside 6-month window or different subreddits')
      console.log('')
      continue
    }

    console.log('Title:', post.title.slice(0, 70) + '...')
    console.log('Body length:', (post.selftext || '').length)
    console.log('Subreddit:', post.subreddit)

    // Check if body is [removed]
    const bodyRemoved = !post.selftext || post.selftext === '[removed]' || post.selftext === '[deleted]'
    console.log('Body removed:', bodyRemoved)

    // Stage 1: Quality filter (posts with body)
    const hasBody = post.selftext && post.selftext.length > 50
    console.log('Has body (>50 chars):', hasBody)

    // Stage 2: Keyword gate
    const textForKeyword = `${post.title} ${post.selftext || ''}`.toLowerCase()
    const passedKeywordGate = passesKeywordGate(textForKeyword, KEYWORDS)
    console.log('Keyword gate:', passedKeywordGate ? 'PASSED' : 'FAILED')

    // Which keywords matched?
    const matchedKeywords = KEYWORDS.filter(kw => textForKeyword.includes(kw.toLowerCase()))
    if (matchedKeywords.length > 0) {
      console.log('Matched keywords:', matchedKeywords.join(', '))
    }

    // Stage 3: Embedding score
    const postText = `${post.title} ${post.selftext || ''}`.slice(0, 500)
    const postEmbedding = await generateEmbedding(postText)
    const score = cosineSimilarity(hypothesisEmbedding, postEmbedding)
    console.log('Embedding score:', score.toFixed(3))
    console.log('Above 0.34 threshold:', score >= 0.34 ? 'YES' : 'NO')

    // Final verdict
    let verdict = 'UNKNOWN'
    let reason = ''

    if (bodyRemoved) {
      // Title-only path
      if (passedKeywordGate) {
        verdict = 'SHOULD PASS (title-only path)'
        reason = 'Body removed, but title passed keyword gate'
      } else {
        verdict = 'SHOULD FAIL'
        reason = 'Body removed AND failed keyword gate'
      }
    } else {
      // Full path
      if (!passedKeywordGate) {
        verdict = 'SHOULD FAIL'
        reason = 'Failed keyword gate'
      } else if (score < 0.34) {
        verdict = 'SHOULD FAIL'
        reason = `Score ${score.toFixed(3)} below 0.34 threshold`
      } else {
        verdict = 'SHOULD PASS'
        reason = `Score ${score.toFixed(3)} >= 0.34 AND passed keyword gate`
      }
    }

    console.log('VERDICT:', verdict)
    console.log('REASON:', reason)
    console.log('')
  }

  // Also check the noise post
  console.log('=== NOISE POST CHECK ===')
  console.log('')

  // Find "I have a real skill, but still can't get my first client"
  const noisePost = posts.find(p => p.title.includes('real skill') && p.title.includes('first client'))
  if (noisePost) {
    console.log('--- NOISE: "first client" post ---')
    console.log('ID:', noisePost.id)
    console.log('Title:', noisePost.title)
    console.log('Body length:', (noisePost.selftext || '').length)

    const textForKeyword = `${noisePost.title} ${noisePost.selftext || ''}`.toLowerCase()
    const passedKeywordGate = passesKeywordGate(textForKeyword, KEYWORDS)
    console.log('Keyword gate:', passedKeywordGate ? 'PASSED' : 'FAILED')

    const matchedKeywords = KEYWORDS.filter(kw => textForKeyword.includes(kw.toLowerCase()))
    if (matchedKeywords.length > 0) {
      console.log('Matched keywords:', matchedKeywords.join(', '))
    }

    const postText = `${noisePost.title} ${noisePost.selftext || ''}`.slice(0, 500)
    const postEmbedding = await generateEmbedding(postText)
    const score = cosineSimilarity(hypothesisEmbedding, postEmbedding)
    console.log('Embedding score:', score.toFixed(3))
    console.log('Above 0.34 threshold:', score >= 0.34 ? 'YES' : 'NO')
  } else {
    console.log('"first client" post not found in fetched data')
  }
}

main().catch(console.error)
