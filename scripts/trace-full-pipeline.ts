/**
 * Trace specific gold nuggets through the full pipeline
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { filterRelevantPosts, qualityGateFilter } from '../src/lib/research/relevance-filter'
import { ArcticShiftSource } from '../src/lib/data-sources/arctic-shift'

const arcticShift = new ArcticShiftSource()

const GOLD_IDS_TO_TRACE = ['1parsre', '1nkiqld', '1nco4hk', '1nvbyjt']
const hypothesis = 'Freelancers struggling to get paid on time by clients'

async function main() {
  console.log('=== FULL PIPELINE TRACE ===')
  console.log('Tracing gold nuggets:', GOLD_IDS_TO_TRACE.join(', '))
  console.log('')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const posts = await arcticShift.searchPosts({
    subreddits: ['freelance', 'freelanceWriters', 'smallbusiness', 'Entrepreneur', 'consulting'],
    limit: 500,
    timeRange: { start: sixMonthsAgo, end: new Date() }
  })

  console.log('Fetched', posts.length, 'posts')

  // Check which gold nuggets are in the fetch
  for (const id of GOLD_IDS_TO_TRACE) {
    const post = posts.find(p => p.id === id)
    console.log(`${id}: ${post ? 'FOUND in fetch' : 'NOT FOUND'}`)
  }
  console.log('')

  // Run quality gate
  const qualityResult = qualityGateFilter(posts)
  console.log('Quality gate results:')
  console.log(`  Passed (with body): ${qualityResult.passed.length}`)
  console.log(`  Title-only: ${qualityResult.titleOnly.length}`)
  console.log(`  Filtered: ${qualityResult.filtered.length}`)
  console.log('')

  // Check where each gold nugget ended up
  for (const id of GOLD_IDS_TO_TRACE) {
    const inPassed = qualityResult.passed.some(p => p.id === id)
    const inTitleOnly = qualityResult.titleOnly.some(p => p.id === id)
    const inFiltered = qualityResult.filtered.some(p => p.id === id)

    let status = 'UNKNOWN'
    if (inPassed) status = 'PASSED (has body)'
    else if (inTitleOnly) status = 'TITLE-ONLY'
    else if (inFiltered) status = 'FILTERED'

    console.log(`${id}: ${status}`)
  }
  console.log('')

  // Run full pipeline
  console.log('Running full pipeline...')
  const result = await filterRelevantPosts(posts, hypothesis, undefined, (msg) => {
    // Look for mentions of our gold nugget IDs
    for (const id of GOLD_IDS_TO_TRACE) {
      if (msg.includes(id)) {
        console.log(`[TRACE ${id}] ${msg}`)
      }
    }
  })

  console.log('')
  console.log('Final results:', result.items.length, 'items')

  // Check which gold nuggets are in final results
  for (const id of GOLD_IDS_TO_TRACE) {
    const found = result.items.some(p => p.id === id)
    console.log(`${id}: ${found ? 'IN RESULTS' : 'NOT IN RESULTS'}`)
  }
}

main()
