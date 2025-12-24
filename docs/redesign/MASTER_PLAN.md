# PVRE Redesign: Master Implementation Plan

> The consolidated roadmap for transforming PVRE into a trusted, delightful product.

**Status: ALL PHASES COMPLETE - Redesign Finished**
**Last Updated:** December 24, 2025
**Questions Resolved:** All 10 open questions answered

---

## The Vision

**PVRE should feel like a trusted advisor handing you a beautifully prepared brief, not a data dump with invented numbers.**

### Before → After

| Aspect | Before | After |
|--------|--------|-------|
| Answer location | Buried in Tab 5 | Hero section (3-second understanding) |
| Data reliability | 35% real, 65% AI speculation | **70% real**, 30% AI with guardrails |
| WTP visibility | Hidden in sub-tabs | Hero-level prominence |
| Quotes | Buried, no context | Front and center with engagement |
| User feeling | Confused, possibly misled | Informed, guided, ready to act |

> Note: Target adjusted from 75% to 70% real data - G2/Capterra deferred, using App Store + Trustpilot instead.

---

## Resolved Decisions Summary

All questions have been resolved (see `DECISIONS.md`):

| Question | Decision |
|----------|----------|
| Q1: Google Trends | Use `google-trends-api` npm, cache 24h, graceful fallback |
| Q2: G2/Capterra | **Deferred.** Use App Store + Trustpilot + AI with guardrails. 70% real. |
| Q3: Product Hunt | Light scraping of public pages, no OAuth. Skip if unreliable. |
| Q4: Pain weights | WTP extracted from Pain. Total pain-related = 50%. |
| Q5: Competition transitional | Adaptive weights: 25% if verified, 15% if AI. Clear labeling. |
| Q6: Two modes | Both single-scroll. Same structure, different content sources. |
| Q7: Components | **Strategy C:** Build parallel in `research-v2/`, swap after testing. |
| Q8: Tab removal | Keep Week 1, build new Week 2, swap Week 3, cleanup Week 4. |
| Q9: Timeline | 4 weeks total. Week 1 delivers visible improvement. |
| Q10: MVP | Badges + WTP hero + Two-axis + Quote cards + Google Trends. |

**Full details:** See `DECISIONS.md`

---

## Three Workstreams

### Workstream 1: Data Reliability
Replace AI speculation with real, verifiable data sources.

**Source:** `DATA_SOURCES.md`

### Workstream 2: UI/UX Redesign
Transform from tab-based data dump to inverted pyramid story.

**Source:** `UI_SPEC.md`

### Workstream 3: Report Logic
Update calculations to use new data sources and two-axis verdict.

**Integrated into both phases above.**

---

## Implementation Phases

### Phase 1: Quick Wins + Google Trends (Week 1) ✅ COMPLETE

**Status:** Completed December 23, 2025

| Task | File | Status |
|------|------|--------|
| Trust badges for AI content | `trust-badge.tsx` | ✅ Done |
| WTP in hero stats | `verdict-hero.tsx` | ✅ Done |
| Two-axis verdict display | `verdict-hero.tsx`, `dual-verdict-display.tsx` | ✅ Done |
| Quote cards redesign | `quote-card.tsx` | ✅ Done |
| Google Trends integration | `google-trends.ts` | ✅ Done |
| AI keyword extraction | `google-trends.ts` (7-day cache) | ✅ Done |
| Integrate trends into timing | `timing-analyzer.ts` | ✅ Done |

**Delivered:**
- Trust badges distinguish VERIFIED, CALCULATED, AI-ESTIMATE data
- WTP signals promoted to hero visibility
- Two-axis verdict (Hypothesis Confidence + Market Opportunity)
- Google Trends provides real trend data with AI-extracted problem-focused keywords
- Keywords cached 7 days for deterministic results

**Tab structure preserved** - single-scroll layout planned for Phase 2.

---

### Phase 2: Dual-Layout + HN Integration (Week 2) ✅ COMPLETE

**Goal:** Build scroll layout alongside tabs with user toggle.

**Status:** Complete - dual-layout infrastructure and HN integration done.

| Task | Location | Status |
|------|----------|--------|
| Shared data layer | `src/lib/research/fetch-research-data.ts` | ✅ Done |
| ResearchDataProvider context | `src/components/research/research-data-provider.tsx` | ✅ Done |
| Layout toggle hook + UI | `src/hooks/use-layout-preference.tsx`, `layout-toggle.tsx` | ✅ Done |
| TabbedView (extracted) | `src/components/research/layouts/tabbed-view.tsx` | ✅ Done |
| ScrollView (new) | `src/components/research/layouts/scroll-view.tsx` | ✅ Done |
| ResultsLayout (switcher) | `src/components/research/layouts/results-layout.tsx` | ✅ Done |
| Hacker News Algolia | `src/lib/data-sources/adapters/hacker-news-adapter.ts` | ✅ Done |
| HN Source Badges (orange) | `pain-score-card.tsx`, `quote-card.tsx` | ✅ Done |

**Implementation Approach (Changed from Plan):**
- Used localStorage + URL param toggle instead of feature flag
- Components in `layouts/` folder, not `research-v2/`
- Both layouts share same data via Context provider
- Page.tsx reduced from ~1300 to ~400 lines

**Toggle Behavior:**
- Default: Tabs (existing behavior)
- Toggle: Users can switch to Scroll (Beta) view
- Persists in localStorage
- URL param `?layout=scroll` overrides saved preference

**Deliverable:** ✅ Dual-layout toggle working. ✅ HN signals with orange badges.

---

### Phase 3: Gradual Swap (Week 3) ✅ COMPLETE

**Goal:** Roll out new UI to all users.

**Status:** Completed December 24, 2025

| Day | Task | Status |
|-----|------|--------|
| 1-4 | Scroll layout default | ✅ Done |
| 5-6 | Trustpilot data source | ✅ Done |
| 7 | Documentation update | ✅ Done |

**Delivered:**
- Scroll layout is now default for all users
- Trustpilot adapter with HTTP-only scraping (no Puppeteer)
- Auto-includes for B2B/SaaS hypotheses (accounting, CRM, insurance, etc.)
- Emerald badges for Trustpilot sources in UI

**Deliverable:** ✅ New UI live for all users + Trustpilot data source.

---

### Phase 4: Polish & Cleanup (Week 4) ✅ COMPLETE

**Goal:** Production-ready, polished experience.

**Status:** Completed December 24, 2025

| Day | Task | Status |
|-----|------|--------|
| 1-2 | Remove feature flag | ✅ Done (no flags found) |
| 2-3 | Archive v1 components | ✅ Done (none to archive) |
| 3-4 | Accessibility audit | ✅ Done |
| 4-5 | Performance optimization | ✅ Done |
| 5-6 | Edge case testing | ✅ Done |
| 7 | BLS data grounding (if time) | Deferred |

**Delivered:**
- Accessibility: Skip-to-content link, ARIA labels for chat sidebar, heading hierarchy fix
- Performance: jsPDF dynamic import (~300KB removed from initial bundle)
- Edge cases: Verified error handling for invalid/missing jobs, auth redirects, input validation

**Deliverable:** ✅ Polished, accessible, production-ready experience.

---

## Viability Formula

### Current (35% Real Data)
```
Score = Pain(35%) + Market(25%) + Competition(25%) + Timing(15%)
        └─ Real ─┘   └─ AI ──┘    └─ AI-based ─┘    └─ AI ─┘
```

### New Formula (70% Real Data)

**When competitor data is AI-based (default):**
```
Score = Pain(35%) + WTP(20%) + Trends(20%) + Competition(15%) + Market(10%)
        └─ Real ─┘  └─Real─┘   └─Real(GT)─┘   └─ AI w/badge ─┘   └─ AI ──┘
```

**When competitor data is verified (App Store/Trustpilot):**
```
Score = Pain(30%) + WTP(20%) + Competition(25%) + Trends(15%) + Market(10%)
        └─ Real ─┘  └─Real─┘   └─── Real ────┘   └─Real(GT)─┘   └─ AI ──┘
```

### Key Change: WTP Extracted from Pain
- **Old:** Pain 35% (WTP buried inside)
- **New:** Pain 30-35% + WTP 20% = **50% pain-related** (up from 35%)
- WTP now gets explicit weight AND hero visibility

---

## Component Architecture

### Strategy: Parallel Build (v2)

Build new components alongside existing, swap after testing.

```
src/components/research/           # Existing (keep working during transition)
src/components/research-v2/        # New single-scroll components
  ├── verdict-hero.tsx             # Two-axis verdict display
  ├── evidence-section.tsx         # Quotes + signals (replaces sub-tabs)
  ├── opportunity-section.tsx      # WTP + gaps + pivots
  ├── context-section.tsx          # Trends + competition + market
  ├── next-steps-section.tsx       # Tailored recommendations
  └── shared/
      ├── trust-badge.tsx          # ✓ Verified / 🤖 AI Estimate
      ├── quote-card.tsx           # Enhanced quote with engagement
      └── signal-distribution.tsx  # Bar visualization

src/components/ui/                 # Shared UI components
  ├── trend-chart.tsx              # Google Trends display
  └── two-axis-gauge.tsx           # Market Opp + Hypothesis Conf

src/lib/data-sources/              # Data source adapters
  ├── google-trends.ts             # google-trends-api npm
  ├── hacker-news.ts               # HN Algolia adapter
  ├── subreddit-stats.ts           # Reddit stats adapter
  └── trustpilot.ts                # Trustpilot scraper (light)

src/app/(dashboard)/research/[id]/
  ├── page.tsx                     # Existing (v1)
  └── page-v2.tsx                  # New (feature flagged)
```

### Swap Sequence

1. **Week 1:** Build shared components (trust-badge, quote-card, trend-chart)
2. **Week 2:** Build v2 page components behind feature flag
3. **Week 3:** Gradual rollout (10% → 50% → 100%)
4. **Week 4:** Remove v1, archive code

---

## Data Source Adapters

### Google Trends (Priority 1)

```typescript
// npm install google-trends-api
import googleTrends from 'google-trends-api';

async function getTrendData(keywords: string[]): Promise<TrendResult | null> {
  try {
    const results = await googleTrends.interestOverTime({
      keyword: keywords,
      startTime: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)),
      geo: '',
    });
    return JSON.parse(results);
  } catch (error) {
    // Graceful fallback: Return null, show "Trends unavailable"
    return null;
  }
}
```

**Caching:** 24 hours per keyword set
**Fallback:** Show AI estimate with clear badge if API fails

### Data Source Priority

| Priority | Source | Integration | Notes |
|----------|--------|-------------|-------|
| 1 | Google Trends | Week 1 | `google-trends-api` npm |
| 2 | Hacker News | Week 2 | Algolia API (free) |
| 3 | Subreddit Stats | Week 3 | Reddit API / stats sites |
| 4 | Trustpilot | Week 3 | Light scraping |
| 5 | BLS Data | Week 4 | api.bls.gov (if time) |
| ❌ | G2/Capterra | Deferred | Legal/technical concerns |

---

## Trust Visual System

### Three Tiers

| Tier | Border | Badge | Background | Use For |
|------|--------|-------|------------|---------|
| Verified | Solid green | ✓ VERIFIED | Light green tint | Real quotes, API data |
| Calculated | Solid blue | 📊 CALCULATED | Light blue tint | Derived scores |
| AI Estimate | Dashed orange | 🤖 AI ESTIMATE | Light orange tint | TAM, market context, AI competitors |

### Competition Section (AI Mode)

```
Competition Analysis
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│ 🤖 AI ESTIMATE                       │
│                                      │
│ FreshBooks, Wave, Bonsai identified  │
│ as likely competitors                │
│                                      │
│ ⚠️ Verify pricing and features       │
│    independently before deciding     │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## Two Research Modes

Both modes use identical single-scroll structure with different content:

| Section | Hypothesis Mode | App-Analysis Mode |
|---------|-----------------|-------------------|
| Verdict Hero | Hypothesis text + two-axis | App card + two-axis |
| Evidence | Reddit/HN quotes | App store reviews |
| Opportunity | WTP signals, pivot angles | Feature gaps, complaints |
| Context | Trends, AI competitors | Competitor apps, market |
| Next Steps | Interview questions | Build/differentiate guidance |

**Why same structure:** Consistent mental model, simpler codebase, easier maintenance.

---

## Success Metrics

| Metric | Current | Week 1 Target | Final Target |
|--------|---------|---------------|--------------|
| % of score from real data | 35% | 55% | 70%+ |
| Time to understand verdict | 30+ sec | 10 sec | < 5 sec |
| Clicks to find WTP | 3-4 | 0 (in hero) | 0 (in hero) |
| User can distinguish AI/real | No | Yes | Yes |
| Would recommend (NPS) | Unknown | 7+/10 | 8+/10 |

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `DECISIONS.md` | Full answers to all open questions |
| `DATA_SOURCES.md` | Data source details and API specs |
| `UI_SPEC.md` | Complete UI/UX specification |
| `../archive/ui-documentation.md` | Current state reference (archived) |
| `../archive/ui-analysis.md` | CC's deep analysis (archived) |
| `../archive/redesign-test-results.md` | Final validation test results (Dec 24, 2025) |

---

## Final Validation (December 24, 2025)

Full UI/UX validation test performed matching the original phase0-test-results.md methodology:

### Test Results

| Test | Hypothesis Confidence | Market Opportunity | Status |
|------|----------------------|-------------------|--------|
| Freelancer Invoicing | 4.1 (PARTIAL) | 5.9 (MODERATE) | Correctly identifies mismatch |
| Headspace App | 8.4 (HIGH) | 8.0 (STRONG) | Validates with high confidence |

### Critical Issues Scorecard

| Issue | Original | After Redesign |
|-------|----------|----------------|
| Answer Last | 30+ sec to find | <5 sec (hero) |
| Trust Opacity | No distinction | CALCULATED/VERIFIED/AI badges |
| Quotes Buried | Sub-tabs | Hero section |
| WTP Hidden | 3-4 clicks | 0 clicks |
| Cognitive Overload | 5 tabs + sub-tabs | Scroll layout default |

**All 5 critical issues: FIXED**

---

*Master plan created: December 2024*
*Questions resolved: December 2024*
*All phases completed: December 24, 2025*
*Status: **COMPLETE - Redesign Finished and Validated***
