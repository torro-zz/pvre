import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAppStoreUrl, extractAppId } from '@/lib/data-sources/app-url-utils'
import { googlePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'
import { appStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'
import type { AppDetails } from '@/lib/data-sources/types'
import { recordApiCost } from '@/lib/api-costs'

const anthropic = new Anthropic()
const PRESEARCH_MODEL = 'claude-sonnet-4-20250514'

// =============================================================================
// HYPOTHESIS MODE TYPES (existing)
// =============================================================================

export interface HypothesisInterpretation {
  audience: string
  problem: string
  shortTitle: string              // Clean, short version for dashboard display (5-8 words)
  searchPhrases: string[]
  confidence: 'low' | 'medium' | 'high'
  ambiguities: string[]
  isTransitionHypothesis: boolean
  // App discovery fields - for smart app store filtering
  appDiscovery?: {
    domainKeywords: string[]      // Core domain terms for search (e.g., ["expat", "international", "health insurance"])
    expectedCategories: string[]   // App categories likely relevant (e.g., ["Medical", "Travel", "Finance"])
    antiCategories: string[]       // Categories to filter out (e.g., ["Games", "Entertainment"])
    competitorApps: string[]       // Known apps in this space (e.g., ["Cigna Global", "SafetyWing"])
  }
}

export interface RefinementSuggestion {
  type: 'audience' | 'problem' | 'angle'
  suggestion: string
  rationale: string
}

export interface HypothesisResponse {
  mode: 'hypothesis'
  originalInput: string           // Exactly what the user typed (for display/recognition)
  interpretation: HypothesisInterpretation
  refinementSuggestions: RefinementSuggestion[]
  formattedHypothesis: string
}

// =============================================================================
// APP ANALYSIS MODE TYPES (new)
// =============================================================================

export interface AppAnalysisInterpretation {
  primaryDomain: string
  secondaryDomains: string[]
  targetAudience: string
  searchPhrases: string[]
  competitorTerms: string[]
}

export interface AppAnalysisResponse {
  mode: 'app-analysis'
  appData: AppDetails
  interpretation: AppAnalysisInterpretation
}

// =============================================================================
// DISCRIMINATED UNION RESPONSE
// =============================================================================

export type InterpretResponse = HypothesisResponse | AppAnalysisResponse

// Legacy type for backward compatibility
export interface InterpretHypothesisResponse {
  interpretation: HypothesisInterpretation
  refinementSuggestions: RefinementSuggestion[]
  formattedHypothesis: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rawInput } = body

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
    }

    const trimmedInput = rawInput.trim()
    if (trimmedInput.length < 10) {
      return NextResponse.json({ error: 'Input too short. Please describe your idea in more detail.' }, { status: 400 })
    }

    // ==========================================================================
    // APP-CENTRIC MODE: Detect app store URLs and route to app analysis
    // ==========================================================================
    if (isAppStoreUrl(trimmedInput)) {
      return handleAppAnalysis(trimmedInput, user.id)
    }

    // ==========================================================================
    // HYPOTHESIS MODE: Standard hypothesis interpretation
    // ==========================================================================

    // Use Claude to interpret the hypothesis
    const prompt = `You are an expert at understanding business hypotheses and market research queries.

The user has entered this free-form text describing a business idea or problem they want to validate:

"${trimmedInput}"

Your task is to interpret this and extract:
1. **Short Title**: A clean, readable version of the user's original input (5-8 words max). Keep the user's intent and key terms, fix grammar/capitalization if needed, but do NOT expand or add detail. This is for dashboard display and quick recognition.
2. **Audience**: Who is experiencing this problem? Be specific about demographics, roles, or situations.
3. **Problem**: What is the core pain point or struggle? Focus on the frustration, not the solution.
4. **Search Phrases**: 3-5 phrases these people would actually type into Reddit when seeking help or venting. Use casual, natural language - how real people talk, not marketing speak.
5. **Confidence**: How confident are you in this interpretation? (low/medium/high)
6. **Ambiguities**: Any unclear aspects that could lead to irrelevant results.
7. **Is Transition Hypothesis**: Is this about people transitioning FROM one state TO another (e.g., employees wanting to become freelancers)?
8. **App Discovery** (for finding relevant mobile apps):
   - **Domain Keywords**: 3-5 domain-specific terms that define this problem space (NOT generic words like "tool", "app", "help"). Prioritize unique, specific terms.
   - **Expected Categories**: Mobile app store categories where relevant apps would be found (e.g., "Medical", "Finance", "Travel", "Business", "Productivity")
   - **Anti-Categories**: Categories that are definitely NOT relevant (e.g., "Games", "Entertainment", "Social Networking" for a B2B hypothesis)
   - **Competitor Apps**: Known apps that solve this or similar problems (if any come to mind)

Also provide 2-3 refinement suggestions if the input is vague or could be more specific.

Respond in this exact JSON format:
{
  "interpretation": {
    "shortTitle": "string - clean 5-8 word title for dashboard",
    "audience": "string - specific description of who",
    "problem": "string - the core pain point",
    "searchPhrases": ["phrase 1", "phrase 2", "phrase 3"],
    "confidence": "low" | "medium" | "high",
    "ambiguities": ["unclear aspect 1", "unclear aspect 2"],
    "isTransitionHypothesis": true | false,
    "appDiscovery": {
      "domainKeywords": ["specific term 1", "specific term 2", "specific term 3"],
      "expectedCategories": ["Category1", "Category2"],
      "antiCategories": ["Category3", "Category4"],
      "competitorApps": ["App Name 1", "App Name 2"]
    }
  },
  "refinementSuggestions": [
    {
      "type": "audience" | "problem" | "angle",
      "suggestion": "more specific version",
      "rationale": "why this is better"
    }
  ],
  "formattedHypothesis": "A clean, formatted version combining audience and problem"
}

Short Title examples:
- Input: "indie hackers stuck at zero revenue" → shortTitle: "Indie hackers stuck at zero revenue"
- Input: "busy professionals not drinking enough water" → shortTitle: "Busy professionals not drinking enough water"
- Input: "saas churn problems" → shortTitle: "SaaS churn problems"
- Input: "remote workers lonely" → shortTitle: "Remote workers feeling lonely"

Important guidelines:
- Search phrases should be what people actually TYPE, not formal descriptions
- Include emotional language people use when frustrated ("hate", "struggle", "can't figure out", "driving me crazy")
- If the input mentions a solution, focus on the underlying problem, not the solution itself
- For transition hypotheses, emphasize the "stuck" feeling and desire for change
- Keep audience specific but not overly narrow
- Mark confidence as "low" if very vague, "high" if very clear and specific
- For domainKeywords, prioritize UNIQUE terms that distinguish this problem (e.g., "expat" not "insurance")
- For expectedCategories, use standard app store categories: Health & Fitness, Medical, Finance, Business, Productivity, Travel, Education, Lifestyle, Shopping, Food & Drink, etc.
- competitorApps can be empty array if no specific apps come to mind`

    const message = await anthropic.messages.create({
      model: PRESEARCH_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Record API cost for pre-search
    await recordApiCost({
      userId: user.id,
      actionType: 'free_presearch',
      model: PRESEARCH_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      endpoint: '/api/research/interpret-hypothesis',
      metadata: { mode: 'hypothesis', inputLength: trimmedInput.length },
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse the JSON response
    let parsed: InterpretHypothesisResponse
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonStr = content.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      parsed = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude response:', content.text)
      throw new Error('Failed to parse interpretation')
    }

    // Validate the response structure
    if (!parsed.interpretation || !parsed.interpretation.audience || !parsed.interpretation.problem) {
      throw new Error('Invalid interpretation structure')
    }

    // Ensure arrays and shortTitle exist
    parsed.interpretation.searchPhrases = parsed.interpretation.searchPhrases || []
    parsed.interpretation.ambiguities = parsed.interpretation.ambiguities || []
    parsed.refinementSuggestions = parsed.refinementSuggestions || []
    // Fallback for shortTitle if Claude didn't generate one
    parsed.interpretation.shortTitle = parsed.interpretation.shortTitle || trimmedInput

    // Ensure appDiscovery fields exist with sensible defaults
    if (!parsed.interpretation.appDiscovery) {
      parsed.interpretation.appDiscovery = {
        domainKeywords: [],
        expectedCategories: [],
        antiCategories: [],
        competitorApps: [],
      }
    } else {
      parsed.interpretation.appDiscovery.domainKeywords = parsed.interpretation.appDiscovery.domainKeywords || []
      parsed.interpretation.appDiscovery.expectedCategories = parsed.interpretation.appDiscovery.expectedCategories || []
      parsed.interpretation.appDiscovery.antiCategories = parsed.interpretation.appDiscovery.antiCategories || []
      parsed.interpretation.appDiscovery.competitorApps = parsed.interpretation.appDiscovery.competitorApps || []
    }

    // Return with mode field for discriminated union
    const response: HypothesisResponse = {
      mode: 'hypothesis',
      originalInput: trimmedInput,  // Pass through what user typed for display
      interpretation: parsed.interpretation,
      refinementSuggestions: parsed.refinementSuggestions,
      formattedHypothesis: parsed.formattedHypothesis,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Interpret hypothesis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to interpret hypothesis' },
      { status: 500 }
    )
  }
}

// =============================================================================
// APP ANALYSIS HANDLER
// =============================================================================

async function handleAppAnalysis(url: string, userId: string): Promise<NextResponse> {
  try {
    // 1. Parse the URL to determine which store
    const parsed = extractAppId(url)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse app store URL. Please check the format.' },
        { status: 400 }
      )
    }

    // 2. Fetch app details from the appropriate store
    let appData: AppDetails | null = null

    if (parsed.store === 'google_play') {
      appData = await googlePlayAdapter.getAppDetails(url)
    } else if (parsed.store === 'app_store') {
      appData = await appStoreAdapter.getAppDetails(url)
    }

    if (!appData) {
      return NextResponse.json(
        { error: 'Could not fetch app details. The app may not exist or be unavailable.' },
        { status: 404 }
      )
    }

    // 3. Use Claude to interpret the app's problem domain
    const prompt = `You are analyzing an app to understand what problem it solves and who it serves.

APP DETAILS:
- Name: ${appData.name}
- Developer: ${appData.developer}
- Category: ${appData.category}
- Rating: ${appData.rating.toFixed(1)} stars (${appData.reviewCount.toLocaleString()} reviews)
- Price: ${appData.price}${appData.hasIAP ? ' + In-App Purchases' : ''}
${appData.installs ? `- Installs: ${appData.installs}` : ''}

DESCRIPTION:
${appData.description.slice(0, 2000)}${appData.description.length > 2000 ? '...' : ''}

Extract the following information:

1. PRIMARY PROBLEM DOMAIN
   What core problem does this app solve? Be specific and concise.
   Example: "Stress and anxiety management through guided meditation"

2. SECONDARY PROBLEM DOMAINS
   What related problems does it also address? List 2-4.
   Example: ["Sleep improvement", "Focus and concentration", "Relaxation"]

3. TARGET AUDIENCE CHARACTERISTICS
   Who uses this app? Be specific about demographics, situations, or roles.
   Example: "Busy professionals and stressed adults seeking accessible mental wellness tools"

4. SEARCH PHRASES
   What phrases would people use when discussing this type of problem on Reddit/forums?
   Include:
   - 3-5 problem-focused phrases (how people describe the pain)
   - 2-3 "alternatives to [app name]" style phrases
   - 2-3 solution-seeking phrases

5. COMPETITOR TERMS
   What other apps or solutions might users compare this to?

Respond in this exact JSON format:
{
  "primaryDomain": "string",
  "secondaryDomains": ["string", "string"],
  "targetAudience": "string",
  "searchPhrases": ["phrase 1", "phrase 2", ...],
  "competitorTerms": ["competitor 1", "competitor 2", ...]
}`

    const message = await anthropic.messages.create({
      model: PRESEARCH_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Record API cost for pre-search (app analysis mode)
    await recordApiCost({
      userId,
      actionType: 'free_presearch',
      model: PRESEARCH_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      endpoint: '/api/research/interpret-hypothesis',
      metadata: { mode: 'app-analysis', appName: appData.name },
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse the JSON response
    let interpretation: AppAnalysisInterpretation
    try {
      let jsonStr = content.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      interpretation = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude response for app analysis:', content.text)
      throw new Error('Failed to interpret app')
    }

    // Validate and ensure arrays exist
    interpretation.secondaryDomains = interpretation.secondaryDomains || []
    interpretation.searchPhrases = interpretation.searchPhrases || []
    interpretation.competitorTerms = interpretation.competitorTerms || []

    // 4. Return the app analysis response
    const response: AppAnalysisResponse = {
      mode: 'app-analysis',
      appData,
      interpretation,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('App analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze app' },
      { status: 500 }
    )
  }
}
