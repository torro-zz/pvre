/**
 * App Name Gate - Filters signals to only include those mentioning the app name
 *
 * In App Gap mode, we analyze a specific app. This gate ensures that:
 * - Reddit signals only pass if they mention the app name
 * - App Store reviews bypass the filter (they're inherently about the app)
 *
 * USAGE:
 *   const result = applyAppNameGate(posts, appData)
 *   // result.passed = posts that mention the app
 *   // result.filtered = posts without app mention (for debugging)
 *
 * See: docs/REFACTORING_PLAN.md Phase 2
 */

import type { AppDetails } from '@/lib/data-sources/types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Item that can be filtered by the App Name Gate.
 * Supports posts (with title) and comments (without title).
 */
export interface AppNameGateItem {
  subreddit: string
  title?: string        // Posts have title, comments may not
  body?: string | null  // Both posts and comments have body
}

/**
 * Result of applying the App Name Gate.
 */
export interface AppNameGateResult<T> {
  /** Items that passed the gate (mention app or are app store reviews) */
  passed: T[]
  /** Items filtered out (Reddit posts without app mention) */
  filtered: T[]
  /** Statistics about the filtering */
  stats: {
    before: number
    after: number
    removed: number
    appName: string
    coreAppName: string
  }
}

// =============================================================================
// CORE LOGIC
// =============================================================================

/**
 * Extract the core app name from a full app name.
 *
 * Examples:
 *   "Loom: Screen Recorder" -> "Loom"
 *   "Slack - Business Chat" -> "Slack"
 *   "Notion" -> "Notion"
 */
export function extractCoreAppName(fullAppName: string): string {
  return fullAppName.split(/[:\-–—]/)[0].trim().toLowerCase()
}

/**
 * Build a word-boundary regex for the app name.
 *
 * This prevents partial matches like "bloom" matching "loom".
 */
export function buildAppNameRegex(coreAppName: string): RegExp {
  const escaped = coreAppName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

/**
 * Check if an item is an app store review (bypasses app name filter).
 */
export function isAppStoreReview(item: AppNameGateItem): boolean {
  return item.subreddit === 'app_store' || item.subreddit === 'google_play'
}

/**
 * Check if an item's text mentions the app name.
 */
export function mentionsAppName(item: AppNameGateItem, appNameRegex: RegExp): boolean {
  const text = `${item.title || ''} ${item.body || ''}`.toLowerCase()
  return appNameRegex.test(text)
}

/**
 * Check if an item passes the App Name Gate.
 *
 * Passes if:
 * - It's an app store review (subreddit is 'app_store' or 'google_play'), OR
 * - The text (title + body) mentions the app name
 */
export function passesAppNameGate(
  item: AppNameGateItem,
  appNameRegex: RegExp
): boolean {
  if (isAppStoreReview(item)) {
    return true
  }
  return mentionsAppName(item, appNameRegex)
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Apply the App Name Gate to a list of items.
 *
 * @param items - Posts, signals, or comments to filter
 * @param appData - App details (must have name)
 * @returns Result with passed/filtered items and stats
 *
 * @example
 * const result = applyAppNameGate(posts, appData)
 * console.log(`Kept ${result.passed.length}, removed ${result.filtered.length}`)
 */
export function applyAppNameGate<T extends AppNameGateItem>(
  items: T[],
  appData: Pick<AppDetails, 'name'>
): AppNameGateResult<T> {
  const coreAppName = extractCoreAppName(appData.name)
  const appNameRegex = buildAppNameRegex(coreAppName)

  const passed: T[] = []
  const filtered: T[] = []

  for (const item of items) {
    if (passesAppNameGate(item, appNameRegex)) {
      passed.push(item)
    } else {
      filtered.push(item)
    }
  }

  return {
    passed,
    filtered,
    stats: {
      before: items.length,
      after: passed.length,
      removed: filtered.length,
      appName: appData.name,
      coreAppName,
    },
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Apply App Name Gate to multiple arrays at once.
 *
 * Useful when you have core, related, and comments to filter together.
 */
export function applyAppNameGateMultiple<T extends AppNameGateItem>(
  itemGroups: { name: string; items: T[] }[],
  appData: Pick<AppDetails, 'name'>
): {
  results: { name: string; result: AppNameGateResult<T> }[]
  totalRemoved: number
  coreAppName: string
} {
  const coreAppName = extractCoreAppName(appData.name)
  const appNameRegex = buildAppNameRegex(coreAppName)

  let totalRemoved = 0
  const results = itemGroups.map(({ name, items }) => {
    const passed: T[] = []
    const filtered: T[] = []

    for (const item of items) {
      if (passesAppNameGate(item, appNameRegex)) {
        passed.push(item)
      } else {
        filtered.push(item)
      }
    }

    totalRemoved += filtered.length

    return {
      name,
      result: {
        passed,
        filtered,
        stats: {
          before: items.length,
          after: passed.length,
          removed: filtered.length,
          appName: appData.name,
          coreAppName,
        },
      },
    }
  })

  return { results, totalRemoved, coreAppName }
}

/**
 * Log App Name Gate results to console.
 */
export function logAppNameGateResult<T>(
  result: AppNameGateResult<T>,
  label: string = 'App Name Gate'
): void {
  if (result.stats.removed > 0) {
    console.log(`[${label}] Removed ${result.stats.removed} items (no "${result.stats.coreAppName}" mention)`)
    console.log(`[${label}] Result: ${result.stats.after} items passed`)
  } else {
    console.log(`[${label}] All ${result.stats.after} items mention "${result.stats.coreAppName}" or are app reviews`)
  }
}
