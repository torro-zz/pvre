# PVRE Known Issues

*Last updated: January 18, 2026*

**For resolved issues, see: `docs/archive/RESOLVED_ISSUES.md`**

---

## Issue Format

Each issue MUST include a **Verify** field with manual testing steps:
```
**Verify:** [How to test] → [Where to look] → [What to check]
```

---

## Open Issues

### 🔴 HIGH

#### App Gap Mode: Very Low Signal Yield from App Reviews
**Impact:** Only ~0.5% of app reviews become signals (5 signals from 1000 reviews)
**Location:** Pain detection pipeline for App Gap mode

**Root cause (investigated Jan 16):**
1. **Embedding filter too strict** — Reviews filtered against hypothesis, but app review language doesn't match hypothesis semantics
2. **Pain keywords required** — Neutral/mildly negative reviews dropped
3. **Double praise filter** — App Gap has regex + embedding praise filters (overkill)

**Potential fixes:**
- Bypass embedding filter for app reviews in App Gap mode (they're inherently relevant)
- Relax praise filtering for app reviews
- Lower thresholds for app store sources

**Key files:**
- `src/lib/filter/tiered-filter.ts`
- `src/lib/analysis/pain-detector.ts`
- `src/app/api/research/community-voice/route.ts`

**Verify:** Run App Gap search → Should see >5% of reviews become signals

---

### 🟡 MEDIUM

#### Market Score Unexplained
**Impact:** Users don't understand score meaning
**Location:** Market tab

Shows "1.0" and "Critical" with "11.1% penetration" but no context.

**Fix:** Add explanation of market score calculation and what penetration percentage represents.
**Verify:** Run search → Market tab → Score should have tooltip or explanation text

---

#### Streaming Route Not Full Parity with Non-Streaming
**Location:** `src/app/api/research/community-voice/stream/route.ts`

The auto-competitor logic in streaming route is missing inputs that non-streaming route uses:
- No competitor detection step (extracts competitors from pain signals)
- No `knownCompetitors`, `targetGeography`, `maxCompetitors` parameters

**Impact:** Lower quality competitor analysis results in Hypothesis mode.

**Fix:** Extract competitor detection logic into shared function, call from both routes.
**Verify:** Run Hypothesis search → Market tab → Check competitor quality matches App Gap mode

---

### 🟢 LOW — Polish

#### App Gap Mode: Consider Similar Summary Simplification
**Impact:** App Gap tabs may have similar redundancy issues as Hypothesis mode had
**Location:** App Gap mode tabs (App, Feedback, Market, Gaps, Verdict)

After simplifying Hypothesis Summary tab (Jan 16), consider whether App Gap mode would benefit from similar "verdict + why + where to dig" approach. App Gap layout is different so may need different treatment.

**Verify:** Review App Gap mode layout → Determine if consolidation makes sense

---

#### Sentiment Overview Format Confusing
**Impact:** Users can't quickly understand overall sentiment
**Location:** Feedback tab

**Fix:** Add overall rating prominently. Redesign rating breakdown to be clearer.
**Verify:** Run App Gap search → Feedback tab → Overall sentiment should be clear at glance

---

#### Opportunity Gaps UI Outdated
**Impact:** Looks unprofessional
**Location:** Market tab > Opportunities section

**Fix:** Redesign opportunity cards with: description, difficulty badge, potential impact, related signals.
**Verify:** Run search → Market tab → Opportunity cards should look polished with badges

---

## Review Needed

### AI Discussion Trends Implementation
**Status:** Needs Review
**Location:** Multiple files

Codex suggested 4 fixes that were applied. Walk through these changes to verify no regressions:
- `src/lib/analysis/timing-analyzer.ts` (lines 229-237)
- `src/lib/rate-limit/index.ts` (lines 188-206)
- `src/lib/data-sources/ai-discussion-trends.ts` (lines 206-212)
- `src/components/research/market-tab.tsx` (lines 982-990)

---

## Planned Features

### Credit/Fuel System Design
**Priority:** HIGH — Business sustainability

Need to design credit system with:
- Cost estimation before search
- Pre-search (free) vs research (paid) boundary
- Margin protection

See `docs/archive/RESOLVED_ISSUES.md` for full spec.

---

### Dual App Store Support
**Status:** Planned

Scrape 500 reviews from iOS App Store + 500 from Google Play Store (currently single store only).
