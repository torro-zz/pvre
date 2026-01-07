# PVRE Codebase Refactoring Plan

*Created: January 7, 2026*

---

## Problem Statement

The codebase has accumulated technical debt that makes changes slow and error-prone:
- **Monolith route**: `community-voice/route.ts` is 1,700 lines handling 11 responsibilities
- **Duplicated types**: Key types defined 2-3 times in different files
- **Scattered mode detection**: `if (appData?.appId)` appears 9 times
- **Inline logic**: Reusable code buried in the route (App Name Gate duplicated twice)
- **4+ data layers**: Too many transformations from API to UI

## Goals

After refactoring:
1. Route reduced from 1,700 to ~400 lines of orchestration
2. Single source of truth for all types
3. Mode detection explicit via `ResearchContext`
4. Reusable modules for common patterns
5. Faster debugging and changes

---

## Phase 0: Type Consolidation (2-3 hours, LOW RISK)

**Goal**: Single source of truth for all research types.

### Files to Create
```
src/types/research/
  index.ts         # Main export barrel
  core.ts          # ResearchJob, PainSignal, PainSummary
  competitor.ts    # Competitor, CompetitorGap, CompetitorIntelligenceResult
  filter.ts        # FilteringMetrics, RelevanceDecision
  result.ts        # CommunityVoiceResult, all result types
```

### Duplicates to Consolidate

| Type | Current Locations | Target |
|------|-------------------|--------|
| `ResearchJob` | types/research.ts, types/database.ts, fetch-research-data.ts | types/research/core.ts |
| `PainSignal` | types/research.ts, pain-detector.ts | types/research/core.ts |
| `Competitor` | types/research.ts, competitor-intelligence/route.ts | types/research/competitor.ts |
| `CompetitorGap` | types/research.ts, competitor-intelligence/route.ts | types/research/competitor.ts |
| `FilteringMetrics` | community-voice/route.ts, fetch-research-data.ts | types/research/filter.ts |
| `CommunityVoiceResult` | community-voice/route.ts | types/research/result.ts |

### Process
1. Create canonical type (union of all fields from duplicates)
2. Export from new location
3. Update imports across codebase
4. Add `@deprecated` to old locations
5. Verify: `npm run build && npm run test:run`

---

## Phase 1: ResearchContext Pattern (2-3 hours, LOW RISK)

**Goal**: Replace scattered mode checks with typed context.

### Files to Create
```
src/lib/research/pipeline/
  context.ts       # ResearchContext type + createContext()
  types.ts         # PipelineStep interface
```

### ResearchContext Interface
```typescript
export type ResearchMode = 'hypothesis' | 'app-gap'

export interface ResearchContext {
  mode: ResearchMode
  jobId: string
  userId: string
  hypothesis: string

  // Mode-specific (only in app-gap)
  appData?: AppDetails
  crossStoreAppData?: AppDetails

  // Config
  config: ResearchConfig

  // Mutable state
  state: ResearchState
}

export function isAppGapMode(ctx: ResearchContext): boolean
export function createContext(job: JobData): ResearchContext
```

### Replace Pattern
```typescript
// BEFORE (appears 9 times)
if (appData && appData.appId) { ... }

// AFTER
if (isAppGapMode(ctx)) { ... }
```

---

## Phase 2: Extract Inline Modules (4-6 hours, MEDIUM RISK)

**Goal**: Extract duplicated and complex inline code to reusable modules.

### 2.1 App Name Gate (HIGH PRIORITY - duplicated twice)
```
Current: route.ts lines 846-943 AND 1216-1280
Target: src/lib/research/gates/app-name-gate.ts
```

```typescript
export interface AppNameGateResult<T> {
  passed: T[]
  filtered: T[]
  stats: { before: number; after: number; appName: string }
}

export function applyAppNameGate<T>(items: T[], appData: AppDetails): AppNameGateResult<T>
```

### 2.2 Cross-Store Lookup
```
Current: route.ts lines 628-685
Target: src/lib/research/steps/cross-store-lookup.ts
```

```typescript
export async function findCrossStoreApp(appData: AppDetails): Promise<AppDetails | null>
export async function fetchCrossStoreReviews(appData: AppDetails): Promise<RedditPost[]>
```

### 2.3 Competitor Extraction
```
Current: route.ts lines 1510-1540
Target: src/lib/research/steps/competitor-detector.ts
```

### 2.4 Adaptive Fetching
```
Current: route.ts lines 1113-1214
Target: src/lib/research/steps/adaptive-fetcher.ts
```

### 2.5 Job Status Manager
```
Current: scattered (lines 322, 1479, 1569-1597)
Target: src/lib/research/steps/job-status.ts
```

---

## Phase 3: Pipeline Steps (8-12 hours, MEDIUM-HIGH RISK)

**Goal**: Break route into composable steps with common interface.

### Step Interface
```typescript
export interface PipelineStep<TInput, TOutput> {
  name: string
  execute(input: TInput, ctx: ResearchContext): Promise<TOutput>
  shouldSkip?(ctx: ResearchContext): boolean
}
```

### Steps to Create (in dependency order)
```
src/lib/research/steps/
  01-job-loader.ts          # Load job data, build context
  02-keyword-extractor.ts   # Extract search keywords
  03-subreddit-discovery.ts # Discover communities (skip in App Gap)
  04-data-fetcher.ts        # Fetch from all sources
  05-filter-orchestrator.ts # Run appropriate filter pipeline
  06-app-name-gate.ts       # Apply app name filter (App Gap only)
  07-pain-analyzer.ts       # Extract pain signals
  08-theme-generator.ts     # Generate themes + questions
  09-market-analyzer.ts     # Market sizing + timing
  10-competitor-detector.ts # Auto-detect competitors
  11-result-compiler.ts     # Build final result
```

---

## Phase 4: Orchestrator (4-6 hours, LOW RISK if Phase 3 done)

**Goal**: Replace 1,700-line route with ~400-line orchestrator.

### New Structure
```typescript
// src/lib/research/pipeline/orchestrator.ts (~300 lines)
export async function runResearchPipeline(ctx: ResearchContext): Promise<CommunityVoiceResult> {
  await keywordExtractorStep.execute(ctx)

  if (!isAppGapMode(ctx)) {
    await subredditDiscoveryStep.execute(ctx)
  }

  await dataFetcherStep.execute(ctx)
  await filterOrchestratorStep.execute(ctx)

  if (isAppGapMode(ctx)) {
    await appNameGateStep.execute(ctx)
  }

  await painAnalyzerStep.execute(ctx)
  await themeGeneratorStep.execute(ctx)
  await marketAnalyzerStep.execute(ctx)

  return resultCompilerStep.compile(ctx)
}

// src/app/api/research/community-voice/route.ts (~100 lines)
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  const credits = await handleCredits(auth.user, request)

  const ctx = await createContext(request, auth.user)
  const result = await runResearchPipeline(ctx)

  await saveResearchResult(ctx.jobId, 'community_voice', result)
  return NextResponse.json(result)
}
```

---

## Phase 5: Cleanup (2-3 hours, LOW RISK)

1. Remove deprecated type locations
2. Update all remaining imports
3. Update documentation (SYSTEM_DOCUMENTATION.md, ARCHITECTURE_SUMMARY.md)
4. Add JSDoc to new modules
5. Final test suite run

---

## Critical Files

| File | Lines | Action |
|------|-------|--------|
| `src/app/api/research/community-voice/route.ts` | 1,700 | Decompose to ~100 lines |
| `src/types/research.ts` | ~200 | Consolidate + re-export |
| `src/lib/research/fetch-research-data.ts` | ~300 | Use canonical types |
| `src/lib/analysis/pain-detector.ts` | ~900 | Export types only |
| `src/app/api/research/competitor-intelligence/route.ts` | ~750 | Use canonical types |

---

## Testing Strategy

| Phase | Tests |
|-------|-------|
| 0 | `npm run build`, `npm run test:run` |
| 1 | Build + manual test both modes |
| 2 | Unit tests for new modules + integration |
| 3 | Unit tests per step + step chain tests |
| 4 | Full E2E + performance benchmark |
| 5 | Full regression suite |

**Manual Tests (after each phase):**
- Hypothesis mode: "Remote workers struggling with async communication"
- App Gap mode: Loom app URL

---

## Rollback Strategy

Each phase is independently deployable and revertible:
- No database schema changes
- API contract (`CommunityVoiceResult`) unchanged
- Existing stored results continue to work

---

## Time Estimates

| Phase | Time | Risk | Dependencies |
|-------|------|------|--------------|
| 0: Types | 2-3h | Low | None |
| 1: Context | 2-3h | Low | Phase 0 |
| 2: Inline Modules | 4-6h | Medium | Phase 1 |
| 3: Pipeline Steps | 8-12h | Medium-High | Phase 1, 2 |
| 4: Orchestrator | 4-6h | Low | Phase 3 |
| 5: Cleanup | 2-3h | Low | Phase 4 |
| **Total** | **22-33h** | - | - |

---

## Approved Approach

**PHASE 0 + 1 FIRST** (user-approved):
- Type consolidation + Context pattern (~5 hours)
- Lowest risk, highest foundation value
- Run full test suite after each phase

**DECISIONS:**
- Preserve all 3 filter paths (tiered, two-stage, legacy)
- Run `npm run build && npm run test:run` after EVERY phase
- Manual test both modes after each phase

**IMPLEMENTATION ORDER:**
1. Phase 0: Type consolidation (2-3h)
2. Phase 1: ResearchContext pattern (2-3h)
3. CHECKPOINT: Evaluate if Phase 2+ needed

**DEFER:** Phases 2-5 until foundation is validated.
