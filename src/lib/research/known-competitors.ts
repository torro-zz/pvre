/**
 * Known Competitors Mapping
 *
 * Static mapping of well-known products to their obvious competitors.
 * Used for auto-detecting competitors in App Gap analysis mode.
 *
 * Guidelines for adding entries:
 * - Key: Normalized app name (lowercase, no platform suffixes)
 * - Value: Array of 3-5 most obvious direct competitors
 * - Focus on products users would realistically compare
 */

export const KNOWN_COMPETITORS: Record<string, string[]> = {
  // Communication & Collaboration
  'slack': ['Microsoft Teams', 'Discord', 'Google Chat', 'Zoom Team Chat'],
  'discord': ['Slack', 'Microsoft Teams', 'Guilded', 'Element'],
  'microsoft teams': ['Slack', 'Google Meet', 'Zoom', 'Discord'],
  'zoom': ['Google Meet', 'Microsoft Teams', 'Webex', 'Skype'],

  // Project Management
  'trello': ['Asana', 'Monday.com', 'ClickUp', 'Notion'],
  'asana': ['Trello', 'Monday.com', 'ClickUp', 'Basecamp'],
  'monday.com': ['Asana', 'Trello', 'ClickUp', 'Wrike'],
  'clickup': ['Asana', 'Monday.com', 'Notion', 'Trello'],
  'jira': ['Linear', 'Asana', 'Monday.com', 'Shortcut'],
  'linear': ['Jira', 'Shortcut', 'Asana', 'Height'],

  // Note-Taking & Documentation
  'notion': ['Confluence', 'Coda', 'Obsidian', 'Roam Research'],
  'obsidian': ['Notion', 'Roam Research', 'Logseq', 'Bear'],
  'evernote': ['Notion', 'OneNote', 'Bear', 'Apple Notes'],
  'confluence': ['Notion', 'Coda', 'Slite', 'Guru'],

  // Design Tools
  'figma': ['Sketch', 'Adobe XD', 'Framer', 'Canva'],
  'sketch': ['Figma', 'Adobe XD', 'Framer', 'InVision'],
  'canva': ['Figma', 'Adobe Express', 'Crello', 'PicMonkey'],
  'adobe xd': ['Figma', 'Sketch', 'Framer', 'InVision'],

  // Developer Tools
  'github': ['GitLab', 'Bitbucket', 'Azure DevOps', 'Gitea'],
  'gitlab': ['GitHub', 'Bitbucket', 'Azure DevOps', 'Gitea'],
  'vscode': ['JetBrains IDEs', 'Sublime Text', 'Atom', 'Vim'],
  'postman': ['Insomnia', 'Hoppscotch', 'Thunder Client', 'Paw'],

  // CRM & Sales
  'salesforce': ['HubSpot', 'Pipedrive', 'Zoho CRM', 'Freshsales'],
  'hubspot': ['Salesforce', 'Pipedrive', 'Zoho CRM', 'ActiveCampaign'],
  'pipedrive': ['HubSpot', 'Salesforce', 'Zoho CRM', 'Close'],

  // Email & Marketing
  'mailchimp': ['ConvertKit', 'Klaviyo', 'Constant Contact', 'Sendinblue'],
  'convertkit': ['Mailchimp', 'Beehiiv', 'Substack', 'Buttondown'],
  'substack': ['Beehiiv', 'Ghost', 'ConvertKit', 'Revue'],

  // Cloud Storage
  'dropbox': ['Google Drive', 'OneDrive', 'Box', 'iCloud'],
  'google drive': ['Dropbox', 'OneDrive', 'Box', 'iCloud'],

  // Video & Streaming
  'youtube': ['Vimeo', 'TikTok', 'Twitch', 'Dailymotion'],
  'twitch': ['YouTube Live', 'Kick', 'Facebook Gaming', 'Trovo'],
  'loom': ['Vidyard', 'CloudApp', 'Screencast-O-Matic', 'Camtasia'],

  // E-commerce
  'shopify': ['WooCommerce', 'BigCommerce', 'Squarespace', 'Wix'],
  'woocommerce': ['Shopify', 'BigCommerce', 'Magento', 'PrestaShop'],

  // Analytics
  'google analytics': ['Mixpanel', 'Amplitude', 'Plausible', 'Fathom'],
  'mixpanel': ['Amplitude', 'Heap', 'PostHog', 'Google Analytics'],
  'amplitude': ['Mixpanel', 'Heap', 'PostHog', 'Pendo'],

  // Password Managers
  '1password': ['LastPass', 'Bitwarden', 'Dashlane', 'Keeper'],
  'lastpass': ['1Password', 'Bitwarden', 'Dashlane', 'NordPass'],
  'bitwarden': ['1Password', 'LastPass', 'Dashlane', 'KeePass'],

  // Calendar & Scheduling
  'calendly': ['Cal.com', 'SavvyCal', 'Doodle', 'Acuity'],
  'cal.com': ['Calendly', 'SavvyCal', 'TidyCal', 'Doodle'],
}

/**
 * Platform suffixes to strip when normalizing app names
 */
const PLATFORM_SUFFIXES = [
  'for ios',
  'for android',
  'for web',
  'for desktop',
  'for mobile',
  'for mac',
  'for windows',
  'for linux',
  'ios',
  'android',
  'mobile',
  'desktop',
  'web',
  'app',
]

/**
 * Normalize an app name for matching against known competitors.
 * - Converts to lowercase
 * - Strips platform suffixes (e.g., "for iOS", "Android")
 * - Trims whitespace
 */
export function normalizeAppName(appName: string): string {
  let normalized = appName.toLowerCase().trim()

  // Remove platform suffixes
  for (const suffix of PLATFORM_SUFFIXES) {
    const pattern = new RegExp(`\\s*[-–—]?\\s*${suffix}\\s*$`, 'i')
    normalized = normalized.replace(pattern, '')
  }

  return normalized.trim()
}

/**
 * Find known competitors for a given app name.
 * Returns empty array if app is not in the mapping.
 *
 * @param appName - The app name to look up (e.g., "Slack for iOS", "Notion")
 * @returns Array of known competitor names, or empty array if not found
 */
export function findKnownCompetitors(appName: string): string[] {
  const normalized = normalizeAppName(appName)
  return KNOWN_COMPETITORS[normalized] || []
}

/**
 * Check if an app is in the known competitors mapping.
 *
 * @param appName - The app name to check
 * @returns true if the app has known competitors mapped
 */
export function hasKnownCompetitors(appName: string): boolean {
  const normalized = normalizeAppName(appName)
  return normalized in KNOWN_COMPETITORS
}

/**
 * Get all known app names (for debugging/admin purposes)
 */
export function getAllKnownApps(): string[] {
  return Object.keys(KNOWN_COMPETITORS)
}
