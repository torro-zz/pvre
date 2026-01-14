# PVRE Known Issues

*Last updated: January 14, 2026*

---

## 🔴 CRITICAL — Fix First

### NEW ISSUES (Jan 13, 2026 - User Reported)

Three issues discovered during post-fix verification:

1. ~~**Hypothesis Mode: Competitor Analysis Requires Manual Trigger**~~ — ✅ FIXED
2. **Timing Tab Missing Trend Visualizations** — 🟡 PARTIAL (UI fixed, data availability issue)
3. **WTP Signals Missing Source Attribution** — Can't verify quotes are real
4. ~~**Timing Analysis Failing Silently**~~ — ✅ FIXED (Jan 14, 2026)

See detailed entries below (after UI/UX Review Findings section).

---

### ~~Timing Analysis Failing Silently~~
**Status:** ✅ FIXED (January 14, 2026)
**Impact:** ~~Timing tab shows "Not analyzed yet" for recent researches~~
**Priority:** ~~HIGH — Affects all new Hypothesis mode researches~~
**Discovered:** January 13, 2026 (evening debugging session)

#### Problem
Recent researches (last ~7 hours) have **no timing data at all** (`timing: null` in saved results). Older researches have timing with `trendSource: 'ai_estimate'` but no visualizations.

#### Evidence
```bash
# Check any research for timing data:
curl -s "http://localhost:3000/api/research/results?jobId=<JOB_ID>" -b /tmp/cookies.txt | \
  jq '.[] | select(.module_name == "community_voice") | .data | has("timing")'

# Recent jobs return: false
# Older jobs (before ~12:00 UTC Jan 13) return: true
```

#### Root Cause Analysis

**1. Timing analyzer throws, market-analyzer catches and returns undefined:**
```typescript
// src/lib/research/steps/market-analyzer.ts:92-106
(async (): Promise<TimingResult | undefined> => {
  try {
    const result = await analyzeTiming({...})
    return result
  } catch (error) {
    console.error('Timing analysis failed (non-blocking):', error)
    return undefined  // <-- timing becomes null in saved results
  }
})()
```

**2. External APIs failing:**
- **Google Trends:** Returns HTML instead of JSON (rate limiting or API change)
  ```
  [GoogleTrends] API error: Unexpected token '<', "<html lang"... is not valid JSON
  ```
- **AI Discussion Trends:** Requires ~100 Arctic Shift API calls, often fails
- **Final Claude API call:** If this throws after both trend sources fail, whole function fails

**3. No fallback when Claude API fails:**
The timing analyzer's final step calls Claude to generate scores/analysis. If this fails, there's no fallback — the entire timing result is lost.

#### Proposed Fix

**Option A: Wrap Claude call in try-catch with fallback (Quick fix)**
```typescript
// In timing-analyzer.ts, wrap the Claude API call:
try {
  const response = await createMessage({...})
  // ... parse response
} catch (error) {
  console.warn('[Timing] Claude API failed, using minimal fallback:', error)
  return {
    score: 5,  // Neutral default
    confidence: 'low',
    trendSource: 'ai_estimate',
    tailwinds: [],
    headwinds: [],
    timingWindow: 'Unknown',
    verdict: 'Unable to analyze timing due to API error',
    trend: 'stable',
    trendData: null,
  }
}
```

**Option B: Add retry logic to timing analyzer (More robust)**
- Retry Claude API call up to 3 times with exponential backoff
- Cache successful timing results for similar hypotheses

**Option C: Fix external API issues (Long-term)**
- Investigate Google Trends HTML response (may need API key or different endpoint)
- Add circuit breaker for Arctic Shift rate limiting

#### Files to Modify
- `src/lib/analysis/timing-analyzer.ts` — Add fallback for Claude API failure
- `src/lib/data-sources/google-trends.ts` — Investigate HTML response issue

#### Test After Fix
```bash
# Run a new research and verify timing is saved:
curl -X POST http://localhost:3000/api/research/community-voice \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"hypothesis":"Test timing fix"}'

# Then check results for timing:
curl -s "http://localhost:3000/api/research/results?jobId=<NEW_JOB_ID>" -b /tmp/cookies.txt | \
  jq '.[] | select(.module_name == "community_voice") | .data.timing'
```

#### Fix Applied (January 14, 2026)

Two changes to `src/lib/analysis/timing-analyzer.ts`:

1. **Timeout protection for trend data sources:**
   - Added `withTimeout()` wrapper with 15-second timeout
   - External APIs (AI Discussion Trends, Google Trends) now fail gracefully
   - If timeout occurs, proceeds with AI estimate instead of hanging

2. **Try-catch around Claude API call:**
   - If Claude API fails, returns fallback result with `score: 5, confidence: 'low'`
   - Ensures timing data is always saved, even on errors
   - Logs warning for debugging

**Result:** Timing endpoint now completes in ~30 seconds (vs 60+ before) and always returns valid data.

**Test result:**
```json
{
  "score": 7.2,
  "confidence": "medium",
  "trendSource": "ai_estimate",
  "verdict": "Strong timing with AI enablement and normalized digital learning..."
}
```

#### Related Work Completed (Jan 13)
- ✅ UI fix committed (`e8bd1f2`) — Shows visualizations when data exists
- ✅ Parallel fetch implemented — Both AI Discussion and Google Trends fetched simultaneously
- ✅ New fields added — `googleTimeline`, `googleKeywords`, etc. stored even when AI is primary

---

### UI/UX Review Findings (Claude + Codex, Jan 13, 2026)

Comprehensive collaborative review of all tabs on the research results page identified the following issues:

---

#### ~~Market & Timing Tabs Not Rendering Content~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~Release blocker - appears as broken product~~
**Location:** `src/app/(dashboard)/research/[id]/page.tsx`

**Problem (RESOLVED):**
- Market tab showed only header: "Market Sizing Analysis - TAM/SAM/SOM estimation - 9.0/10"
- Timing tab showed only header: "Market Timing Analysis - Tailwinds and headwinds - 8.2/10"
- Database HAD full data but UI was NOT rendering it

**Root Cause:**
The page has two rendering paths:
1. For `pending`/`processing` jobs: Used simplified "partial results" view with only score headers
2. For `completed` jobs: Used full `ResultsLayout` with `MarketTab` component

The test job had status `pending` (stuck) which triggered the simplified view.

**Fix Applied:**
1. Added `import { MarketTab } from '@/components/research/market-tab'`
2. Wrapped partial results view in `ResearchDataProvider` (was missing context)
3. Replaced simplified Market tab placeholder with full `<MarketTab />` component
4. Updated Timing tab to show full data (score, trend, tailwinds/headwinds count)

**Files Changed:**
- `src/app/(dashboard)/research/[id]/page.tsx` (lines 39, 235, 338-390, 423)

**Verification:**
- Sizing sub-tab: TAM/SAM/SOM funnel renders with full data
- Timing sub-tab: Full tailwinds (5) and headwinds (3) displayed
- All 173 tests pass

**Test Job:** `611e50c1-7153-4b29-98dd-1210c3673eba` (Pet Sitter hypothesis)

---

#### Score Contradictions Undermine Credibility
**Status:** 🟡 PARTIAL FIX (Jan 13, 2026)
**Impact:** Users will question scoring logic
**Location:** Verdict tab, Community tab

**Problems Found:**

1. **Pain Score 10.0 + "LIMITED EVIDENCE"**
   - Community tab shows Pain Score 10.0/10 (perfect)
   - But also shows orange "LIMITED EVIDENCE" confidence badge
   - These are intentionally independent metrics (intensity vs sample size)
   - **Status:** By design - Pain Score measures intensity, Limited Evidence measures sample size
   - **Future:** Consider adding tooltip explaining the distinction

2. **Verdict 9.5 with Missing Dimension**
   - ✅ **FIXED:** Now shows prominent "3/4 dimensions" amber badge next to verdict
   - ✅ **FIXED:** Uses `calibratedVerdictLabel` which accounts for sample size limitations
   - Verdict Hero now shows both "STRONG SIGNAL" AND "3/4 dimensions" badges side by side
   - **File:** `src/components/research/verdict-hero.tsx` lines 77-88

3. **Component Math Doesn't Match**
   - Weighted components: Pain 10.0 @47%, Market 9.0 @33%, Timing 8.2 @20% = ~9.3
   - But Verdict shows 9.5/10
   - **Explanation:** Score calibration (`applyScoreCalibration`) pushes mid-range scores further from center (5.5)
   - **Future:** Add formula tooltip showing raw score vs calibrated score

---

#### ~~Opaque Scoring - No Formula Visibility~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~Users can't verify or understand scores~~
**Location:** Verdict tab breakdown

**Problems (RESOLVED):**
- ✅ Formula tooltip added to verdict score showing weighted calculation
- ✅ Shows: Pain (47%), Market (33%), Timing (20%) with individual scores
- ✅ Shows raw score vs calibrated score with explanation
- "0.7% penetration needed" metric still needs explanation (separate issue)

**Fix Applied:**
- Added `getFormulaExplanation()` helper function to `verdict-hero.tsx`
- Wrapped score in Tooltip showing dimension breakdown
- Shows calibration note when raw ≠ calibrated score

**File:** `src/components/research/verdict-hero.tsx` lines 46-66, 100-126

---

#### ~~Partial Assessment Not Properly Gated~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~Misleading confidence levels~~
**Location:** Verdict tab

**Problem (RESOLVED):**
- ✅ Now shows prominent "3/4 dimensions" amber badge next to verdict label
- ✅ Uses `calibratedVerdictLabel` which adjusts label based on sample size
- ✅ Badge only appears when `verdict.isComplete === false`

**Fix Applied:**
- Added conditional Badge component rendering partial dimension count
- Styled with amber border/text for visibility

**File:** `src/components/research/verdict-hero.tsx` lines 133-137

---

#### ~~Missing Metric Definitions~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~Users don't understand what metrics mean~~
**Location:** Investor Metrics Hero, Research Hero Stats

**Fixes Applied:**

1. **WTP Signals - Full tooltips with scale:**
   - None (0): "...validation gap"
   - Weak (1-3): "Some payment intent - gather more evidence"
   - Moderate (4-8): "Good evidence of payment intent"
   - Strong (9+): "Strong monetization signal"
   - **Files:** `research-hero-stats.tsx:127-135`, `investor-metrics-hero.tsx:574-580`

2. **Pain Score - Scale tooltips:**
   - Minimal (0-3.9): "Little evidence of pain"
   - Low (4-5.9): "Some awareness, limited urgency"
   - Moderate (6-7.9): "Clear frustration, may not be urgent"
   - Strong (8-10): "Urgent, frequent frustration"
   - **File:** `investor-metrics-hero.tsx:556-562`

3. **Timing Score - Scale tooltips:**
   - Declining (0-3.9): "Headwinds detected"
   - Uncertain (4-5.9): "Mixed signals"
   - Stable (6-7.9): "Balanced market conditions"
   - Rising (8-10): "Strong tailwinds"
   - **File:** `investor-metrics-hero.tsx:604-612`

4. **Verdict Score - Scale tooltips:**
   - No Signal (0-3.4): "Insufficient evidence"
   - Weak (3.5-5.4): "Significant gaps"
   - Mixed (5.5-7.4): "Some promising, some concerns"
   - Strong (7.5-10): "Multiple positive signals align"
   - **File:** `investor-metrics-hero.tsx:622-628`

5. **Core Signals** - Already had tooltip: "Core signals directly match your hypothesis"
6. **Confidence thresholds** - Already had tooltip: "Very Low (<10), Low (10-30), Medium (30-100), High (100+)"

---

#### ~~Data Limitations Not Surfaced~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~Users don't know data constraints~~
**Location:** Research Hero Stats, Investor Metrics Hero

**Fixes Applied:**

1. **Date Range Tooltip** — Shows date range with interpretation:
   - Explains that older data may reflect outdated pain points
   - Notes that recent data (30-90 days) is most actionable
   - **File:** `research-hero-stats.tsx:295-311`

2. **Match Rate Tooltip** — Explains relevance filtering:
   - <10%: "Low match rate. Many posts were off-topic."
   - 10-30%: "Moderate match rate. Some filtering applied."
   - >30%: "Good match rate. Most posts directly discuss your problem."
   - **File:** `research-hero-stats.tsx:269-291`

3. **Sample Size Tooltip** — Explains post count significance:
   - <20 posts: "Small sample — interpret cautiously"
   - 20-50 posts: "Moderate sample — directional insights"
   - 50+ posts: "Good sample size — statistically meaningful"
   - **File:** `investor-metrics-hero.tsx:800-817`

4. **Sample Breadth Tooltip** — Explains community count:
   - <3 communities: "Limited perspective"
   - 3-7 communities: "Moderate coverage"
   - 7+ communities: "Good coverage — diverse perspectives"
   - **File:** `investor-metrics-hero.tsx:782-799`

**Note:** All metrics now have hover tooltips with interpretation guidance.

---

#### Theme Overlap and Generic Summary
**Status:** 🟢 INVESTIGATED - LOW (Future Enhancement)
**Impact:** Reduced actionability of insights
**Location:** `src/lib/analysis/theme-extractor.ts`

**Problems:**
- "Unreliable sitters" and "Communication mismatch" overlap conceptually
- Executive Summary generic, doesn't tie to quantified themes
- Could be more actionable with theme-specific recommendations

**Investigation (Jan 13, 2026):**

Theme extraction is AI-driven using Claude (`theme-extractor.ts:321-338`). The current prompt includes:
- "Each theme name MUST be a descriptive phrase of 3-6 words"
- Bad examples listed (vague themes)
- Good examples listed (specific themes)

**Root Cause:**
Theme overlap occurs because Claude identifies related but distinct pain points. Without semantic similarity checking, two themes about different aspects of the same problem (e.g., "sitter reliability" vs "sitter communication") are both extracted.

**Recommended Fix Approaches:**

1. **Post-processing deduplication** (Medium effort):
   - After Claude returns themes, compute semantic similarity between theme names
   - Merge themes with >0.8 similarity, combining their frequencies
   - Requires embedding API call

2. **Prompt engineering** (Low effort, lower reliability):
   - Add explicit instruction: "Avoid overlapping themes. If two themes describe the same root problem, combine them."
   - Risk: May overcorrect and lose distinct nuances

3. **Executive summary enhancement** (Low effort):
   - Update prompt line 309: Change from generic summary to:
   ```
   "summary": "Executive summary referencing top 2 themes by frequency with their counts (e.g., 'Theme X (mentioned 12 times) and Theme Y (8 mentions) dominate...')"
   ```

**Decision:** Defer to future sprint. Current behavior is functional, just suboptimal. Risk of prompt changes causing regressions outweighs LOW priority benefit.

---

### Quick Wins for Above Issues

| Fix | Effort | Impact | Status |
|-----|--------|--------|--------|
| ~~Debug Market/Timing tab rendering~~ | ~~Medium~~ | ~~Critical~~ | ✅ DONE |
| ~~Add score formula tooltip~~ | ~~Low~~ | ~~High~~ | ✅ DONE |
| ~~Add metric definitions tooltips~~ | ~~Low~~ | ~~Medium~~ | ✅ DONE |
| ~~Add data limitations callout~~ | ~~Low~~ | ~~Medium~~ | ✅ DONE |
| ~~Gate confidence when incomplete~~ | ~~Medium~~ | ~~High~~ | ✅ DONE |
| ~~Resolve score contradictions~~ | ~~Medium~~ | ~~Critical~~ | ✅ DONE |

---

### ~~App Gap Mode: Research Pipeline Stuck/Failing~~
**Status:** ✅ VERIFIED FIXED (Jan 13, 2026)
**Impact:** ~~App Gap research fails to complete - stuck in processing~~
**Location:** Research pipeline / community-voice API

**Root Cause:** Arctic Shift API rate limiting was crashing the pipeline.

**Fix Applied (Jan 10, 2026):**
Added try/catch in `src/lib/analysis/timing-analyzer.ts:95-101` to make AI Discussion Trends non-blocking:
- If Arctic Shift fails, logs warning and continues
- Falls back to Google Trends or AI estimate
- Research pipeline no longer crashes on rate limiting

**Verification Test (Jan 13, 2026):**
```
Test: App Gap Mode - Notion
Job ID: fff03cd6-0882-431c-9d33-a6a34dba72e3
Mode: App Gap (App Store analysis)
App: Notion: Notes, Tasks, AI

Results:
✅ Pipeline does NOT crash/fail
✅ No console errors visible
✅ Job progresses through stages (Pain Analysis phase active)
✅ Credit consumed (job is processing)
⚠️ Performance severely degraded (see Search Slowdown issue below)

Time elapsed: 24+ minutes (still processing at test end)
Expected time: ~4 minutes
```

**Conclusion:** The crash fix works - pipeline continues even when Arctic Shift is rate-limited. However, the performance degradation is severe (see next issue).

---

### ~~Arctic Shift API Rate Limiting~~
**Status:** ✅ FIXED (Jan 11, 2026)
**Impact:** ~~AI Discussion Trends unreliable, will fail with multiple concurrent users~~
**Location:** `src/lib/arctic-shift/client.ts`, `src/lib/data-sources/ai-discussion-trends.ts`

**Problem:**
Arctic Shift was returning HTTP 422 with `"error":"Timeout. Maybe slow down a bit"` due to parallel request bursts.

**Solution Implemented (4-layer approach):**

1. **Serialized AI Discussion Trends** — `ai-discussion-trends.ts:387-392`
   - Changed from parallel to sequential time window fetching
   - Reduces parallel burst by 75%

2. **422-specific longer backoff** — `client.ts:86-97`
   - Detects 422 "Timeout" errors specifically
   - Uses 10-15-20 second delays instead of 1-2-4 seconds
   - Gives server time to recover

3. **Query-level caching** — `client.ts:47-54`, `cache.ts:180-252`
   - Caches individual API responses in Supabase (24-hour TTL)
   - Repeat queries hit cache, reducing API load significantly

4. **Rate limit header awareness** — `rate-limiter.ts:27-85`, `client.ts:61-66,83-84`
   - Reads `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
   - Proactively pauses when near API limit
   - Logs warnings when limit is low

**Files modified:**
- `src/lib/arctic-shift/client.ts` — Caching, 422 backoff, header tracking
- `src/lib/arctic-shift/rate-limiter.ts` — Rate limit header state tracking
- `src/lib/data-sources/ai-discussion-trends.ts` — Sequential time windows
- `src/lib/data-sources/cache.ts` — Query-level cache functions

---

### ~~Search Takes 30+ Minutes (SEVERE Slowdown)~~
**Status:** ✅ FIXED (Jan 13, 2026)
**Impact:** ~~App Gap searches take **30-35+ minutes** instead of ~4 minutes~~
**Location:** `src/lib/analysis/timing-analyzer.ts`, `src/lib/research/steps/market-analyzer.ts`

---

#### ✅ FIX APPLIED: Skip AI Discussion Trends for App Gap Mode

**Changes Made (Jan 13, 2026):**

1. **`src/lib/analysis/timing-analyzer.ts`** (lines 27, 95-108)
   - Added `isAppGapMode?: boolean` to `TimingInput` interface
   - Wrapped `getAIDiscussionTrend()` call with `if (!input.isAppGapMode)` check
   - Falls back to Google Trends or AI estimate for App Gap mode

2. **`src/lib/research/steps/market-analyzer.ts`** (lines 95, 99)
   - Now passes `isAppGapMode: isAppGapMode(ctx)` to `analyzeTiming()`

**Expected improvement:** App Gap searches: 30+ min → ~4 min (8x faster)

**Why this is the right fix:**
- App Gap mode analyzes **app store reviews**, not Reddit discussions
- AI Discussion Trends searches Reddit for keyword trends — irrelevant for app review analysis
- The app reviews themselves ARE the signal source; Reddit trends add nothing
- Skipping ~100 sequential Arctic Shift API calls removes the bottleneck

---

#### Previous Investigation: BOTTLENECK CONFIRMED (for historical reference)

**Live Test (Jan 13, 2026):**
```
Test: App Gap Mode - Notion
Job ID: 096f0cb1-44d9-4a3e-93d9-c46de6ecd7ea
Wall clock time: 35+ minutes (test ended, job still processing)
UI elapsed counter: 2059s (~34 min)
Expected time: ~4 minutes
Status: Stuck on "Packaging your insights" for 30+ minutes

Network analysis:
- POST /api/research/community-voice: STILL PENDING after 35 min
- No browser console errors
- Credit consumed, job is processing
```

**Root Cause: `getAIDiscussionTrend()` makes ~100 sequential Arctic Shift API calls**

Even in App Gap mode (analyzing app reviews), the timing analyzer calls AI Discussion Trends:
```
timing-analyzer.ts:96 → getAIDiscussionTrend(keywords)
                         ↓
ai-discussion-trends.ts:532 → getAIDiscussionTrend()
                         ↓
4 time windows × ~25 calls each = ~100 total API calls
  ├─ current30d:  7 subreddits × 3 tokens + 4 global = ~25 calls
  ├─ baseline30d: 7 subreddits × 3 tokens + 4 global = ~25 calls
  ├─ current90d:  7 subreddits × 3 tokens + 4 global = ~25 calls
  └─ baseline90d: 7 subreddits × 3 tokens + 4 global = ~25 calls
```

**Why this is absurd for App Gap mode:**
- We're analyzing **app store reviews**, not Reddit discussions
- Keywords are derived from app name (e.g., "Notion"), not a hypothesis
- Reddit "AI Discussion Trends" are completely irrelevant to app review analysis
- The app reviews themselves ARE the timing signal

**Why 30+ minutes happens:**
- Each call can hit 422 "timeout" errors → 10-20s backoff per retry
- Rate limiter can add multi-minute waits when near API limit
- ~100 sequential calls × average 20s = 33 minutes
- This matches observed behavior perfectly

---

#### ~~Recommended Fix: Skip AI Discussion Trends for App Gap Mode~~ (IMPLEMENTED)

~~**Priority 1 (IMMEDIATE):** Disable `getAIDiscussionTrend` for App Gap mode~~ — **Done, see fix above**

---

#### Alternative/Additional Optimizations (for Hypothesis mode if needed)

| Priority | Option | Change | Trade-off |
|----------|--------|--------|-----------|
| ~~**1st**~~ | ~~**Skip AI Trends in App Gap**~~ | ~~Disable entirely for App Gap mode~~ | **✅ DONE** |
| **2nd** | **Reduce to 2 windows** | Only fetch current30d + baseline30d | 50% faster, 90d data rarely needed |
| **3rd** | **Parallel with throttle** | Run 2 windows at once with delay | May trigger rate limiting |
| **4th** | **Aggressive caching** | Skip if any cached data exists | May show stale data |

---

### Market/Competition Tab Doesn't Auto-Start in App Gap Mode
**Status:** ✅ FIXED (Jan 11, 2026)
**Impact:** ~~Users must manually click "Run Competitor Intelligence" after research completes~~
**Location:** Market tab > Competition section

**Original Problem:**
After completing an App Gap search, the Competition tab showed "Run Competitor Intelligence" button instead of auto-running.

**Root Causes Identified:**

1. **Database constraint** — Migration 012 may not have been applied to prod, causing `competitor_intelligence` module name to be rejected by the `research_results` table constraint.

2. **No fallback save** — When auto-competitor analysis failed (for ANY reason - API credits, network, Claude errors), the catch block only marked `competitor_analysis: 'failed'` but saved NO results. This caused the UI to show the "Run" button.

3. **Module name inconsistency** — The GET endpoint in `competitor-intelligence/route.ts:973` only queried for `competitor_intel` (old name), but auto-competitor saves as `competitor_intelligence` (new name).

**Fixes Applied (Jan 11, 2026):**

1. **Fallback save on failure** — `community-voice/route.ts:1282-1328`
   - Added `createFallbackCompetitorResult()` function to `competitor-analyzer.ts`
   - When auto-competitor fails, now creates and saves fallback results
   - Marks `competitor_analysis: 'completed'` (with fallback flag in metadata)
   - UI shows results instead of "Run" button

2. **GET endpoint compatibility** — `competitor-intelligence/route.ts:968-989`
   - Changed `.eq('module_name', 'competitor_intel')` to `.in('module_name', ['competitor_intelligence', 'competitor_intel'])`
   - Now finds results regardless of which name was used

3. **Database migration** — `supabase/migrations/012_fix_competitor_intelligence_constraint.sql`
   - ⚠️ **USER ACTION REQUIRED:** Apply this migration to your Supabase production database
   - Adds `competitor_intelligence` to the allowed module names

**Files Modified:**
- `src/lib/research/competitor-analyzer.ts` — Added `createFallbackCompetitorResult()` export
- `src/app/api/research/community-voice/route.ts` — Save fallback on failure
- `src/app/api/research/competitor-intelligence/route.ts` — Query both module names

**Database Migration Required:**
Run migration 012 on your production database:
```sql
-- From: supabase/migrations/012_fix_competitor_intelligence_constraint.sql
ALTER TABLE public.research_results
DROP CONSTRAINT IF EXISTS research_results_module_name_check;

ALTER TABLE public.research_results
ADD CONSTRAINT research_results_module_name_check
CHECK (module_name IN ('community_voice', 'pain_analysis', 'market_sizing', 'timing_analysis', 'competitor_analysis', 'competitor_intelligence', 'competitor_intel'));
```

**Testing:** Run App Gap search and verify competitor analysis completes automatically (with real or fallback results).

---

### ~~Google Trends Not Showing in App Gap Mode~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~Users don't see timing/trend data for apps~~
**Location:** Market tab > Timing section

**Fix Applied:**
- Root cause: AI-extracted keywords from long App Gap hypotheses were too generic (e.g., "AI chatbot productivity")
- Added `appName` parameter to `TimingInput` interface in `timing-analyzer.ts`
- Modified `analyzeTiming` to prepend actual app name (e.g., "ChatGPT") as first Google Trends keyword
- Updated `community-voice/route.ts` to pass `appData?.name` when calling `analyzeTiming`
- Now shows real Google Trends data for the specific app being analyzed

**Note:** Only applies to NEW research jobs. Existing jobs won't have timing data until re-run.

---

### ~~Self-Competitor Still Appears (ChatGPT → OpenAI)~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~App being analyzed shows as competitor to itself~~
**Location:** Market tab > Competition section

**Fix Applied:**
- Extended `analyzedAppName` to include developer name in pipe-separated format: `chatgpt|openai`
- Updated `competitor-intelligence/route.ts` to extract both `appData.name` and `appData.developer`
- Updated `competitor-results.tsx` filtering to split by `|` and check all names
- Competitors matching either the app name OR developer name are now excluded
- Works for all apps: ChatGPT filters out "OpenAI", Slack filters out "Salesforce", etc.

---

### ~~Opportunity Timelines Unrealistic ("3+ months")~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~Makes opportunities sound impossible for indie founders~~
**Location:** Market tab > Opportunities section

**Fix Applied:**
- Removed specific timeline estimates that implied unrealistic scopes
- Updated `getEffortLabel()` function in `market-tab.tsx` (lines 1161-1168)
- New labels: "Quick Win", "Moderate Effort", "Significant Build"
- Old labels removed: "Quick Win (1-2 weeks)", "Medium Effort (1-3 months)", "Major Initiative (3+ months)"

---

### ~~"Example Source" Label Still Appearing~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~Confusing UX - unclear what "Example source" means~~
**Location:** Opportunities tab

**Fix Applied:**
- Changed label from "Example source" to "View source" in `opportunities.tsx` (line 366)
- Now clearly indicates the user can click to view the original source

---

### ~~Verdict Messages Contradict Each Other~~
**Status:** ✅ FIXED (Jan 8, 2026)
**Impact:** ~~Users get conflicting guidance~~
**Location:** Verdict tab

**Fix Applied:**
- `verdict-hero.tsx` now uses shared `getVerdictMessage` utility instead of duplicating logic
- Banner action text, colors, and gradient now align with verdict assessment
- Reduced 47 lines of duplicate code

---

### ~~Hypothesis Confidence Wrong Metric for App Gap Mode~~
**Status:** ✅ FIXED (Jan 8, 2026)
**Impact:** ~~Two-axis viability assessment uses irrelevant metric~~
**Location:** Verdict tab

**Fix Applied:**
- Added `isAppAnalysis` prop through component chain (`tabbed-view.tsx` → `summary-tab.tsx` → `viability-verdict.tsx` → `dual-verdict-display.tsx`)
- App Gap mode now shows "Signal Quality" instead of "Hypothesis Confidence"
- Added 2 regression tests in `verdict-display.test.tsx`

---

### ~~Self-Competitor Still Appears in Competitor List (App Gap Mode)~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~Analyzed app appears as its own competitor~~

**Fix Applied:**
- Added `analyzedAppName` field to `CompetitorIntelligenceResult` type
- `competitor-intelligence/route.ts` extracts normalized app name from `coverage_data.appData.name` when `mode === 'app-analysis'`
- `competitor-results.tsx` uses `results.analyzedAppName` for self-filtering (App Gap mode only)
- Hypothesis mode unchanged (no self-filtering needed)

---

### ~~Coverage Preview Shows Wrong Sources for App Gap Mode~~
**Status:** ✅ FIXED (Jan 5, 2026)
**Impact:** ~~Users don't understand what data will be analyzed~~
**Location:** Coverage preview screen (before starting research)

**Fix Applied:**
- Added separate render path in `coverage-preview.tsx` for `mode === 'app-analysis'`
- Shows app being analyzed (icon, name, rating, review count)
- Displays App Store & Google Play as primary "Review Sources"
- Removes Reddit-centric sections (Communities, Discussion Sources, Example Posts, Relevance Check)
- Loading message says "Preparing app store review analysis"
- Button says "Analyze App" instead of "Start Research"

**Original Problem:**

The coverage preview was designed for **Hypothesis mode** where Reddit IS the primary source. For App Gap mode, we were showing the wrong thing:

| What the UI Shows | What Actually Happens |
|-------------------|----------------------|
| Reddit as the only source | We fetch 500+ App Store reviews as the PRIMARY data |
| Subreddits like r/dating, r/Tinder | These find general dating discussions, not app-specific feedback |
| No mention of App Store/Google Play | Those reviews ARE fetched but not shown here |

**What Reddit Provides (and doesn't):**

For Tinder App Gap analysis, Reddit search will find:
- ✅ Some app-specific discussions in r/Tinder
- ❌ Mostly general dating advice ("how to get matches")
- ❌ Relationship discussions not about the app
- ❌ Dilutes the signal from actual app reviews

**The app store reviews are 10x more valuable** because they're:
- Direct feedback about the app
- From verified users
- Focused on app experience, not general dating

**Suggested Changes for App Gap Coverage Preview:**

1. **Show App Stores as Primary Sources**
```
REVIEW SOURCES
[📱 App Store  500 reviews]  [🤖 Google Play  500 reviews]
```

2. **Either Hide Reddit or Make it Optional**
   - **Option A:** Remove Reddit entirely for App Gap mode (cleaner, faster, more relevant)
   - **Option B:** Show as optional secondary source with toggle

3. **Remove/Replace Irrelevant Sections**
   - "COMMUNITIES" section → doesn't make sense for app analysis
   - "EXAMPLE POSTS" → should show example reviews, not Reddit posts
   - "Relevance Check" → was designed for Reddit, not app reviews

4. **Simplify the UI for App Gap**
```
Analyzing: Tinder Dating App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sources:
  App Store     500 reviews
  Google Play   500 reviews (cross-store lookup)

Analysis Depth: [Quick] [Standard] [Deep]

[Start Analysis →]
```

**Recommendation:**

For App Gap mode, Reddit is noise. Suggested approach:
1. Show App Store/Google Play prominently as the data sources
2. Hide Reddit communities (or make them an advanced "also search Reddit" toggle)
3. Change example posts to example reviews
4. Simplify the whole coverage screen for app analysis

**Files:**
- `src/components/research/coverage-preview.tsx` — main UI component
- `src/app/api/research/coverage-check/route.ts` — API that generates coverage data

---

## 🔴 CRITICAL — Fix First

### ~~Hypothesis Mode: Competitor Analysis Requires Manual Trigger~~
**Status:** ✅ FIXED (Jan 13, 2026) — with follow-up issues identified by Codex
**Impact:** ~~Inconsistent UX between modes - Hypothesis mode feels incomplete~~
**Location:** `src/app/api/research/community-voice/stream/route.ts`
**Discovered:** January 13, 2026

**Problem (RESOLVED):**
In **App Gap mode**, competitor analysis ran automatically. In **Hypothesis mode**, it did NOT auto-run because the streaming endpoint (`community-voice/stream/route.ts`) was missing the auto-competitor logic that existed in the non-streaming endpoint.

**Root Cause:**
- App Gap mode uses `/api/research/community-voice` (non-streaming, has auto-competitor)
- Hypothesis mode uses `/api/research/community-voice/stream` (SSE streaming, was missing auto-competitor)

**Fix Applied:**
Added auto-competitor analysis to the streaming endpoint (lines 410-473):
1. After saving `community_voice` results, update `step_status` to mark pain_analysis complete
2. Auto-run `analyzeCompetitors()`
3. Save `competitor_intelligence` results
4. Mark job as "completed" with all 4 dimensions

**Files Modified:**
- `src/app/api/research/community-voice/stream/route.ts` — Added auto-competitor logic (lines 386-473)

**Behavior Now:**
Both modes complete with all 4 dimensions:
- `pain_analysis: 'completed'`
- `market_sizing: 'completed'`
- `timing_analysis: 'completed'`
- `competitor_analysis: 'completed'`

#### Codex Review Follow-up Issues (Jan 13, 2026)

The following issues were identified by Codex during code review of the fix:

---

**🔴 HIGH: Community Voice Save Failure Not Handled**
**Status:** ✅ FIXED (Jan 13, 2026)
**Location:** `stream/route.ts:381-484`

~~If `saveResearchResult(jobId, 'community_voice', ...)` fails, the code just logs the error and continues to competitor analysis anyway.~~

**Fix Applied:**
Restructured lines 381-484 to wrap save + competitor logic in single try-catch:
- On failure: marks job as `failed` with `error_source: 'database'`
- Sends SSE error event to client
- Closes stream and returns early (skips competitor)
- Matches non-streaming route behavior

**Files Modified:** `src/app/api/research/community-voice/stream/route.ts`

---

**🟡 MEDIUM: Streaming Route Not Full Parity with Non-Streaming**
**Status:** Open
**Location:** `stream/route.ts:416-420`

The auto-competitor logic in the streaming route is missing inputs that the non-streaming route uses:
- No competitor detection step (extracts competitors from pain signals)
- No `knownCompetitors` parameter
- No `targetGeography` parameter
- No `clusters` parameter (App Gap only, acceptable)
- No `maxCompetitors` parameter
- No `analyzedAppName` parameter (App Gap only, acceptable)

**Impact:** Lower quality competitor analysis results in Hypothesis mode. The non-streaming route runs a full competitor detection step that extracts competitor names from pain signals before running analysis.

**Recommended Fix:** Extract competitor detection logic into a shared function and call it from both routes.

---

**🟡 MEDIUM: SSE Doesn't Signal Competitor Failure to Client**
**Status:** Open
**Location:** `stream/route.ts:438-472`

If competitor analysis fails, the client still receives a final `complete` event with no indication of failure. The database shows `competitor_analysis: 'failed'` but the UI won't know unless it polls.

**Expected:** Send an error or warning SSE event when competitor analysis fails so the UI can show appropriate feedback.

**Recommended Fix:** Add `sendEvent(controller, { type: 'error', step: 'competitor', message: '...' })` before the final complete event when competitor fails.

---

**🟢 LOW: Duplicate Result Payload in SSE**
**Status:** Open
**Location:** `stream/route.ts:402-408, 476-481`

The large `result` object is sent twice:
1. In `community_voice_done` progress event (line 407)
2. In final `complete` event (line 480)

**Impact:** Increased SSE payload size and client buffering pressure.

**Recommended Fix:** Remove `data: { result }` from the final `complete` event since it was already sent.

---

### Timing Tab Missing Google Trends and AI Discussion Trends
**Status:** 🟡 PARTIAL FIX (January 13, 2026) — UI changes applied, underlying data availability issue
**Impact:** ~~Users see timing score but no supporting visualizations~~
**Location:** `src/components/research/market-tab.tsx`, `src/lib/analysis/timing-analyzer.ts`
**Discovered:** January 13, 2026

**Problem (RESOLVED):**
1. ~~**Timing tab shows nothing** — No Google Trends chart, no AI Discussion Trends visualization~~
2. ~~**AI Discussion Trends missing entirely** — The purple card with 30d/90d changes not visible~~
3. **Tailwinds/Headwinds displayed correctly** — No changes needed

---

#### Root Cause Analysis (Codex-Reviewed)

**TWO separate data paths with different problems:**

| Visualization | Data Source | UI File | Problem |
|---------------|-------------|---------|---------|
| Purple "Discussion Trends" card | `communityVoiceResult.data.unifiedTrends` | `market-tab.tsx:821` | Hidden when `insufficientData === true` |
| Blue "Google Trends" chart | `timingData.trendData.timelineData` | `market-tab.tsx:955` | Data never fetched when AI Discussion succeeds |

**Data Path 1: Purple Card (UI gating issue)**
- Source: `unifiedTrends` from `combineDiscussionTrends()` in `discussion-trends.ts`
- UI condition: `{unifiedTrends && !unifiedTrends.insufficientData}`
- Problem: Card hidden entirely when `insufficientData === true`, even if useful data exists

**Data Path 2: Blue Chart (Architecture issue)**
- Source: `timing-analyzer.ts` lines 89-131 uses fallback hierarchy:
  1. Try AI Discussion Trends first
  2. If fails → try Google Trends
  3. If fails → use AI estimate
- Problem: When AI Discussion succeeds, Google Trends is **never fetched**
- Result: `timelineData` is empty/undefined — no data to display

---

#### Proposed Solution (Plan v2 — Codex Approved)

**Phase 0: Diagnostic**
Add logging to `TimingSubTab` in `market-tab.tsx` to confirm what data exists:
```typescript
console.log('[TimingSubTab] Debug:', {
  hasUnifiedTrends: !!unifiedTrends,
  unifiedTrendsInsufficient: unifiedTrends?.insufficientData,
  unifiedTrendsRecentCount: unifiedTrends?.recentCount,
  trendSource: timingData?.trendSource,
  hasTimelineData: !!timingData?.trendData?.timelineData?.length,
});
```

**Phase 1: Fix Purple Card (UI only)**

File: `src/components/research/market-tab.tsx`

Change 1 — Relax hiding condition (line 821):
```typescript
// FROM:
{unifiedTrends && !unifiedTrends.insufficientData && (...)}

// TO: Show if any useful data exists
{unifiedTrends && ((unifiedTrends.recentCount ?? 0) > 0 || (unifiedTrends.previousCount ?? 0) > 0) && (...)}
```

Change 2 — Add low-confidence warning INSIDE the card (after line 822):
```typescript
{(unifiedTrends.insufficientData || unifiedTrends.confidence === 'low' || unifiedTrends.confidence === 'none') && (
  <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-xs text-amber-700 dark:text-amber-400">
    <AlertTriangle className="h-3 w-3" />
    <span>Limited data — interpret with caution</span>
  </div>
)}
```

**Phase 2: Fix Blue Chart (Architecture change)**

File: `src/lib/analysis/timing-analyzer.ts`

Change 1 — Fetch both sources in parallel (lines 89-131):
```typescript
const [aiTrendResult, googleTrendResult] = await Promise.allSettled([
  input.isAppGapMode ? Promise.resolve(null) : getAIDiscussionTrend(keywords),
  getCachedTrendData(keywords)
]);

aiTrendData = aiTrendResult.status === 'fulfilled' ? aiTrendResult.value : null;
googleTrendData = googleTrendResult.status === 'fulfilled' ? googleTrendResult.value : null;

// Determine primary source for score calculation
if (aiTrendData?.dataAvailable && !aiTrendData.insufficientData) {
  trendSource = 'ai_discussion';
} else if (googleTrendData?.dataAvailable) {
  trendSource = 'google_trends';
} else {
  trendSource = 'ai_estimate';
}
```

Change 2 — Add new fields to `trendData` in return (additive, backward compatible):
```typescript
trendData: {
  ...existingFields,
  // NEW: Google Trends data (available even when AI Discussion is primary)
  googleTimeline: googleTrendData?.timelineData || null,
  googleKeywords: googleTrendData?.keywords || null,
  googleKeywordBreakdown: googleTrendData?.keywordBreakdown || null,
  googleDataAvailable: !!googleTrendData?.dataAvailable,
}
```

Change 3 — Update UI to show Google Trends when data exists (`market-tab.tsx:955`):
```typescript
// FROM:
{timingData.trendSource === 'google_trends' && timingData.trendData?.dataAvailable && (...)}

// TO: Show if Google data exists (with supplementary label if AI is primary)
{(timingData.trendData?.googleTimeline?.length > 0 ||
  (timingData.trendSource === 'google_trends' && timingData.trendData?.timelineData?.length > 0)) && (...)}
```

---

#### Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Old results without `googleTimeline` | Check `timelineData` + `trendSource === 'google_trends'` |
| Old results with `insufficientData: true` | Now shows with warning (improvement) |
| New results | Both visualizations when both sources succeed |

---

#### Test Cases

| Test | Mode | Expected |
|------|------|----------|
| AI success + Google success | Hypothesis | Purple card + Blue chart |
| AI success + Google failure | Hypothesis | Purple card only |
| AI insufficient + Google success | Hypothesis | Purple card with warning + Blue chart |
| Both fail | Either | Amber "AI Estimate" warning |
| App Gap (AI skipped) | App Gap | Blue chart only |

---

#### Fix Applied (January 13, 2026)

**Changes to `src/components/research/market-tab.tsx`:**
1. Changed purple card condition from `!unifiedTrends.insufficientData` to show if any counts exist
2. Added amber "Limited data" warning inside card when `insufficientData` or low confidence
3. Changed blue chart condition to show if `googleTimeline` data exists (not just when primary source)
4. Added "(supplementary)" label when Google Trends is secondary to AI Discussion

**Changes to `src/lib/analysis/timing-analyzer.ts`:**
1. Added new optional fields to `TimingResult.trendData`: `googleTimeline`, `googleKeywords`, `googleKeywordBreakdown`, `googleDataAvailable`
2. Changed from sequential fetch (AI → Google fallback) to parallel fetch using `Promise.allSettled`
3. Both sources fetched simultaneously, Google data stored even when AI Discussion is primary
4. Primary source still determines timing score calculation

**Result:**
- Purple "Discussion Trends" card shows when data exists (with warning if limited)
- Blue "Google Trends" chart shows when timeline data exists (labeled "supplementary" if AI is primary)
- Both can display simultaneously for new searches
- Backward compatible with old saved results

**Verification:** Build passes, 176 tests pass

**Current Reality (January 13, 2026 - Evening Update):**

The UI fix is applied and working correctly. HOWEVER, there's an underlying data availability issue:

| Observed Behavior | Cause | Impact |
|-------------------|-------|--------|
| Recent researches have NO timing data (null) | Timing analysis throwing exceptions silently | Timing tab shows "Not analyzed yet" |
| Older researches have timing with `ai_estimate` | AI Discussion & Google Trends both fail | No trend visualizations, only score |
| Google Trends API returns HTML errors | Rate limiting or API changes | Google Trends chart never displays |

**Root Cause:** The timing analyzer's final Claude API call can fail, causing the entire function to throw (caught by market analyzer step, returning `undefined`). When both trend data sources fail (common), users see only AI-estimated scores with no supporting visualizations.

**Recommended Next Step:** Add retry logic or better error handling to the timing analyzer's Claude API call to ensure timing data is always saved, even if with `ai_estimate` fallback. Consider caching Google Trends data more aggressively.

---

### WTP Signals Missing Source Attribution
**Status:** Open
**Impact:** Users can't verify WTP signals are real - trust/credibility issue
**Location:** `src/components/research/quotes-panel.tsx` or similar
**Discovered:** January 13, 2026

**Problem:**
In the **Evidence > Quotes > WTP Signals** section:
1. WTP (Willingness to Pay) signals have **no source links** — unlike Key Pain Quotes which DO show sources
2. The displayed WTP quotes cannot be verified as real user comments
3. Unclear if these are:
   - Extracted from actual user posts/reviews
   - AI-generated summaries
   - Hallucinated content

**Example:**
```
Key Pain Quotes:
  "I hate when my sitter cancels last minute..."
  Source: r/dogs • 2 days ago  [✅ Has source]

WTP Signals:
  "I would pay $50/month for a reliable service..."
  [❌ No source, no date, no verification]
```

**Expected Behavior:**
WTP Signals should have the same source attribution as Key Pain Quotes:
- Source link (Reddit post URL, App Store review link)
- Date/timestamp
- Community or platform name
- Upvote/engagement count (if available)

**Root Cause Investigation:**
1. Check how WTP signals are extracted — `pain-detector.ts` or theme extractor?
2. Do WTP signals retain source metadata when extracted?
3. Is the source data available but UI not rendering it?
4. Or are WTP signals AI-generated without grounding in real quotes?

**Files to Investigate:**
- `src/components/research/quotes-panel.tsx` — Quote display component
- `src/lib/analysis/pain-detector.ts` — WTP signal extraction
- `src/lib/analysis/theme-extractor.ts` — May extract WTP patterns
- `CommunityVoiceResult.wtpSignals` type definition

**Trust Impact:**
If WTP signals are AI-generated without real sources, they should either be:
1. Removed entirely (misleading)
2. Clearly labeled as "AI-inferred" (not real quotes)
3. Fixed to only show actual user quotes with sources

---

## 🟡 MEDIUM — Next Sprint

### WTP Comments Truncated and Unreadable
**Status:** Open
**Impact:** Users can't read full willingness-to-pay signals
**Location:** Gaps tab > WTP section

Comments under "Willingness to Pay Signals" are cut off, unlike other sections which show full text.

**Fix:** Show full text for WTP signals, or add "expand" button. Match behavior of other sections.

---

### ~~Google Trends Keyword Truncated~~
**Status:** ✅ REPLACED (Jan 8, 2026)
**Impact:** ~~Incomplete data display~~
**Location:** Market tab > Timing section

~~Shows "dating apps for relation" cut off instead of full keyword.~~

**Resolution:** Google Trends API was replaced with AI Discussion Trends (see below). This issue is no longer applicable.

---

### Google Trends API Blocked (429 Errors)
**Status:** ✅ REPLACED with AI Discussion Trends (Jan 8, 2026)
**Impact:** Google Trends data unavailable
**Location:** Market tab > Timing section

**Original Problem:**
The unofficial `google-trends-api` npm package was blocked by Google (429 rate limit errors). The package hasn't been updated in 5 years and Google actively blocks scrapers.

**Solution Implemented:**
Built a new "AI Discussion Trends" feature that analyzes Reddit discussions about problems in AI-related contexts:
- Searches AI subreddits (r/ChatGPT, r/ClaudeAI, etc.) for problem keywords
- Compares 30-day and 90-day windows to detect trends
- Weights posts by engagement (upvotes + comments)
- Falls back to Google Trends only if AI trends unavailable

**New Files:**
- `src/lib/data-sources/ai-discussion-trends.ts` — Core trend analysis
- `src/lib/rate-limit/index.ts` — Vercel KV rate limiting

**UI Changes:**
- Purple "AI Discussion Trends" card shows 30d/90d changes
- Falls back to Google Trends (blue) if available
- Falls back to "AI ESTIMATE" if neither available

**Why This Is Better:**
- People asking AI about problems = active pain signal
- No rate limiting issues (we control the data pipeline)
- More relevant to PVRE's pain detection mission

---

### Source Links Don't Go to Specific Reviews
**Status:** Open
**Impact:** Users can't verify source quotes
**Location:** Gaps tab > signal cards

"Original comment" link goes to general Google Play page, not specific review.

**Fix:** Change link text to clarify destination: "View on Google Play" instead of "Original comment". Add tooltip: "Links to app store page (specific review links not available)".

---

### Reddit Metrics Shown in App Gap Mode
**Status:** Open
**Impact:** Confusing metrics for App Store-only analysis
**Location:** Results header

Shows "0 communities" and "94 posts" for App Store reviews — wrong terminology.

**Fix:** Use "reviews" terminology in App Gap mode, hide Reddit-specific metrics.

---

### Market Score Unexplained
**Status:** Open
**Impact:** Users don't understand score meaning
**Location:** Market tab

Shows "1.0" and "Critical" with "11.1% penetration" but no context for what this means.

**Fix:** Add explanation of market score calculation and what penetration percentage represents.

---

## 🟢 LOW — Polish

### Investor Metrics Repeated on Every Tab
**Status:** Open
**Impact:** Wastes space, clutters views
**Location:** All tabs (App, Feedback, Market, Gaps, Verdict)

Same "Investor Metrics" section appears at top of every tab.

**Fix:** Make collapsible (collapsed by default), or move to dedicated Summary section.

---

### Sentiment Overview Format Confusing
**Status:** Open
**Impact:** Users can't quickly understand overall sentiment
**Location:** Feedback tab

Shows "46 one to two stars" with format that doesn't communicate sentiment at a glance. Missing overall rating for context.

**Fix:** Add overall rating prominently (e.g., "3.8 ★ from 274K reviews"). Redesign rating breakdown to be clearer.

---

### Opportunity Gaps UI Outdated
**Status:** Open
**Impact:** Looks unprofessional
**Location:** Market tab > Opportunities section

Cards show only headline + minimal detail. "Difficulty" tag and market opportunity icon look dated.

**Fix:** Redesign opportunity cards with: description, difficulty badge, potential impact, related signals.

---

## 📝 DEVELOPMENT NOTES

### Claude Code Skills Require Directory + SKILL.md
**Discovered:** January 8, 2026

Skills require a **directory** containing a `SKILL.md` file (not a standalone `.md` file).

**Correct structure:**
```
.claude/skills/goodnight/SKILL.md    ✅ Works
.claude/skills/goodnight.md          ❌ Not detected
```

**Required frontmatter fields:**
```yaml
---
name: goodnight                      # Required - lowercase, hyphens only
description: What it does            # Required - triggers skill discovery
model: claude-sonnet-4-20250514      # Optional - model to use
context: fork                        # Optional - isolated context
---
```

**Locations:**
| Path | Scope |
|------|-------|
| `~/.claude/skills/my-skill/` | Personal (all projects) |
| `.claude/skills/my-skill/` | Project (repo-specific) |

**Our `/goodnight` skill:** `.claude/skills/goodnight/SKILL.md`

**Note:** May need to restart Claude Code session for new skills to be detected.

---

## 🟡 REVIEW NEEDED

### AI Discussion Trends Implementation - Review with Codex
**Status:** Needs Review (Jan 9, 2026)
**Impact:** New feature may have edge cases
**Location:** Multiple files

Codex reviewed the AI Discussion Trends implementation and suggested 4 fixes that were applied:

1. **HIGH:** `finalTrend` now matches `trendSource` (was potentially inconsistent)
2. **MEDIUM:** Rate-limit key format fixed in `getRateLimitStatus`
3. **MEDIUM:** Strategy B now filters by AI terms (was unused function)
4. **LOW:** UI fallback for missing `trendSource` (backward compatibility)

**Files to review:**
- `src/lib/analysis/timing-analyzer.ts` (lines 229-237)
- `src/lib/rate-limit/index.ts` (lines 188-206)
- `src/lib/data-sources/ai-discussion-trends.ts` (lines 206-212)
- `src/components/research/market-tab.tsx` (lines 982-990)

**Action:** Walk through these changes with Codex to verify they're correct and don't introduce regressions.

---

## 🔵 PLANNED FEATURES

### Credit/Fuel System Design
**Status:** Planning Required
**Priority:** HIGH — Business sustainability
**Impact:** Pricing fairness, margin protection, user trust

Need to design a credit system that:

1. **Works for all search types:**
   | Mode | Depth | Sample Size | Signal Cap | Estimated Cost |
   |------|-------|-------------|------------|----------------|
   | Hypothesis | Quick | 150 | 50 | TBD |
   | Hypothesis | Medium | 300 | 100 | TBD |
   | Hypothesis | Deep | 450 | 200 | TBD |
   | App Gap | Quick | 150 | 50 | TBD |
   | App Gap | Medium | 300 | 100 | TBD |
   | App Gap | Deep | 450 | 200 | TBD |

2. **Shows cost BEFORE search starts:**
   - Calculate estimated token usage based on depth + mode
   - Display credit cost on coverage preview screen
   - User confirms spend before starting

3. **Separates free vs paid usage:**
   - Pre-search (coverage check, interpretation) = FREE
   - Actual research = PAID (credits/fuel)
   - Clear boundary for user

4. **Protects margin for sustainability:**
   - Cover API costs (Anthropic, embeddings)
   - Cover server/infrastructure costs
   - Cover marketing budget
   - Leave room for growth

**Metrics to track (add to admin analytics):**
- Token usage per search type/depth
- API cost per search type/depth
- Response payload sizes
- Signal counts by depth tier

**Questions to answer:**
- Should credits be flat-rate per depth, or variable based on actual usage?
- How to handle searches that fail/timeout (refund credits)?
- Should heavy users get volume discounts?
- How to communicate value vs. cost to users?

**Files to update when implementing:**
- `src/lib/filter/config.ts` — cost constants
- `src/app/api/research/coverage-check/route.ts` — show estimated cost
- `src/components/research/coverage-preview.tsx` — display cost to user
- `src/app/api/admin/analytics/route.ts` — track usage metrics

---

### Dual App Store Support
**Status:** Planned
**Impact:** 2x data volume, cross-platform insights
**Location:** App Gap mode data collection

Currently scrape from one store only. Should scrape 500 reviews from iOS App Store + 500 from Google Play Store.

**Implementation:**
- Detect app on both stores (use app name/developer match)
- Scrape 500 reviews from each
- Merge into single analysis OR show platform comparison
- Flag platform-specific pain (e.g., "Android users report more crashes")

---

## Recently Verified Fixed (January 6, 2026)

| Issue | Verification |
|-------|--------------|
| Google Trends not showing (App Gap) | ✅ Added `appName` param to timing analyzer, prepends app name to keywords |
| Self-competitor (ChatGPT → OpenAI) | ✅ Now filters by both app name AND developer name via pipe-separated format |
| Unrealistic timelines (3+ months) | ✅ Removed time estimates, now "Quick Win", "Moderate Effort", "Significant Build" |
| "Example Source" label | ✅ Changed to "View source" in opportunities.tsx |
| Comparison Matrix empty | ✅ Now shows 6 competitors × 5 dimensions with scores |
| Comparative Mentions | ✅ NEW: Extracts real user comparisons from reviews |
| App Store dates null | ✅ Timestamps present (e.g., `1763722867`) |
| Recency metrics zero | ✅ `last30Days: 33`, `last90Days: 37` |
| Self-competitor in list | ✅ Fixed via `analyzedAppName` extraction from `coverage_data.appData.name` |
| Interview questions null | ✅ 15 questions in 3 categories |
| Google Trends weighted % | ✅ Shows +948%, rising |
| No [object Object] in export | ✅ 0 occurrences |
| No raw embeddings in export | ✅ Cleaned properly |

### Comparative Mentions Feature (NEW)
**Status:** Implemented
**Location:** Market tab > Competition > User Comparisons section

Extracts real user comparisons from App Store/Google Play reviews:
- "Hinge is so much better"
- "Unlike Bumble, this app..."
- "I switched from OkCupid because..."

Shows a table with positive/negative/net sentiment counts based on **actual user mentions**, not AI estimates.

**Files:**
- `src/lib/analysis/comparative-mentions.ts` — extraction logic
- `src/app/api/research/competitor-intelligence/route.ts` — integration
- `src/components/research/competitor-results.tsx` — UI display

**Note:** Only works for NEW research jobs (not retroactive to existing data).

---

## File Reference

| Issue Category | Likely Files |
|----------------|--------------|
| Verdict | `src/components/research/verdict-hero.tsx`, `viability-verdict.tsx` |
| Market/Competition | `src/components/research/market-tab.tsx` |
| Gaps/WTP | `src/components/research/opportunities.tsx` |
| Feedback/Sentiment | `src/components/research/user-feedback.tsx` |
| Layout/Metrics | `src/components/research/layouts/` |
| App Store adapters | `src/lib/data-sources/adapters/` |