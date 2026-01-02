/**
 * Google Trends Data Source
 *
 * Fetches real trend data from Google Trends API.
 * Falls back gracefully if the API fails or rate limits.
 * Uses AI to extract problem-focused keywords (not demographics).
 */

// Type declarations for google-trends-api (no @types package available)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require('google-trends-api');

import { anthropic, getCurrentTracker } from "../anthropic";
import { trackUsage } from "../analysis/token-tracker";
import { parseClaudeJSON } from "../json-parse";

export interface TrendDataPoint {
  time: string;
  formattedTime: string;
  value: number[];
}

export interface KeywordTrend {
  keyword: string;
  percentageChange: number;
  trend: 'rising' | 'stable' | 'falling';
  q1Average: number;
  q4Average: number;
}

export interface TrendResult {
  keywords: string[];
  timelineData: TrendDataPoint[];
  averages: number[];
  trend: 'rising' | 'stable' | 'falling';
  percentageChange: number; // Change from start to end of period (aggregate)
  keywordBreakdown?: KeywordTrend[]; // Per-keyword breakdown (new, optional for backwards compat)
}

export interface GoogleTrendsError {
  code: 'RATE_LIMITED' | 'API_ERROR' | 'PARSE_ERROR' | 'UNKNOWN';
  message: string;
}

/**
 * Get trend data for given keywords over the past year
 *
 * @param keywords - Array of 1-5 keywords to compare
 * @param geo - Two-letter country code or empty for global
 * @returns TrendResult or null if API fails
 */
export async function getTrendData(
  keywords: string[],
  geo: string = ''
): Promise<TrendResult | null> {
  if (keywords.length === 0 || keywords.length > 5) {
    console.warn('[GoogleTrends] Invalid keyword count:', keywords.length);
    return null;
  }

  try {
    // Fetch interest over time for the past year
    console.log('[GoogleTrends] CALLING REAL API for keywords:', keywords);
    const results = await googleTrends.interestOverTime({
      keyword: keywords,
      startTime: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)), // 1 year ago
      geo: geo,
    });
    console.log('[GoogleTrends] API RETURNED real data');

    // Parse the JSON response
    const data = JSON.parse(results);

    if (!data.default?.timelineData) {
      console.warn('[GoogleTrends] No timeline data in response');
      return null;
    }

    const timelineData: TrendDataPoint[] = data.default.timelineData.map(
      (point: { time: string; formattedTime: string; value: number[] }) => ({
        time: point.time,
        formattedTime: point.formattedTime,
        value: point.value,
      })
    );

    // Calculate averages for each keyword
    const averages = keywords.map((_, keywordIndex) => {
      const values = timelineData.map(point => point.value[keywordIndex] || 0);
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    });

    // Calculate trend direction using first vs last quarter
    const quarterLength = Math.floor(timelineData.length / 4);
    const firstQuarter = timelineData.slice(0, quarterLength);
    const lastQuarter = timelineData.slice(-quarterLength);

    // Calculate per-keyword breakdown
    const keywordBreakdown: KeywordTrend[] = keywords.map((keyword, keywordIndex) => {
      const q1Avg = firstQuarter.reduce((sum, p) => sum + (p.value[keywordIndex] || 0), 0) / firstQuarter.length;
      const q4Avg = lastQuarter.reduce((sum, p) => sum + (p.value[keywordIndex] || 0), 0) / lastQuarter.length;

      const pctChange = q1Avg > 0
        ? ((q4Avg - q1Avg) / q1Avg) * 100
        : (q4Avg > 0 ? 100 : 0); // If starting from zero, treat any growth as 100%

      let keywordTrend: 'rising' | 'stable' | 'falling';
      if (pctChange > 15) {
        keywordTrend = 'rising';
      } else if (pctChange < -15) {
        keywordTrend = 'falling';
      } else {
        keywordTrend = 'stable';
      }

      return {
        keyword,
        percentageChange: Math.round(pctChange),
        trend: keywordTrend,
        q1Average: Math.round(q1Avg * 100) / 100,
        q4Average: Math.round(q4Avg * 100) / 100,
      };
    });

    // Aggregate calculation (use first keyword for backwards compatibility)
    const firstQuarterAvg = firstQuarter.reduce((sum, p) => sum + (p.value[0] || 0), 0) / firstQuarter.length;
    const lastQuarterAvg = lastQuarter.reduce((sum, p) => sum + (p.value[0] || 0), 0) / lastQuarter.length;

    // Calculate percentage change
    const percentageChange = firstQuarterAvg > 0
      ? ((lastQuarterAvg - firstQuarterAvg) / firstQuarterAvg) * 100
      : 0;

    // Determine trend direction
    let trend: 'rising' | 'stable' | 'falling';
    if (percentageChange > 15) {
      trend = 'rising';
    } else if (percentageChange < -15) {
      trend = 'falling';
    } else {
      trend = 'stable';
    }

    return {
      keywords,
      timelineData,
      averages,
      trend,
      percentageChange: Math.round(percentageChange),
      keywordBreakdown,
    };
  } catch (error) {
    // Log error for debugging but fail gracefully
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[GoogleTrends] API error:', errorMessage);

    // Check for rate limiting
    if (errorMessage.includes('429') || errorMessage.includes('rate')) {
      console.warn('[GoogleTrends] Rate limited - will use AI fallback');
    }

    return null;
  }
}

/**
 * Extract keywords from a hypothesis for trend analysis
 *
 * @param hypothesis - The business hypothesis
 * @returns Array of keywords suitable for Google Trends
 */
export function extractTrendKeywords(hypothesis: string): string[] {
  // Remove common words and extract key terms
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'that', 'this',
    'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while',
    'who', 'which', 'what', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'also', 'now', 'help', 'helps', 'helping',
    'tool', 'tools', 'app', 'platform', 'software', 'service', 'solution',
    'product', 'business', 'people', 'users', 'customers', 'clients',
  ]);

  // Clean and split the hypothesis
  const words = hypothesis
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique words, max 5 for Google Trends
  const uniqueWords = [...new Set(words)];

  // Prioritize compound terms if present
  const compoundTerms: string[] = [];
  const singleWords: string[] = [];

  // Look for common patterns like "freelance invoicing" or "remote work"
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
      const compound = `${words[i]} ${words[i + 1]}`;
      if (compound.length <= 30) {
        compoundTerms.push(compound);
      }
    }
  }

  uniqueWords.forEach(word => {
    if (!singleWords.includes(word)) {
      singleWords.push(word);
    }
  });

  // Combine: 2 compound terms + 3 single words (max 5 total)
  const result = [
    ...compoundTerms.slice(0, 2),
    ...singleWords.filter(w => !compoundTerms.some(c => c.includes(w))).slice(0, 3),
  ].slice(0, 5);

  return result;
}

/**
 * Cache for AI-extracted keywords to ensure deterministic results.
 * Same hypothesis always gets the same keywords.
 */
const keywordCache = new Map<string, { keywords: string[]; timestamp: number }>();
const KEYWORD_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (longer than trend data cache)

/**
 * Normalize hypothesis for cache key (lowercase, trim, collapse whitespace)
 */
function normalizeHypothesis(hypothesis: string): string {
  return hypothesis.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract keywords using AI to focus on the PROBLEM domain, not demographics.
 *
 * This is important because hypotheses often contain both:
 * - WHO has the problem (professionals, students, parents) - NOT useful for trends
 * - WHAT the problem is (stress management, invoicing) - USEFUL for trends
 *
 * Results are cached for 7 days to ensure deterministic results for the same hypothesis.
 *
 * @param hypothesis - The business hypothesis
 * @returns Array of 3-5 keywords focused on the problem/solution domain
 */
export async function extractTrendKeywordsWithAI(hypothesis: string): Promise<string[]> {
  // Check cache first for deterministic results
  const cacheKey = normalizeHypothesis(hypothesis);
  const cached = keywordCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < KEYWORD_CACHE_TTL) {
    console.log('[GoogleTrends] Using cached AI keywords for hypothesis');
    return cached.keywords;
  }

  const prompt = `Extract 3-5 Google Trends search keywords from this business hypothesis.

HYPOTHESIS: "${hypothesis}"

IMPORTANT RULES:
1. Focus on the PROBLEM or SOLUTION domain - what people search for when they have this need
2. AVOID demographic terms (professionals, students, parents, individuals, users, customers)
3. AVOID generic business terms (tool, app, platform, software, service, solution)
4. Keywords should be terms people actually type into Google when researching this problem
5. Prefer 2-3 word phrases over single words when they're commonly searched
6. Think: "What would someone Google if they had this problem?"

EXAMPLES:
- Hypothesis about freelancers struggling with invoicing → ["freelance invoicing", "invoice templates", "client billing"]
- Hypothesis about stressed professionals → ["stress management", "work anxiety", "burnout recovery"]
- Hypothesis about parents tracking kids' screen time → ["screen time kids", "parental controls", "digital wellness"]

Respond with ONLY a JSON array of 3-5 keyword strings:
["keyword1", "keyword2", "keyword3"]`;

  try {
    // Use Haiku for simple keyword extraction (3x cheaper than Sonnet)
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });

    // Track token usage
    const tracker = getCurrentTracker();
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, "claude-3-5-haiku-latest");
    }

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const keywords = parseClaudeJSON<string[]>(content.text, 'trend keywords');

    // Validate and clean
    if (!Array.isArray(keywords) || keywords.length === 0) {
      throw new Error("Invalid keywords array");
    }

    // Filter to valid strings, max 5
    const validKeywords = keywords
      .filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 50)
      .slice(0, 5);

    if (validKeywords.length === 0) {
      throw new Error("No valid keywords extracted");
    }

    // Cache the results for deterministic behavior
    keywordCache.set(cacheKey, { keywords: validKeywords, timestamp: Date.now() });
    console.log('[GoogleTrends] AI extracted keywords (cached):', validKeywords);
    return validKeywords;

  } catch (error) {
    console.warn('[GoogleTrends] AI keyword extraction failed, falling back to simple extraction:', error);
    // Fall back to simple extraction - also cache the fallback result
    const fallbackKeywords = extractTrendKeywords(hypothesis);
    keywordCache.set(cacheKey, { keywords: fallbackKeywords, timestamp: Date.now() });
    return fallbackKeywords;
  }
}

/**
 * Cache for trend data to avoid excessive API calls
 */
const trendCache = new Map<string, { data: TrendResult | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get trend data with caching
 */
export async function getCachedTrendData(
  keywords: string[],
  geo: string = ''
): Promise<TrendResult | null> {
  const cacheKey = `${keywords.sort().join('|')}|${geo}`;
  const cached = trendCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[GoogleTrends] Using cached data for:', keywords);
    return cached.data;
  }

  const data = await getTrendData(keywords, geo);
  trendCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}
