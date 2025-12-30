# Known Issues

Last updated: December 30, 2025

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

# 12-30: AI Filter Tuning (Domain Gate + Problem Match)

**Status:** 🔄 In Progress — Needs More Testing

## Background

After implementing embedding pre-filter with keyword gate (committed as `6105c45`), the AI filters (Domain Gate and Problem Match) became too strict. The embedding filter now does the heavy lifting for semantic relevance, so AI filters should be more inclusive.

## Changes Made (Uncommitted)

### 1. Domain Gate → Spam Filter Only
**File:** `src/lib/research/relevance-filter.ts` (lines 761-778)
- Changed from strict domain matching to pure spam filter
- Only rejects obvious spam: gaming, recipes, sports, entertainment
- Increased body preview from 100 to 250 chars for better context
- Unified prompt for all domain types (compound and simple)

### 2. Problem Match → Client Payment Check
**File:** `src/lib/research/relevance-filter.ts` (lines 1142-1164)
- Changed from "STRICT PROBLEM RELEVANCE CHECK" to inclusive check
- Now asks: "Is a CLIENT not paying or paying late?"
- Explicitly rejects personal debt, low wages, invoice templates
- Accepts related problems: non-payment, payment disputes, chasing money

### 3. Keyword Gate → Single Problem Indicator
**File:** `src/lib/embeddings/embedding-service.ts` (lines 522-529)
- Changed from requiring 2+ words with problem indicator
- Now passes with ANY single problem indicator word (late, unpaid, owed, etc.)
- Allows "Late invoices are killing my momentum" to pass (was failing before)

## Current Test Results

| Run | Signals | Relevant | Rate | Notes |
|-----|---------|----------|------|-------|
| 1 | 3 | 2 | 67% | "Feeling deflated" + "Late invoices" ✅ |
| 2 | 4 | 2 | 50% | Personal debt post leaked through |
| 3 | 1 | 1 | 100% | Low volume but high precision |

## Remaining Issues

### Issue 1: Low Signal Volume
**Problem:** Only getting 1-4 signals instead of target 10-15
**Cause:** Keyword gate may still be too restrictive. SingleWords list only contains problem indicators, missing common words like "invoice", "payment", "client"
**Next Step:** Investigate keyword extraction (extractProblemFocus) to ensure it returns both problem indicators AND common domain words

### Issue 2: Keyword Extraction Variability
**Problem:** Claude sometimes returns different keywords, causing inconsistent results between runs
**Evidence:** One run had 8 single words, another had only 5
**Next Step:** Consider caching keyword extraction per hypothesis, or using deterministic keyword list

### Issue 3: Personal Debt Posts Leaking Through
**Problem:** "No idea how I'm gonna survive" (about personal credit card debt) sometimes passes Problem Match
**Cause:** Sonnet not consistently following N rules
**Next Step:** Strengthen N examples in prompt, or add explicit debt keywords to reject list

## Files Modified (Uncommitted)

| File | Changes |
|------|---------|
| `src/lib/research/relevance-filter.ts` | Domain Gate spam-only prompt, Problem Match client payment check, increased body preview |
| `src/lib/embeddings/embedding-service.ts` | Keyword gate single indicator pass |

## What Works Well

1. **Embedding filter**: Correctly passes semantically relevant posts
2. **"Feeling deflated"**: Now passes (mentions "$10k owed through missed payments")
3. **"Late invoices"**: Now passes (exact problem match)
4. **CRM story**: Correctly rejected (about building product, not payment issues)
5. **Personal debt**: Usually rejected (about credit cards, not client payments)

## Next Session TODO

1. Commit current changes with WIP documentation
2. Investigate keyword extraction to ensure common domain words included
3. Run 5+ test runs to validate 60%+ relevance consistency
4. If volume still low, consider loosening keyword gate further
5. If precision drops, tighten Problem Match examples

---

# 12-28: Evidence Tab - Pain Signals Sub-tab Fixes

**Status:** ✅ All Complete (Dec 28, 2025)

## P0 - Critical (Trust-Breaking)

### ✅ Fix 1: Fix "STRONGEST SIGNAL: Unclear"
**Fixed:** Now shows actual highest-intensity quote with subreddit and intensity level. Falls back to "TOP SIGNALS: Multiple high-intensity signals detected" when keyword is "Unclear" or not helpful.

### ✅ Fix 2: Fix WTP Quote Not Showing WTP
**Fixed:** Added validation that WTP quotes contain actual purchase intent language (pay, spend, buy, price, etc.). If no valid WTP quote exists, shows "X potential indicators found (weak signal — no explicit quote)" instead of showing irrelevant quotes.

## P1 - High Priority

### ✅ Fix 3: Explain Emotional Tone Percentages
**Fixed:** Added "Posts may express multiple emotions" explanation. Changed from confusing percentages to counts "(11)" for clarity.

### ✅ Fix 4: Clarify "2 posts analyzed" vs "15 signals"
**Fixed:** Confidence line now shows "15 signals from 2 core posts" when data available, making distinction clear.

### ✅ Fix 5: Fix "Active-intensity" Terminology
**Status:** Verified - already using correct "Medium-intensity" throughout.

## P2 - Polish

### ✅ Fix 6: Fix "1 posts" Grammar
**Fixed:** Added `pluralize()` helper. All instances now correctly show "1 post" vs "2 posts", "1 signal" vs "2 signals".

### ✅ Fix 7: Red X Button
**Status:** N/A - No red X button found in PainScoreCard component. May have been from a previous version.

### ⏳ Fix 8: Score Calculation Explanation
**Status:** Deferred - Optional enhancement for future.

---

# 12-28: Evidence Tab - Data Quality Notice Fixes (Round 2)

**Status:** ✅ All Complete (Dec 28, 2025)

## P0 - Critical (Trust-Breaking)

### ✅ Fix 1: Remove "Relevance (0%)" Display
**Fixed:** Removed percentage display entirely. Now shows "2 of 695 posts matched your hypothesis" instead of misleading "Relevance (0%)".

### ✅ Fix 2: Fix Contradictory Signal Counts
**Fixed:** Added `totalSignals` to interface. Now shows "15 signals found (2 high-relevance)" instead of conflicting "5 core" vs "2 signals" messages.

### ✅ Fix 3: Fix Math Error
**Fixed:** Removed percentage calculation that rounded 0.29% to 0%. Shows absolute counts instead.

### ✅ Fix 4: Soften Accusatory Language
**Fixed:** Changed "Very broad topic — most posts are off-topic" → "Limited matches found. Consider refining your search terms." Never blames user.

## P1 - High Priority

### ✅ Fix 5: Make Sub-tabs Sticky
**Status:** Already complete from Round 1.

### ✅ Fix 6: Simplify Data Quality Notice
**Fixed:** Collapsed state now shows key info: "Limited Data: 2 relevant posts from 695 scanned [Details]". More informative at a glance.

## P2 - Polish

### ✅ Fix 7: Consistent Badge Labels
**Status:** Verified - all theme cards use "intensity" consistently (High/Medium/Low intensity).

### ✅ Fix 8: Source Table Collapse by Default
**Status:** Already collapsed by default from Round 1.

---

# 12-27: Evidence Tab - Themes Sub-tab Fixes (Round 1)

**Status:** ✅ All Complete (Dec 28, 2025)

## P1 - High Priority

### ✅ Fix 1: Consolidate Theme Card Badges
**Fixed:** Consolidated from 4 badges (tier + resonance + intensity + sources) down to 1 intensity badge + mentions count.

### ✅ Fix 2: Fix Inconsistent Badge Labels
**Fixed:** Changed "Med" → "Medium" for consistent "High/Medium/Low" labels.

### ✅ Fix 3: Make Sub-tabs Sticky or More Visible
**Fixed:** Sub-tabs now sticky with `position: sticky; top: 0; z-index: 10;` + background.

### ✅ Fix 4: Rename "Alternatives Mentioned"
**Fixed:** Renamed to "Platforms Mentioned" with updated description.

## P2 - Polish

### ✅ Fix 5: Add Copy Button to Customer Language
**Fixed:** Added "Copy All" button that copies all phrases as newline-separated list.

### ✅ Fix 6: Make Theme Cards Collapsible
**Fixed:** Cards now collapsible with chevron icons. Card 1 expanded by default, others collapsed. Added "Expand All" / "Collapse All" links at top.

### ✅ Fix 7: Increase Strategic Recommendations Readability
**Fixed:** Increased rationale text from `text-xs` (12px) to `text-sm` (14px).

### ✅ Fix 8: Verify Mention Count Math
**Fixed:** Added visible header note: "X themes identified from Y signals (some signals relate to multiple themes)".

---

# 12-26 Meeting: CEO Review - UI/UX Feedback

## Remaining Items (Still To Do)

### Connect Help Button to Canny
**Source:** CEO review
**Status:** Open — Deferred (external service configuration)
**Issue:** The "Help" button in the settings section leads to an unconnected Canny site, rendering it non-functional.
**Proposed:** Prioritize connecting the application to the Canny service to ensure the "Help" button functions as intended.

### Clarify Purpose of API Keys
**Source:** CEO review
**Status:** Open
**Issue:** The "API Keys" section in the settings is unclear. Its purpose, use case, and value are not understood.
**Proposed:** Provide a clear explanation of what the API keys are for, how they can be used, and their benefits. Based on this information, a decision can be made on whether to keep or remove the feature.

### Investigate Two-Panel Section
**Source:** CEO review
**Status:** Open
**Issue:** A previously discussed "two-panel section" for displaying research cannot be found in the current application. All research is presented in a single vertical column.
**Proposed:** Clarify what the "two-panel section" refers to. Provide a visual example or demonstration (e.g., using Playwright) to show where it is or how it's intended to work.

---

## CEO Review - Completed Items (December 27, 2025)

### ✅ Declutter Dashboard
**Source:** CEO review
**Fixed:** Removed "Completed" and "Success Rate" stat cards from QuickStats. Dashboard now shows only "Total Research" and "This Week" (2 stats instead of 4).

### ✅ Update Landing Page Content
**Source:** CEO review
**Fixed:** Complete landing page overhaul (Dec 29, 2025):
- Added "Who this is for" targeting line and visceral pain point copy
- Created ProductPreview component with accurate mockup of research results
- Redesigned features section as clean 2x2 bento grid
- Added FAQ accordion section
- Styled "The Switch" bar with dark gradient and green accent glow
- Updated light mode to cool gray palette (#F8FAFC) for modern SaaS feel
- Removed placeholder testimonials section

### ⚠️ Redesign Research Page Layout - INCOMPLETE
**Source:** CEO review
**Status:** Partial — Compacted components but core grid layout NOT done
**What was done:** Made "Sources Covered" collapsible, made InvestorMetricsHero compact.
**Still needed:** A floating/adaptable grid layout for research information. Currently everything is still in a single vertical column. The goal is to arrange information blocks side-by-side where appropriate, using space more efficiently (like a bento grid).

### ✅ Dashboard Kebab Menu Overlay Issue
**Source:** CEO review
**Fixed:** Action menu now uses 1/4 width sliding overlay with iOS-style buttons. Z-index issues resolved.

### ✅ Remove 'P' Icon from Collapsible Panel
**Source:** CEO review
**Fixed:** Changed to stacked "PV/RE" text logo in collapsed state.

### ✅ Reposition "Start New Research" Button
**Source:** CEO review
**Fixed:** Button repositioned for prominence.

### ✅ Display All Research on Dashboard
**Source:** CEO review
**Fixed:** Dashboard now shows all research with "Show more" pagination.

### ✅ Add Folder Organization for Research
**Source:** CEO review
**Fixed:** Full folder system implemented with CRUD API, folder filtering, and kebab menu organization.

### ✅ Remove Gimmicky Star Icons
**Source:** CEO review
**Fixed:** Sparkles/star icons removed from UI.

### ✅ Duplicate Kebab Menu Item
**Source:** CEO review
**Fixed:** Removed redundant 'View Details' option.

### ✅ Fix Collapsible Hypothesis Feature
**Source:** CEO review
**Fixed:** CollapsibleText now applied to both structured hypothesis (audience/problem) and raw hypothesis text.

### ✅ Improve Share and Export Functionality
**Source:** CEO review
**Fixed:** Added true 1-page Executive Summary PDF and Interview Guide PDF with "The Mom Test" principles.

### ✅ Make "Chat with your data" Window Collapsible
**Source:** CEO review
**Fixed:** Converted to side drawer overlay with floating trigger button. Premium UI with animations.

---

## P0 — Critical

### Data Quality Initiative (Dec 22, 2025)
**Status:** ✅ Implemented — Phase 0 Complete
**Impact:** Core value proposition at risk - 64% relevance issue + low data confidence

**Three Problems Identified (Now Solved):**

1. **Over-Filtering** ✅
   - Fixed: Two-stage filtering with Sonnet upgrade
   - Result: 80-85% relevance for app analysis mode

2. **Wrong Quote Selection Criteria** ✅
   - Fixed: Relevance-weighted quote selection (60% relevance + 25% specificity + 15% first-person)
   - Result: 100% quote relevance in app analysis test

3. **Weak WTP Signal Sources** ✅
   - Fixed: App reviews prioritized for WTP signals
   - Result: App analysis mode significantly outperforms hypothesis-only mode

**Solutions Implemented:**
- Two-stage filtering: Boolean pre-filter → Sonnet (fetch 3-5x more data, better model)
- Pronoun detection (first-person language boost 1.3x, third-person penalty 0.7x)
- Quote selection by hypothesis relevance, not pain intensity
- Grounded competitor discovery (from app stores + Reddit mentions, not Claude invention)
- Different data source priorities for hypothesis vs app search

**Test Results (Dec 22, 2025):**
- Freelancer hypothesis mode: 11% relevance (expected - hypothesis doesn't match Reddit discourse)
- Headspace app analysis: 80-85% relevance (excellent)
- System correctly identifies hypothesis/market mismatches

**Reference:** `docs/data-quality/DATA_QUALITY_BRIEF.md`, `docs/data-quality/PHASE0_TEST_RESULTS.md`

### Report Redesign — Two-Axis Verdict System (Dec 22-23, 2025)
**Status:** ✅ Implemented — Phase A+B+C+D Complete

**Problem Solved:** Single viability score conflated "market opportunity" with "hypothesis fit". Users paying £14 for a report showing "7.6/10 STRONG SIGNAL" but only 11% hypothesis relevance felt confused and cheated.

**Solution Implemented:**
- **Two-Axis Scoring:** Separate `hypothesisConfidence` (0-10) from `marketOpportunity` (0-10)
- **DualVerdictDisplay component:** Side-by-side score cards with gauges
- **Backward Compatibility:** Old results show single-axis, new results show both
- **Search Coverage Section:** "What We Searched" transparency table showing sources, scope, volume
- **Adjacent Opportunities:** Pivot suggestions when hypothesis confidence is low
- **Customer Language Bank:** Marketing phrases with copy functionality

**Key Components Added:**
- `src/lib/analysis/viability-calculator.ts` — `calculateHypothesisConfidence()`, `calculateMarketOpportunity()`
- `src/components/research/dual-verdict-display.tsx` — Two-axis UI
- `src/components/research/search-coverage-section.tsx` — "What We Searched" transparency
- `src/components/research/adjacent-opportunities.tsx` — Pivot suggestions
- `src/components/research/customer-language-bank.tsx` — Marketing phrases
- `src/lib/utils/coverage-helpers.ts` — Server-safe utility functions
- PDF generator updated with two-axis section, Customer Language Bank, Adjacent Opportunities

**Phase E (Tailored Next Steps):** ✅ Implemented (Dec 23, 2025)
- Dynamic recommendations based on confidence level (PROCEED/EXPLORE/PIVOT)
- TailoredNextSteps component with interview tips and action steps
- PDF report includes "Your Next Steps" page

**Remaining Data Sources:**
- Additional data sources (G2, Product Hunt) — deferred to Q1 2026

**Reference:** `docs/report-redesign/REPORT_REDESIGN_BRIEF.md`, `REPORT_STRUCTURE_TEMPLATE.md`

---

## Business Model Notes

### Credit System Reconsideration (Dec 15, 2025)
**Status:** Needs Discussion

The current credit model (1 credit = 1 research) may need rethinking:
- "Ask Anything" chat sidebar adds ongoing API costs per query (Claude Sonnet calls)
- Users can now ask unlimited follow-up questions after initial research
- Future features (multi-source, monitoring) will add more per-use costs

**Options to consider:**
1. **Fuel model** — Pool of API credits that depletes with each action
2. **Subscription tiers** — Monthly plans with usage limits (£29/£79/£199)
3. **Hybrid** — Base subscription + fuel top-ups for heavy users
4. **Query limits** — Cap "Ask Anything" queries per research (e.g., 10 free, then fuel)

**Decision deferred** — Will revisit when usage patterns are clearer

---

## User Flow Test Reports

### December 21, 2025 - Expat Social Isolation Test

**Tester:** User (Manual)
**Hypothesis Tested:** "expats feeling socially isolated during the seasonal festivities - christmas and new year as they do not have a social circle"
**Overall Result:** 11 UX friction points identified, relevance prediction dropped from 8% to 6% after refinement

#### User's Original Narrative (Verbatim)

> I am running this search "expats feeling socially isolated during the seasonal festivities - christmas and new year as they do not have a social circle" and as you can see we have this small 'good detail - try specifying who has this problem'. That's one thing that is off as i have mentionned this in my hypothesis already.
>
> Then we get to this Image 2, all looks good here - I press search this.
>
> Now we are on the Configure Research Screen as shown on image 3. I see ~692 posts. Under communities: I press to add r/socialskills 100, still the same ~692 posts. I look at Data Sources, there is only Reddit. I look at the Communities again and only see 100 posts per most communiites (even though we have changed this to get more posts to cover more time), so i think maybe i can do a deep search and get more posts. I press on Deep under Analysis Depth, no changes...
>
> Also Data Sources is displayed in a way where google Play and App Store are under data sources, it almost looks like the app stores are on their own and we think data Sources are Reddit mostly, there is no way to just disable Google Play or App Store at once. And I do not see Hacker news as data sources.
>
> I now press on Start Research and get image 4. The 'Based on analyzing 37 posts from your selected communities' is not the first thing i see. I have the feeling that spending this credit will only give me a match of 8% which sounds ridiculously small. as a new user i do not understand why i would only get 8%, there needs to be an explanation to this. But i see I can Broaden my search, suggestion of removing seasonal timing to find the year-round discussion. I Refine my hypothesis.
>
> I am now refining and i am on image 5. Here i am a little confused, before it seemed i had only one input window. Now there are two. Who's struggling, i am putting in Expats living abroad - Whats their Problem? I put 'Feeling lonely and socially isolated'. Now even though I have changed this, the search phrases are still the same. You can see this on image 6. I run it like this and click Continue with Changes.
>
> Now i am on image 7. I click search This.
>
> I am now on image 8 and honestly tired, I click start research.
>
> Now i am on Image 9 and it looks like this is even worse than it was before as we see 6%.

#### Friction Points Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | "Specify who" hint despite "expats" in input | P2 | ✅ Fixed - Added expat keywords |
| 2 | Adding subreddit doesn't update post count | P2 | ✅ Already worked (reactive) |
| 3 | Analysis Depth has no visible effect | P2 | ✅ Fixed - Pill counts now update with depth |
| 4 | Data source hierarchy confusing | P2 | ✅ Already grouped by type |
| 5 | No toggle to disable all app stores | P2 | ✅ Already existed |
| 6 | Hacker News not visible for remote work | P2 | ✅ Fixed - Added remote work keywords to HN trigger |
| 7 | Quality preview appears AFTER commit | P1 | ✅ Fixed - Already inline |
| 8 | No explanation for low relevance % | P1 | ✅ Fixed - Added "Why is relevance low?" section |
| 9 | Single vs dual input confusion | P2 | ✅ Fixed - Added inline editing, removed Adjust step |
| 10 | Search phrases don't regenerate | P1 | ✅ Fixed - Always regenerate on hypothesis change |
| 11 | Relevance worse after refinement (8%→6%) | P1 | ✅ Fixed - Cache sample posts for consistent scoring |

---

## P1 — Important

### ✅ Direct API Calls Don't Persist to Database (Dec 25, 2025)
**Status:** Documented/By Design (Dec 29, 2025)
**Resolution:** This is intentional behavior - allows stateless API calls for quick testing without polluting the database.

**Behavior:**
| Scenario | Credit Deducted | Results Returned | Saved to DB |
|----------|-----------------|------------------|-------------|
| With `jobId` | ✅ | ✅ | ✅ |
| Without `jobId` | ✅ | ✅ | ❌ |

**Documentation Added:**
- `docs/TECHNICAL_OVERVIEW.md` → "API Persistence Behavior" section
- `CLAUDE.md` → "Documentation Updates" section

**Workaround for Testing:** See `docs/TECHNICAL_OVERVIEW.md` → "API Persistence Behavior" for the two-step flow (create job first, then call community-voice with jobId).

---

## P2 — Low Priority

*All P2 issues from user testing have been resolved. See Completed Issues section below.*

---

## P3 — Future Enhancements

### AI vs Code Audit (Dec 23, 2025)
**Status:** Open — Track for post-launch review
**Impact:** Non-determinism in AI calls can cause inconsistent results

**Problem:** Several features use AI where deterministic code might work better. AI calls are:
- Non-deterministic (same input → different output)
- Slower and costlier than code
- Harder to debug and reproduce

**Current AI usages to audit:**
1. **Google Trends keyword extraction** (`extractTrendKeywordsWithAI`) — Uses AI to extract problem-focused keywords. ✅ Now cached for 7 days per hypothesis for deterministic results.
2. **Hypothesis interpretation** — Extracts audience/problem/search phrases
3. **Theme extraction** — Groups pain signals into themes
4. **Relevance filtering** — Determines if posts match hypothesis

**Recommended approach:**
- Audit each AI usage after MVP stabilizes
- For each: Can rules achieve 80%+ of the quality?
- Prefer code when determinism matters (search, scoring)
- Use AI when semantic understanding is essential (interpretation, summarization)
- Cache AI results when possible to ensure consistency per hypothesis

**Decision:** Defer until post-launch when usage patterns are clearer.

### App Analysis Results Parity (Dec 29, 2025)
**Status:** Open — Backlog
**Impact:** Inconsistent UX between hypothesis validation and app analysis modes

**Problem:** App-side results don't have the same polish as hypothesis-side results. Need to ensure consistency between both research modes in terms of UI treatment, data display, and feature parity.

**Files:** `src/app/(dashboard)/research/[id]/page.tsx`, components in `src/components/research/`

### PDF Exports Professional Redesign (Dec 29, 2025)
**Status:** Open — Backlog
**Impact:** Reports look too casual for business use

**Problem:** Current PDF exports are too colorful and not professional enough. Need sharper, more business-appropriate design.

**Files:** `src/lib/pdf/report-generator.ts`

### TAM/SAM/SOM External Data Sources (Dec 29, 2025)
**Status:** Open — Backlog
**Impact:** Market sizing estimates lack grounded data

**Problem:** Current TAM/SAM/SOM estimates are Fermi-based calculations. Need to research and integrate reliable external data sources for more realistic market sizing.

**Files:** `src/lib/analysis/market-sizing.ts`

### TikTok Data Source Wrapper (Dec 29, 2025)
**Status:** Open — Backlog
**Impact:** Missing popular social platform for pain signal discovery

**Problem:** TikTok is a major source of user-generated content about problems and pain points. Need to research API options and create adapter following `DataSourceAdapter` pattern.

**Files:** `src/lib/data-sources/`

### Google Trends API Expansion (Dec 29, 2025)
**Status:** Open — Backlog
**Impact:** Underutilizing available Google Trends data

**Problem:** Currently Google Trends is only used for timing analysis. Could leverage additional features: related queries, regional interest, rising topics.

**Files:** `src/lib/data-sources/google-trends.ts`

---

## Completed Issues

### December 24, 2025 (Redesign Complete + Full UI/UX Test)
- ✅ **[P0] PVRE Redesign Complete** — All 4 phases of UI/UX redesign finished:
  - Phase 1: Trust badges, WTP hero, two-axis verdict, Google Trends
  - Phase 2: Dual-layout infrastructure, HN integration, layout toggle
  - Phase 3: Scroll layout default, Trustpilot adapter
  - Phase 4: Accessibility (skip-to-content, ARIA labels), jsPDF dynamic import (~300KB savings)
- ✅ **Full UI/UX Validation Test** — Comprehensive testing matching phase0-test-results methodology:
  - Test 1 (Freelancer Invoicing): Conf 4.1, Opp 5.9 - correctly identifies hypothesis/market mismatch
  - Test 2 (Headspace App): Conf 8.4, Opp 8.0 - validates problem space with high confidence
  - All 5 critical UI issues from ui-analysis.md confirmed FIXED
  - Time to verdict: <5 sec (was 30+), Clicks to WTP: 0 (was 3-4)
- ✅ **Test artifacts saved** — Raw JSON + PDFs for both tests saved to Downloads folder

### December 24, 2025 (Model Updates + Cost Optimization)
- ✅ **[P1] Deprecated Model in Relevance Filter** — Updated from `claude-3-5-sonnet-20241022` to `claude-sonnet-4-20250514` in relevance-filter.ts
- ✅ **Cost Optimization** — Downgraded Google Trends keyword extraction from Sonnet ($3/M) to Haiku ($0.80/M) - 3x cheaper
- ✅ **Model Standardization** — Updated 7 locations from old `claude-3-haiku-20240307` to `claude-3-5-haiku-latest`

### December 24, 2025 (CEO Review Fixes)
- ✅ **[P0] PDF Interview Questions Bug** — Fixed `[object Object]` rendering in PDF interview questions. Root cause: AI sometimes returns `{purpose, question}` objects instead of plain strings. Fix: Added defensive type handling in report-generator.ts line 732.
- ✅ **[P0] preFilterAndRank() Wired In** — The first-person pronoun filter infrastructure existed but was not connected to the pipeline. Now integrated between quality gate and domain gate filter. Posts are ranked by pre-score (first-person language + engagement + recency) and only top 150 candidates sent to AI. Expected cost savings: ~$0.02-0.03 per search (15-25%).
- ✅ **[P1] AutoModerator Filter** — Added `bot_content` filter reason in quality gate to skip AutoModerator and [deleted] author posts before AI processing. Saves unnecessary Haiku calls on bot messages.
- ✅ **[P1] Data Sources Display Fix** — Fixed "Reddit, Trustpilot" showing in coverage display even when Trustpilot returned 0 signals. Coverage helper now only shows sources that actually contributed data.
- ✅ **[P1] Trustpilot Auto-Trigger Fix** — Disabled naive keyword-based auto-triggering (e.g., hypothesis containing "invoice" triggering Trustpilot). Now Trustpilot only auto-triggers when: (1) hypothesis mentions a known product name (QuickBooks, FreshBooks, etc.), or (2) hypothesis uses product research patterns ("users of X", "alternative to Y"). For general problem validation, user must explicitly select Trustpilot. Prevents wasting API calls fetching irrelevant product reviews for hypothesis searches.
- ✅ **[P1] Comment Pre-Filter Added** — Comments were bypassing preFilterAndRank, causing ~600 comments to hit AI when only ~200 were quality candidates. Added `preFilterAndRankComments()` function that ranks by first-person language (40%), engagement (40%), and recency (20%). Now limits to top 200 before AI processing. **Result: 67% reduction in comments sent to AI, 30% fewer Haiku calls, ~17% cost reduction.**

### December 21, 2025 (User Testing Fixes - Session 2)
- ✅ **[P2] Hacker News for Remote Work** — Added remote work keywords ("remote", "wfh", "distributed team", "digital nomad", "freelancer", etc.) to TECH_KEYWORDS so Hacker News appears as a data source for remote work hypotheses.
- ✅ **[P2] App Stores Only for App Hypotheses** — App stores (Google Play, App Store) now only appear when hypothesis mentions mobile apps. For non-app hypotheses (e.g., "remote workers feeling isolated"), app stores are hidden since app reviews contain bug complaints, not problem validation signals.
- ✅ **[P2] Relevance Check Simplified** — Replaced confusing percentages with binary "Good match" / "Broad search" feedback. Added Beta badge and hide toggle. Clear explanation shows sample size tested.

### December 21, 2025 (User Testing Fixes - Session 1)
- ✅ **[P1] Search Phrase Regeneration** — Fixed phrases not regenerating after hypothesis change. `handleConfirmAdjustments()` and `applyRefinement()` now ALWAYS trigger interpret-hypothesis API to get fresh phrases when audience/problem changes. User-added custom phrases are preserved.
- ✅ **[P1] Low Relevance Explanation** — Added "Why is relevance low?" educational section in coverage-preview.tsx. Explains common causes: too specific/seasonal terms, narrow problem definition, different language used online. Also added concrete calculation: "Based on checking 40 sample posts: 5 matched your problem" so users understand WHERE the percentage comes from.
- ✅ **[P1] Consistent Relevance During Refinement** — Fixed relevance % fluctuating due to random sample variance. Coverage-check API now caches sample posts and reuses them for subsequent checks during the same session. Ensures consistent quality scoring.
- ✅ **[P2] Expat Keywords** — Added expat/immigrant/foreigner/abroad keywords to AUDIENCE_WORDS array in conversational-input.tsx. Users specifying these terms no longer see "specify who" hint.
- ✅ **[P2] Single vs Dual Input Confusion** — Replaced jarring "Adjust" screen transition with inline editing. Users can now click "Edit" next to Audience or Problem on the confirm screen to edit inline. Removed separate adjust step entirely. Phrases are automatically regenerated after inline edits.
- ✅ **[P2] Analysis Depth Pill Counts** — Fixed community pills always showing "100" regardless of Quick/Standard/Deep selection. Root cause: API only fetches 100 posts for stats, so `estimatedPosts` maxes at 100. Fix: If `estimatedPosts >= 100`, display `sampleSize` (150/300/450) since more posts exist. Verified: Quick shows 150, Standard shows 300, Deep shows 450 per community.
- ✅ **[P2] Coverage Check Caching** — Added two-tier caching (in-memory 30min + Supabase 90 day) for coverage check API calls. Prevents redundant searches when refining hypotheses or revisiting coverage preview.
- ✅ **[P2] Community/Depth/Sources Already Working** — Verified post count is reactive to community selection, data sources are grouped by type, app store toggle exists, and HN appears for tech hypotheses.

### December 18, 2025
- ✅ **[P0] App IAP Display** — Fixed apps showing "Free" when they have In-App Purchases. App Store adapter now detects IAP from description keywords (subscription, premium, unlock, etc.) since API doesn't provide `offersIAP` field. Display shows "Free + IAP" instead of just "Free".
- ✅ **[P0] Feedback Tab Quality** — Fixed truncated review text (was 150 chars, now expandable with "Read more"). Fixed missing positive reviews by using star ratings (4-5★ = positive, 1-2★ = pain). Added star rating display to each quote.
- ✅ **[P0] Market Tab Source Separation** — Themes now show source badges (Reddit, Google Play, App Store). Theme extraction prompts track which sources each theme appears in. "Sources analyzed" header shows app store sources alongside subreddits.
- ✅ **[P0] Chat Typo Fix** — Fixed "Familys" typo in niche detection by using explicit plural mappings instead of simple `+ 's'` pluralization.
- ✅ **[P0] Verdict Warning Frequency** — Fixed warnings appearing too frequently. Raised "Narrow Problem Definition" threshold from 50% to 70% AND requires <15 relevant posts. Raised "Very High Filter Rate" threshold to 95% AND <10 posts analyzed. Warnings only appear when they indicate actual problems.
- ✅ **[P1] Revenue/Pricing Adaptation** — Fixed pricing defaults not adapting to app categories. Improved category matching using keyword-based lookup instead of exact string matching. Handles different formats (HEALTH_AND_FITNESS, Health & Fitness, etc.). Added more categories (food, photo, video, travel, news).
- ✅ **[P1] Relevance Signal Accuracy** — Made Stage 1 (Domain Gate) more lenient with clearer "when in doubt, say Y" instructions. Made Stage 2 (Problem Match) more balanced - accepts "closely related challenges" and "posts seeking solutions" while still filtering clearly irrelevant content.
- ✅ **[P2] Scoring Logic Documentation** — Confirmed scoring logic is documented in TECHNICAL_OVERVIEW.md (lines 195-241). Formula: Pain (35%) + Market (25%) + Competition (25%) + Timing (15%). Relevance improvements above help make scores more reliable.

### December 16, 2025 (Evening)
- ✅ **[UX] Analysis Depth Selector** — Users can now choose sample size per source: Quick (100), Standard (200), Deep (300). Shows "per source, prioritizing 2-3★ reviews" and total data points estimate. Passed through to research pipeline via `sampleSizePerSource` in coverage data.
- ✅ **[UX] Honest Data Source Counts** — Changed misleading totals to "X of Y" format. E.g., `Google Play (100 of 86,351)` instead of `(86,351)`. Users now see what we'll actually analyze vs what's available.
- ✅ **[UX] Accurate Coverage Header** — Changed "Found ~402,576 relevant discussions" to "Analyzing ~800 of 402,576 available" based on selected sample size and data sources.
- ✅ **[UX] Smart Pricing Defaults** — Auto-set pricing based on app category (Health & Fitness: $10, Medical: $15, etc.) for app-centric mode. User can still override via "Change" button.
- ✅ **[UX] Market Opportunity Header** — Changed confusing "Hypothesis Being Tested" header to "Market Opportunity" with "Finding white space around this competitor" for app-centric mode.

### December 16, 2025
- ✅ **[Phase 3] App Store Pipeline Integration** — Google Play and App Store adapters now fully integrated into research pipeline. When users select these sources in coverage preview, reviews are fetched and flow through the same relevance filter and pain detection as Reddit posts. Source attribution via `subreddit` field (`google_play`, `app_store`) enables proper tracking in pain signals and reports.
- ✅ **[Phase 3] HN Search Relevance Fix** — Hacker News search now uses single-keyword strategy to avoid returning irrelevant results. Multi-word queries caused the Algolia API to return poor matches; single primary keyword provides much better relevance.

### December 15, 2025
- ✅ **[Phase 3] Multi-Source Data Adapters** — Implemented unified `DataSourceAdapter` pattern with Google Play, App Store, and Hacker News adapters. Each adapter outputs `UnifiedSignal` format with normalized engagement scores. Coverage preview shows estimated post counts from each source.
- ✅ **[Phase 2] Ask Anything Chat Sidebar** — Chat interface on research results page allows users to ask follow-up questions about their data. Uses Claude Sonnet to analyze stored pain signals and provide insights.
- ✅ **[Phase 2] Topic Resonance Scoring** — Each theme now displays engagement quality (High/Medium/Low resonance) based on engagement rate relative to views.

### December 14, 2025
- ✅ **[Phase 2] Dark Mode with User Settings** — Full dark mode support with automatic system preference detection. Uses `next-themes` for theme management. Theme toggle button in header (sun/moon icon) allows quick switching. New "Appearance" section in Settings page with System/Light/Dark options. Cookie banner, dashboard badges, and notifications page all updated for dark mode. Users can choose to follow system settings or force light/dark mode.
- ✅ **[Phase 2] Multi-Source URL Support** — Expanded URL analysis mode to support 7 sources: Reddit, Twitter/X, Product Hunt, Hacker News, Indie Hackers, LinkedIn, and any website. Each source has its own icon and detection. URLs are validated and source type is auto-detected. Helpful for analyzing competitor pages, discussions, and reviews from various platforms.
- ✅ **[Phase 2] Emotions Breakdown** — Added emotional tone analysis to pain signals. Detects 6 emotions: Frustration, Anxiety, Disappointment, Confusion, Hope, Neutral. Each signal is classified and displayed with emoji badges and percentages in Community Voice results. Keywords-based detection using common emotional expressions.
- ✅ **[Phase 2] URL Analysis Mode** — Added "Paste URL" tab to input with mode toggle (Describe/Paste URL). Validates Reddit URLs with visual feedback. Currently Reddit-only with "Coming soon" note for other sources. UI ready for future backend expansion.
- ✅ **[Phase 2] Better Loading Experience** — Fun progress phases: "Firing up the engines", "Gathering the juicy data", "Picking out the hot takes", etc. Added rotating founder quotes (Paul Graham, Reid Hoffman, Steve Blank, etc.) that cycle every 8 seconds during loading.
- ✅ **[P3] Input Quality Indicator** — Real-time hint below input showing detail level. Detects audience words (who, parents, freelancers, etc.) and problem words (struggle, frustrated, hate, etc.). Shows "Try adding more detail" (< 20 chars), contextual suggestions (20-50 chars), or "Great detail ✓" (50+ with both audience and problem detected).
- ✅ **[P2] Honest Labeling for Removed Posts** — Changed "recoverable" to "title_only" throughout the codebase. Progress messages now say "Including X posts (title only)" instead of "Recovering X posts". Body preview shows "[removed] - title only" instead of "[removed] - recoverable via title". More honest about what we're actually doing with moderated posts.
- ✅ **[P2] Refinement Suggestions for Vague Input** — Enhanced refinement suggestions UI: Low confidence inputs get amber warning styling with AlertTriangle icon and explanatory text "Broad searches often return irrelevant results." Medium confidence gets violet styling with Sparkles icon. Suggestions are clickable buttons that apply the refinement and proceed to search.
- ✅ **[P1] Red Flags Section at Top of Report** — Added prominent "Red Flags Detected" card that appears BEFORE the viability score when critical issues exist. Shows: No Purchase Intent (0 WTP), Saturated Market (free competitors), Narrow Problem Definition (high Stage 2 filter rate), and Very High Filter Rate (>90% posts filtered). Each flag has severity badge (HIGH/MEDIUM) and explanatory message.
- ✅ **[P1] Do Not Pursue Verdict Tier** — Updated verdict thresholds: WEAK SIGNAL now 4.0-5.0 (was 2.5-5.0), below 4.0 is "DO NOT PURSUE" with clear stop message. Updated descriptions: WEAK = "Significant concerns detected. Validate core assumptions before building." DO NOT PURSUE = "No viable business signal detected. Pivot to different problem or audience."
- ✅ **[P0] Two-Stage Relevance Filter** — Stage 2 now checks SPECIFIC PROBLEM, not just domain. Prompts updated to require exact problem matching with examples. Tracks `stage2FilterRate` (% of domain-relevant posts failing problem filter) and `narrowProblemWarning` flag (true when >50% fail). Water reminder test: 87.7% of "hydration" posts correctly filtered out because they weren't about "forgetting to drink."
- ✅ **[P0] Viability Score Inflation from Market Sizing** — Market Score now adjusted by WTP Factor (0→×0.3, 1-3→×0.6), Severity Factor (based on averageIntensity), and Free Alternatives Factor (×0.5 if freemium exists). Water reminder app Market Score dropped from 9.0 to 1.8/10.
- ✅ **[P0] Zero WTP Kill Switch** — Score capped at 5.0 when `wtpSignals === 0 && totalSignals < 20`. Prevents inflated scores for ideas with no purchase intent.
- ✅ **[P1] Competition Saturation Cap** — Hard cap at 5.0 for saturated markets with dominant free competitors. Soft cap at 6.5 for saturated markets.

### December 13, 2025
- ✅ **[P0] Data Quality Surfaced to Users** — Verdict labels now calibrated based on sample size. When data is limited (<20 posts): "STRONG SIGNAL" → "PROMISING — LIMITED DATA". Score displays confidence range (e.g., "7.8 ±2.0"). Implemented in `viability-calculator.ts` with `calibratedVerdictLabel` and `scoreRange` fields.
- ✅ **[P0] Pain Score Consistency** — Now uses ONE calculated pain score consistently. Community Voice header uses `calculateOverallPainScore()` (same formula as Verdict dimensions). Eliminated confusion from multiple different scores.
- ✅ **[P1] Sample-Size-Based Confidence** — Verdict labels now account for sample size: "very_limited" (<20), "low_confidence" (20-49), "moderate_confidence" (50-99), "high_confidence" (100+). Verdict badge changes based on this (e.g., "STRONG — NEEDS MORE DATA").
- ✅ **Removed Posts in Example Preview** — Filter added in `coverage-preview.tsx` to exclude posts with titles containing "[removed]", "[deleted]", or shorter than 20 characters. Only valid, readable posts shown in preview.
- ✅ **Search Phrase Display** — Verified that search phrases are displayed as individual list items with checkmarks (not concatenated into a truncated sentence). Current implementation already uses solution #3 (list format).

### December 12, 2025 (afternoon)
- ✅ **[P1] Actionable Executive Summaries** — Theme analysis now includes 2-3 strategic recommendations (action + rationale) and a key opportunity callout. Executive Summary UI displays numbered recommendation cards and green-highlighted opportunity box.
- ✅ **[P0] Live Post Preview** — Coverage check now shows 5 actual Reddit post titles ("Example posts we'll analyze") from top subreddits before user spends credit. Clickable links to original posts.
- ✅ **[P2] Editable Search Phrase Pills** — Users can now remove irrelevant AI-generated phrases (x button) and add custom ones ("+ Add" button) directly in the confirmation step.
- ✅ **[P0] Conversational Input Redesign** — Single text field → AI interprets → User confirms. New `/api/research/interpret-hypothesis` endpoint uses Claude to extract audience, problem, and search phrases. Three-step wizard: input → confirm interpretation → adjust if needed. Dramatically reduces input friction.
- ✅ **[P1] Hypothesis Comparison Feature** — Side-by-side comparison of 2-4 hypotheses. Dashboard has "Compare Hypotheses" button that enters selection mode. Comparison page shows Best Performers summary, Score Comparison grid with color-coded cells and trophy badges, and Detailed Metrics table (pain signals, WTP, TAM, trend, posts analyzed).

### December 12, 2025
- ✅ **[P0] Audience-Aware Search Discovery** — Three-part fix: (1) Subreddit discovery now detects transition hypotheses and prioritizes transition-focused subs (r/careerguidance, r/sidehustle) over established business subs (r/Entrepreneur, r/smallbusiness). (2) Keyword extractor extracts "gap phrases" for transition hypotheses. (3) Relevance filter uses audience-aware tiering (CORE = employed seeking transition, RELATED = established entrepreneurs).
- ✅ **[P0] Signal Tiering for Multi-Domain Hypotheses** — Implemented CORE/RELATED/N classification in relevance filter. CORE signals (intersection matches) now weighted higher, RELATED signals labeled as contextual in theme extraction.
- ✅ **[P0] Always Include Removed Posts** — Now recovers all [removed] posts with substantive titles (>30 chars), not just when data sparse. Weight increased from 0.5x to 0.7x.

### December 10, 2025
- ✅ Theme extraction producing word frequencies — Added quality validation and retry
- ✅ Admin dashboard analytics reset — Implemented with localStorage
- ✅ Admin dashboard API health reset — Implemented with localStorage
- ✅ Partial title-only recovery — Works as sparse-data safety net

### December 9, 2025
- ✅ Market sizing pricing scenarios — Full implementation
- ✅ Viability verdict calibration — Score spreading + data sufficiency
- ✅ Sample size indicator — Confidence labels based on post count
- ✅ Problem gate over-filtering — Asymmetric matching (Problem=STRICT, Audience=LOOSE)

### December 8, 2025
- ✅ Relevance filter matching audience instead of problem — 3-stage filtering
- ✅ AI suggested competitors not visible during processing
- ✅ Price input manual typing
- ✅ Problem language auto-generation

### December 7, 2025
- ✅ Keywords extraction including solution words
- ✅ Low-relevance subreddits auto-selected
- ✅ Subreddit discovery returning generic demographics
- ✅ Competitor comparison matrix confusion
- ✅ Low data quality / not enough posts
- ✅ Google-only auth
- ✅ Market sizing without revenue goal

### December 3, 2025
- ✅ Hypothesis input optimized for solutions
- ✅ Single text field limitations
- ✅ No subreddit validation
- ✅ Tab-close anxiety
- ✅ No first-time onboarding
- ✅ No clear credit purchase path

---

## How to Use This File

**Format:**
```
### TITLE
**Status:** Open, DATE
**Impact:** What user pain this causes

**Problem:** Description

**Solution:** Brief fix (reference IMPLEMENTATION_PLAN.md for details)
```

**For CC:** Check P0 first, then P1. Full specs in IMPLEMENTATION_PLAN.md.
