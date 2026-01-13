/**
 * Timing Analyzer Module
 * Uses Claude to identify market timing signals (tailwinds/headwinds).
 * Enhanced with AI Discussion Trends (Reddit) as primary source,
 * with Google Trends as fallback.
 * Part of the Viability Verdict scoring system (15% weight in full formula).
 */

import { anthropic, getCurrentTracker } from "../anthropic";
import { trackUsage } from "./token-tracker";
import { parseClaudeJSON } from "../json-parse";
import {
  TrendResult,
  KeywordTrend,
  getCachedTrendData,
  extractTrendKeywordsWithAI,
} from "../data-sources/google-trends";
import {
  getAIDiscussionTrend,
  AITrendResult,
} from "../data-sources/ai-discussion-trends";

export interface TimingInput {
  hypothesis: string;
  industry?: string;
  appName?: string; // For App Gap mode: include app name in Google Trends keywords
  isAppGapMode?: boolean; // Skip AI Discussion Trends for App Gap mode (performance optimization)
}

export interface TimingSignal {
  signal: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface TimingResult {
  score: number; // 0-10
  confidence: 'high' | 'medium' | 'low';
  tailwinds: TimingSignal[];
  headwinds: TimingSignal[];
  timingWindow: string; // e.g., "12-18 months"
  verdict: string;
  trend: 'rising' | 'stable' | 'falling';
  // Trend data source indicator
  trendSource: 'ai_discussion' | 'google_trends' | 'ai_estimate';
  // Trend data (null if all sources failed)
  trendData: {
    keywords: string[];
    percentageChange: number;
    dataAvailable: boolean;
    // Source-specific fields
    keywordBreakdown?: KeywordTrend[];
    // Timeline data for sparkline visualization (Google Trends only)
    timelineData?: Array<{
      time: string;
      formattedTime: string;
      value: number[];
    }>;
    // AI Discussion specific fields
    totalVolume?: number;
    sources?: string[];
    insufficientData?: boolean;
    change30d?: number;
    change90d?: number;
  } | null;
}

export async function analyzeTiming(
  input: TimingInput
): Promise<TimingResult> {
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Step 1: Extract keywords for trend analysis
  let keywords = await extractTrendKeywordsWithAI(input.hypothesis);

  // For App Gap mode: ensure the app name is included as a keyword for better relevance
  if (input.appName) {
    const normalizedAppName = input.appName.split(/[:\-–—]/)[0].trim();
    // Add app name at the beginning if not already present
    if (!keywords.some(k => k.toLowerCase().includes(normalizedAppName.toLowerCase()))) {
      keywords = [normalizedAppName, ...keywords].slice(0, 4);
    }
    console.log('[Timing] App Gap mode - including app name in keywords:', normalizedAppName);
  }

  // Step 2: Try AI Discussion Trends first (primary source)
  let aiTrendData: AITrendResult | null = null;
  let googleTrendData: TrendResult | null = null;
  let trendSource: 'ai_discussion' | 'google_trends' | 'ai_estimate' = 'ai_estimate';

  if (keywords.length > 0) {
    // Skip AI Discussion Trends for App Gap mode - it analyzes app reviews, not Reddit discussions
    // This avoids ~100 sequential Arctic Shift API calls that add 30+ minutes to App Gap searches
    if (input.isAppGapMode) {
      console.log('[Timing] Skipping AI Discussion Trends for App Gap mode (not relevant for app review analysis)');
    } else {
      console.log('[Timing] Fetching AI Discussion Trends for:', keywords);
      try {
        aiTrendData = await getAIDiscussionTrend(keywords);
      } catch (aiTrendError) {
        // Non-blocking: Arctic Shift rate limiting or other errors shouldn't crash research
        console.warn('[Timing] AI Discussion Trends failed (non-blocking):', aiTrendError instanceof Error ? aiTrendError.message : aiTrendError);
        aiTrendData = null;
      }
    }

    if (aiTrendData?.dataAvailable && !aiTrendData.insufficientData) {
      trendSource = 'ai_discussion';
      console.log('[Timing] Using AI Discussion Trends - trend:', aiTrendData.trend, 'change:', aiTrendData.percentageChange);
    } else {
      // Step 3: Fall back to Google Trends if AI trends unavailable
      console.log('[Timing] AI Discussion Trends unavailable, trying Google Trends...');
      try {
        googleTrendData = await getCachedTrendData(keywords);
      } catch (googleTrendError) {
        // Non-blocking: Google Trends errors shouldn't crash research
        console.warn('[Timing] Google Trends failed (non-blocking):', googleTrendError instanceof Error ? googleTrendError.message : googleTrendError);
        googleTrendData = null;
      }

      if (googleTrendData) {
        trendSource = 'google_trends';
        console.log('[Timing] Using Google Trends - trend:', googleTrendData.trend);
      } else {
        console.log('[Timing] All trend sources unavailable, using AI estimate');
      }
    }
  }

  // Build trend context for AI prompt based on available data
  let trendContext: string;
  if (trendSource === 'ai_discussion' && aiTrendData) {
    trendContext = `
REAL TREND DATA (from AI Discussion Analysis on Reddit):
- Keywords analyzed: ${aiTrendData.keywords.join(', ')}
- Trend direction: ${aiTrendData.trend.toUpperCase()} (${aiTrendData.percentageChange > 0 ? '+' : ''}${aiTrendData.percentageChange}% change)
- 30-day change: ${aiTrendData.change30d > 0 ? '+' : ''}${aiTrendData.change30d}%
- 90-day change: ${aiTrendData.change90d > 0 ? '+' : ''}${aiTrendData.change90d}%
- Data volume: ${aiTrendData.totalVolume} discussions analyzed
- Confidence: ${aiTrendData.confidence}
- This is REAL data from Reddit AI discussions. Your trend assessment should align with this data.
`;
  } else if (trendSource === 'google_trends' && googleTrendData) {
    trendContext = `
REAL GOOGLE TRENDS DATA (verified):
- Keywords analyzed: ${googleTrendData.keywords.join(', ')}
- Trend direction: ${googleTrendData.trend.toUpperCase()} (${googleTrendData.percentageChange > 0 ? '+' : ''}${googleTrendData.percentageChange}% over past year)
- This is REAL data from Google Trends. Your trend assessment should align with this data.
`;
  } else {
    trendContext = `
NOTE: Real-time trend data unavailable. Provide your best estimate for trend direction based on your knowledge.
`;
  }

  const prompt = `You are a market timing analyst. Assess whether NOW is a good time to launch this business.

HYPOTHESIS: "${input.hypothesis}"
${input.industry ? `INDUSTRY: ${input.industry}` : ''}
CURRENT DATE: ${currentDate}
${trendContext}

Analyze the timing by identifying:

1. TAILWINDS (factors that make NOW a good time)
   - Macro trends supporting this
   - Recent changes that create opportunity
   - Technology enablers that didn't exist before
   - Cultural/behavioral shifts
   - Regulatory changes that help

2. HEADWINDS (factors that make NOW challenging)
   - Economic conditions
   - Market saturation concerns
   - Regulatory risks
   - Technology barriers
   - Cultural resistance

3. TIMING WINDOW
   - How long until this opportunity closes or changes?
   - Is this a short window (6-12 months) or long (2-3 years)?

4. TREND DIRECTION
   - Is interest/demand for this type of solution rising, stable, or falling?
   ${(aiTrendData || googleTrendData) ? '- USE THE TREND DATA ABOVE to inform your assessment.' : ''}

SCORING GUIDE for timing_score (0-10):
- Strong tailwinds, few headwinds, clear window → 8-10
- More tailwinds than headwinds, reasonable window → 6-7.9
- Mixed signals, uncertain window → 4-5.9
- More headwinds than tailwinds → 2-3.9
- Strong headwinds, closing window → 0-1.9

Respond with ONLY valid JSON:
{
  "timing_score": <number 0-10>,
  "tailwinds": [
    {
      "signal": "<short name, 2-4 words>",
      "impact": "<high|medium|low>",
      "description": "<1-2 sentence explanation>"
    }
  ],
  "headwinds": [
    {
      "signal": "<short name, 2-4 words>",
      "impact": "<high|medium|low>",
      "description": "<1-2 sentence explanation>"
    }
  ],
  "timing_window": "<e.g., 12-18 months>",
  "trend": "<rising|stable|falling>",
  "verdict": "<1-2 sentence assessment of timing>",
  "confidence": "<high|medium|low>"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });

  // Track token usage
  const tracker = getCurrentTracker();
  if (tracker && response.usage) {
    trackUsage(tracker, response.usage, "claude-sonnet-4-20250514");
  }

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Parse JSON from response with repair capability
  const data = parseClaudeJSON<{
    timing_score: number;
    confidence: 'high' | 'medium' | 'low';
    tailwinds: { signal: string; impact: 'high' | 'medium' | 'low'; description: string }[];
    headwinds: { signal: string; impact: 'high' | 'medium' | 'low'; description: string }[];
    timing_window: string;
    verdict: string;
    trend: 'rising' | 'stable' | 'falling';
  }>(content.text, 'timing analysis');

  // Use trend from the selected source to ensure consistency
  let finalTrend: 'rising' | 'stable' | 'falling';
  if (trendSource === 'ai_discussion' && aiTrendData) {
    finalTrend = aiTrendData.trend;
  } else if (trendSource === 'google_trends' && googleTrendData) {
    finalTrend = googleTrendData.trend;
  } else {
    finalTrend = data.trend; // AI estimate from Claude
  }

  // Build trend data response based on source
  let trendDataResponse: TimingResult['trendData'] = null;

  if (trendSource === 'ai_discussion' && aiTrendData) {
    trendDataResponse = {
      keywords: aiTrendData.keywords,
      percentageChange: aiTrendData.percentageChange,
      dataAvailable: true,
      totalVolume: aiTrendData.totalVolume,
      sources: aiTrendData.sources,
      insufficientData: aiTrendData.insufficientData,
      change30d: aiTrendData.change30d,
      change90d: aiTrendData.change90d,
    };
  } else if (trendSource === 'google_trends' && googleTrendData) {
    trendDataResponse = {
      keywords: googleTrendData.keywords,
      percentageChange: googleTrendData.percentageChange,
      dataAvailable: true,
      keywordBreakdown: googleTrendData.keywordBreakdown,
      timelineData: googleTrendData.timelineData,
    };
  }

  return {
    score: data.timing_score,
    confidence: data.confidence,
    tailwinds: data.tailwinds || [],
    headwinds: data.headwinds || [],
    timingWindow: data.timing_window,
    verdict: data.verdict,
    trend: finalTrend,
    trendSource,
    trendData: trendDataResponse,
  };
}
