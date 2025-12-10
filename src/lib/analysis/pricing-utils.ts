/**
 * Pricing Utilities
 * Functions for extracting and analyzing pricing from competitor data.
 */

// =============================================================================
// COMPETITOR PRICING EXTRACTION
// =============================================================================

export interface CompetitorPricingInfo {
  name: string;
  pricingModel: string | null;
  pricingRange: string | null;
  extractedPrice: number | null; // Extracted monthly price in USD
}

export interface PricingSuggestion {
  medianPrice: number | null;
  averagePrice: number | null;
  priceRange: { min: number; max: number } | null;
  competitorsWithPricing: number;
  totalCompetitors: number;
  suggestedPrice: number;
  source: 'competitors' | 'default';
  pricingModels: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract monthly price from a pricing range string
 * Handles formats like: "$29/month", "$9-$49/mo", "$99/user/month", "Free - $199"
 */
export function extractMonthlyPrice(pricingRange: string | null): number | null {
  if (!pricingRange) return null;

  const cleaned = pricingRange.toLowerCase();

  // Check if it's annual pricing (convert to monthly)
  const isAnnual = /\/(year|yr|annual)/i.test(cleaned);

  // Extract all dollar amounts
  const priceMatches = cleaned.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  if (!priceMatches || priceMatches.length === 0) return null;

  // Parse prices
  const prices = priceMatches.map(p => {
    const numStr = p.replace(/[$,]/g, '');
    return parseFloat(numStr);
  }).filter(p => !isNaN(p) && p > 0);

  if (prices.length === 0) return null;

  // If free or freemium and only has high price, use the high price
  if (/free/i.test(cleaned) && prices.length === 1 && prices[0] > 100) {
    // Probably annual, convert
    return Math.round(prices[0] / 12);
  }

  // For ranges, take the middle-ish value (2nd if 3+ prices, higher if 2)
  let basePrice: number;
  if (prices.length === 1) {
    basePrice = prices[0];
  } else if (prices.length === 2) {
    // Take the paid tier (higher price if one is 0 or very low)
    basePrice = prices[0] < 5 ? prices[1] : (prices[0] + prices[1]) / 2;
  } else {
    // Take median for multiple prices
    prices.sort((a, b) => a - b);
    basePrice = prices[Math.floor(prices.length / 2)];
  }

  // Convert annual to monthly if needed
  if (isAnnual && basePrice > 50) {
    basePrice = Math.round(basePrice / 12);
  }

  // Sanity check - if price seems annual (>$200/mo is suspicious), divide by 12
  if (basePrice > 200 && !/enterprise/i.test(cleaned)) {
    basePrice = Math.round(basePrice / 12);
  }

  return Math.round(basePrice);
}

/**
 * Extract pricing information from competitor analysis results
 * Returns a suggested price based on competitor data
 */
export function extractCompetitorPricing(competitors: {
  name: string;
  pricingModel: string | null;
  pricingRange: string | null;
}[]): PricingSuggestion {
  const pricingInfo: CompetitorPricingInfo[] = competitors.map(c => ({
    name: c.name,
    pricingModel: c.pricingModel,
    pricingRange: c.pricingRange,
    extractedPrice: extractMonthlyPrice(c.pricingRange),
  }));

  const pricesWithData = pricingInfo.filter(p => p.extractedPrice !== null);
  const prices = pricesWithData.map(p => p.extractedPrice!);

  // Collect unique pricing models
  const pricingModels = [...new Set(
    competitors
      .map(c => c.pricingModel)
      .filter((m): m is string => m !== null && m.length > 0)
  )];

  if (prices.length === 0) {
    return {
      medianPrice: null,
      averagePrice: null,
      priceRange: null,
      competitorsWithPricing: 0,
      totalCompetitors: competitors.length,
      suggestedPrice: 29, // Default fallback
      source: 'default',
      pricingModels,
      confidence: 'low',
    };
  }

  // Sort prices for median calculation
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length % 2 === 0
    ? Math.round((sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2)
    : sortedPrices[Math.floor(sortedPrices.length / 2)];

  const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };

  // Determine confidence based on data coverage
  const coverage = prices.length / competitors.length;
  const confidence: 'high' | 'medium' | 'low' =
    coverage >= 0.7 && prices.length >= 3 ? 'high' :
    coverage >= 0.4 && prices.length >= 2 ? 'medium' : 'low';

  // Use median as suggested price (more robust to outliers)
  return {
    medianPrice,
    averagePrice,
    priceRange,
    competitorsWithPricing: prices.length,
    totalCompetitors: competitors.length,
    suggestedPrice: medianPrice,
    source: 'competitors',
    pricingModels,
    confidence,
  };
}
