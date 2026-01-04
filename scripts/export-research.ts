/**
 * PVRE Research Export Script
 *
 * Exports complete research data from database:
 * - research_jobs table (main job record + coverage_data JSON)
 * - research_results table (all modules: community_voice, competitor_intelligence, etc.)
 *
 * Usage:
 *   npx tsx scripts/export-research.ts <job-id>
 *   npx tsx scripts/export-research.ts d72aaf43-32f1-4e7f-8c74-3e23b23f25e7
 *
 * Output:
 *   ~/Downloads/PVRE_EXPORT_<job-id>_<timestamp>/
 *     - raw-export.json (complete database record)
 *     - narrative.md (human-readable document)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mgrnghjjsllwuphyrjtw.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.error('Run: source .env.local && npx tsx scripts/export-research.ts <job-id>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Strip embedding vectors from objects to reduce file size
 * Embeddings are large arrays of floats that bloat the narrative from ~50KB to 300KB+
 */
function stripEmbeddings(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    // If it's a large array of numbers, it's probably an embedding vector
    if (obj.length > 100 && typeof obj[0] === 'number') {
      return `[embedding vector - ${obj.length} dimensions]`
    }
    return obj.map(stripEmbeddings)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip known embedding fields
      if (key === 'embedding' || key === 'hypothesis_embedding' || key.endsWith('Embedding')) {
        const arr = value as unknown[]
        result[key] = `[embedding - ${arr?.length || 0} dimensions]`
      } else {
        result[key] = stripEmbeddings(value)
      }
    }
    return result
  }
  return obj
}

/**
 * Safely extract a score value that might be a number or an object
 */
function extractScore(score: unknown): string {
  if (typeof score === 'number') return `${score}/10`
  if (typeof score === 'object' && score !== null) {
    const s = score as Record<string, unknown>
    const val = s.score ?? s.value ?? s.overall ?? s.total
    if (typeof val === 'number') return `${val}/10`
    return JSON.stringify(score)
  }
  if (score === undefined || score === null) return 'N/A'
  return String(score)
}

interface ExportResult {
  exportedAt: string
  jobId: string
  job: Record<string, unknown>
  results: {
    module_name: string
    data: Record<string, unknown>
    created_at: string
  }[]
}

async function exportResearch(jobId: string): Promise<ExportResult> {
  console.log(`\n=== PVRE Research Export ===`)
  console.log(`Job ID: ${jobId}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // 1. Fetch the main job record
  console.log('1. Fetching research_jobs record...')
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError) {
    console.error('ERROR fetching job:', jobError)
    throw jobError
  }

  if (!job) {
    console.error('ERROR: Job not found')
    throw new Error(`Job ${jobId} not found`)
  }

  console.log(`   Status: ${job.status}`)
  console.log(`   Hypothesis: ${(job.hypothesis as string).substring(0, 80)}...`)

  // 2. Fetch all research_results for this job
  console.log('\n2. Fetching research_results...')
  const { data: results, error: resultsError } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', jobId)

  if (resultsError) {
    console.error('ERROR fetching results:', resultsError)
    throw resultsError
  }

  console.log(`   Found ${results?.length || 0} result modules:`)
  results?.forEach(r => {
    const dataKeys = r.data ? Object.keys(r.data as object) : []
    console.log(`   - ${r.module_name}: ${dataKeys.length} fields`)
  })

  // 3. Compile the export
  const exportData: ExportResult = {
    exportedAt: new Date().toISOString(),
    jobId,
    job,
    results: results || []
  }

  return exportData
}

function createOutputDirectory(jobId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const shortId = jobId.substring(0, 8)
  const dirName = `PVRE_EXPORT_${shortId}_${timestamp}`
  const outputDir = path.join(process.env.HOME || '', 'Downloads', dirName)

  fs.mkdirSync(outputDir, { recursive: true })
  console.log(`\n3. Created output directory: ${outputDir}`)

  return outputDir
}

function writeJsonExport(outputDir: string, data: ExportResult): string {
  const filePath = path.join(outputDir, 'raw-export.json')

  // Write with full pretty-printing, no truncation
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))

  const stats = fs.statSync(filePath)
  console.log(`\n4. Wrote raw-export.json (${(stats.size / 1024).toFixed(1)} KB)`)

  return filePath
}

function generateNarrative(data: ExportResult): string {
  const { job, results } = data
  const coverage = (job.coverage_data || {}) as Record<string, unknown>

  // Find module data
  const communityVoice = results.find(r => r.module_name === 'community_voice')?.data as Record<string, unknown> || {}
  const competitorIntel = results.find(r => r.module_name === 'competitor_intelligence')?.data as Record<string, unknown> || {}

  let md = ''

  // ========== HEADER ==========
  md += `# PVRE Research Export: Complete Analysis\n\n`
  md += `**Job ID:** \`${job.id}\`\n`
  md += `**Created:** ${job.created_at}\n`
  md += `**Status:** ${job.status}\n`
  md += `**Export Time:** ${data.exportedAt}\n\n`
  md += `---\n\n`

  // ========== RESEARCH INPUT ==========
  md += `## 1. Research Input\n\n`

  const appData = coverage.appData as Record<string, unknown> | undefined
  if (appData) {
    md += `### App Analyzed (App Gap Mode)\n\n`
    md += `| Field | Value |\n`
    md += `|-------|-------|\n`
    for (const [key, value] of Object.entries(appData)) {
      md += `| ${key} | ${JSON.stringify(value)} |\n`
    }
    md += `\n`
  }

  md += `### Hypothesis (Raw)\n\n`
  md += `\`\`\`\n${job.hypothesis}\n\`\`\`\n\n`

  const structured = coverage.structuredHypothesis as Record<string, unknown> | undefined
  if (structured) {
    md += `### Structured Hypothesis (AI-parsed)\n\n`
    md += `| Field | Value |\n`
    md += `|-------|-------|\n`
    for (const [key, value] of Object.entries(structured)) {
      md += `| ${key} | ${typeof value === 'string' ? value : JSON.stringify(value)} |\n`
    }
    md += `\n`
  }

  // ========== COVERAGE DATA ==========
  md += `## 2. Coverage Data (from research_jobs.coverage_data)\n\n`
  md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(coverage), null, 2)}\n\`\`\`\n\n`

  // ========== PAIN SIGNALS ==========
  const painSignals = communityVoice.painSignals as Array<Record<string, unknown>> || []
  md += `## 3. Pain Signals (ALL ${painSignals.length})\n\n`

  if (painSignals.length > 0) {
    painSignals.forEach((signal, i) => {
      md += `### Signal ${i + 1}\n\n`
      md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(signal), null, 2)}\n\`\`\`\n\n`
    })
  } else {
    md += `*No pain signals found*\n\n`
  }

  // ========== PAIN SUMMARY ==========
  const painSummary = communityVoice.painSummary as Record<string, unknown> | undefined
  md += `## 4. Pain Summary\n\n`
  if (painSummary) {
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(painSummary), null, 2)}\n\`\`\`\n\n`
  } else {
    md += `*No pain summary available*\n\n`
  }

  // ========== THEME ANALYSIS ==========
  const themeAnalysis = communityVoice.themeAnalysis as Record<string, unknown> | undefined
  md += `## 5. Theme Analysis\n\n`
  if (themeAnalysis) {
    const themes = (themeAnalysis.themes || []) as Array<Record<string, unknown>>
    md += `**Total Themes:** ${themes.length}\n\n`
    themes.forEach((theme, i) => {
      md += `### Theme ${i + 1}: ${theme.title || theme.name || 'Unnamed'}\n\n`
      md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(theme), null, 2)}\n\`\`\`\n\n`
    })
  } else {
    md += `*No theme analysis available*\n\n`
  }

  // ========== TIMING / GOOGLE TRENDS ==========
  const timing = communityVoice.timing as Record<string, unknown> | undefined
  md += `## 6. Timing Analysis & Google Trends\n\n`
  if (timing) {
    md += `**Score:** ${timing.score}/10\n`
    md += `**Trend:** ${timing.trend}\n`
    md += `**Confidence:** ${timing.confidence}\n`
    md += `**Timing Window:** ${timing.timingWindow}\n\n`

    md += `### Tailwinds\n\n`
    const tailwinds = (timing.tailwinds || []) as Array<{ signal: string; impact: string; description: string } | string>
    if (tailwinds.length > 0) {
      tailwinds.forEach((tw, i) => {
        if (typeof tw === 'object' && tw !== null) {
          md += `${i + 1}. **${tw.signal}** (${tw.impact}): ${tw.description}\n`
        } else {
          md += `${i + 1}. ${tw}\n`
        }
      })
    } else {
      md += `*None identified*\n`
    }
    md += `\n`

    md += `### Headwinds\n\n`
    const headwinds = (timing.headwinds || []) as Array<{ signal: string; impact: string; description: string } | string>
    if (headwinds.length > 0) {
      headwinds.forEach((hw, i) => {
        if (typeof hw === 'object' && hw !== null) {
          md += `${i + 1}. **${hw.signal}** (${hw.impact}): ${hw.description}\n`
        } else {
          md += `${i + 1}. ${hw}\n`
        }
      })
    } else {
      md += `*None identified*\n`
    }
    md += `\n`

    md += `### Google Trends Data (trendData)\n\n`
    const trendData = timing.trendData as Record<string, unknown> | undefined
    if (trendData) {
      md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(trendData), null, 2)}\n\`\`\`\n\n`

      // Highlight the aggregate calculation issue
      const breakdown = (trendData.keywordBreakdown || []) as Array<Record<string, unknown>>
      const aggregateChange = trendData.percentageChange
      if (breakdown.length > 0) {
        md += `#### Keyword Breakdown Analysis\n\n`
        md += `| Keyword | Q1 Avg | Q4 Avg | % Change | Trend |\n`
        md += `|---------|--------|--------|----------|-------|\n`
        breakdown.forEach(kw => {
          md += `| ${kw.keyword} | ${kw.q1Average} | ${kw.q4Average} | ${kw.percentageChange}% | ${kw.trend} |\n`
        })
        md += `\n`
        md += `**Aggregate YoY:** ${aggregateChange}%\n`
        md += `**Calculation Note:** Check if this aggregate correctly weights by search volume.\n\n`
      }
    } else {
      md += `*No Google Trends data available*\n\n`
    }
  } else {
    md += `*No timing analysis available*\n\n`
  }

  // ========== MARKET SIZING ==========
  const marketSizing = communityVoice.marketSizing as Record<string, unknown> | undefined
  md += `## 7. Market Sizing\n\n`
  if (marketSizing) {
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(marketSizing), null, 2)}\n\`\`\`\n\n`
  } else {
    md += `*No market sizing data available*\n\n`
  }

  // ========== CLUSTERS ==========
  const clusters = communityVoice.clusters as Array<Record<string, unknown>> | undefined
  md += `## 8. Clusters\n\n`
  if (clusters && clusters.length > 0) {
    clusters.forEach((cluster, i) => {
      md += `### Cluster ${i + 1}\n\n`
      md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(cluster), null, 2)}\n\`\`\`\n\n`
    })
  } else {
    md += `*No clusters available*\n\n`
  }

  // ========== COMPETITOR INTELLIGENCE ==========
  md += `## 9. Competitor Intelligence\n\n`
  if (Object.keys(competitorIntel).length > 0) {
    md += `### Competition Score\n\n`
    md += `**Score:** ${extractScore(competitorIntel.competitionScore)}\n\n`

    md += `### Market Overview\n\n`
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(competitorIntel.marketOverview), null, 2)}\n\`\`\`\n\n`

    const allCompetitors = (competitorIntel.competitors || []) as Array<Record<string, unknown>>

    // Filter out the analyzed app from its own competitor list (App Gap mode)
    const appName = appData?.name as string | undefined
    const competitors = appName
      ? allCompetitors.filter(comp => {
          const compName = (comp.name as string || '').toLowerCase().trim()
          const analyzedName = appName.toLowerCase().trim()
          // Filter if exact match or name contains app name (e.g., "Loom" in "Loom: Screen Recorder")
          const appBaseName = analyzedName.split(':')[0].trim()
          return compName !== analyzedName &&
                 compName !== appBaseName &&
                 !compName.includes(appBaseName)
        })
      : allCompetitors

    const filtered = allCompetitors.length - competitors.length
    md += `### Competitors (${competitors.length}${filtered > 0 ? ` — ${filtered} self-reference filtered` : ''})\n\n`
    competitors.forEach((comp, i) => {
      md += `#### Competitor ${i + 1}: ${comp.name || 'Unknown'}\n\n`
      md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(comp), null, 2)}\n\`\`\`\n\n`
    })

    const gaps = (competitorIntel.gaps || []) as Array<Record<string, unknown>>
    md += `### Competitive Gaps (${gaps.length})\n\n`
    gaps.forEach((gap, i) => {
      const gapName = gap.name || gap.title || gap.gap || gap.theme || `Gap ${i + 1}`
      const gapDesc = gap.description || gap.detail || gap.opportunity || JSON.stringify(stripEmbeddings(gap))
      md += `${i + 1}. **${gapName}**: ${gapDesc}\n`
    })
    md += `\n`

    md += `### Positioning Recommendations\n\n`
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(competitorIntel.positioningRecommendations), null, 2)}\n\`\`\`\n\n`
  } else {
    md += `*No competitor intelligence data available*\n\n`
  }

  // ========== INTERVIEW QUESTIONS ==========
  const interviewQuestions = communityVoice.interviewQuestions as Array<string> | undefined
  md += `## 10. Interview Questions (AI-generated)\n\n`
  if (interviewQuestions && interviewQuestions.length > 0) {
    interviewQuestions.forEach((q, i) => {
      md += `${i + 1}. ${q}\n`
    })
    md += `\n`
  } else {
    md += `*No interview questions generated*\n\n`
  }

  // ========== METADATA ==========
  const cvMetadata = communityVoice.metadata as Record<string, unknown> | undefined
  md += `## 11. Metadata (Processing Details)\n\n`
  if (cvMetadata) {
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(cvMetadata), null, 2)}\n\`\`\`\n\n`
  } else {
    md += `*No metadata available*\n\n`
  }

  // ========== SUBREDDITS ==========
  const subreddits = communityVoice.subreddits as Record<string, unknown> | undefined
  md += `## 12. Subreddits Analyzed\n\n`
  if (subreddits) {
    md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(subreddits), null, 2)}\n\`\`\`\n\n`
  } else {
    md += `*No subreddit data available*\n\n`
  }

  // ========== FULL RAW JOB RECORD ==========
  md += `## 13. Full Job Record (research_jobs table)\n\n`
  md += `\`\`\`json\n${JSON.stringify(stripEmbeddings(job), null, 2)}\n\`\`\`\n\n`

  // ========== FOOTER ==========
  md += `---\n\n`
  md += `*Exported by PVRE Research Export Script*\n`
  md += `*Export Time: ${data.exportedAt}*\n`
  md += `*Total Sections: 13*\n`

  return md
}

function writeNarrative(outputDir: string, narrative: string): string {
  const filePath = path.join(outputDir, 'narrative.md')
  fs.writeFileSync(filePath, narrative)

  const stats = fs.statSync(filePath)
  const wordCount = narrative.split(/\s+/).length
  console.log(`5. Wrote narrative.md (${(stats.size / 1024).toFixed(1)} KB, ~${wordCount} words)`)

  return filePath
}

async function main() {
  const jobId = process.argv[2]

  if (!jobId) {
    console.error('Usage: npx tsx scripts/export-research.ts <job-id>')
    console.error('\nExample:')
    console.error('  npx tsx scripts/export-research.ts d72aaf43-32f1-4e7f-8c74-3e23b23f25e7')
    process.exit(1)
  }

  try {
    // Export data from database
    const exportData = await exportResearch(jobId)

    // Create output directory
    const outputDir = createOutputDirectory(jobId)

    // Write raw JSON
    writeJsonExport(outputDir, exportData)

    // Generate and write narrative
    const narrative = generateNarrative(exportData)
    writeNarrative(outputDir, narrative)

    console.log(`\n=== Export Complete ===`)
    console.log(`Output: ${outputDir}`)
    console.log(`\nFiles:`)
    console.log(`  - raw-export.json (complete database record)`)
    console.log(`  - narrative.md (human-readable analysis)`)
    console.log(`\nOpen with:`)
    console.log(`  open "${outputDir}"`)

  } catch (error) {
    console.error('\nExport failed:', error)
    process.exit(1)
  }
}

main()
