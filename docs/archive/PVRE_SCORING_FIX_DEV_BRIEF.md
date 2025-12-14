# PVRE Scoring System: Critical Fixes Required

**Date:** December 14, 2025  
**Priority:** HIGH  
**Context:** CEO + PM analysis of viability scoring accuracy

---

## Executive Summary

Testing revealed that PVRE gives inflated scores to unviable business ideas. A deliberately bad hypothesis ("water reminder app for busy professionals") received 6.4/10 when it should have scored 2-3/10 with a "Do Not Pursue" verdict.

**Root causes identified:**
1. Market Score inflated by TAM size regardless of willingness-to-pay
2. Relevance filter catches domain but misses specific problem mismatch
3. Zero WTP signals don't trigger score penalty
4. No mechanism for competition saturation to kill a verdict
5. Red flags buried instead of surfaced prominently

---

## Test Case Evidence

**Hypothesis tested:** "An app that sends daily reminders to drink water for busy professionals"

**Expected result:** Score 2-4/10, verdict "Do Not Pursue"

**Actual result:** Score 6.4/10, verdict "Mixed Signal - conduct user interviews"

| Metric | Value | Problem |
|--------|-------|---------|
| WTP Signals | 0 | Should have killed the score |
| Relevant pain signals | ~2 of 10 | 80% were about taste, filters, unrelated topics |
| Market Score | 9.0/10 | Based on fantasy TAM of 800M |
| Free alternatives | Many (phone timers, free apps) | Not weighted in scoring |
| Filter rate | 95.2% | Very narrow signal, should flag concern |

---

## P0 Fixes (Critical)

### Fix 1: WTP Kill Switch

**Current behavior:** WTP signals are recorded but don't affect scoring

**Required behavior:**
```javascript
// After pain analysis completes
if (wtpSignals === 0 && totalSignals < 20) {
  // Cap the overall viability score
  viabilityScore = Math.min(viabilityScore, 5.0);
  
  // Override verdict
  verdict = "WEAK SIGNAL";
  verdictDescription = "No purchase intent detected. Validate willingness-to-pay before proceeding.";
  
  // Add prominent warning
  redFlags.push({
    severity: "HIGH",
    message: "Zero willingness-to-pay signals found in community data"
  });
}
```

**Rationale:** Pain without WTP = hobby problem, not business opportunity. This single fix would have dropped the water app from 6.4 to 5.0 maximum.

---

### Fix 2: Market Score Adjustment Factors

**Current formula:** `marketScore = f(TAM, SAM, SOM)`

**Required formula:**
```javascript
function calculateAdjustedMarketScore(rawMarketScore, analysis) {
  let adjustedScore = rawMarketScore;
  
  // Factor 1: WTP Evidence
  const wtpCount = analysis.signals.filter(s => s.willingnessToPaySignal).length;
  if (wtpCount === 0) {
    adjustedScore *= 0.3;  // Severe penalty
  } else if (wtpCount <= 3) {
    adjustedScore *= 0.6;  // Moderate penalty
  }
  // wtpCount > 3: no penalty
  
  // Factor 2: Problem Severity
  const avgIntensity = calculateAverageIntensity(analysis.signals);
  if (avgIntensity < 0.4) {  // Trivial/convenience problem
    adjustedScore *= 0.5;
  } else if (avgIntensity < 0.7) {  // Moderate frustration
    adjustedScore *= 0.8;
  }
  // High intensity: no penalty
  
  // Factor 3: Free Alternatives
  const hasFreeAlternatives = analysis.competitors.some(c => 
    c.pricing === 'free' || c.hasFreeVersion === true
  );
  if (hasFreeAlternatives) {
    adjustedScore *= 0.5;
  }
  
  return Math.max(adjustedScore, 1.0);  // Floor at 1.0
}
```

**Example for water reminder app:**
- Raw market score: 9.0
- WTP factor (0 signals): × 0.3 = 2.7
- Severity (trivial): × 0.5 = 1.35
- Free alternatives (yes): × 0.5 = 0.675
- **Adjusted market score: 0.7/10** (rounds to 1.0)

This alone would drop the overall from 6.4 to approximately **3.5/10**.

---

### Fix 3: Two-Stage Relevance Filter

**Current behavior:** Filter checks if post relates to the DOMAIN (e.g., "hydration", "water", "office")

**Required behavior:** Add second stage checking if post relates to the SPECIFIC PROBLEM

**Stage 1 prompt (keep as-is):**
```
Does this post relate to [domain keywords]?
```

**Stage 2 prompt (add):**
```
The user's hypothesis is: [full hypothesis]
The specific PROBLEM they want to solve is: [extracted problem statement]

This post passed domain relevance. Now determine:
Does this post describe someone experiencing the SPECIFIC PROBLEM above?

Examples of MATCH:
- Hypothesis problem: "forgetting to drink water during busy workdays"
- Post: "I get so absorbed in meetings I realize at 5pm I haven't had water all day"
- Result: MATCH ✓

Examples of MISMATCH:
- Hypothesis problem: "forgetting to drink water during busy workdays"  
- Post: "I don't like the taste of plain water"
- Result: MISMATCH ✗ (this is about taste preference, not forgetting)

Respond with: MATCH or MISMATCH
```

**Implementation:**
```javascript
async function twoStageRelevanceFilter(post, hypothesis) {
  // Stage 1: Domain relevance (existing)
  const domainRelevant = await checkDomainRelevance(post, hypothesis.keywords);
  if (!domainRelevant) return { relevant: false, stage: 1 };
  
  // Stage 2: Problem relevance (new)
  const problemRelevant = await checkProblemRelevance(post, hypothesis.problemStatement);
  if (!problemRelevant) {
    return { 
      relevant: false, 
      stage: 2, 
      reason: "domain_match_problem_mismatch"
    };
  }
  
  return { relevant: true };
}
```

**Reporting:** Track stage 2 filter rate separately. If >50% of stage 1 passes fail stage 2, flag as "narrow problem definition" in report.

---

## P1 Fixes (High Priority)

### Fix 4: Add "Do Not Pursue" Verdict Tier

**Current verdict tiers:**
- STRONG SIGNAL (8+)
- MIXED SIGNAL (5-7.9)  
- LIMITED DATA (low sample size)

**Required verdict tiers:**
```javascript
function getVerdict(score, dataQuality, wtpSignals) {
  if (score >= 8.0 && dataQuality !== 'low') {
    return {
      tier: "STRONG SIGNAL",
      action: "Proceed to user interviews with confidence.",
      color: "green"
    };
  }
  
  if (score >= 6.0) {
    return {
      tier: "MIXED SIGNAL", 
      action: "Conduct user interviews to validate. Mixed signals require direct customer contact.",
      color: "yellow"
    };
  }
  
  if (score >= 4.0) {
    return {
      tier: "WEAK SIGNAL",
      action: "Significant concerns detected. Validate core assumptions before any building.",
      color: "orange"
    };
  }
  
  // score < 4.0
  return {
    tier: "DO NOT PURSUE",
    action: "No viable business signal detected. Pivot to a different problem or audience.",
    color: "red"
  };
}
```

---

### Fix 5: Competition Saturation Score Cap

**Current behavior:** Competition score is one factor among many

**Required behavior:** Saturated markets should cap overall viability

```javascript
function applyCompetitionCap(viabilityScore, competitionAnalysis) {
  const dominated = competitionAnalysis.competitors.filter(c => 
    c.threatLevel === 'high' && c.hasFreeVersion
  ).length >= 2;
  
  const saturated = competitionAnalysis.marketMaturity === 'mature' ||
                    competitionAnalysis.competitors.length >= 5;
  
  if (dominated && saturated) {
    // Hard cap at 5.0 - saturated markets can't score higher
    return Math.min(viabilityScore, 5.0);
  }
  
  if (saturated) {
    // Soft cap at 6.5
    return Math.min(viabilityScore, 6.5);
  }
  
  return viabilityScore;
}
```

**Rationale:** Real pain + huge TAM + good timing means nothing if 10 free alternatives exist. Competition should be able to kill a verdict.

---

## P2 Fixes (Medium Priority)

### Fix 6: Red Flags Section at Top of Report

**Current behavior:** Warning signs (0 WTP, high filter rate, low quality) are scattered or buried in metadata

**Required behavior:** Add prominent "Red Flags" section before the viability score

```javascript
function generateRedFlags(analysis) {
  const flags = [];
  
  if (analysis.wtpSignals === 0) {
    flags.push({
      icon: "⚠️",
      title: "No Purchase Intent",
      detail: "Zero signals of willingness to pay detected in community discussions"
    });
  }
  
  if (analysis.filterRate > 0.9) {
    flags.push({
      icon: "⚠️", 
      title: "Very Narrow Signal",
      detail: `${Math.round(analysis.filterRate * 100)}% of posts filtered as irrelevant`
    });
  }
  
  if (analysis.hasFreeAlternatives) {
    flags.push({
      icon: "⚠️",
      title: "Free Alternatives Exist",
      detail: "Competitors offer free solutions to this problem"
    });
  }
  
  if (analysis.signals.length < 15) {
    flags.push({
      icon: "ℹ️",
      title: "Limited Data",
      detail: `Only ${analysis.signals.length} relevant signals found`
    });
  }
  
  return flags;
}
```

**PDF Report Layout:**
```
┌─────────────────────────────────────────┐
│ HYPOTHESIS                              │
│ [hypothesis text]                       │
├─────────────────────────────────────────┤
│ ⚠️ RED FLAGS DETECTED                   │  ← NEW SECTION
│ • No Purchase Intent: Zero WTP signals  │
│ • Free Alternatives Exist               │
│ • Very Narrow Signal: 95% filtered      │
├─────────────────────────────────────────┤
│ VIABILITY VERDICT                       │
│ 3.2/10 - DO NOT PURSUE                  │
└─────────────────────────────────────────┘
```

---

## Scoring Formula Summary

**Current:**
```
viability = (pain × 0.35) + (competition × 0.25) + (market × 0.25) + (timing × 0.15)
```

**Proposed:**
```
adjustedMarket = market × wtpFactor × severityFactor × freeAltFactor

rawViability = (pain × 0.35) + (competition × 0.25) + (adjustedMarket × 0.25) + (timing × 0.15)

// Apply caps
if (wtpSignals === 0 && signals < 20) rawViability = min(rawViability, 5.0)
if (saturatedMarket) rawViability = min(rawViability, 5.0)

finalViability = rawViability
```

---

## Validation Test Cases

After implementing fixes, verify with these tests:

| Test | Hypothesis | Expected Score | Expected Verdict |
|------|------------|----------------|------------------|
| Bad idea | "Water reminder app for professionals" | 2-4/10 | DO NOT PURSUE |
| Saturated market | "Meditation app for stress" | 3-5/10 | WEAK SIGNAL |
| Real opportunity | "Tool for night shift workers to maintain relationships" | Depends on data | Should surface novel insights |
| Obviously good | Previous test "Solo founders isolation" | 6-7/10 | MIXED SIGNAL (not 8.2) |

---

## Implementation Order

1. **Week 1:** Fix 1 (WTP kill switch) + Fix 2 (market score factors)
2. **Week 2:** Fix 3 (two-stage relevance filter)
3. **Week 3:** Fix 4 (verdict tiers) + Fix 6 (red flags section)
4. **Week 4:** Fix 5 (competition cap) + validation testing

---

## Success Criteria

After fixes, PVRE should:

1. ✅ Score unviable ideas below 4.0
2. ✅ Never give 6+ to ideas with 0 WTP signals
3. ✅ Surface "DO NOT PURSUE" verdict for saturated markets with free alternatives
4. ✅ Filter pain signals for problem relevance, not just domain
5. ✅ Show red flags prominently before the score

**The goal:** PVRE should confidently tell users "Don't build this" when the data warrants it. A validation tool that only validates is useless.

---

*Document prepared by: CEO + PM Analysis*  
*For: Claude Code Development Team*
