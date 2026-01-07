/**
 * Theme Analyzer Step - Extract themes and generate interview questions
 *
 * This step analyzes pain signals to:
 * - Extract key themes using Claude
 * - Calculate theme resonance (how much evidence supports each theme)
 * - Generate interview questions for user research
 *
 * USAGE:
 *   const result = await themeAnalyzerStep.execute(input, ctx)
 *   // result.themeAnalysis = { themes: [...], summary: ... }
 *   // result.interviewQuestions = { contextQuestions, problemQuestions, solutionQuestions }
 *
 * See: docs/REFACTORING_PLAN.md Phase 4
 */

import type { PipelineStep } from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import {
  extractThemes,
  generateInterviewQuestions,
  calculateThemeResonance,
  type ThemeAnalysis,
} from '@/lib/analysis/theme-extractor'
import type { PainSignal } from '@/lib/analysis/pain-detector'

// =============================================================================
// INPUT/OUTPUT TYPES
// =============================================================================

export interface ThemeAnalyzerInput {
  /** Pain signals to analyze for themes */
  painSignals: PainSignal[]
  /** Original hypothesis for context */
  hypothesis: string
}

export interface InterviewQuestions {
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
}

export interface ThemeAnalyzerOutput {
  /** Extracted themes with resonance scores */
  themeAnalysis: ThemeAnalysis
  /** Generated interview questions organized by category */
  interviewQuestions: InterviewQuestions
}

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Theme Analyzer Step
 *
 * Extracts themes from pain signals and generates interview questions.
 * Includes resonance calculation to show evidence strength per theme.
 */
export const themeAnalyzerStep: PipelineStep<ThemeAnalyzerInput, ThemeAnalyzerOutput> = {
  name: 'Theme Analyzer',

  async execute(input, ctx): Promise<ThemeAnalyzerOutput> {
    const { painSignals, hypothesis } = input

    console.log(`  Analyzing ${painSignals.length} pain signals for themes`)

    // =========================================================================
    // Step 1: Extract themes using Claude
    // =========================================================================
    const themeAnalysis = await extractThemes(painSignals, hypothesis)
    console.log(`  Extracted ${themeAnalysis.themes.length} themes`)

    // =========================================================================
    // Step 2: Calculate resonance for each theme
    // =========================================================================
    themeAnalysis.themes = calculateThemeResonance(themeAnalysis.themes, painSignals)
    console.log(`  Calculated resonance for ${themeAnalysis.themes.length} themes`)

    // =========================================================================
    // Step 3: Generate interview questions
    // =========================================================================
    const interviewQuestions = await generateInterviewQuestions(themeAnalysis, hypothesis)
    console.log(`  Generated ${interviewQuestions.contextQuestions.length + interviewQuestions.problemQuestions.length + interviewQuestions.solutionQuestions.length} interview questions`)

    return {
      themeAnalysis,
      interviewQuestions,
    }
  },
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export type { ThemeAnalysis }
