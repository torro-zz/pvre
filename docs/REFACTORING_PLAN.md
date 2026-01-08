# PVRE Codebase Refactoring Plan

*Created: January 7, 2026*
*Last Updated: January 8, 2026*

---

## Current Status: PAUSED AT PHASE 4i

```
Phase 0: Type Consolidation ............ ✅ COMPLETE
Phase 1: ResearchContext Pattern ....... ✅ COMPLETE
Phase 2: Extract Inline Modules ........ ✅ COMPLETE (3 of 5 modules)
Phase 3: Pipeline Steps ................ ✅ COMPLETE (infrastructure)
Phase 4: Route Integration ............. ✅ COMPLETE (8 of 11 steps integrated)
Phase 5: Full Orchestrator ............. ⬜ NOT STARTED
Phase 6: Cleanup ....................... ⬜ NOT STARTED
```

**Route Reduction:** 1,700 → 1,376 lines (19% reduction, 324 lines removed)

**Decision:** Stopped here because remaining work is HIGH RISK:
- Filter Pipeline (~400 lines) has calibrated 75% hit rate - changes could break it
- Adaptive Fetching (~100 lines) has complex state interactions

---

## What Was Completed

### Phase 0: Type Consolidation ✅
- Created `src/types/research/` with canonical types
- Single source of truth for all research types

### Phase 1: ResearchContext Pattern ✅
- Created `src/lib/research/pipeline/context.ts`
- `isAppGapMode(ctx)` replaces scattered `if (appData?.appId)` checks
- `createContext()` builds typed context from job data

### Phase 2: Extract Inline Modules ✅ (Partial)

| Module | Status | File |
|--------|--------|------|
| App Name Gate | ✅ Done | `src/lib/research/gates/app-name-gate.ts` |
| Cross-Store Lookup | ✅ Done | `src/lib/research/steps/cross-store-lookup.ts` |
| Competitor Detector | ✅ Done | `src/lib/research/steps/competitor-detector.ts` |
| Adaptive Fetching | ⬜ Not done | Still inline |
| Job Status Manager | ⬜ Not done | Still inline |

### Phase 3: Pipeline Steps Infrastructure ✅
- Created `PipelineStep<TInput, TOutput>` interface
- Created `executeStep()` helper with timing and skip handling
- Files: `src/lib/research/pipeline/types.ts`

### Phase 4: Route Integration ✅ (Complete - 8 of 11 steps)

| Step | Status | Integrated into Route |
|------|--------|----------------------|
| Keyword Extractor | ✅ Done | Yes |
| Subreddit Discovery | ✅ Done | Yes (+ weights) |
| Data Fetcher | ✅ Done | Yes (Phase 4i) |
| Pain Analyzer | ✅ Done | Yes (+ categorization) |
| Theme Analyzer | ✅ Done | Yes |
| Market Analyzer | ✅ Done | Yes |
| Competitor Detector | ✅ Done | Yes |
| Filter Orchestrator | ⬜ Skipped | HIGH RISK - calibrated |
| Adaptive Fetcher | ⬜ Skipped | Medium risk - complex state |
| Result Compiler | ⬜ Skipped | Low value |

---

## What Remains (If You Want to Continue)

All safe refactoring is complete. Remaining items are higher risk:

### HIGH RISK - Not Recommended
1. **Filter Orchestrator** (~400 lines, 3 modes)
   - ⚠️ Calibrated 75% hit rate - changes could break it
   - Would need extensive testing before deployment

2. **Adaptive Fetcher** (~100 lines)
   - Complex state interactions with filteringMetrics
   - Only runs in edge cases (low signal count)
   - Risk outweighs marginal benefit

3. **Result Compiler** (~100 lines)
   - Just data assembly, no reusable logic

---

## Files Created During Refactoring

```
src/types/research/
  index.ts              # Type barrel export
  core.ts               # Core types
  competitor.ts         # Competitor types
  filter.ts             # Filter types
  result.ts             # Result types

src/lib/research/pipeline/
  context.ts            # ResearchContext + helpers
  types.ts              # PipelineStep interface
  orchestrator.ts       # runResearchPipeline() (not integrated)

src/lib/research/gates/
  app-name-gate.ts      # App Name Gate logic

src/lib/research/steps/
  index.ts              # Step barrel export
  cross-store-lookup.ts # Cross-store app lookup
  keyword-extractor.ts  # Keyword extraction step
  subreddit-discovery.ts # Subreddit discovery step (+ weights)
  data-fetcher.ts       # Data fetching step (Phase 4i)
  pain-analyzer.ts      # Pain analysis + categorization step
  theme-analyzer.ts     # Theme extraction step
  market-analyzer.ts    # Market sizing + timing step
  competitor-detector.ts # Competitor detection step
```

---

## Problem Statement (Original)

The codebase had accumulated technical debt:
- **Monolith route**: `community-voice/route.ts` was 1,700 lines handling 11 responsibilities
- **Duplicated types**: Key types defined 2-3 times in different files
- **Scattered mode detection**: `if (appData?.appId)` appeared 9 times
- **Inline logic**: Reusable code buried in the route

## Goals (Original)

1. ~~Route reduced from 1,700 to ~400 lines~~ → Achieved 1,376 lines (19% reduction)
2. ✅ Single source of truth for all types
3. ✅ Mode detection explicit via `ResearchContext`
4. ✅ Reusable modules for common patterns
5. ✅ Faster debugging and changes

---

## Commits

| Commit | Phase | Description |
|--------|-------|-------------|
| `1403fd9` | 0+1 | Type consolidation and ResearchContext pattern |
| `ec63b32` | 2 | Extract App Name Gate module |
| `4cbcadb` | 2 | Extract Cross-Store Lookup module |
| `7e8e14e` | 3 | Add pipeline step infrastructure |
| `679d323` | 4 | Add orchestrator and additional steps |
| `0f72fe6` | 4b | Integrate keyword and subreddit steps |
| `1691c78` | 4c | Integrate painAnalyzerStep |
| `ec3324b` | 4d | Add themeAnalyzerStep |
| `ff3cb8e` | 4e | Add marketAnalyzerStep |
| `28dd448` | 4f | Add competitorDetectorStep |
| `52d8daf` | 4f | Integrate competitorDetectorStep into route |
| `5ea422e` | 4g | Move semantic categorization into painAnalyzerStep |
| `f9b77c9` | 4h | Add subredditWeights to SubredditDiscoveryOutput |
| `9e8450c` | 4i | Integrate dataFetcherStep into route |

---

## Testing Strategy

After any future changes:
```bash
npm run build        # Must pass
npm run test:run     # 163+ tests must pass
```

**Manual Tests:**
- Hypothesis mode: "Remote workers struggling with async communication"
- App Gap mode: Loom app URL

---

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| Jan 7, 2026 | Stop at Phase 4e | Filter pipeline is high-risk (75% calibrated), remaining gains are marginal |
| Jan 7, 2026 | Keep 3 filter modes | Legacy, two-stage, tiered all serve different purposes |
| Jan 7, 2026 | Don't integrate dataFetcherStep | Complex branching, risk outweighs benefit |
| Jan 8, 2026 | Continue with Phase 4f | Competitor Detector is low-risk (end of pipeline) |
| Jan 8, 2026 | Skip Result Compiler | Just data assembly, low value for complexity |
| Jan 8, 2026 | Pause at Phase 4f | Remaining work (data fetcher, filter) is high-risk |
| Jan 8, 2026 | Resume: Phase 4g-4i | Semantic categorization, subreddit weights, data fetcher - all safe |
| Jan 8, 2026 | Integrate dataFetcherStep | Carefully extracted 140 lines, all tests passing |
| Jan 8, 2026 | Skip Adaptive Fetcher | Complex state, edge case only, medium risk |
| Jan 8, 2026 | Final stop at Phase 4i | 19% reduction achieved, remaining work too risky |
