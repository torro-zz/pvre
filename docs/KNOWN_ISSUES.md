# Known Issues

Last updated: December 14, 2025

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## P0 — Critical

*No open P0 issues*

---

## P1 — Important

*No open P1 issues*

---

## P2 — Low Priority


System marks them "recoverable" but only analyzes titles. Full post body would provide richer pain signals. Reddit moderation is destroying r/Entrepreneur data in real-time.

**Solution options:**
1. **Actually recover** — Use Pushshift/Reveddit archives to get full body text
2. **Honest labeling** — If not recovering, change label from "recoverable" to "title_only"
3. **Source diversification** — Prioritize subreddits with less aggressive moderation

---

### Refinement Suggestions for Vague Input
**Status:** Open, December 12th
**Impact:** Vague hypotheses still produce vague searches

**Problem:** When user enters something broad like "gym socializing", AI interprets it but doesn't offer narrower alternatives. User might not realize a more specific angle would get better results.

**Solution:** Detect vague/broad inputs and show refinement suggestions:
```
Your input is quite broad. You might get better results with:
- "introverts wanting to make gym friends"
- "fear of being creepy when approaching people at gym"
- "gym etiquette for starting conversations"
```

---

## P3 — Future Enhancements

### Input Quality Indicator
**Status:** Open, December 12th
**Impact:** Users don't know if their input is detailed enough

**Problem:** No feedback on whether the free-form input has enough detail for a good search. Users might submit one-word inputs and get poor results.

**Solution:** Show real-time hint below input:
- < 20 chars: "Try adding more detail"
- 20-50 chars: "Good start — who's the audience?"
- 50+ chars with audience + problem: "Great detail ✓"

---

## Completed Issues

### December 14, 2025
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
