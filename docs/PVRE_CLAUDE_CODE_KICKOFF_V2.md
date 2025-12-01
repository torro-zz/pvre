# PVRE - Claude Code Development Guide
## Pre-Validation Research Engine: Next Phase Implementation

*Last updated: 2025-11-30*

---

## 📍 CURRENT STATE

PVRE is at **~90% MVP complete**. The core pipeline works:

| Component | Status | Notes |
|-----------|--------|-------|
| Landing Page | ✅ Complete | Tech-forward design |
| Google OAuth | ✅ Complete | Via Supabase |
| Community Voice Mining | ✅ Complete | Arctic Shift + Claude |
| Pain Detection | ✅ Complete | 150+ keywords, WTP signals |
| Competitor Intelligence | ✅ Complete | AI-powered analysis |
| Viability Verdict | ⚠️ Partial | **Only 2/4 dimensions** |
| Interview Questions | ✅ Complete | Embedded in Community Voice |
| Research History | ✅ Complete | Dashboard with status |
| PDF Export | ❌ Not started | **Priority: HIGH** |
| Error Handling | ⚠️ Basic | Needs improvement |

### Critical Gap: Incomplete Viability Score

**Current Formula (2 dimensions):**
```javascript
VIABILITY_SCORE = (Pain × 0.58) + (Competition × 0.42)
```

**Target Formula (4 dimensions):**
```javascript
VIABILITY_SCORE = (Pain × 0.35) + (Market × 0.25) + (Competition × 0.25) + (Timing × 0.15)
```

**Missing:** Market Sizing + Timing modules

---

## 🎯 PHASE 1: LAUNCH-READY (This Week)

**Goal:** Complete the product so it can be put in front of 10 real users.

### Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Market Sizing module | 3-4 hrs | Completes viability score |
| P0 | Timing module | 2-3 hrs | Completes viability score |
| P0 | Update scoring to 4 dimensions | 1 hr | Core feature complete |
| P0 | Transparency UI for verdict | 3-4 hrs | Users understand WHY |
| P1 | PDF Export | 4-6 hrs | Users can take output with them |
| P1 | Error handling | 3-4 hrs | Graceful failures |
| P1 | New landing page | 1-2 hrs | Better conversion |

---

## 🔧 IMPLEMENTATION GUIDE

### Task 1: Market Sizing Module

**Location:** `src/lib/analysis/market-sizing.ts`

**Approach:** Use Claude to perform Fermi estimation. No external APIs needed for MVP.

```typescript
// src/lib/analysis/market-sizing.ts

import Anthropic from "@anthropic-ai/sdk";

interface MarketSizingInput {
  hypothesis: string;
  geography?: string;
  targetPrice?: number;
  mscTarget?: number; // Minimum Success Criteria (revenue goal)
}

interface MarketSizingResult {
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
  const client = new Anthropic();
  
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });

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
```

---

### Task 2: Timing Module

**Location:** `src/lib/analysis/timing-analyzer.ts`

**Approach:** Use Claude to identify tailwinds and headwinds. Google Trends can be added later.

```typescript
// src/lib/analysis/timing-analyzer.ts

import Anthropic from "@anthropic-ai/sdk";

interface TimingInput {
  hypothesis: string;
  industry?: string;
}

interface TimingResult {
  score: number; // 0-10
  confidence: 'high' | 'medium' | 'low';
  tailwinds: {
    signal: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }[];
  headwinds: {
    signal: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }[];
  timingWindow: string; // e.g., "12-18 months"
  verdict: string;
}

export async function analyzeTiming(
  input: TimingInput
): Promise<TimingResult> {
  const client = new Anthropic();

  const prompt = `You are a market timing analyst. Assess whether NOW is a good time to launch this business.

HYPOTHESIS: "${input.hypothesis}"
${input.industry ? `INDUSTRY: ${input.industry}` : ''}
CURRENT DATE: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

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
      "signal": "<short name>",
      "impact": "<high|medium|low>",
      "description": "<1-2 sentence explanation>"
    }
  ],
  "headwinds": [
    {
      "signal": "<short name>",
      "impact": "<high|medium|low>",
      "description": "<1-2 sentence explanation>"
    }
  ],
  "timing_window": "<e.g., 12-18 months>",
  "verdict": "<1-2 sentence assessment of timing>",
  "confidence": "<high|medium|low>"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse timing response");
  }

  const data = JSON.parse(jsonMatch[0]);

  return {
    score: data.timing_score,
    confidence: data.confidence,
    tailwinds: data.tailwinds,
    headwinds: data.headwinds,
    timingWindow: data.timing_window,
    verdict: data.verdict
  };
}
```

---

### Task 3: Update Viability Calculator

**Location:** `src/lib/analysis/viability-calculator.ts`

Update to use all 4 dimensions:

```typescript
// src/lib/analysis/viability-calculator.ts

interface ViabilityInput {
  painScore: number;
  painConfidence: string;
  competitionScore: number;
  competitionConfidence: string;
  marketScore?: number;
  marketConfidence?: string;
  timingScore?: number;
  timingConfidence?: string;
}

interface ViabilityResult {
  totalScore: number;
  verdict: 'strong' | 'mixed' | 'weak' | 'none';
  color: 'green' | 'yellow' | 'orange' | 'red';
  recommendation: string;
  dimensions: {
    name: string;
    score: number;
    weight: number;
    weightedScore: number;
    status: 'strong' | 'okay' | 'weak' | 'dealbreaker';
  }[];
  weakestDimension: string;
  dealbreakers: string[];
  confidence: 'high' | 'medium' | 'low' | 'very_low';
}

export function calculateViability(input: ViabilityInput): ViabilityResult {
  // Determine which dimensions we have
  const hasMarket = input.marketScore !== undefined;
  const hasTiming = input.timingScore !== undefined;
  
  // Full weights
  const fullWeights = {
    pain: 0.35,
    market: 0.25,
    competition: 0.25,
    timing: 0.15
  };
  
  // Calculate active weights (normalize to available dimensions)
  let activeWeights: Record<string, number> = {};
  let totalWeight = fullWeights.pain + fullWeights.competition;
  
  if (hasMarket) totalWeight += fullWeights.market;
  if (hasTiming) totalWeight += fullWeights.timing;
  
  activeWeights.pain = fullWeights.pain / totalWeight;
  activeWeights.competition = fullWeights.competition / totalWeight;
  if (hasMarket) activeWeights.market = fullWeights.market / totalWeight;
  if (hasTiming) activeWeights.timing = fullWeights.timing / totalWeight;
  
  // Calculate weighted scores
  const dimensions: ViabilityResult['dimensions'] = [
    {
      name: 'Pain',
      score: input.painScore,
      weight: activeWeights.pain,
      weightedScore: input.painScore * activeWeights.pain,
      status: getDimensionStatus(input.painScore)
    },
    {
      name: 'Competition',
      score: input.competitionScore,
      weight: activeWeights.competition,
      weightedScore: input.competitionScore * activeWeights.competition,
      status: getDimensionStatus(input.competitionScore)
    }
  ];
  
  if (hasMarket) {
    dimensions.push({
      name: 'Market',
      score: input.marketScore!,
      weight: activeWeights.market!,
      weightedScore: input.marketScore! * activeWeights.market!,
      status: getDimensionStatus(input.marketScore!)
    });
  }
  
  if (hasTiming) {
    dimensions.push({
      name: 'Timing',
      score: input.timingScore!,
      weight: activeWeights.timing!,
      weightedScore: input.timingScore! * activeWeights.timing!,
      status: getDimensionStatus(input.timingScore!)
    });
  }
  
  // Calculate total
  const totalScore = dimensions.reduce((sum, d) => sum + d.weightedScore, 0);
  
  // Find weakest dimension
  const sortedDimensions = [...dimensions].sort((a, b) => a.score - b.score);
  const weakestDimension = sortedDimensions[0].name;
  
  // Check for dealbreakers (any dimension < 3)
  const dealbreakers = dimensions
    .filter(d => d.score < 3)
    .map(d => d.name);
  
  // Determine verdict
  let verdict: ViabilityResult['verdict'];
  let color: ViabilityResult['color'];
  let recommendation: string;
  
  if (totalScore >= 7.5) {
    verdict = 'strong';
    color = 'green';
    recommendation = 'Proceed to customer interviews with confidence. Your hypothesis shows strong indicators across all dimensions.';
  } else if (totalScore >= 5.0) {
    verdict = 'mixed';
    color = 'yellow';
    recommendation = `Promising but needs refinement. Focus on improving ${weakestDimension} before investing heavily.`;
  } else if (totalScore >= 2.5) {
    verdict = 'weak';
    color = 'orange';
    recommendation = 'Significant concerns detected. Consider pivoting the hypothesis or validating core assumptions before proceeding.';
  } else {
    verdict = 'none';
    color = 'red';
    recommendation = 'This hypothesis is unlikely to be viable. Recommend pivoting to a different problem or market.';
  }
  
  // Override recommendation if dealbreakers exist
  if (dealbreakers.length > 0) {
    recommendation = `⚠️ DEALBREAKER: ${dealbreakers.join(', ')} scored critically low (<3). Address this before proceeding. ${recommendation}`;
  }
  
  // Calculate overall confidence
  const confidences = [input.painConfidence, input.competitionConfidence];
  if (input.marketConfidence) confidences.push(input.marketConfidence);
  if (input.timingConfidence) confidences.push(input.timingConfidence);
  
  const confidence = getOverallConfidence(confidences);
  
  return {
    totalScore: Math.round(totalScore * 10) / 10,
    verdict,
    color,
    recommendation,
    dimensions,
    weakestDimension,
    dealbreakers,
    confidence
  };
}

function getDimensionStatus(score: number): 'strong' | 'okay' | 'weak' | 'dealbreaker' {
  if (score >= 7) return 'strong';
  if (score >= 5) return 'okay';
  if (score >= 3) return 'weak';
  return 'dealbreaker';
}

function getOverallConfidence(confidences: string[]): 'high' | 'medium' | 'low' | 'very_low' {
  const values = { high: 3, medium: 2, low: 1, very_low: 0 };
  const avg = confidences.reduce((sum, c) => sum + (values[c as keyof typeof values] || 1), 0) / confidences.length;
  
  if (avg >= 2.5) return 'high';
  if (avg >= 1.5) return 'medium';
  if (avg >= 0.5) return 'low';
  return 'very_low';
}
```

---

### Task 4: Update Community Voice API Route

**Location:** `src/app/api/research/community-voice/route.ts`

Add Market Sizing and Timing calls to the pipeline:

```typescript
// Add these imports
import { calculateMarketSize } from "@/lib/analysis/market-sizing";
import { analyzeTiming } from "@/lib/analysis/timing-analyzer";

// In the main POST handler, after competitor analysis:

// Step 5: Market Sizing (new)
console.log("Step 5: Calculating market size...");
const marketSizing = await calculateMarketSize({
  hypothesis,
  geography: "Global", // Could be extracted from hypothesis
  targetPrice: 29,
  mscTarget: 1000000
});

// Step 6: Timing Analysis (new)
console.log("Step 6: Analyzing timing...");
const timing = await analyzeTiming({
  hypothesis
});

// Step 7: Calculate final viability with all 4 dimensions
const viability = calculateViability({
  painScore: painAnalysis.painScore,
  painConfidence: painAnalysis.dataConfidence,
  competitionScore: competitorAnalysis.competitionScore,
  competitionConfidence: 'medium',
  marketScore: marketSizing.score,
  marketConfidence: marketSizing.confidence,
  timingScore: timing.score,
  timingConfidence: timing.confidence
});

// Include in response
return NextResponse.json({
  ...existingResponse,
  marketSizing,
  timing,
  viability
});
```

---

### Task 5: Transparency UI Component

**Location:** `src/components/research/viability-verdict.tsx`

Add a breakdown section showing WHY the user got their score:

```tsx
// Add this section inside the ViabilityVerdict component

interface DimensionBreakdownProps {
  dimensions: {
    name: string;
    score: number;
    weight: number;
    status: string;
  }[];
  painDetails?: {
    highIntensityCount: number;
    wtpSignalCount: number;
    postsAnalyzed: number;
  };
  marketDetails?: {
    som: number;
    customersNeeded: number;
    penetrationRequired: number;
  };
  competitionDetails?: {
    competitorCount: number;
    gapsFound: number;
    avgSatisfaction: number;
  };
  timingDetails?: {
    tailwindsCount: number;
    headwindsCount: number;
    timingWindow: string;
  };
}

function DimensionBreakdown({ 
  dimensions, 
  painDetails,
  marketDetails,
  competitionDetails,
  timingDetails 
}: DimensionBreakdownProps) {
  return (
    <div className="mt-6 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">What Drove This Score</h3>
      
      <div className="space-y-4">
        {dimensions.map((dim) => (
          <div key={dim.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{dim.name} Score</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm px-2 py-0.5 rounded ${
                  dim.status === 'strong' ? 'bg-green-500/20 text-green-400' :
                  dim.status === 'okay' ? 'bg-yellow-500/20 text-yellow-400' :
                  dim.status === 'weak' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {dim.score.toFixed(1)}/10
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  dim.status === 'strong' ? 'bg-green-500' :
                  dim.status === 'okay' ? 'bg-yellow-500' :
                  dim.status === 'weak' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${dim.score * 10}%` }}
              />
            </div>
            
            {/* Dimension-specific details */}
            {dim.name === 'Pain' && painDetails && (
              <div className="text-sm text-zinc-500 space-y-1 pl-4 border-l-2 border-zinc-800">
                <p>• High-intensity keywords: {painDetails.highIntensityCount} posts</p>
                <p>• WTP signals detected: {painDetails.wtpSignalCount} posts</p>
                <p>• Data confidence: {painDetails.postsAnalyzed}+ posts analyzed</p>
              </div>
            )}
            
            {dim.name === 'Market' && marketDetails && (
              <div className="text-sm text-zinc-500 space-y-1 pl-4 border-l-2 border-zinc-800">
                <p>• SOM estimate: {marketDetails.som.toLocaleString()} customers</p>
                <p>• You need: {marketDetails.customersNeeded.toLocaleString()} for goal</p>
                <p>• Required penetration: {marketDetails.penetrationRequired.toFixed(1)}%</p>
              </div>
            )}
            
            {dim.name === 'Competition' && competitionDetails && (
              <div className="text-sm text-zinc-500 space-y-1 pl-4 border-l-2 border-zinc-800">
                <p>• Direct competitors: {competitionDetails.competitorCount}</p>
                <p>• Market gaps found: {competitionDetails.gapsFound}</p>
                <p>• Avg user satisfaction: {competitionDetails.avgSatisfaction.toFixed(1)}/5</p>
              </div>
            )}
            
            {dim.name === 'Timing' && timingDetails && (
              <div className="text-sm text-zinc-500 space-y-1 pl-4 border-l-2 border-zinc-800">
                <p>• Tailwinds identified: {timingDetails.tailwindsCount}</p>
                <p>• Headwinds identified: {timingDetails.headwindsCount}</p>
                <p>• Timing window: {timingDetails.timingWindow}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Weakest dimension callout */}
      <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-sm text-amber-400">
          <strong>⚠️ Focus Area:</strong> {dimensions.sort((a, b) => a.score - b.score)[0].name} is your weakest dimension. 
          Improving this will have the biggest impact on your viability score.
        </p>
      </div>
    </div>
  );
}
```

---

### Task 6: PDF Export

**Location:** `src/lib/pdf/report-generator.ts`

Install dependencies first:
```bash
npm install jspdf html2canvas
```

```typescript
// src/lib/pdf/report-generator.ts

import jsPDF from 'jspdf';

interface ReportData {
  hypothesis: string;
  viability: {
    totalScore: number;
    verdict: string;
    recommendation: string;
    dimensions: { name: string; score: number }[];
  };
  painAnalysis: {
    painScore: number;
    themes: { title: string; intensity: string; postCount: number }[];
    topQuotes: string[];
  };
  competitors: {
    name: string;
    threatLevel: string;
    strengths: string[];
    weaknesses: string[];
  }[];
  marketSizing?: {
    tam: { value: number; description: string };
    sam: { value: number; description: string };
    som: { value: number; description: string };
  };
  timing?: {
    tailwinds: { signal: string; description: string }[];
    headwinds: { signal: string; description: string }[];
  };
  interviewQuestions: {
    context: string[];
    problem: string[];
    solution: string[];
  };
  createdAt: string;
}

export function generatePDFReport(data: ReportData): jsPDF {
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  
  // Helper function for text wrapping
  const addWrappedText = (text: string, fontSize: number, maxWidth: number = contentWidth) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * (fontSize * 0.5) + 5;
  };
  
  // Helper for new page check
  const checkNewPage = (neededSpace: number = 40) => {
    if (y > doc.internal.pageSize.getHeight() - neededSpace) {
      doc.addPage();
      y = 20;
    }
  };
  
  // === PAGE 1: Executive Summary ===
  
  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PVRE Research Report', margin, y);
  y += 15;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128);
  doc.text(`Generated: ${data.createdAt}`, margin, y);
  y += 15;
  
  // Hypothesis
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Hypothesis', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  addWrappedText(data.hypothesis, 11);
  y += 10;
  
  // Viability Verdict Box
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 50, 'F');
  
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Viability Verdict', margin + 5, y);
  y += 10;
  
  doc.setFontSize(28);
  const verdictColor = data.viability.verdict === 'strong' ? [34, 197, 94] :
                       data.viability.verdict === 'mixed' ? [234, 179, 8] :
                       data.viability.verdict === 'weak' ? [249, 115, 22] :
                       [239, 68, 68];
  doc.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.text(`${data.viability.totalScore.toFixed(1)}/10`, margin + 5, y);
  
  doc.setFontSize(14);
  doc.text(data.viability.verdict.toUpperCase() + ' SIGNAL', margin + 50, y);
  y += 15;
  
  doc.setTextColor(0);
  doc.setFontSize(10);
  addWrappedText(data.viability.recommendation, 10, contentWidth - 10);
  y += 20;
  
  // Dimension scores
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Dimension Breakdown', margin, y);
  y += 10;
  
  doc.setFont('helvetica', 'normal');
  data.viability.dimensions.forEach(dim => {
    doc.text(`${dim.name}: ${dim.score.toFixed(1)}/10`, margin, y);
    y += 7;
  });
  
  // === PAGE 2: Pain Analysis ===
  doc.addPage();
  y = 20;
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Community Voice Analysis', margin, y);
  y += 15;
  
  doc.setFontSize(12);
  doc.text(`Pain Score: ${data.painAnalysis.painScore.toFixed(1)}/10`, margin, y);
  y += 15;
  
  doc.setFontSize(14);
  doc.text('Top Pain Themes', margin, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  data.painAnalysis.themes.slice(0, 5).forEach(theme => {
    checkNewPage();
    doc.text(`• ${theme.title} (${theme.intensity}, ${theme.postCount} posts)`, margin, y);
    y += 7;
  });
  y += 10;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Quotes', margin, y);
  y += 10;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  data.painAnalysis.topQuotes.slice(0, 5).forEach(quote => {
    checkNewPage();
    addWrappedText(`"${quote}"`, 9);
    y += 5;
  });
  
  // === PAGE 3: Competitors ===
  doc.addPage();
  y = 20;
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Competitive Landscape', margin, y);
  y += 15;
  
  data.competitors.slice(0, 5).forEach(comp => {
    checkNewPage(50);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${comp.name} (${comp.threatLevel} threat)`, margin, y);
    y += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    if (comp.strengths.length > 0) {
      doc.text('Strengths: ' + comp.strengths.slice(0, 2).join(', '), margin + 5, y);
      y += 6;
    }
    if (comp.weaknesses.length > 0) {
      doc.text('Weaknesses: ' + comp.weaknesses.slice(0, 2).join(', '), margin + 5, y);
      y += 6;
    }
    y += 5;
  });
  
  // === PAGE 4: Interview Questions ===
  doc.addPage();
  y = 20;
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Interview Questions', margin, y);
  y += 15;
  
  const questionSections = [
    { title: 'Context Questions', questions: data.interviewQuestions.context },
    { title: 'Problem Exploration', questions: data.interviewQuestions.problem },
    { title: 'Solution Testing', questions: data.interviewQuestions.solution }
  ];
  
  questionSections.forEach(section => {
    checkNewPage(40);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    section.questions.forEach((q, i) => {
      checkNewPage();
      addWrappedText(`${i + 1}. ${q}`, 10);
    });
    y += 5;
  });
  
  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text('Generated by PVRE - Pre-Validation Research Engine', margin, doc.internal.pageSize.getHeight() - 10);
  
  return doc;
}

// Usage in component:
// const doc = generatePDFReport(reportData);
// doc.save(`pvre-report-${hypothesis.slice(0, 30)}.pdf`);
```

---

### Task 7: Error Handling

**Location:** `src/lib/errors.ts` and update API routes

```typescript
// src/lib/errors.ts

export class PVREError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public recoverable: boolean = true,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'PVREError';
  }
}

export const ErrorCodes = {
  ARCTIC_SHIFT_UNAVAILABLE: {
    code: 'ARCTIC_SHIFT_UNAVAILABLE',
    message: 'Reddit data source is temporarily unavailable',
    suggestion: 'Please try again in a few minutes',
    recoverable: true
  },
  CLAUDE_API_ERROR: {
    code: 'CLAUDE_API_ERROR',
    message: 'AI analysis service encountered an error',
    suggestion: 'Please try again. If the problem persists, try a simpler hypothesis',
    recoverable: true
  },
  NO_POSTS_FOUND: {
    code: 'NO_POSTS_FOUND',
    message: 'No relevant discussions found for this hypothesis',
    suggestion: 'Try broader search terms or different keywords',
    recoverable: false
  },
  LOW_DATA_QUALITY: {
    code: 'LOW_DATA_QUALITY',
    message: 'Very few relevant posts found',
    suggestion: 'Results may be unreliable. Consider expanding your hypothesis scope',
    recoverable: false
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a moment',
    suggestion: 'Wait 30 seconds and try again',
    recoverable: true
  },
  AUTH_REQUIRED: {
    code: 'AUTH_REQUIRED',
    message: 'Authentication required',
    suggestion: 'Please sign in to continue',
    recoverable: false
  }
} as const;

// Retry wrapper for API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry non-recoverable errors
      if (error instanceof PVREError && !error.recoverable) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}
```

Update API routes to use error handling:

```typescript
// In API routes, wrap calls:
import { withRetry, PVREError, ErrorCodes } from '@/lib/errors';

// Example usage:
try {
  const posts = await withRetry(
    () => fetchRedditPosts(subreddits, keywords),
    3,
    1000
  );
  
  if (posts.length === 0) {
    throw new PVREError(
      ErrorCodes.NO_POSTS_FOUND.message,
      ErrorCodes.NO_POSTS_FOUND.code,
      404,
      false,
      ErrorCodes.NO_POSTS_FOUND.suggestion
    );
  }
  
  if (posts.length < 20) {
    // Continue but flag low confidence
    console.warn('Low data quality warning');
  }
  
} catch (error) {
  if (error instanceof PVREError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
      suggestion: error.suggestion,
      recoverable: error.recoverable
    }, { status: error.statusCode });
  }
  
  // Unknown error
  return NextResponse.json({
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    suggestion: 'Please try again or contact support'
  }, { status: 500 });
}
```

---

## 📅 THIS WEEK'S SPRINT

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Day 1** | Market Sizing module | `market-sizing.ts` working, API integrated |
| **Day 2** | Timing module + scoring | `timing-analyzer.ts` working, 4-dimension verdict |
| **Day 3** | Transparency UI | Breakdown component showing why scores |
| **Day 4** | PDF Export | Download button working with full report |
| **Day 5** | Error handling | Graceful failures, retry logic, user messages |
| **Day 6** | New landing page + Polish | Conversion-optimized LP live |
| **Day 7** | Testing + Launch prep | 5 test runs, fix issues, first user outreach |

---

## 🚀 PHASE 2: USER FEEDBACK (Weeks 2-3)

**After Phase 1, focus on getting users:**

### User Acquisition Channels
- Reddit: r/startups, r/entrepreneur, r/SaaS
- LinkedIn: Post about what you're building
- Indie Hackers: Share your journey
- Personal network: Founder friends

### Outreach Template
```
Hey [name],

I built a tool that does in 5 minutes what used to take me 
30+ hours: pre-validation research for business ideas.

It mines Reddit for pain signals, maps competitors, and 
tells you if an idea is worth pursuing—before you build.

Would you be up for trying it on your next idea? 
Free, no strings attached. I just want honest feedback.

[Link]
```

### Instrumentation (Before Users Arrive)
```typescript
// Key events to track
track('research_started', { hypothesis_length, user_id })
track('research_completed', { viability_score, duration_seconds })
track('pdf_downloaded', { job_id })
track('verdict_section_expanded', { dimension })
track('research_abandoned', { step, error? })
```

### Feedback Collection
After each research run, ask:
1. On a scale of 1-10, how useful was this research?
2. What was most valuable? (open text)
3. What was missing? (open text)
4. Would you pay for this? How much? (ranges)

---

## 📊 PHASE 3: GROWTH (Weeks 4-6)

Based on Phase 2 learnings, prioritize from:

### If Users Want More Data Depth:
- Google Trends integration (timing enhancement)
- G2/Capterra review scraping (competitor enhancement)
- Twitter/X mining (pain signal enhancement)

### If Users Want Better Output:
- Shareable report links (public URLs)
- Markdown export (for Notion)
- Slide deck export (for pitches)

### If Users Want to Track Progress:
- Re-run research and compare scores
- Historical tracking dashboard
- "Ideas" workspace with multiple hypotheses

### Technical Foundations:
- Test suite (Jest/Vitest)
- Error monitoring (Sentry)
- Performance optimization

---

## 💰 PRICING STRATEGY

**Recommended approach:** Free for first 20 users, then add Stripe.

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 3 researches/month |
| Pro | $29/mo | 20 researches/month |
| Team | $79/mo | Unlimited + team features |

**Unit economics:**
- Cost per research: ~$0.10
- Margin at $29/month with 20 runs: $27/mo (93%)

---

## ⚙️ ENVIRONMENT VARIABLES

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic (Required)
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🧪 TESTING CHECKLIST

Before launch, run these scenarios:

| Test | Expected Result |
|------|-----------------|
| Enter short hypothesis (3 words) | Should work, but suggest expansion |
| Enter very long hypothesis (100+ words) | Should work, extract key concepts |
| Enter hypothesis with no Reddit data | Graceful error with suggestion |
| Enter hypothesis with lots of data | Complete in 60-90 seconds |
| Arctic Shift is slow | Progress updates, doesn't time out |
| Claude API error | Retry 3x, then graceful error |
| Download PDF | All sections render correctly |
| Mobile view | Responsive, usable on phone |
| Multiple tabs open | Each research independent |

---

## 📞 SUPPORT

For questions during development:
1. Check this document first
2. Review the Technical Overview (CLAUDE.md)
3. Search existing code for patterns
4. Ask in the next chat session

---

*Document version: 2.0 (2025-11-30)*
*Next update: After Phase 1 completion*
