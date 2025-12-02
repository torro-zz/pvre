/**
 * Market Sizing Module
 * Uses Claude to perform Fermi estimation for TAM/SAM/SOM analysis.
 * Part of the Viability Verdict scoring system (25% weight in full formula).
 */

import { anthropic, getCurrentTracker } from "../anthropic";
import { trackUsage } from "./token-tracker";

export interface MarketSizingInput {
  hypothesis: string;
  geography?: string;
  targetPrice?: number;
  mscTarget?: number; // Minimum Success Criteria (revenue goal)
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
}

export async function calculateMarketSize(
  input: MarketSizingInput
): Promise<MarketSizingResult> {
  const geography = input.geography || "Global";
  const price = input.targetPrice || 29; // default $29/month
  const msc = input.mscTarget || 1000000; // default $1M ARR

  const prompt = `You are a market sizing expert. Perform a Fermi estimation for this business hypothesis.

HYPOTHESIS: "${input.hypothesis}"
TARGET GEOGRAPHY: ${geography}
ASSUMED PRICE: $${price}/month ($${price * 12}/year)
REVENUE GOAL (MSC): $${msc.toLocaleString()} ARR

Perform a bottom-up Fermi estimation:

1. TAM (Total Addressable Market)
   - Start with the total population or market
   - Apply relevant filters to get to everyone who COULD use this

2. SAM (Serviceable Available Market)
   - Filter TAM to those you can actually reach
   - Consider geography, language, channel access

3. SOM (Serviceable Obtainable Market)
   - Realistically, who can you capture in 2-3 years?
   - Consider competition, awareness, adoption rates

4. MSC Analysis
   - Customers needed = MSC / (price × 12)
   - Penetration required = customers needed / SOM
   - Is this achievable?

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

  // Parse JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse market sizing response");
  }

  const data = JSON.parse(jsonMatch[0]);

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
    suggestions: data.suggestions
  };
}
