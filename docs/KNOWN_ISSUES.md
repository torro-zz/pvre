# Known Issues

Last updated: December 13, 2025

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## P0 — Critical

### Data Quality Not Surfaced to Users
**Status:** Open, December 12th
**Impact:** Users see "STRONG SIGNAL" when underlying data is weak — trust damage when discovered

**Problem:** Research with 97% filter rate (15 posts analyzed from 497 found) displays:
- Viability: "7.8/10 STRONG SIGNAL"
- Confidence: "high"
- No visible indicator that data quality is "low"

The JSON contains `qualityLevel: "low"` but this never appears in the PDF or UI. A sophisticated user who exports JSON will discover the gap between presented confidence and actual confidence.

**Evidence from Dec 12 test:**
```
postsFound: 497
postsAnalyzed: 15
postFilterRate: 96.98%
qualityLevel: "low"  ← hidden from user
```

**Solution:**
1. **Verdict calibration** — When `qualityLevel: "low"`:
   - Change "STRONG SIGNAL" → "PROMISING — NEEDS MORE DATA"
   - Add confidence range: "7.8 ±1.5/10"
   
2. **Prominent data quality badge** — Page 1 of PDF and results header:
   ```
   📊 Data Quality: LOW (15 posts analyzed)
   ⚠️ Interpret scores with caution — limited sample size
   ```

3. **Sample size context** — Show "Based on X posts from Y communities" near every score

---

### Pain Score Inconsistency
**Status:** Open, December 12th
**Impact:** Multiple pain scores displayed — users question data integrity

**Problem:** Same research shows three different pain scores:
| Location | Score |
|----------|-------|
| Dimension Breakdown (PDF p.1) | 6.0/10 |
| Theme Analysis overall (JSON) | 8.0/10 |
| Community Voice header | 8/10 |

They measure different things (weighted viability component vs raw intensity) but display without explanation.

**Solution:**
1. Use ONE pain score consistently throughout UI/PDF
2. If showing multiple, clearly label: "Pain Intensity: 8/10" vs "Weighted Pain Score: 6/10"
3. Tooltip or footnote explaining the difference

---

## P1 — Important

### Confidence Labels Don't Scale With Sample Size
**Status:** Open, December 12th
**Impact:** "High confidence" on 15 posts undermines credibility

**Problem:** System reports `confidence: "high"` for timing and market sizing based on 15 posts and 35 comments. This isn't statistically defensible.

**Current behavior:** Confidence is set by AI judgment, not sample size.

**Solution:** Implement sample-size-based confidence scaling:
```
<10 posts  → confidence: "very_low"
10-25      → confidence: "low"
25-50      → confidence: "medium"
50-100     → confidence: "high"
>100       → confidence: "very_high"
```

AI can still adjust within ±1 tier based on signal quality, but sample size sets the baseline.

---

## P2 — Low Priority

### [removed] Posts Marked "Recoverable" But Not Recovered
**Status:** Open, December 12th
**Impact:** Title-only analysis loses pain signal depth

**Problem:** Relevance decisions show many posts as:
```
"reason": "removed_recoverable"
"body_preview": "[removed] - recoverable via title"
```

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

### December 13, 2025
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
