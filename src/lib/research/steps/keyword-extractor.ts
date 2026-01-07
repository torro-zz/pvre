/**
 * Keyword Extractor Step - Extract search keywords from hypothesis
 *
 * This step extracts primary, secondary, and exclude keywords from the
 * user's hypothesis for better search precision.
 *
 * USAGE:
 *   const result = await keywordExtractorStep.execute(input, ctx)
 *   // result.primary = ['keyword1', 'keyword2']
 *   // result.exclude = ['spam', 'ad']
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

import {
  extractSearchKeywords,
  type ExtractedKeywords,
} from '@/lib/reddit/keyword-extractor'
import type {
  PipelineStep,
  KeywordExtractionInput,
  KeywordExtractionOutput,
} from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Build enhanced search context from structured hypothesis.
 */
function buildSearchContext(input: KeywordExtractionInput): string {
  const { hypothesis, structuredHypothesis } = input

  if (!structuredHypothesis) {
    return hypothesis
  }

  const { audience, problem } = structuredHypothesis
  const problemLanguage = (structuredHypothesis as { problemLanguage?: string }).problemLanguage

  let context = audience && problem
    ? `${audience} who ${problem}`
    : hypothesis

  if (problemLanguage) {
    context += ` (searches for: ${problemLanguage})`
  }

  return context
}

/**
 * Extract user-provided problem language phrases.
 */
function extractUserPhrases(problemLanguage: string): string[] {
  return problemLanguage
    .split(/[,"]/)
    .map(p => p.trim())
    .filter(p => p.length > 3 && p.length < 50)
    .slice(0, 3) // Max 3 phrases
}

/**
 * Extract user-provided exclude topics.
 */
function extractUserExcludes(excludeTopics: string): string[] {
  return excludeTopics
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 2 && p.length < 50)
}

/**
 * Keyword Extractor Step
 *
 * Extracts search keywords from the hypothesis using Claude.
 * If structured input is available, uses it for better extraction.
 */
export const keywordExtractorStep: PipelineStep<KeywordExtractionInput, KeywordExtractionOutput> = {
  name: 'Keyword Extractor',

  async execute(input, _ctx): Promise<KeywordExtractionOutput> {
    const { structuredHypothesis } = input

    // Build enhanced search context
    const searchContext = buildSearchContext(input)
    console.log(`  Search context: "${searchContext.slice(0, 80)}..."`)

    // Extract keywords using Claude
    const extractedKeywords: ExtractedKeywords = await extractSearchKeywords(searchContext)

    // Add user problem language as primary keywords (if provided)
    const problemLanguage = (structuredHypothesis as { problemLanguage?: string } | undefined)?.problemLanguage
    if (problemLanguage) {
      const userPhrases = extractUserPhrases(problemLanguage)
      extractedKeywords.primary.unshift(...userPhrases)
      console.log(`  Added user problem language: ${userPhrases.join(', ')}`)
    }

    // Add user exclude topics (if provided)
    const excludeTopics = (structuredHypothesis as { excludeTopics?: string } | undefined)?.excludeTopics
    if (excludeTopics) {
      const userExcludes = extractUserExcludes(excludeTopics)
      extractedKeywords.exclude.push(...userExcludes)
      console.log(`  Added user excludes: ${userExcludes.join(', ')}`)
    }

    console.log(`  Primary keywords: ${extractedKeywords.primary.slice(0, 5).join(', ')}`)
    console.log(`  Exclude keywords: ${extractedKeywords.exclude.join(', ') || 'none'}`)

    return {
      primary: extractedKeywords.primary,
      secondary: extractedKeywords.secondary,
      exclude: extractedKeywords.exclude,
      searchContext,
    }
  },
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export { buildSearchContext, extractUserPhrases, extractUserExcludes }
