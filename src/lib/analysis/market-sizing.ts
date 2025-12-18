/**
 * Market Sizing Module
 * Uses Claude to perform Fermi estimation for TAM/SAM/SOM analysis.
 * Part of the Viability Verdict scoring system (25% weight in full formula).
 */

import { anthropic, getCurrentTracker } from "../anthropic";
import { trackUsage } from "./token-tracker";
import { parseClaudeJSON } from "../json-parse";

// Re-export pricing utilities for backwards compatibility
export {
  extractMonthlyPrice,
  extractCompetitorPricing,
  type CompetitorPricingInfo,
  type PricingSuggestion,
} from './pricing-utils';

export type GeographyScope = 'local' | 'national' | 'global';

export interface MarketSizingInput {
  hypothesis: string;
  geography?: string;           // Location string (e.g., "London, UK" or "United States")
  geographyScope?: GeographyScope; // Scoping level for TAM/SAM/SOM
  targetPrice?: number;
  mscTarget?: number; // Minimum Success Criteria (revenue goal)
}

export interface PricingScenario {
  price: number; // Monthly price
  label: string; // e.g., "Budget", "Standard", "Premium"
  customersNeeded: number;
  penetrationRequired: number; // percentage
  achievability: 'highly_achievable' | 'achievable' | 'challenging' | 'difficult' | 'unlikely';
  isUserPrice: boolean; // True if this is the user's selected price
}

export interface MarketSizingResult {
  score: number; // 0-10
  confidence: 'high' | 'medium' | 'low' | 'very_low';
  tam: {
    value: number;
    description: string;
    reasoning: string;
  };
  sam: {
    value: number;
    description: string;
    reasoning: string;
  };
  som: {
    value: number;
    description: string;
    reasoning: string;
  };
  mscAnalysis: {
    customersNeeded: number;
    penetrationRequired: number; // percentage
    verdict: string;
    achievability: 'highly_achievable' | 'achievable' | 'challenging' | 'difficult' | 'unlikely';
  };
  suggestions: string[];
  // New: Pricing scenarios for comparison
  pricingScenarios?: PricingScenario[];
}

export async function calculateMarketSize(
  input: MarketSizingInput
): Promise<MarketSizingResult> {
  const geography = input.geography || "Global";
  const scope = input.geographyScope || "global";
  const price = input.targetPrice || 29; // default $29/month
  const msc = input.mscTarget || 1000000; // default $1M ARR

  // Build scoping instructions based on geography scope
  let scopingRules = "";
  if (scope === "local") {
    scopingRules = `
GEOGRAPHIC SCOPING (Local/City Target):
- TAM: National market (${geography} country)
- SAM: Regional market around ${geography}
- SOM: ${geography} city/metro area - realistic Year 1 capture
This is for a founder launching in a specific city. Use LOCAL numbers, not global.`;
  } else if (scope === "national") {
    scopingRules = `
GEOGRAPHIC SCOPING (National Target):
- TAM: Continental/regional market (e.g., Europe, North America)
- SAM: ${geography} national market
- SOM: Realistic Year 1 capture within ${geography}
This is for a founder launching nationally. Use NATIONAL numbers, not global.`;
  } else {
    scopingRules = `
GEOGRAPHIC SCOPING (Global/Online Target):
- TAM: Worldwide market for this problem
- SAM: Accessible markets (English-speaking, online access, etc.)
- SOM: Realistic Year 1 capture with online marketing
This is for an online business with no geographic constraints.`;
  }

  const prompt = `You are a market sizing expert. Perform a Fermi estimation for this business hypothesis.

HYPOTHESIS: "${input.hypothesis}"
TARGET GEOGRAPHY: ${geography}
GEOGRAPHIC SCOPE: ${scope.toUpperCase()}
ASSUMED PRICE: $${price}/month ($${price * 12}/year)
REVENUE GOAL (MSC): $${msc.toLocaleString()} ARR
${scopingRules}

CRITICAL: Founders need ACTIONABLE numbers for their target market, not vanity global TAM figures.
If targeting London, give London numbers. If targeting USA, give USA numbers.

Perform a bottom-up Fermi estimation:

1. TAM (Total Addressable Market)
   - Scope according to the GEOGRAPHIC SCOPING rules above
   - Apply relevant filters to get to everyone who COULD use this

2. SAM (Serviceable Available Market)
   - Filter TAM to those you can actually reach
   - Consider geography, language, channel access

3. SOM (Serviceable Obtainable Market)
   - Realistically, who can you capture in Year 1?
   - Consider competition, awareness, adoption rates
   - This should be a LOCAL, ACHIEVABLE number

4. MSC Analysis
   - Customers needed = MSC / (price × 12)
   - Penetration required = customers needed / SOM
   - Is this achievable in the TARGET GEOGRAPHY?

SCORING GUIDE for market_score (0-10):
- Penetration < 5% needed → 9/10 (highly achievable)
- Penetration 5-10% needed → 7.5/10 (achievable)
- Penetration 10-25% needed → 5.5/10 (challenging)
- Penetration 25-50% needed → 3.5/10 (difficult)
- Penetration > 50% needed → 1.5/10 (unlikely viable)

Respond with ONLY valid JSON in this exact format:
{
  "tam": {
    "value": <number>,
    "description": "<one line description>",
    "reasoning": "<2-3 sentence explanation of how you got here>"
  },
  "sam": {
    "value": <number>,
    "description": "<one line description>",
    "reasoning": "<2-3 sentence explanation>"
  },
  "som": {
    "value": <number>,
    "description": "<one line description>",
    "reasoning": "<2-3 sentence explanation>"
  },
  "customers_needed": <number>,
  "penetration_required": <decimal, e.g. 0.15 for 15%>,
  "market_score": <number 0-10>,
  "achievability": "<highly_achievable|achievable|challenging|difficult|unlikely>",
  "verdict": "<one sentence assessment>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>"],
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
    market_score: number;
    confidence: 'high' | 'medium' | 'low';
    tam: { value: number; description: string; reasoning: string };
    sam: { value: number; description: string; reasoning: string };
    som: { value: number; description: string; reasoning: string };
    customers_needed: number;
    penetration_required: number;
    verdict: string;
    achievability: 'highly_achievable' | 'achievable' | 'challenging' | 'difficult' | 'unlikely';
    suggestions?: string[];
  }>(content.text, 'market sizing');

  // Generate pricing scenarios to help user understand pricing impact
  const somValue = data.som.value;
  const pricingScenarios = generatePricingScenarios(price, msc, somValue);

  return {
    score: data.market_score,
    confidence: data.confidence,
    tam: data.tam,
    sam: data.sam,
    som: data.som,
    mscAnalysis: {
      customersNeeded: data.customers_needed,
      penetrationRequired: data.penetration_required * 100,
      verdict: data.verdict,
      achievability: data.achievability
    },
    suggestions: data.suggestions || [],
    pricingScenarios,
  };
}

/**
 * Get achievability rating based on penetration percentage
 */
function getAchievability(penetration: number): PricingScenario['achievability'] {
  if (penetration < 5) return 'highly_achievable';
  if (penetration < 10) return 'achievable';
  if (penetration < 25) return 'challenging';
  if (penetration < 50) return 'difficult';
  return 'unlikely';
}

/**
 * Generate pricing scenarios for comparison
 * Shows how different price points affect achievability
 */
function generatePricingScenarios(
  userPrice: number,
  mscTarget: number,
  somValue: number
): PricingScenario[] {
  // Define standard price tiers
  const priceTiers = [
    { price: 15, label: 'Budget' },
    { price: 29, label: 'Standard' },
    { price: 49, label: 'Professional' },
    { price: 99, label: 'Premium' },
    { price: 199, label: 'Enterprise' },
  ];

  // Add user's price if it's not already in the tiers
  const userPriceNormalized = Math.round(userPrice);
  const existingTier = priceTiers.find(t => t.price === userPriceNormalized);
  if (!existingTier && userPrice > 0) {
    priceTiers.push({ price: userPriceNormalized, label: 'Your Price' });
    priceTiers.sort((a, b) => a.price - b.price);
  }

  // Calculate scenarios
  const scenarios: PricingScenario[] = priceTiers.map(tier => {
    const annualPrice = tier.price * 12;
    const customersNeeded = Math.ceil(mscTarget / annualPrice);
    const penetrationRequired = somValue > 0 ? (customersNeeded / somValue) * 100 : 100;

    return {
      price: tier.price,
      label: tier.label,
      customersNeeded,
      penetrationRequired: Math.round(penetrationRequired * 10) / 10,
      achievability: getAchievability(penetrationRequired),
      isUserPrice: tier.price === userPriceNormalized || tier.label === 'Your Price',
    };
  });

  // Filter to show only relevant scenarios (3-5 around the user's price)
  // Include: user's price + 2 lower + 2 higher if available
  const userIndex = scenarios.findIndex(s => s.isUserPrice);
  if (userIndex === -1) return scenarios.slice(0, 5);

  const startIndex = Math.max(0, userIndex - 2);
  const endIndex = Math.min(scenarios.length, startIndex + 5);

  return scenarios.slice(startIndex, endIndex);
}
