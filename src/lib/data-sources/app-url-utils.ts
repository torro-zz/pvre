/**
 * App Store URL Detection and Parsing Utilities
 *
 * Handles URL detection and app ID extraction for:
 * - Google Play Store: play.google.com/store/apps/details?id=com.example.app
 * - Apple App Store: apps.apple.com/app/app-name/id123456789
 */

export type AppStore = 'google_play' | 'app_store'

export interface ParsedAppUrl {
  store: AppStore
  appId: string
  market?: string  // For App Store: 'us', 'gb', etc.
}

/**
 * Check if a string is an app store URL (Google Play or Apple App Store)
 */
export function isAppStoreUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  const trimmed = input.trim().toLowerCase()

  return (
    trimmed.includes('play.google.com/store/apps') ||
    trimmed.includes('apps.apple.com/') ||
    // Also handle short URLs
    trimmed.includes('play.google.com/store/apps/details') ||
    trimmed.includes('itunes.apple.com/app')
  )
}

/**
 * Extract app ID and store type from a URL
 *
 * Examples:
 * - play.google.com/store/apps/details?id=com.calm.android → { store: 'google_play', appId: 'com.calm.android' }
 * - apps.apple.com/us/app/calm/id571800810 → { store: 'app_store', appId: '571800810', market: 'us' }
 * - apps.apple.com/app/calm/id571800810 → { store: 'app_store', appId: '571800810', market: 'us' }
 */
export function extractAppId(url: string): ParsedAppUrl | null {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()

  // Google Play Store
  // Format: play.google.com/store/apps/details?id=com.example.app
  if (trimmed.includes('play.google.com')) {
    const match = trimmed.match(/[?&]id=([a-zA-Z0-9._]+)/)
    if (match && match[1]) {
      return {
        store: 'google_play',
        appId: match[1],
      }
    }
    return null
  }

  // Apple App Store
  // Format 1: apps.apple.com/us/app/app-name/id123456789
  // Format 2: apps.apple.com/app/app-name/id123456789 (no region)
  // Format 3: itunes.apple.com/app/app-name/id123456789
  if (trimmed.includes('apps.apple.com') || trimmed.includes('itunes.apple.com')) {
    // Extract market (country code) if present
    const marketMatch = trimmed.match(/apps\.apple\.com\/([a-z]{2})\/app/i)
    const market = marketMatch?.[1]?.toLowerCase() || 'us'

    // Extract app ID (numeric ID after "id")
    const idMatch = trimmed.match(/\/id(\d+)/)
    if (idMatch && idMatch[1]) {
      return {
        store: 'app_store',
        appId: idMatch[1],
        market,
      }
    }
    return null
  }

  return null
}

/**
 * Detect market/region from App Store URL
 * Returns 'us' as default if not detected
 */
export function detectMarketFromUrl(url: string): string {
  if (!url) return 'us'

  // apps.apple.com/gb/app/calm/id571800810 → 'gb'
  const match = url.match(/apps\.apple\.com\/([a-z]{2})\//i)
  return match?.[1]?.toLowerCase() || 'us'
}

/**
 * Build a Google Play Store URL from an app ID
 */
export function buildGooglePlayUrl(appId: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`
}

/**
 * Build an App Store URL from an app ID and optional market
 */
export function buildAppStoreUrl(appId: string, market: string = 'us'): string {
  return `https://apps.apple.com/${market}/app/app/id${appId}`
}
