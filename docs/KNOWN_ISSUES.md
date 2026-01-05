# PVRE Known Issues

*Last updated: January 5, 2026*

---

## 🔴 CRITICAL — Fix First

### Verdict Messages Contradict Each Other
**Status:** Open
**Impact:** Users get conflicting guidance
**Location:** Verdict tab

Yellow recommendation box says "proceed with caution" while verdict section says "pivot". Mixed signals confuse users.

**Fix:** Ensure recommendation text aligns with verdict score and assessment.

---

### Hypothesis Confidence Wrong Metric for App Gap Mode
**Status:** Open
**Impact:** Two-axis viability assessment uses irrelevant metric
**Location:** Verdict tab

Shows "Hypothesis Confidence" axis in App Gap mode, but no hypothesis was tested — user analyzed an existing app.

**Fix:** For App Gap mode, replace "Hypothesis Confidence" with "Signal Quality" or "Data Confidence". Keep current metric for Hypothesis mode only.

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

## 🟡 MEDIUM — Next Sprint

### WTP Comments Truncated and Unreadable
**Status:** Open
**Impact:** Users can't read full willingness-to-pay signals
**Location:** Gaps tab > WTP section

Comments under "Willingness to Pay Signals" are cut off, unlike other sections which show full text.

**Fix:** Show full text for WTP signals, or add "expand" button. Match behavior of other sections.

---

### Google Trends Keyword Truncated
**Status:** Open
**Impact:** Incomplete data display
**Location:** Market tab > Timing section

Shows "dating apps for relation" cut off instead of full keyword.

**Fix:** Display full keyword. If space constrained, use tooltip for full text or truncate with "..." and show full on hover.

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

## 🔵 PLANNED FEATURES

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

## Recently Verified Fixed (January 5, 2026)

| Issue | Verification |
|-------|--------------|
| Comparison Matrix empty | ✅ Now shows 6 competitors × 5 dimensions with scores |
| Comparative Mentions | ✅ NEW: Extracts real user comparisons from reviews |
| App Store dates null | ✅ Timestamps present (e.g., `1763722867`) |
| Recency metrics zero | ✅ `last30Days: 33`, `last90Days: 37` |
| Self-competitor in list | ❌ **REOPENED** — Name mismatch issue, see CRITICAL section |
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