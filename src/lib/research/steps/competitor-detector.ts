/**
 * Competitor Detector Step - Detect competitors from known mappings and signals
 *
 * This step identifies potential competitors from:
 * 1. Known competitors static mapping (App Gap mode)
 * 2. Competitor mentions extracted from pain signals using regex patterns
 *
 * USAGE:
 *   const result = await competitorDetectorStep.execute(input, ctx)
 *   // result.competitors = [...detected competitor names]
 *
 * See: docs/REFACTORING_PLAN.md Phase 4f
 */

import type { PipelineStep } from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import { isAppGapMode } from '@/lib/research/pipeline'
import { extractCoreAppName } from '@/lib/research/gates/app-name-gate'
import { findKnownCompetitors } from '@/lib/research/known-competitors'
import type { PainSignal } from './pain-analyzer'

// =============================================================================
// INPUT/OUTPUT TYPES
// =============================================================================

export interface CompetitorDetectorInput {
  /** Pain signals to scan for competitor mentions */
  painSignals: PainSignal[]
  /** Maximum number of competitors to detect */
  maxCompetitors?: number
}

export interface CompetitorDetectorOutput {
  /** Detected competitor names (deduplicated, capped) */
  competitors: string[]
  /** Known competitors from static mapping */
  knownCompetitors: string[]
  /** Competitors extracted from signal mentions */
  signalCompetitors: string[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Words to filter out when extracting competitor mentions */
const NON_COMPETITOR_WORDS = new Set([
  'the', 'this', 'that', 'they', 'what', 'just', 'now',
  'its', 'your', 'their', 'been', 'have', 'has', 'was',
  'were', 'are', 'will', 'would', 'could', 'should',
  'much', 'very', 'really', 'actually', 'finally',
])

/** Regex patterns to find competitor mentions in text */
const COMPETITOR_PATTERNS = [
  /switched\s+to\s+(\w+)/gi,
  /moved?\s+to\s+(\w+)/gi,
  /using\s+(\w+)\s+instead/gi,
  /(\w+)\s+is\s+(?:much\s+)?better/gi,
  /prefer\s+(\w+)/gi,
  /try\s+(\w+)/gi,
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract competitor mentions from pain signals using regex patterns.
 */
function extractCompetitorMentions(
  signals: PainSignal[],
  maxSignals: number = 30
): string[] {
  const mentions = new Set<string>()

  for (const signal of signals.slice(0, maxSignals)) {
    const text = `${signal.title || ''} ${signal.text || ''}`

    for (const pattern of COMPETITOR_PATTERNS) {
      // Reset regex state for each pattern
      pattern.lastIndex = 0
      const matches = text.matchAll(pattern)

      for (const match of matches) {
        const name = match[1]
        if (name && name.length > 2 && !NON_COMPETITOR_WORDS.has(name.toLowerCase())) {
          mentions.add(name)
        }
      }
    }
  }

  return Array.from(mentions)
}

function buildSelfNames(ctx: ResearchContext): string[] {
  if (!isAppGapMode(ctx) || !ctx.appData?.name) return []

  const selfNames = new Set<string>()
  const coreName = extractCoreAppName(ctx.appData.name)
  if (coreName) {
    selfNames.add(coreName)
  }

  const fullName = ctx.appData.name.trim().toLowerCase()
  if (fullName) {
    selfNames.add(fullName)
  }

  const developerName = ctx.appData.developer?.trim().toLowerCase()
  if (developerName) {
    selfNames.add(developerName)
  }

  return Array.from(selfNames)
}

function filterSelfCompetitors(names: string[], selfNames: string[]): string[] {
  if (selfNames.length === 0) return names

  return names.filter((name) => {
    const candidate = name.toLowerCase().trim()
    if (!candidate) return false
    return !selfNames.some((selfName) =>
      candidate === selfName ||
      candidate.includes(selfName) ||
      selfName.includes(candidate)
    )
  })
}

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Competitor Detector Step
 *
 * Detects potential competitors from known mappings and pain signal mentions.
 * Returns deduplicated list capped at maxCompetitors (default 8).
 */
export const competitorDetectorStep: PipelineStep<CompetitorDetectorInput, CompetitorDetectorOutput> = {
  name: 'Competitor Detector',

  async execute(input, ctx): Promise<CompetitorDetectorOutput> {
    const { painSignals, maxCompetitors = 8 } = input
    const detected: string[] = []
    const selfNames = buildSelfNames(ctx)

    // =========================================================================
    // Step 1: Known competitors from static mapping (App Gap mode only)
    // =========================================================================
    let knownCompetitors: string[] = []

    if (isAppGapMode(ctx) && ctx.appData?.name) {
      knownCompetitors = findKnownCompetitors(ctx.appData.name)
      if (knownCompetitors.length > 0) {
        console.log(`  Found ${knownCompetitors.length} known competitors for ${ctx.appData.name}`)
        detected.push(...knownCompetitors)
      }
    }

    // =========================================================================
    // Step 2: Extract competitor mentions from pain signals
    // =========================================================================
    const signalCompetitors = extractCompetitorMentions(painSignals, 30).slice(0, 5)

    if (signalCompetitors.length > 0) {
      console.log(`  Extracted ${signalCompetitors.length} competitor mentions from signals`)
      detected.push(...signalCompetitors)
    }

    // =========================================================================
    // Step 3: Deduplicate and cap
    // =========================================================================
    const uniqueCompetitors = [...new Set(detected.map(c => c.toLowerCase()))]
      .map(c => detected.find(d => d.toLowerCase() === c)!)

    const filteredCompetitors = filterSelfCompetitors(uniqueCompetitors, selfNames)
      .slice(0, maxCompetitors)

    console.log(`  Final: ${filteredCompetitors.length} competitors detected`)

    return {
      competitors: filteredCompetitors,
      knownCompetitors: filterSelfCompetitors(knownCompetitors, selfNames),
      signalCompetitors: filterSelfCompetitors(signalCompetitors, selfNames),
    }
  },
}
