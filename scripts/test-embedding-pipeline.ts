/**
 * Test embedding pipeline with live searches
 * Captures metrics to compare before/after embedding implementation
 */

// Load env FIRST before any other imports
import { config } from 'dotenv'
config({ path: '.env.local' })

// Verify keys loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not found')
  process.exit(1)
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not found')
  process.exit(1)
}

import * as fs from 'fs'

// Dynamic imports AFTER env is loaded
async function loadModules() {
  const { filterRelevantPosts } = await import('../src/lib/research/relevance-filter')
  const { fetchPostsFromSubreddits } = await import('../src/lib/arctic-shift/client')
  return { filterRelevantPosts, fetchPostsFromSubreddits }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface TestResult {
  hypothesis: string
  searchType: 'hypothesis' | 'app_gap'
  metrics: {
    totalPostsFetched: number
    postsAfterQualityGate: number
    postsAfterPreFilter: number
    embeddingHighSimilarity: number
    embeddingMediumSimilarity: number
    embeddingFiltered: number
    postsAfterDomainGate: number
    postsAfterProblemMatch: number
    coreSignals: number
    relatedSignals: number
  }
  examples: {
    filteredByEmbedding: Array<{ title: string; similarity?: number }>
    passedEmbedding: Array<{ title: string; similarity?: number; tier: string }>
  }
  timing: {
    totalMs: number
    embeddingMs?: number
  }
}

async function runTest(
  hypothesis: string,
  searchType: 'hypothesis' | 'app_gap',
  modules: Awaited<ReturnType<typeof loadModules>>
): Promise<TestResult> {
  const { filterRelevantPosts, fetchPostsFromSubreddits } = modules
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: "${hypothesis}"`)
  console.log(`Type: ${searchType}`)
  console.log('='.repeat(60))

  const startTime = Date.now()

  // Determine subreddits based on search type
  const subreddits = searchType === 'hypothesis'
    ? ['freelance', 'freelanceWriters', 'Upwork', 'smallbusiness', 'Entrepreneur']
    : ['Slack', 'productivity', 'RemoteWork', 'startups']

  // Fetch posts from Arctic Shift
  console.log('\nFetching posts from Arctic Shift...')

  // Calculate time range (last 365 days)
  const now = Date.now()
  const oneYearAgo = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000)
  const nowUnix = Math.floor(now / 1000)

  let rawPosts: any[] = []
  try {
    rawPosts = await fetchPostsFromSubreddits(subreddits, {
      limit: 100,
      after: oneYearAgo as any,
      before: nowUnix as any,
      sort: 'score',
      sort_type: 'desc',
    })
    console.log(`  Fetched ${rawPosts.length} posts from ${subreddits.join(', ')}`)
  } catch (e) {
    console.log(`  Error fetching posts: ${e}`)
  }

  // Transform to expected format (selftext -> body, num_comments -> numComments)
  const posts = rawPosts.map(p => ({
    id: p.id,
    title: p.title,
    body: p.selftext || '',
    author: p.author,
    subreddit: p.subreddit,
    score: p.score,
    numComments: p.num_comments,
    createdUtc: p.created_utc,
    permalink: p.permalink,
    url: p.url,
  }))

  console.log(`\nTotal posts fetched: ${posts.length}`)

  // Track progress messages to capture embedding metrics
  const progressMessages: string[] = []
  const sendProgress = (msg: string) => {
    progressMessages.push(msg)
    console.log(`  ${msg}`)
  }

  // Run the filter pipeline
  console.log('\nRunning filter pipeline...')
  const filterResult = await filterRelevantPosts(
    posts,
    hypothesis,
    undefined,
    sendProgress
  )

  const totalTime = Date.now() - startTime

  // Extract examples of filtered and passed posts
  const filteredExamples = filterResult.decisions
    .filter(d => d.reason?.startsWith('low_similarity'))
    .slice(0, 5)
    .map(d => ({
      title: d.title,
      similarity: parseFloat(d.reason?.replace('low_similarity_', '') || '0'),
    }))

  const passedExamples = filterResult.decisions
    .filter(d => d.decision !== 'N')
    .slice(0, 5)
    .map(d => ({
      title: d.title,
      tier: d.decision,
    }))

  const result: TestResult = {
    hypothesis,
    searchType,
    metrics: {
      totalPostsFetched: posts.length,
      postsAfterQualityGate: posts.length - filterResult.metrics.stage3Filtered,
      postsAfterPreFilter: posts.length - filterResult.metrics.stage3Filtered - filterResult.metrics.preFilterSkipped,
      embeddingHighSimilarity: filterResult.metrics.embeddingHighSimilarity,
      embeddingMediumSimilarity: filterResult.metrics.embeddingMediumSimilarity,
      embeddingFiltered: filterResult.metrics.embeddingFiltered,
      postsAfterDomainGate: filterResult.metrics.stage1Filtered > 0
        ? (posts.length - filterResult.metrics.stage3Filtered - filterResult.metrics.preFilterSkipped - filterResult.metrics.embeddingFiltered - filterResult.metrics.stage1Filtered)
        : 0,
      postsAfterProblemMatch: filterResult.items.length,
      coreSignals: filterResult.metrics.coreSignals,
      relatedSignals: filterResult.metrics.relatedSignals,
    },
    examples: {
      filteredByEmbedding: filteredExamples,
      passedEmbedding: passedExamples,
    },
    timing: {
      totalMs: totalTime,
    },
  }

  console.log('\n--- Results ---')
  console.log(`Embedding HIGH: ${result.metrics.embeddingHighSimilarity}`)
  console.log(`Embedding MEDIUM: ${result.metrics.embeddingMediumSimilarity}`)
  console.log(`Embedding FILTERED: ${result.metrics.embeddingFiltered}`)
  console.log(`Final posts: ${result.metrics.postsAfterProblemMatch}`)
  console.log(`CORE: ${result.metrics.coreSignals}, RELATED: ${result.metrics.relatedSignals}`)
  console.log(`Total time: ${result.timing.totalMs}ms`)

  return result
}

async function main() {
  console.log('PVRE Embedding Pipeline Test')
  console.log('============================\n')

  // Load modules dynamically AFTER env is loaded
  const modules = await loadModules()

  const results: TestResult[] = []

  // Test 1: Hypothesis search
  const hypothesisResult = await runTest(
    'Freelancers struggling to get paid on time by clients',
    'hypothesis',
    modules
  )
  results.push(hypothesisResult)

  // Test 2: App Gap search
  const appGapResult = await runTest(
    'Slack',
    'app_gap',
    modules
  )
  results.push(appGapResult)

  // Generate markdown report
  const report = generateReport(results)

  const outputPath = `${process.env.HOME}/Downloads/EMBEDDING_TEST_RESULTS.md`
  fs.writeFileSync(outputPath, report)
  console.log(`\n\nReport saved to: ${outputPath}`)
}

function generateReport(results: TestResult[]): string {
  const hypothesisResult = results.find(r => r.searchType === 'hypothesis')!
  const appGapResult = results.find(r => r.searchType === 'app_gap')!

  return `# Embedding Pipeline Test Results

*Generated: ${new Date().toISOString()}*

## Summary Comparison

| Metric | Before (Audit) | After (Embedding) | Change |
|--------|----------------|-------------------|--------|
| Irrelevant signals | ~64% | TBD after analysis | |
| WTP false positives | Common | TBD | |
| Haiku calls | ~200 | ${hypothesisResult.metrics.embeddingHighSimilarity + hypothesisResult.metrics.embeddingMediumSimilarity} | |
| Total cost | $0.16 | ~$0.01 embedding + Haiku | |

---

## Test 1: Hypothesis Search

**Query:** "${hypothesisResult.hypothesis}"

### Pipeline Metrics

| Stage | Posts |
|-------|-------|
| Fetched from Arctic Shift | ${hypothesisResult.metrics.totalPostsFetched} |
| After Quality Gate | ${hypothesisResult.metrics.postsAfterQualityGate} |
| After PreFilter | ${hypothesisResult.metrics.postsAfterPreFilter} |
| **Embedding HIGH (≥0.55)** | ${hypothesisResult.metrics.embeddingHighSimilarity} |
| **Embedding MEDIUM (0.40-0.55)** | ${hypothesisResult.metrics.embeddingMediumSimilarity} |
| **Embedding FILTERED (<0.40)** | ${hypothesisResult.metrics.embeddingFiltered} |
| After Domain Gate (Haiku) | ${hypothesisResult.metrics.postsAfterDomainGate} |
| Final (after Problem Match) | ${hypothesisResult.metrics.postsAfterProblemMatch} |

### Embedding Filter Effectiveness

- **Posts sent to Haiku:** ${hypothesisResult.metrics.embeddingHighSimilarity + hypothesisResult.metrics.embeddingMediumSimilarity} (vs ~200 before)
- **Posts filtered by embedding:** ${hypothesisResult.metrics.embeddingFiltered}
- **Filter rate:** ${Math.round(hypothesisResult.metrics.embeddingFiltered / hypothesisResult.metrics.postsAfterPreFilter * 100)}%

### Examples Filtered by Embedding (similarity < 0.40)

${hypothesisResult.examples.filteredByEmbedding.map((e, i) =>
  `${i+1}. [${e.similarity?.toFixed(2)}] "${e.title}"`
).join('\n') || 'No examples captured'}

### Examples That Passed Embedding Filter

${hypothesisResult.examples.passedEmbedding.map((e, i) =>
  `${i+1}. [${e.tier}] "${e.title}"`
).join('\n') || 'No examples captured'}

### Timing

- Total: ${hypothesisResult.timing.totalMs}ms

---

## Test 2: App Gap Search

**Query:** "${appGapResult.hypothesis}"

### Pipeline Metrics

| Stage | Posts |
|-------|-------|
| Fetched from Arctic Shift | ${appGapResult.metrics.totalPostsFetched} |
| After Quality Gate | ${appGapResult.metrics.postsAfterQualityGate} |
| After PreFilter | ${appGapResult.metrics.postsAfterPreFilter} |
| **Embedding HIGH (≥0.55)** | ${appGapResult.metrics.embeddingHighSimilarity} |
| **Embedding MEDIUM (0.40-0.55)** | ${appGapResult.metrics.embeddingMediumSimilarity} |
| **Embedding FILTERED (<0.40)** | ${appGapResult.metrics.embeddingFiltered} |
| After Domain Gate (Haiku) | ${appGapResult.metrics.postsAfterDomainGate} |
| Final (after Problem Match) | ${appGapResult.metrics.postsAfterProblemMatch} |

### Embedding Filter Effectiveness

- **Posts sent to Haiku:** ${appGapResult.metrics.embeddingHighSimilarity + appGapResult.metrics.embeddingMediumSimilarity} (vs ~200 before)
- **Posts filtered by embedding:** ${appGapResult.metrics.embeddingFiltered}
- **Filter rate:** ${Math.round(appGapResult.metrics.embeddingFiltered / appGapResult.metrics.postsAfterPreFilter * 100)}%

### Examples Filtered by Embedding (similarity < 0.40)

${appGapResult.examples.filteredByEmbedding.map((e, i) =>
  `${i+1}. [${e.similarity?.toFixed(2)}] "${e.title}"`
).join('\n') || 'No examples captured'}

### Examples That Passed Embedding Filter

${appGapResult.examples.passedEmbedding.map((e, i) =>
  `${i+1}. [${e.tier}] "${e.title}"`
).join('\n') || 'No examples captured'}

### Timing

- Total: ${appGapResult.timing.totalMs}ms

---

## Analysis

### False Negatives (Relevant posts incorrectly filtered)

*Review the "Filtered by Embedding" examples above. Any that seem relevant to the hypothesis?*

### False Positives (Irrelevant posts that passed)

*Review the "Passed Embedding Filter" examples above. Any that seem irrelevant?*

### Threshold Calibration

Current thresholds:
- HIGH: ≥ 0.55
- MEDIUM: ≥ 0.40
- FILTERED: < 0.40

Based on results, consider:
- [ ] Lower MEDIUM threshold if too many relevant posts filtered
- [ ] Raise MEDIUM threshold if too many irrelevant posts passing
- [ ] Thresholds look good

---

## Cost Estimate

| Item | Before | After |
|------|--------|-------|
| Embedding calls | N/A | ~$0.01 per search |
| Haiku calls (Domain Gate) | ~200 posts | ${Math.max(hypothesisResult.metrics.embeddingHighSimilarity + hypothesisResult.metrics.embeddingMediumSimilarity, appGapResult.metrics.embeddingHighSimilarity + appGapResult.metrics.embeddingMediumSimilarity)} posts max |
| Haiku calls (Problem Match) | ~60-80 | ~${Math.max(hypothesisResult.metrics.postsAfterProblemMatch, appGapResult.metrics.postsAfterProblemMatch)} |
| **Estimated total** | ~$0.16 | ~$0.05-0.08 |

---

## Conclusion

[ ] Ready to commit - thresholds are calibrated
[ ] Needs adjustment - see recommendations above
`
}

main().catch(console.error)
