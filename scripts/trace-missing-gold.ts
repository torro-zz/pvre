/**
 * Trace why gold nuggets that pass calibration are missing in pipeline
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'
import { passesKeywordGate } from '../src/lib/embeddings/embedding-service'

const arcticShift = new ArcticShiftSource()

// Gold nuggets that PASSED calibration (score >= 0.34) but MISSING in pipeline
const MISSING_GOLD = [
  { id: '1parsre', score: 0.510, title: 'lost hours and money to bad clients how do you spot red flags' },
  { id: '1nkiqld', score: 0.341, title: '6 months of work. $0 payment. Here\'s what I learned' },
  { id: '1nco4hk', score: 0.400, title: 'Stuck in a stalled ghostwriting project. What are my options?' },
  { id: '1nvbyjt', score: 0.521, title: 'We Lost $120k to Client Nonpayment: our story' },
]

// Keywords that would be generated (from pipeline output)
const KEYWORDS = [
  'late payment', 'not paid', 'unpaid invoice', 'owed money', "won't pay",
  'payment delay', 'chasing payment', 'invoice outstanding', 'invoice ignored',
  'payment ghosting', 'late', 'unpaid', 'owed', 'overdue', 'delay'
]

async function main() {
  console.log('=== MISSING GOLD NUGGET TRACE ===')
  console.log('These posts passed calibration (>= 0.34) but are missing from pipeline results')
  console.log('')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  console.log('Fetched', posts.length, 'posts')
  console.log('')

  for (const gold of MISSING_GOLD) {
    console.log(`--- ${gold.id} (calibration score: ${gold.score}) ---`)
    console.log('Expected title:', gold.title)

    const post = posts.find(p => p.id === gold.id)
    if (!post) {
      console.log('STATUS: NOT FOUND IN FETCH')
      console.log('REASON: May be outside 6-month window or in different subreddit subset')
      console.log('')
      continue
    }

    console.log('Actual title:', post.title)
    console.log('Subreddit:', post.subreddit)
    console.log('Body length:', (post.selftext || '').length)
    const bodyRemoved = !post.selftext || post.selftext === '[removed]' || post.selftext === '[deleted]'
    console.log('Body removed:', bodyRemoved)

    // Check keyword gate
    const textForKeyword = `${post.title} ${post.selftext || ''}`.toLowerCase()
    const passedKeyword = passesKeywordGate(textForKeyword, KEYWORDS)
    console.log('Keyword gate:', passedKeyword ? 'PASSED' : 'FAILED')

    if (!passedKeyword) {
      // Why did it fail?
      console.log('Text checked:', textForKeyword.slice(0, 200))
    }

    console.log('')
  }
}

main()
