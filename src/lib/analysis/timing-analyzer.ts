/**
 * Timing Analyzer Module
 * Uses Claude to identify market timing signals (tailwinds/headwinds).
 * Part of the Viability Verdict scoring system (15% weight in full formula).
 */

import { anthropic, getCurrentTracker } from "../anthropic";
import { trackUsage } from "./token-tracker";
import { parseClaudeJSON } from "../json-parse";

export interface TimingInput {
  hypothesis: string;
  industry?: string;
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
}

export async function analyzeTiming(
  input: TimingInput
): Promise<TimingResult> {
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const prompt = `You are a market timing analyst. Assess whether NOW is a good time to launch this business.

HYPOTHESIS: "${input.hypothesis}"
${input.industry ? `INDUSTRY: ${input.industry}` : ''}
CURRENT DATE: ${currentDate}

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

  return {
    score: data.timing_score,
    confidence: data.confidence,
    tailwinds: data.tailwinds || [],
    headwinds: data.headwinds || [],
    timingWindow: data.timing_window,
    verdict: data.verdict,
    trend: data.trend
  };
}
