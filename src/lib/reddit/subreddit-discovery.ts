// Subreddit Discovery Service
// Uses Claude to analyze hypothesis and suggest relevant subreddits
// Implements 3-stage domain-first discovery pipeline

import { anthropic, getCurrentTracker } from '../anthropic'
import { trackUsage } from '../analysis/token-tracker'
import { searchSubreddits } from '../arctic-shift/client'
import { parseClaudeJSON } from '../json-parse'

// =============================================================================
// TYPES
// =============================================================================

interface SubredditSuggestion {
  name: string
  reason: string
  relevance: 'high' | 'medium' | 'low'
}

/**
 * Context about whether the hypothesis describes a TRANSITION state
 * (current state → desired state) vs a static problem
 */
export interface TransitionContext {
  isTransition: boolean
  currentState?: string      // e.g., "employed", "corporate job"
  desiredState?: string      // e.g., "entrepreneur", "business owner"
  transitionType?: 'career' | 'lifestyle' | 'skill' | 'other'
}

// Patterns that indicate the hypothesis is about TRANSITIONING to something
const TRANSITION_PATTERNS = {
  career: [
    /\b(want(?:ing|s)? to|trying to|considering|thinking about|planning to)\s+(start|launch|build|create|begin|open)\s+(\w+\s+)?(a\s+)?(\w+\s+)?(business|company|startup|side hustle|freelance)/i,
    /\b(escape|leave|quit)\s+(my\s+)?(\w+\s+)?(job|9-5|corporate|career)/i,
    /\b(become|becoming)\s+(an?\s+)?(\w+\s+)?(entrepreneur|freelancer|founder|business owner|self-employed|independent)/i,
    /\b(transition(?:ing)?|switch(?:ing)?|move|moving)\s+(from|to|into)\s+/i,
    /\b(build|start|launch|create)\s+(\w+\s+)?(own\s+)?(business|company)/i,  // "build their own business"
  ],
  lifestyle: [
    /\b(want(?:ing|s)? to|trying to)\s+(be(?:come)?|get)\s+(fit|healthy|active)/i,
    /\b(start(?:ing)?|begin(?:ning)?)\s+(to\s+)?(exercise|workout|work out|run|gym)/i,
  ],
}

// Audience indicators that suggest CURRENT state (not goal achieved)
const EMPLOYED_AUDIENCE_PATTERNS = [
  /\b(employed|employee|corporate|9-5|nine-to-five|office job|day job|full-time job|w-2|salaried)\b/i,
  /\b(stuck in|trapped in|escape from)\s+(a\s+)?(job|career|corporate)/i,
  /\b(working professional|office worker|desk job)\b/i,
]

// Subreddits for people ALREADY running businesses (wrong audience for transition hypotheses)
const ESTABLISHED_BUSINESS_SUBREDDITS = [
  'entrepreneur', 'smallbusiness', 'startups', 'ecommerce', 'sweatystartup',
  'EntrepreneurRideAlong', 'SideProject', 'indiehackers',
]

// Subreddits where EMPLOYED people discuss career transitions
const TRANSITION_SUBREDDITS = [
  'careerguidance', 'careeradvice', 'jobs', 'antiwork', 'findapath',
  'financialindependence', 'Fire', 'leanfire', 'overemployed',
  'sidehustle', 'WorkOnline', 'beermoney',
]

export interface DomainExtraction {
  primaryDomain: string
  secondaryDomains: string[]
  audienceDescriptor: string
  transition?: TransitionContext  // Added: transition context for audience-aware discovery
}

// =============================================================================
// TRANSITION DETECTION
// =============================================================================

/**
 * Detect if a hypothesis describes a TRANSITION (current state → desired state)
 * This is critical for audience-aware subreddit selection.
 *
 * Example: "employed people wanting to start a business"
 * - Current state: employed
 * - Desired state: business owner
 * - We want subreddits where EMPLOYED people discuss this, not where business owners hang out
 */
export function detectTransitionContext(hypothesis: StructuredHypothesis): TransitionContext {
  const combinedText = `${hypothesis.audience} ${hypothesis.problem} ${hypothesis.problemLanguage || ''}`

  // Check for career transition patterns
  for (const pattern of TRANSITION_PATTERNS.career) {
    if (pattern.test(combinedText)) {
      // Check if audience is currently employed
      const isEmployedAudience = EMPLOYED_AUDIENCE_PATTERNS.some(p => p.test(combinedText))
      return {
        isTransition: true,
        currentState: isEmployedAudience ? 'employed' : undefined,
        desiredState: 'entrepreneur/business owner',
        transitionType: 'career',
      }
    }
  }

  // Check for lifestyle transition patterns
  for (const pattern of TRANSITION_PATTERNS.lifestyle) {
    if (pattern.test(combinedText)) {
      return {
        isTransition: true,
        transitionType: 'lifestyle',
      }
    }
  }

  return { isTransition: false }
}

export interface SubredditCandidate {
  name: string
  relevanceScore: 'high' | 'medium' | 'low'
  relevanceReason: string
  audienceMatch: string
  priority: number
}

export interface ValidatedSubreddit extends SubredditCandidate {
  isValid: boolean
  problemRelevance: string
  rejectReason?: string
}

export interface StructuredHypothesis {
  audience: string
  problem: string
  problemLanguage?: string
}

export interface DiscoveryResult {
  subreddits: string[]
  suggestions: SubredditSuggestion[]
  domain?: DomainExtraction
  validatedSubreddits?: ValidatedSubreddit[]
  warning: string | null
  recommendation: 'proceed' | 'proceed_with_caution' | 'reconsider'
}

// =============================================================================
// STAGE 1: DOMAIN EXTRACTION
// =============================================================================

/**
 * Extract the problem DOMAIN from a hypothesis, not the audience demographics.
 * This is the key insight: "men in 50s with aging skin" → domain is "skincare", not "men"
 *
 * Also detects TRANSITION context for audience-aware subreddit selection.
 */
async function extractDomain(hypothesis: StructuredHypothesis): Promise<DomainExtraction> {
  // First, detect if this is a transition hypothesis
  const transition = detectTransitionContext(hypothesis)

  const systemPrompt = `You identify the core problem domain from a business hypothesis.

The DOMAIN is the subject area of the PROBLEM, not the audience.

Examples:
- "men in their 50s with aging skin" → Domain: SKINCARE / ANTI-AGING
- "busy parents with picky eaters" → Domain: PARENTING / KIDS FOOD
- "freelancers struggling to find clients" → Domain: FREELANCING / CLIENT ACQUISITION
- "expats feeling lonely abroad" → Domain: EXPAT LIFE / LONELINESS / SOCIAL CONNECTION
- "runners with knee pain" → Domain: RUNNING / SPORTS INJURIES

The domain is about the PROBLEM, not the AUDIENCE.
Wrong: "men" (that's audience)
Right: "skincare" (that's the problem domain)

Return JSON only, no explanation.`

  const userPrompt = `Extract the problem domain from this hypothesis:

Audience: ${hypothesis.audience}
Problem: ${hypothesis.problem}
${hypothesis.problemLanguage ? `Problem Language: ${hypothesis.problemLanguage}` : ''}

What is the PROBLEM DOMAIN (not the audience)?

{
  "primaryDomain": "main problem area",
  "secondaryDomains": ["related area 1", "related area 2"],
  "audienceDescriptor": "who they are (for filtering later)"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 512,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const result = parseClaudeJSON<DomainExtraction>(textContent.text, 'domain extraction')
    // Attach transition context
    result.transition = transition
    return result
  } catch (error) {
    console.error('Domain extraction failed:', error)
    // Fallback: use the problem as the domain
    return {
      primaryDomain: hypothesis.problem,
      secondaryDomains: [],
      audienceDescriptor: hypothesis.audience,
      transition,
    }
  }
}

// =============================================================================
// STAGE 2: DOMAIN-FIRST SUBREDDIT DISCOVERY
// =============================================================================

/**
 * Find subreddits where the PROBLEM DOMAIN is discussed, not just where the audience exists.
 * This is the critical change: prioritize problem-domain subreddits over demographic subreddits.
 *
 * For TRANSITION hypotheses (e.g., "employed people wanting to start business"):
 * - Prioritize subreddits where the CURRENT state audience discusses the transition
 * - Deprioritize subreddits for people who already achieved the goal
 */
async function discoverSubredditsByDomain(
  domain: DomainExtraction,
  hypothesis: StructuredHypothesis
): Promise<SubredditCandidate[]> {
  const isEmployedTransition = domain.transition?.currentState === 'employed' && domain.transition?.transitionType === 'career'

  // Build transition-aware system prompt
  let systemPrompt = `You are a Reddit expert finding subreddits where a specific PROBLEM is actively discussed.

CRITICAL RULES:
1. Find subreddits about the PROBLEM DOMAIN first
2. Then check if the AUDIENCE would be present there
3. Domain-specific subreddits ALWAYS beat demographic subreddits

PRIORITY ORDER:
1. HIGH: Subreddits dedicated to the exact problem (r/SkincareAddiction for skincare)
2. HIGH: Subreddits for the problem + audience intersection (r/30PlusSkinCare for aging skin)
3. MEDIUM: Large subreddits where the problem is commonly discussed (r/malegrooming)
4. LOW: Demographic subreddits where problem MIGHT appear (r/AskMenOver30)
5. AVOID: Generic demographic subreddits with no problem focus (r/malefashionadvice for skincare)

NEVER recommend subreddits just because they match the AUDIENCE if they don't discuss the PROBLEM.

For each subreddit, explain WHY it's relevant to the PROBLEM (not just the audience).

CRITICAL PERSPECTIVE CHECK:
- Posts must be BY the target audience, not ABOUT them
- For "elderly people" → r/AskOldPeople ✓ (elderly post here) NOT r/AgingParents ✗ (caregivers post)
- For "freelancers" → r/freelance ✓ (freelancers post) NOT r/hiring ✗ (employers post)`

  // Add transition-specific instructions
  if (isEmployedTransition) {
    systemPrompt += `

⚠️ CRITICAL - TRANSITION HYPOTHESIS DETECTED ⚠️
This hypothesis is about EMPLOYED PEOPLE wanting to START a business.
The audience is people CURRENTLY EMPLOYED, not existing business owners.

MUST PRIORITIZE subreddits where EMPLOYED people discuss:
- Career transitions, escape from 9-5
- Side hustles while employed
- Financial independence / FIRE
- Career guidance and job dissatisfaction

MUST DEPRIORITIZE subreddits for ESTABLISHED entrepreneurs:
- r/Entrepreneur (people already running businesses)
- r/smallbusiness (existing business owners)
- r/startups (funded startup founders)
These are the WRONG AUDIENCE - they've already made the transition.

GOOD subreddits for employed→entrepreneur transition:
- r/careerguidance, r/careeradvice (employed people seeking guidance)
- r/antiwork, r/jobs (job dissatisfaction discussions)
- r/financialindependence, r/Fire (people planning exit from employment)
- r/sidehustle, r/overemployed (employed people with side income)
- r/findapath (career direction seekers)`
  }

  let userPrompt = `Find Reddit communities for this research:

PRIMARY DOMAIN: ${domain.primaryDomain}
SECONDARY DOMAINS: ${domain.secondaryDomains.join(', ') || 'none'}
AUDIENCE: ${domain.audienceDescriptor}
PROBLEM: ${hypothesis.problem}
${hypothesis.problemLanguage ? `PROBLEM LANGUAGE: ${hypothesis.problemLanguage}` : ''}`

  // Add transition context to user prompt
  if (isEmployedTransition) {
    userPrompt += `

⚠️ TRANSITION CONTEXT:
- Current state: EMPLOYED (this is who we want to hear from)
- Desired state: Business owner/entrepreneur (this is NOT who we want)
- Find subreddits where EMPLOYED people discuss wanting to start businesses, NOT where existing entrepreneurs hang out`
  }

  userPrompt += `

Find 8-12 subreddits, prioritizing:
1. Communities dedicated to ${domain.primaryDomain}
2. Communities where ${domain.audienceDescriptor} discuss ${domain.primaryDomain}
3. Communities where "${hypothesis.problem}" is frequently discussed

Return JSON only:
{
  "subreddits": [
    {
      "name": "subreddit name without r/",
      "relevanceScore": "high" | "medium" | "low",
      "relevanceReason": "WHY this sub discusses the PROBLEM",
      "audienceMatch": "how well the target audience is represented",
      "priority": 1-5 (1 = best)
    }
  ]
}

IMPORTANT: Do NOT include subreddits that only match the audience but don't discuss the problem.`

  if (isEmployedTransition) {
    userPrompt += `
CRITICAL: Do NOT include r/Entrepreneur, r/smallbusiness, r/startups - these are for people who ALREADY have businesses, not for employed people considering the transition.`
  } else {
    userPrompt += `
Example for skincare hypothesis:
- YES: r/SkincareAddiction (discusses skincare problems)
- YES: r/30PlusSkinCare (aging skin specifically)
- NO: r/malefashionadvice (men's sub but about clothing, not skin)
- NO: r/menslib (men's sub but about masculinity politics, not skin)`
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const parsed = parseClaudeJSON<{ subreddits: SubredditCandidate[] }>(textContent.text, 'subreddit discovery')
    let subreddits = parsed.subreddits || []

    // Post-processing for transition hypotheses: deprioritize/filter established business subs
    if (isEmployedTransition && subreddits.length > 0) {
      console.log('[SubredditDiscovery] Transition hypothesis detected - applying audience-aware filtering')

      // Deprioritize established business subreddits (set to low priority)
      subreddits = subreddits.map(sub => {
        const lowerName = sub.name.toLowerCase()
        if (ESTABLISHED_BUSINESS_SUBREDDITS.some(s => s.toLowerCase() === lowerName)) {
          console.log(`[SubredditDiscovery] Deprioritizing r/${sub.name} (established business audience)`)
          return {
            ...sub,
            relevanceScore: 'low' as const,
            priority: 5,
            relevanceReason: `${sub.relevanceReason} [DEPRIORITIZED: established business owners, not employed transition seekers]`,
          }
        }
        return sub
      })

      // Check if we have any transition-friendly subreddits
      const hasTransitionSubs = subreddits.some(sub =>
        TRANSITION_SUBREDDITS.some(ts => ts.toLowerCase() === sub.name.toLowerCase())
      )

      // Inject high-priority transition subreddits if missing
      if (!hasTransitionSubs) {
        console.log('[SubredditDiscovery] No transition subreddits found - injecting r/careerguidance, r/sidehustle')
        const injectedSubs: SubredditCandidate[] = [
          {
            name: 'careerguidance',
            relevanceScore: 'high',
            relevanceReason: 'Employed people seeking career transition advice',
            audienceMatch: 'Excellent - primarily employed people considering changes',
            priority: 1,
          },
          {
            name: 'sidehustle',
            relevanceScore: 'high',
            relevanceReason: 'Employed people building side businesses',
            audienceMatch: 'Excellent - people with day jobs exploring business ideas',
            priority: 1,
          },
        ]
        subreddits = [...injectedSubs, ...subreddits]
      }

      // Sort by priority (transition-friendly first)
      subreddits.sort((a, b) => a.priority - b.priority)
    }

    return subreddits
  } catch (error) {
    console.error('Domain-first subreddit discovery failed:', error)
    return []
  }
}

// =============================================================================
// STAGE 3: VALIDATION CHECK
// =============================================================================

/**
 * Validate that suggested subreddits actually discuss the problem domain.
 * Be aggressive about rejecting poor matches - better 4 good subs than 8 mediocre ones.
 */
async function validateSubredditRelevance(
  candidates: SubredditCandidate[],
  domain: DomainExtraction,
  hypothesis: StructuredHypothesis
): Promise<ValidatedSubreddit[]> {
  if (candidates.length === 0) {
    return []
  }

  const systemPrompt = `You validate whether suggested subreddits actually discuss a specific problem.

For each subreddit, answer:
1. Is this subreddit primarily about the PROBLEM DOMAIN? (Yes/No/Partially)
2. Would posts about the problem be ON-TOPIC in this subreddit? (Yes/No)
3. What percentage of posts likely relate to the problem? (estimate)

REJECT subreddits where:
- The problem would be OFF-TOPIC
- Less than 10% of content relates to the problem
- The subreddit is about a DIFFERENT problem that happens to share the audience

Be aggressive about rejecting poor matches. Better to have 4 good subreddits than 8 mediocre ones.`

  const subredditList = candidates
    .map((c) => `- r/${c.name}: "${c.relevanceReason}"`)
    .join('\n')

  const userPrompt = `Validate these subreddits for researching: "${hypothesis.problem}"

Problem Domain: ${domain.primaryDomain}
Secondary Domains: ${domain.secondaryDomains.join(', ') || 'none'}

Subreddits to validate:
${subredditList}

Return JSON only:
{
  "validated": [
    {
      "name": "subreddit",
      "isValid": true/false,
      "problemRelevance": "percentage or description of how much content relates to problem",
      "rejectReason": "if invalid, why (or null if valid)"
    }
  ]
}

Only include subreddits where the problem would be ON-TOPIC. Reject aggressively.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const parsed = parseClaudeJSON<{
      validated: { name: string; isValid: boolean; problemRelevance: string; rejectReason?: string }[]
    }>(textContent.text, 'subreddit validation')

    // Merge validation results with candidates
    return candidates.map((candidate) => {
      const validation = parsed.validated.find(
        (v) => v.name.toLowerCase() === candidate.name.toLowerCase()
      )
      return {
        ...candidate,
        isValid: validation?.isValid ?? true, // Default to valid if not found
        problemRelevance: validation?.problemRelevance ?? 'unknown',
        rejectReason: validation?.rejectReason,
      }
    })
  } catch (error) {
    console.error('Subreddit validation failed:', error)
    // On error, mark all as valid to avoid blocking the flow
    return candidates.map((c) => ({
      ...c,
      isValid: true,
      problemRelevance: 'validation failed, assuming valid',
    }))
  }
}

// =============================================================================
// MAIN DISCOVERY FUNCTION (3-STAGE PIPELINE)
// =============================================================================

/**
 * Main entry point for subreddit discovery.
 * Implements 3-stage pipeline: Domain Extraction → Domain-First Discovery → Validation
 *
 * @param input - Either a string hypothesis (legacy) or structured hypothesis object
 * @param excludeSubreddits - Optional array of subreddits to exclude from results (for adaptive fetching)
 */
export async function discoverSubreddits(
  input: string | StructuredHypothesis,
  excludeSubreddits?: string[]
): Promise<DiscoveryResult> {
  // Handle legacy string input by converting to structured format
  const hypothesis: StructuredHypothesis =
    typeof input === 'string'
      ? { audience: input, problem: input }
      : input

  // Normalize exclude list for case-insensitive comparison
  const excludeSet = new Set((excludeSubreddits || []).map(s => s.toLowerCase()))

  console.log('[SubredditDiscovery] Stage 1: Extracting problem domain...')

  // STAGE 1: Extract the problem domain
  const domain = await extractDomain(hypothesis)
  console.log(`[SubredditDiscovery] Domain extracted: ${domain.primaryDomain} (audience: ${domain.audienceDescriptor})`)

  // STAGE 2: Discover subreddits by domain
  console.log('[SubredditDiscovery] Stage 2: Finding domain-specific subreddits...')
  const candidates = await discoverSubredditsByDomain(domain, hypothesis)
  console.log(`[SubredditDiscovery] Found ${candidates.length} candidate subreddits`)

  if (candidates.length === 0) {
    // Fallback to legacy discovery if domain-first fails
    console.log('[SubredditDiscovery] No candidates found, using fallback...')
    const fallback = getFallbackSubreddits(hypothesis.problem)
    return {
      ...fallback,
      domain,
      warning: 'No domain-specific communities found. Using general fallback subreddits.',
      recommendation: 'proceed_with_caution',
    }
  }

  // STAGE 3: Validate subreddit relevance
  console.log('[SubredditDiscovery] Stage 3: Validating subreddit relevance...')
  const validated = await validateSubredditRelevance(candidates, domain, hypothesis)

  // Filter to only valid subreddits
  const validSubreddits = validated.filter((s) => s.isValid)
  console.log(`[SubredditDiscovery] ${validSubreddits.length}/${validated.length} subreddits passed validation`)

  // Log rejected subreddits for debugging
  const rejected = validated.filter((s) => !s.isValid)
  if (rejected.length > 0) {
    console.log('[SubredditDiscovery] Rejected subreddits:')
    rejected.forEach((s) => console.log(`  - r/${s.name}: ${s.rejectReason}`))
  }

  // Clean up subreddit names
  let cleanedNames = await validateSubredditsExist(validSubreddits.map((s) => s.name))

  // Filter out excluded subreddits (for adaptive fetching)
  if (excludeSet.size > 0) {
    cleanedNames = cleanedNames.filter(name => !excludeSet.has(name.toLowerCase()))
    console.log(`[SubredditDiscovery] Filtered to ${cleanedNames.length} after excluding already-searched`)
  }

  // Determine recommendation based on results
  let warning: string | null = null
  let recommendation: 'proceed' | 'proceed_with_caution' | 'reconsider' = 'proceed'

  if (cleanedNames.length === 0) {
    warning = 'No communities specifically discussing this problem were found. Consider: (1) rephrasing your problem, (2) manually adding subreddits you know, (3) this problem may not be widely discussed on Reddit.'
    recommendation = 'reconsider'
  } else if (cleanedNames.length < 3) {
    warning = 'Limited communities found for this problem. Results may be sparse. Consider adding more subreddits manually.'
    recommendation = 'proceed_with_caution'
  }

  // Convert to legacy format for backwards compatibility
  const suggestions: SubredditSuggestion[] = validSubreddits
    .filter((s) => cleanedNames.includes(s.name.toLowerCase()))
    .map((s) => ({
      name: s.name,
      reason: s.relevanceReason,
      relevance: s.relevanceScore,
    }))

  return {
    subreddits: cleanedNames,
    suggestions,
    domain,
    validatedSubreddits: validated,
    warning,
    recommendation,
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate that subreddits exist and are accessible via Arctic Shift
 * Note: We now skip strict validation since Arctic Shift posts search
 * will just return empty for non-existent subreddits
 */
async function validateSubredditsExist(subreddits: string[]): Promise<string[]> {
  // Clean up subreddit names (remove r/ prefix if present, lowercase)
  const cleaned = subreddits.map((s) => {
    let name = s.toLowerCase().trim()
    if (name.startsWith('r/')) {
      name = name.substring(2)
    }
    // Handle r_running -> running format
    if (name.startsWith('r_')) {
      name = name.substring(2)
    }
    return name
  })

  // Remove duplicates and empty strings
  const unique = [...new Set(cleaned)].filter((s) => s.length > 0)

  return unique
}

/**
 * Fallback subreddit suggestions based on keyword extraction
 */
function getFallbackSubreddits(hypothesis: string): DiscoveryResult {
  const lowercaseHypothesis = hypothesis.toLowerCase()
  const suggestions: SubredditSuggestion[] = []

  // Fitness related
  if (
    lowercaseHypothesis.includes('fitness') ||
    lowercaseHypothesis.includes('training') ||
    lowercaseHypothesis.includes('workout') ||
    lowercaseHypothesis.includes('gym')
  ) {
    suggestions.push(
      { name: 'fitness', reason: 'General fitness community', relevance: 'high' },
      { name: 'xxfitness', reason: 'Women-focused fitness', relevance: 'medium' },
      { name: 'bodyweightfitness', reason: 'Home workout community', relevance: 'medium' }
    )
  }

  // Skincare related
  if (
    lowercaseHypothesis.includes('skin') ||
    lowercaseHypothesis.includes('skincare') ||
    lowercaseHypothesis.includes('aging') ||
    lowercaseHypothesis.includes('wrinkle')
  ) {
    suggestions.push(
      { name: 'SkincareAddiction', reason: 'Main skincare community', relevance: 'high' },
      { name: '30PlusSkinCare', reason: 'Aging skin focused', relevance: 'high' },
      { name: 'malegrooming', reason: 'Men\'s grooming including skincare', relevance: 'medium' }
    )
  }

  // Parenting related
  if (
    lowercaseHypothesis.includes('parent') ||
    lowercaseHypothesis.includes('kid') ||
    lowercaseHypothesis.includes('child') ||
    lowercaseHypothesis.includes('baby')
  ) {
    suggestions.push(
      { name: 'Parenting', reason: 'General parenting community', relevance: 'high' },
      { name: 'beyondthebump', reason: 'New parents community', relevance: 'high' },
      { name: 'Mommit', reason: 'Mothers community', relevance: 'medium' }
    )
  }

  // Freelance related
  if (
    lowercaseHypothesis.includes('freelance') ||
    lowercaseHypothesis.includes('client') ||
    lowercaseHypothesis.includes('self-employed')
  ) {
    suggestions.push(
      { name: 'freelance', reason: 'Freelancer community', relevance: 'high' },
      { name: 'graphic_design', reason: 'Design freelancers', relevance: 'medium' },
      { name: 'webdev', reason: 'Web development freelancers', relevance: 'medium' }
    )
  }

  // If no specific matches, add general communities
  if (suggestions.length === 0) {
    suggestions.push(
      { name: 'Entrepreneur', reason: 'Business and startup discussion', relevance: 'medium' },
      { name: 'smallbusiness', reason: 'Small business community', relevance: 'medium' },
      { name: 'productivity', reason: 'Productivity and tools', relevance: 'low' }
    )
  }

  return {
    subreddits: suggestions.map((s) => s.name),
    suggestions,
    warning: 'Using fallback subreddits. Consider manually adding more specific communities.',
    recommendation: 'proceed_with_caution',
  }
}

/**
 * Expand subreddit list with related communities
 */
export async function expandSubreddits(
  baseSubreddits: string[],
  limit: number = 5
): Promise<string[]> {
  const expanded = new Set(baseSubreddits)

  for (const subreddit of baseSubreddits.slice(0, 3)) {
    try {
      // Search for related subreddits
      const related = await searchSubreddits({
        subreddit_prefix: subreddit.substring(0, 4),
        limit: limit,
      })

      related.forEach((r) => expanded.add(r.name))
    } catch (error) {
      console.warn(`Failed to expand subreddit ${subreddit}:`, error)
    }
  }

  return Array.from(expanded)
}
