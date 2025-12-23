/**
 * Google Trends Data Source
 *
 * Fetches real trend data from Google Trends API.
 * Falls back gracefully if the API fails or rate limits.
 */

// Type declarations for google-trends-api (no @types package available)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require('google-trends-api');

export interface TrendDataPoint {
  time: string;
  formattedTime: string;
  value: number[];
}

export interface TrendResult {
  keywords: string[];
  timelineData: TrendDataPoint[];
  averages: number[];
  trend: 'rising' | 'stable' | 'falling';
  percentageChange: number; // Change from start to end of period
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
    const results = await googleTrends.interestOverTime({
      keyword: keywords,
      startTime: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)), // 1 year ago
      geo: geo,
    });

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
