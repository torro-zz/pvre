# Known Issues

Last updated: December 22, 2025

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

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

*All P1 issues from user testing have been resolved. See Completed Issues section below.*

---

## P2 — Low Priority

*All P2 issues from user testing have been resolved. See Completed Issues section below.*

---

## P3 — Future Enhancements

*No open P3 issues*

---

## Completed Issues

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
