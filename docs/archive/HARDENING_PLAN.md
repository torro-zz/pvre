# PVRE Hardening Plan - December 2024

## ✅ STATUS: ALL STEPS COMPLETED (Dec 2, 2024)

All 4 hardening steps have been implemented:
1. ✅ Supabase TypeScript types generated (`src/types/supabase.ts`)
2. ✅ Shared `saveResearchResult()` utility created (`src/lib/research/save-result.ts`)
3. ✅ All APIs refactored to use the shared utility
4. ✅ Integration tests added (`src/__tests__/research-flow.integration.test.ts`)

The codebase now has:
- **Type safety**: Using wrong column names is a compile-time error
- **Single source of truth**: All research saves go through one utility
- **Test coverage**: 66 passing tests including data-layer integration tests

---

## Context: Why This Matters

On Dec 1, 2024, we discovered a critical bug: all step-based APIs were saving results with `module_type` instead of `module_name`. This caused:
- Research completing but no results saved
- PDF exports showing 0.0/10 "NO SIGNAL"
- "View Full Results" showing "Research Not Started"

This was a symptom of deeper structural issues that need addressing.

---

## The 4-Step Hardening Plan

### Step 1: Generate Supabase TypeScript Types [COMPLETED]

**Why:** Prevents ALL column name bugs at compile time.

**How:**
```bash
# Option A: If you have Supabase CLI linked
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts

# Option B: Generate from database URL
npx supabase gen types typescript --db-url "postgresql://..." > src/types/supabase.ts

# Option C: Copy from Supabase Dashboard
# Go to: Project Settings > API > Generate types
```

**Then update clients:**
```typescript
// src/lib/supabase/client.ts
import { Database } from '@/types/supabase'
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient<Database>(...)
```

**Verification:** After this, `module_type` would show as TypeScript error.

---

### Step 2: Create Shared `saveResearchResult()` Utility [COMPLETED]

**Why:** Single source of truth for saving results. Impossible to use wrong column.

**Create file:** `src/lib/research/save-result.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export type ModuleName =
  | 'pain_analysis'
  | 'market_sizing'
  | 'timing_analysis'
  | 'competitor_intelligence'
  | 'community_voice'

export async function saveResearchResult(
  jobId: string,
  moduleName: ModuleName,
  data: Record<string, unknown>
) {
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('research_results')
    .upsert({
      job_id: jobId,
      module_name: moduleName,
      data,
      created_at: new Date().toISOString(),
    }, { onConflict: 'job_id,module_name' })

  if (error) {
    console.error(`Failed to save ${moduleName} results for job ${jobId}:`, error)
    throw new Error(`Failed to save research results: ${error.message}`)
  }

  return { success: true }
}
```

**Then refactor these files to use it:**
- `src/app/api/research/pain-analysis/stream/route.ts` (line ~432)
- `src/app/api/research/market-sizing/route.ts` (line ~124)
- `src/app/api/research/timing/route.ts` (line ~122)
- `src/app/api/research/competitor-intelligence/route.ts` (line ~632)
- `src/app/api/research/community-voice/stream/route.ts` (line ~412)

---

### Step 3: Decide on Flow Architecture [COMPLETED - Option B]

**Current State:**
- **Old flow:** `/research` → community-voice API → saves as `community_voice` (includes market+timing)
- **Step flow:** `/research/[id]/steps` → 4 separate APIs → saves as `pain_analysis`, etc.

**Options:**

**A) Deprecate old flow entirely:**
- Remove `/api/research/community-voice/stream`
- All research goes through step-based flow
- Simpler, but loses "quick research" option

**B) Keep both, unify data layer:**
- Both flows use `saveResearchResult()`
- Old flow saves as `community_voice` (legacy)
- Step flow saves as individual modules
- Detail page already handles both

**C) Migrate old flow to step-based backend:**
- Old flow UI stays (one-click research)
- But internally calls all 4 step APIs sequentially
- Most work, but cleanest long-term

**Recommendation:** Option B for now. Old flow still works for existing users, step flow is the future.

---

### Step 4: Add E2E Test for Research Flow [COMPLETED]

**Why:** Catches data-layer bugs that UI testing misses.

**Update `/test-flow` slash command** or create new test:

```typescript
// Test should verify:
// 1. Create job via API
// 2. Run pain analysis → verify result saved to DB
// 3. Run market sizing → verify result saved to DB
// 4. Run timing analysis → verify result saved to DB
// 5. Run competitor analysis → verify result saved to DB
// 6. Fetch results via API → verify all 4 modules present
// 7. Generate PDF → verify viability score > 0
```

**Key assertions:**
```typescript
// After running pain analysis
const results = await supabase
  .from('research_results')
  .select('*')
  .eq('job_id', jobId)
  .eq('module_name', 'pain_analysis')
  .single()

assert(results.data !== null, 'Pain analysis results should be saved')
assert(results.data.data.painSignals?.length > 0, 'Should have pain signals')
```

---

## Bug Fixes Already Applied (Dec 1, 2024)

1. **Fixed column name in all step APIs:**
   - `module_type` → `module_name` in 5 API files
   - Added `{ onConflict: 'job_id,module_name' }` to upserts

2. **Fixed result queries:**
   - `/api/research/results/route.ts` now queries `module_name`
   - `/api/research/competitor-suggestions/route.ts` now queries `module_name`

3. **Fixed detail page:**
   - Queries both old names (`community_voice`) and new names (`pain_analysis`)
   - Combines data from separate market_sizing and timing_analysis results

4. **Added step-based flow enhancements:**
   - Market sizing: region dropdown + price input
   - Competitor analysis: AI suggestions + manual input
   - PDF export button now works

---

## Files Modified on Dec 1, 2024

```
src/app/api/research/pain-analysis/stream/route.ts
src/app/api/research/market-sizing/route.ts
src/app/api/research/timing/route.ts
src/app/api/research/competitor-intelligence/route.ts
src/app/api/research/competitor-suggestions/route.ts
src/app/api/research/results/route.ts
src/app/api/research/community-voice/stream/route.ts
src/app/(dashboard)/research/[id]/page.tsx
src/app/(dashboard)/research/[id]/steps/page.tsx
src/components/ui/select.tsx (new - added via shadcn)
```

---

## To Resume Tomorrow

1. **First:** Verify the bug fix works
   - Start dev server: `npm run dev`
   - Create a NEW research job (old ones have no saved data)
   - Run through all 4 steps
   - Check "View Full Results" shows actual data
   - Export PDF and verify it has scores

2. **Then:** Implement Step 1 (Supabase types)

3. **Then:** Implement Step 2 (shared utility)

4. **Then:** Implement Step 4 (E2E test)

5. **Step 3** (architecture decision) can wait until after testing confirms everything works.

---

## Commands to Get Started

```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev

# In another terminal, test the fix:
curl -X POST http://localhost:3000/api/dev/login -c /tmp/pvre-cookies.txt
# Then use Puppeteer or browser to create new research
```

---

## Why This Happened (For Future Reference)

1. **No DB types** = column name bugs invisible to TypeScript
2. **Duplicate code** = bugs multiply across files
3. **No data-layer tests** = only UI tested, not actual saves
4. **Two parallel flows** = cognitive overhead, easy to miss integration

The fix is structural: types + shared utilities + tests = self-defending codebase.
