# PVRE Codebase Refactoring Plan

*Created: January 7, 2026*
*Last Updated: January 7, 2026*

---

## Current Status: PAUSED AT PHASE 4e

```
Phase 0: Type Consolidation ............ ✅ COMPLETE
Phase 1: ResearchContext Pattern ....... ✅ COMPLETE
Phase 2: Extract Inline Modules ........ ✅ COMPLETE (2 of 5 modules)
Phase 3: Pipeline Steps ................ ✅ COMPLETE (infrastructure)
Phase 4: Route Integration ............. 🟡 PARTIAL (5 of 11 steps integrated)
Phase 5: Full Orchestrator ............. ⬜ NOT STARTED
Phase 6: Cleanup ....................... ⬜ NOT STARTED
```

**Route Reduction:** 1,700 → 1,566 lines (8% reduction, 134 lines removed)

**Decision:** Stopped here because remaining work is HIGH RISK:
- Filter Pipeline (~400 lines) has calibrated 75% hit rate - changes could break it
- Data Fetching (~400 lines) has complex branching for 3 modes

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
| Competitor Extraction | ⬜ Not done | Still inline |
| Adaptive Fetching | ⬜ Not done | Still inline |
| Job Status Manager | ⬜ Not done | Still inline |

### Phase 3: Pipeline Steps Infrastructure ✅
- Created `PipelineStep<TInput, TOutput>` interface
- Created `executeStep()` helper with timing and skip handling
- Files: `src/lib/research/pipeline/types.ts`

### Phase 4: Route Integration 🟡 (Partial)

| Step | Status | Integrated into Route |
|------|--------|----------------------|
| Keyword Extractor | ✅ Done | Yes |
| Subreddit Discovery | ✅ Done | Yes |
| Data Fetcher | ✅ Created | **No** - too complex |
| Pain Analyzer | ✅ Done | Yes |
| Theme Analyzer | ✅ Done | Yes |
| Market Analyzer | ✅ Done | Yes |
| Filter Orchestrator | ⬜ Not done | No - HIGH RISK |
| Competitor Detector | ⬜ Not done | No |
| Result Compiler | ⬜ Not done | No |

---

## What Remains (If You Want to Continue)

### Option A: Safe Continuation (LOW RISK)
Extract these without touching the filter pipeline:

1. **Competitor Detector** (~100 lines)
   - Location: route.ts lines 1510-1540
   - Risk: Low

2. **Result Compiler** (~100 lines)
   - Location: route.ts end section
   - Risk: Low

3. **Integrate Data Fetcher** (~400 lines)
   - Step already created, just needs route integration
   - Risk: Medium (complex branching)

### Option B: Full Orchestrator (HIGH RISK)
Complete extraction including filter pipeline:

1. **Filter Orchestrator** (~400 lines, 3 modes)
   - ⚠️ HIGH RISK - calibrated 75% hit rate
   - Would need extensive testing
   - Not recommended without dedicated QA time

2. **Replace route with single orchestrator call**
   - Target: route.ts reduced to ~100 lines

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
  subreddit-discovery.ts # Subreddit discovery step
  data-fetcher.ts       # Data fetching step (created, not integrated)
  pain-analyzer.ts      # Pain analysis step
  theme-analyzer.ts     # Theme extraction step
  market-analyzer.ts    # Market sizing + timing step
```

---

## Problem Statement (Original)

The codebase had accumulated technical debt:
- **Monolith route**: `community-voice/route.ts` was 1,700 lines handling 11 responsibilities
- **Duplicated types**: Key types defined 2-3 times in different files
- **Scattered mode detection**: `if (appData?.appId)` appeared 9 times
- **Inline logic**: Reusable code buried in the route

## Goals (Original)

1. ~~Route reduced from 1,700 to ~400 lines~~ → Achieved 1,566 (partial)
2. ✅ Single source of truth for all types
3. ✅ Mode detection explicit via `ResearchContext`
4. ✅ Reusable modules for common patterns
5. ✅ Faster debugging and changes

---

## Commits (All Pushed to Main)

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
