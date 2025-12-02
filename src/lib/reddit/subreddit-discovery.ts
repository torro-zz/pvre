// Subreddit Discovery Service
// Uses Claude to analyze hypothesis and suggest relevant subreddits

import { anthropic, getCurrentTracker } from '../anthropic'
import { trackUsage } from '../analysis/token-tracker'
import { searchSubreddits } from '../arctic-shift/client'

interface SubredditSuggestion {
  name: string
  reason: string
  relevance: 'high' | 'medium' | 'low'
}

interface DiscoveryResult {
  subreddits: string[]
  suggestions: SubredditSuggestion[]
}

/**
 * Use Claude to discover relevant subreddits for a given hypothesis
 */
export async function discoverSubreddits(hypothesis: string): Promise<DiscoveryResult> {
  const systemPrompt = `You are a Reddit expert helping entrepreneurs find relevant subreddits for market research.

Your task is to suggest subreddits where people discuss problems, challenges, and needs related to a business hypothesis.

CRITICAL RULES:
1. Prioritize NICHE communities over large general ones
2. Focus on WHERE the target user spends time, not WHERE they might mention keywords
3. For a fitness app: suggest fitness subreddits, NOT entrepreneur subreddits
4. For a freelancer tool: suggest freelancer subreddits, NOT general business subreddits

Focus on:
- Niche communities specific to the PROBLEM DOMAIN (e.g., r/crossfit for fitness, r/freelance for freelancers)
- Communities where people ASK FOR HELP with this specific problem
- Subreddits with 10k-500k members (active but not too noisy)
- Professional or hobby communities where target users hang out

Strongly Avoid:
- r/Entrepreneur, r/startups, r/smallbusiness (too generic, full of marketers)
- Giant subreddits like r/AskReddit, r/LifeProTips (too noisy)
- Meme or entertainment subreddits
- Subreddits that are likely private or inactive`

  const userPrompt = `Business Hypothesis: "${hypothesis}"

Suggest 6-10 subreddits where the TARGET USERS (not entrepreneurs) discuss problems related to this hypothesis.

Ask yourself: "Who has the problem this hypothesis solves? Where do THEY hang out on Reddit?"

Respond in JSON format:
{
  "suggestions": [
    {
      "name": "subreddit_name_without_r_prefix",
      "reason": "Why this subreddit is relevant",
      "relevance": "high" | "medium" | "low"
    }
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    })

    // Track token usage
    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-haiku-20240307')
    }

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { suggestions: SubredditSuggestion[] }

    // Validate subreddits exist via Arctic Shift
    const validatedSubreddits = await validateSubreddits(
      parsed.suggestions.map((s) => s.name)
    )

    return {
      subreddits: validatedSubreddits,
      suggestions: parsed.suggestions.filter((s) =>
        validatedSubreddits.includes(s.name.toLowerCase())
      ),
    }
  } catch (error) {
    console.error('Subreddit discovery failed:', error)
    // Return fallback general subreddits based on common patterns
    return getFallbackSubreddits(hypothesis)
  }
}

/**
 * Validate that subreddits exist and are accessible via Arctic Shift
 * Note: We now skip strict validation since Arctic Shift posts search
 * will just return empty for non-existent subreddits
 */
async function validateSubreddits(subreddits: string[]): Promise<string[]> {
  // Clean up subreddit names (remove r/ prefix if present, lowercase)
  const cleaned = subreddits.map(s => {
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
  const unique = [...new Set(cleaned)].filter(s => s.length > 0)

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

  // Hyrox specific
  if (lowercaseHypothesis.includes('hyrox')) {
    suggestions.push(
      { name: 'hyrox', reason: 'Direct Hyrox community', relevance: 'high' },
      { name: 'crossfit', reason: 'Related functional fitness', relevance: 'high' },
      { name: 'running', reason: 'Running component of Hyrox', relevance: 'medium' },
      { name: 'ocr', reason: 'Obstacle course racing community', relevance: 'medium' }
    )
  }

  // Location based
  const locations = ['london', 'nyc', 'la', 'sydney', 'melbourne', 'toronto', 'vancouver']
  for (const location of locations) {
    if (lowercaseHypothesis.includes(location)) {
      suggestions.push({
        name: location,
        reason: `Local ${location} community`,
        relevance: 'medium',
      })
    }
  }

  // Business/Entrepreneur related
  if (
    lowercaseHypothesis.includes('business') ||
    lowercaseHypothesis.includes('startup') ||
    lowercaseHypothesis.includes('entrepreneur')
  ) {
    suggestions.push(
      { name: 'Entrepreneur', reason: 'Startup and business community', relevance: 'high' },
      { name: 'smallbusiness', reason: 'Small business owners', relevance: 'high' },
      { name: 'startups', reason: 'Startup founders', relevance: 'medium' }
    )
  }

  // Tech related
  if (
    lowercaseHypothesis.includes('app') ||
    lowercaseHypothesis.includes('software') ||
    lowercaseHypothesis.includes('saas') ||
    lowercaseHypothesis.includes('tech')
  ) {
    suggestions.push(
      { name: 'SaaS', reason: 'SaaS product community', relevance: 'high' },
      { name: 'webdev', reason: 'Web developers', relevance: 'medium' },
      { name: 'programming', reason: 'General programming', relevance: 'low' }
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
