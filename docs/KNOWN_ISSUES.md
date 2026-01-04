# Known Issues

Last updated: January 4, 2026

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## 🔴 CRITICAL — UI Contradictions

### Verdict Messages Contradict Each Other
**Status:** Open — January 4, 2026
**Impact:** Users cannot trust the recommendation — UI says both "proceed" AND "pivot"

**Evidence (Loom App Gap search):**

| Element | Message | Implication |
|---------|---------|-------------|
| Yellow warning box | "Strong signals detected - proceed to customer interviews" | ✅ Go ahead |
| Verdict hero | "No viable business signal detected. Pivot to a different problem" | ❌ Stop |
| Direct signals score | 10.0 (perfect) | ✅ Excellent |
| Verdict score | 3.1/10 "No Signal" | ❌ Nothing found |
| What This Means | "100% of signals directly match your hypothesis" | ✅ Perfect relevance |

**User reaction:** "Which is it? Should I proceed or pivot?"

**Root cause:** Different components use different logic to generate messages:
- Yellow box checks signal count
- Verdict checks composite score
- "What This Means" checks relevance %

**Fix required:** Align ALL messages to use the same verdict score:
- Score ≥ 7: "Strong opportunity — proceed to interviews"
- Score 5-7: "Mixed signals — investigate further"  
- Score 3-5: "Weak signals — consider pivoting"
- Score < 3: "No viable signal — pivot"

**Files to fix:**
- Verdict display component (hero message)
- Warning box logic
- "What This Means" section

---

### Reddit Metrics Shown in App Gap Mode
**Status:** Open — January 4, 2026
**Impact:** Confusing/alarming metrics that don't apply

**Evidence:**
- Shows "0 communities" — App Gap doesn't use Reddit communities
- Shows "94 posts" — These are App Store reviews, not posts
- Shows "Recency: 0%" — Alarming, suggests stale data

**Fix required:** In App Gap mode, show App Store metrics instead:
- "26 reviews analyzed" (not "94 posts")
- Hide community count
- Show review date range instead of "Recency"

---

### Market Score Unexplained (1.0 "Critical")
**Status:** Open — January 4, 2026
**Impact:** User sees scary "Critical" label with no context

**Evidence:**
- Market Score: 1.0/10 "Critical"
- Shows "11.1% penetration needed - challenging"
- No explanation of what 11.1% means or why it's critical

**Questions:**
1. What does "11.1% penetration" mean?
2. 11.1% of what? SAM? TAM?
3. Why is this "Critical" for an existing successful app like Loom?

**Fix required:** Either:
- Explain the metric: "Would need 5M users (11.1% of 45M SAM) to reach viability"
- Or hide this metric if it's not meaningful for App Gap mode
- Or fix the calculation — Loom IS viable, so score shouldn't be 1.0

---

### ✅ CLOSED: 0% YoY Growth Shows "Stable" (Green Badge)
**Status:** Fixed — January 4, 2026
**Resolution:** Changed badge from "Stable" to "Flat" with amber color

---

### Google Trends Aggregate Weighted by Wrong Factor
**Status:** NEEDS VERIFICATION — January 4, 2026
**Impact:** HIGH — Aggregate YoY can be completely wrong

**CC claimed fix applied** but Loom export still shows 0% aggregate.

**Evidence (Loom search):**

| Keyword | YoY | Q4 Avg Volume |
|---------|-----|---------------|
| async video communication | 0% | 0.0 ← near-zero |
| non meeting communication | +5% | 1.7 |
| quick video messaging | +100% | 0.1 ← near-zero |
| remote team collaboration | **+389%** | 22.9 |
| work communication tools | **+75%** | 61.5 |
| **Aggregate** | **0%** | — |

**Possibilities:**
1. Export was from BEFORE the fix
2. Fix didn't persist to database
3. Fix only applies to NEW searches

**Verification:** Run fresh Timeleft search and check aggregate.

**Files to check:**
- `src/lib/analysis/google-trends.ts` — weighted calculation

---

## 🔴 CRITICAL — Export & Rendering Bugs

### Analyzed App Appears in Own Competitor List
**Status:** Open — January 4, 2026
**Impact:** HIGH — Loom listed as competitor to itself with "high threat level"

**Evidence:** When analyzing Loom, competitor list includes:
```json
{
  "name": "Loom",
  "threatLevel": "high",
  "marketShareEstimate": "dominant"
}
```

**Fix required:** Exclude analyzed app from competitor list by matching name/developer.

---

### Competitive Gaps Show "undefined"
**Status:** Open — January 4, 2026
**Impact:** MEDIUM — Gap names not rendering

**Evidence:**
```
1. **undefined**: Cluster 2 shows significant frustration...
2. **undefined**: Users love the simplicity...
```

**Fix required:** Check gap field name extraction (name vs title vs gap).

---

### Competition Score Shows "[object Object]"
**Status:** Open — January 4, 2026
**Impact:** MEDIUM — Score not readable

**Evidence (narrative.md line 7750):**
```
**Score:** [object Object]
```

**Fix required:** Extract score.value or score.score from competition score object.

---

### Tailwinds/Headwinds Show "[object Object]"
**Status:** Open — January 4, 2026
**Impact:** MEDIUM — Timing analysis not readable

**Evidence:**
```
### Tailwinds
1. [object Object]
2. [object Object]
```

**Fix required:** Extract name, impact, description from tailwind/headwind objects.

---

### 4,652 Embedding Values in Narrative Export
**Status:** Open — January 4, 2026
**Impact:** MEDIUM — File bloated from 50KB to 319KB

**Evidence:** Lines 2800-7700+ contain raw embedding vectors.

**Fix required:** Strip embedding arrays from narrative export.

---

### Pain Signal Tier Classification Weak in App Gap Mode
**Status:** Open — January 4, 2026
**Impact:** MEDIUM — Direct app complaints marked RELATED instead of CORE

**Evidence:**
| Signal | Current | Should Be |
|--------|---------|-----------|
| iPad upload fails 4 times | RELATED | CORE |
| Videos won't finish publishing | RELATED | CORE |

**Fix required:** In App Gap mode, App Store reviews with low ratings = CORE tier.

---

## 🔴 CRITICAL — Data Quality Bugs

### ✅ CLOSED: Praise Filter — Embedding-Based Approach
**Status:** Fixed — January 4, 2026
**Resolution:** Built embedding-based praise filter following signal-categorizer.ts pattern

**Verification (Loom):**
- 26 signals processed, 3 filtered as pure praise
- 0 false positives (100% precision)
- 7.7% slip-through rate (under 10% target)

**Commits:**
- 73a6b80: feat(analysis): Add embedding-based praise filter
- 60ab12a: fix(research): Add App Gap mode validation

---

### ✅ CLOSED: App Gap Mode Fallback Behavior
**Status:** Fixed — January 4, 2026
**Resolution:** Added validation in community-voice route

**Root cause:** UI layer could allow job creation even if interpret-hypothesis returned 404, causing App Gap mode to run without appData and fall back to Hypothesis mode.

**Fix:** Added validation at lines 376-388 in community-voice/route.ts:
- Checks if mode === 'app-analysis' but appData is missing
- Returns 400 error with clear message

---

### ✅ CLOSED: "Ads & Interruptions" Category Matching Wrong Context
**Status:** Fixed — January 3, 2026

### ✅ CLOSED: WTP Signals Show Purchase Regret, Not Purchase Intent
**Status:** Fixed — January 3, 2026

### ✅ CLOSED: Pure Praise Reviews Classified as Pain Signals
**Status:** Fixed — January 4, 2026 (embedding-based approach)

---

## Recently Closed (January 4, 2026)

### ✅ CLOSED: Praise Filter Embedding Implementation
- Built PraiseFilter class following signal-categorizer.ts pattern
- Uses cosine similarity against praise/complaint anchor embeddings
- Two-layer architecture: regex pre-filter (fast) + embedding filter (accurate)
- Verified with Loom: 7.7% slip-through, 0 false positives

### ✅ CLOSED: App Gap Mode Validation
- Added searchType validation in community-voice route
- Prevents fallback to Hypothesis mode when appData missing

---

## Recently Closed (January 3, 2026)

### ✅ CLOSED: Complete Module Specifications (HIGH Priority)
### ✅ CLOSED: App Gap Mode Shows Irrelevant Reddit Posts
### ✅ CLOSED: Architecture Documentation Section 18

---

## Recently Closed (January 2, 2026)

### ✅ CLOSED: Two-Step Analysis Flow Causing Score Changes
### ✅ CLOSED: Verdict Score Inconsistent Across Tabs
### ✅ CLOSED: Market Score 7-Point Gap (9.3 vs 2.2)
### ✅ CLOSED: Competitor Classification Misclassifying High-Threat Competitors
### ✅ CLOSED: Analyzed App Appears in Own Competitor List
### ✅ CLOSED: App Store Review Count Mismatch (39,668 → 16)
### ✅ CLOSED: Same Comment in Multiple Categories
### ✅ CLOSED: UI Polish Items (Batch)

---

## Medium Priority — Architecture

### ✅ CLOSED: App Store-First Architecture for App Gap Mode
**Status:** All Phases Complete — January 3, 2026

---

## Medium Priority — UI Redesign

### Verdict Page Has Too Many Score Constructs
**Status:** Partially Complete — January 2, 2026
**Remaining:** Part 4: User preference toggle (needs DB change)

---

## Low Priority — Logic / Accuracy

### Entry Difficulty Still Potentially Underestimated
**Status:** Open — MONITOR

### Timing Score Minor Mismatch (8.2 vs 8.4)
**Status:** Open — LOW PRIORITY

### "3.5 WTP Found" — Fractional Signal Count
**Status:** Needs Reproduction

---

## Existing Open Items

- Connect Help Button to Canny (Deferred)
- Clarify Purpose of API Keys
- Investigate Two-Panel Section
- Redesign Research Page Layout (Partial)

---

## Architecture Reference

**Key files:**
- Pain detection: `pain-detector.ts`
- Signal categorization: `signal-categorizer.ts`
- Praise filter: `pain-detector.ts` (PraiseFilter class)
- Theme extraction: `theme-extractor.ts`
- Community voice: `community-voice/route.ts`
- App Store adapter: `app-store-adapter.ts`
- Verdict display: Check for verdict-related components

**Architecture Docs:** `docs/SYSTEM_DOCUMENTATION.md` Section 18

---

## How to Use This File

**For CC:** 
1. 🔴 CRITICAL bugs first — UI contradictions are blocking trust
2. Check existing patterns before implementing
3. Reference Architecture section for key files
4. Run Pre-Fix Testing Checklist before closing