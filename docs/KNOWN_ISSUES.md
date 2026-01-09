# PVRE Known Issues

*Last updated: January 9, 2026*

---

## 🔴 CRITICAL — Fix First

### Market/Competition Tab Doesn't Auto-Start in App Gap Mode
**Status:** FIX APPLIED (Jan 9, 2026) — Needs Testing
**Impact:** Users must manually click "Run Competitor Intelligence" after research completes
**Location:** Market tab > Competition section

**Problem:**
After completing an App Gap search (e.g., Notion), the Market/Competition tab shows:
- "Complete Your Research" prompt
- "Run Competitor Intelligence to finalize your research verdict"
- User must manually click the button

**Expected Behavior:**
Competitor Intelligence should auto-start as part of the research pipeline, not require manual user action.

**Investigation Notes:**
- Screenshot shows: Pain Analysis ✅, Market Sizing ✅, Timing Analysis ✅
- But Competition tab shows manual "Run Competitor Intelligence" button
- "AI-Suggested Competitors" shows "Analyzing community discussions for competitors..." (loading)

**Files to investigate:**
- `src/app/api/research/community-voice/route.ts` — main research pipeline
- `src/app/api/research/competitor-intelligence/route.ts` — competitor analysis API
- `src/components/research/market-tab.tsx` — UI that shows the prompt
- `src/components/research/competitor-results.tsx` — competition results display

**Root Cause:** `formatClustersForPrompt` throws on malformed clusters (App Gap only)

In App Gap mode, `result.clusters` is populated from `tieredResult.appGapClusters` and passed to `analyzeCompetitors`.
This calls `formatClustersForPrompt(clusters)` which expects full `SignalCluster` shape:
- `sources` (with `appStore`, `googlePlay`)
- `avgSimilarity` (for `.toFixed()`)
- `representativeQuotes`

If any cluster object is missing these properties, it throws. The error is caught at line ~1285 in `community-voice/route.ts` and swallowed (logged but non-blocking). Job completes but `competitor_analysis: 'failed'`.

**Why Hypothesis mode works:** It doesn't pass `clusters`, so `formatClustersForPrompt` is never called.

**Files involved:**
- `src/app/api/research/community-voice/route.ts:1187` — auto-competitor block
- `src/lib/research/competitor-analyzer.ts` — `formatClustersForPrompt`
- Catch block at `src/app/api/research/community-voice/route.ts:1285`

**Fix Applied:**
Added defensive guards in `formatClustersForPrompt` and `getClusterSummary` in `src/lib/embeddings/clustering.ts`:
- `cluster.sources ?? {}` handles missing sources
- `Number.isFinite(cluster.avgSimilarity) ? cluster.avgSimilarity : 0` handles missing/invalid avgSimilarity
- `Array.isArray(cluster.representativeQuotes) ? cluster.representativeQuotes : []` handles missing quotes
- `cluster.size ?? 0` handles missing size

**Testing Required:** Run a new App Gap search (e.g., Notion) and verify Competitor Intelligence auto-runs without requiring manual button click.

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