/**
 * Verdict Messages - Single Source of Truth
 *
 * ALL user-facing recommendation messages must use this utility to ensure
 * consistent messaging across components. No component should have its own
 * logic for determining verdict labels or recommendations.
 *
 * The verdict score (0-10) is the single source of truth, calculated as a
 * weighted average of Pain, Market, Competition, and Timing scores.
 *
 * Thresholds (aligned with VERDICT_THRESHOLDS in viability-calculator.ts):
 * - Strong: >= 7.5
 * - Mixed: 5.0-7.5
 * - Weak: 4.0-5.0
 * - None: < 4.0
 */

import { VERDICT_THRESHOLDS, VerdictLevel } from '@/lib/analysis/viability-calculator'

export type VerdictSeverity = 'success' | 'warning' | 'error'

export interface VerdictMessage {
  level: VerdictLevel
  label: string
  shortMessage: string
  longMessage: string
  severity: VerdictSeverity
  action: string
  // Color classes for consistent styling
  colors: {
    text: string
    bg: string
    border: string
    gradient: string
  }
}

/**
 * Get a consistent verdict message based on the overall score.
 * Use this in all components that display recommendations.
 *
 * @param score - The overall verdict score (0-10)
 * @param hasCriticalConcerns - Whether there are dealbreakers or high-severity red flags
 */
export function getVerdictMessage(
  score: number,
  hasCriticalConcerns = false
): VerdictMessage {
  // Critical concerns override the verdict message but keep the level
  if (hasCriticalConcerns && score >= VERDICT_THRESHOLDS.mixed) {
    return {
      level: getVerdictLevel(score),
      label: 'Review Required',
      shortMessage: 'Critical concerns detected',
      longMessage: 'There are critical concerns that need to be addressed before proceeding.',
      severity: 'warning',
      action: 'Review concerns before proceeding',
      colors: {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      },
    }
  }

  if (score >= VERDICT_THRESHOLDS.strong) {
    return {
      level: 'strong',
      label: 'Strong Signal',
      shortMessage: 'Strong opportunity detected',
      longMessage: 'Strong pain signals with evidence of willingness to pay. This problem is worth solving.',
      severity: 'success',
      action: 'Proceed to customer interviews',
      colors: {
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      },
    }
  }

  if (score >= VERDICT_THRESHOLDS.mixed) {
    return {
      level: 'mixed',
      label: 'Mixed Signals',
      shortMessage: 'Mixed signals detected',
      longMessage: 'Some pain signals found but concerns exist. Investigate further before committing resources.',
      severity: 'warning',
      action: 'Validate assumptions first',
      colors: {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      },
    }
  }

  if (score >= VERDICT_THRESHOLDS.weak) {
    return {
      level: 'weak',
      label: 'Weak Signal',
      shortMessage: 'Weak signals detected',
      longMessage: 'Limited evidence of pain or willingness to pay. Significant pivots may be needed.',
      severity: 'warning',
      action: 'Consider pivoting',
      colors: {
        text: 'text-orange-700 dark:text-orange-300',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        border: 'border-orange-200 dark:border-orange-800',
        gradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
      },
    }
  }

  return {
    level: 'none',
    label: 'No Signal',
    shortMessage: 'No viable signal detected',
    longMessage: 'No viable business signal detected. Pivot to a different problem or target audience.',
    severity: 'error',
    action: 'Pivot to a different problem',
    colors: {
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      gradient: 'from-red-500/10 via-red-500/5 to-transparent',
    },
  }
}

/**
 * Get just the verdict level from a score.
 * Use getVerdictMessage() when you need more than just the level.
 */
export function getVerdictLevel(score: number): VerdictLevel {
  if (score >= VERDICT_THRESHOLDS.strong) return 'strong'
  if (score >= VERDICT_THRESHOLDS.mixed) return 'mixed'
  if (score >= VERDICT_THRESHOLDS.weak) return 'weak'
  return 'none'
}

/**
 * Get a trend badge label and color for YoY growth.
 * 0% is "Flat" (not "Stable"), negative is "Declining".
 */
export function getTrendBadge(yoyGrowth: number): { label: string; color: string } {
  if (yoyGrowth > 20) return { label: 'Growing', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' }
  if (yoyGrowth > 5) return { label: 'Rising', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' }
  if (yoyGrowth > -5) return { label: 'Flat', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' }
  if (yoyGrowth > -20) return { label: 'Declining', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' }
  return { label: 'Falling', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' }
}
