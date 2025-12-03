# Code Hardening Guide

A practical guide to writing safe, maintainable code. These practices prevent bugs before they reach production.

---

## Why This Matters: A Real Story

On Dec 1, 2024, we discovered that research results weren't being saved to the database. Users would complete their research, see "Processing...", then get "No Results Found."

**Root cause:** Code used `module_type` instead of `module_name` as the database column name.

**Why it wasn't caught:**
- No TypeScript types for the database (string column names have no checking)
- No integration tests verified data was actually saved
- The bug existed in 5+ files (copy-paste code)
- UI tests passed because the API returned success

**Result:** Terrible user experience. Research completed but results vanished.

**The fix took 10 minutes. Finding it took hours.**

This guide prevents that class of bugs entirely.

---

## The 4 Pillars of Safe Code

### Pillar 1: Type Safety - Generate Database Types

**The Problem:** String column names have no compile-time checking.

```typescript
// This typo compiles fine, fails silently at runtime
await supabase.from('research_results').insert({
  module_type: 'pain_analysis',  // WRONG column name!
})
```

**The Solution:** Generate TypeScript types from your database schema.

```bash
# Generate types from Supabase
npx supabase gen types typescript --project-id YOUR_PROJECT > src/types/supabase.ts
```

Then use them in your clients:

```typescript
// src/lib/supabase/admin.ts
import { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(url, key)
}
```

**Now typos are compile-time errors:**

```typescript
// TypeScript ERROR: 'module_type' does not exist in type
await supabase.from('research_results').insert({
  module_type: 'pain_analysis',  // ❌ Caught at compile time!
})
```

**When to regenerate types:**
- After any database schema change
- After adding/removing columns
- After changing column types

---

### Pillar 2: Single Source of Truth - Shared Utilities

**The Problem:** Same database operation copy-pasted in multiple files.

```typescript
// File 1
await supabase.from('research_results').insert({
  job_id: jobId,
  module_name: 'pain_analysis',  // Correct
  data: result,
})

// File 2 (someone copied and modified)
await supabase.from('research_results').insert({
  job_id: jobId,
  module_type: 'market_sizing',  // WRONG - typo introduced
  data: result,
})
```

**The Solution:** One function, one place, one source of truth.

```typescript
// src/lib/research/save-result.ts
export type ModuleName =
  | 'pain_analysis'
  | 'market_sizing'
  | 'timing_analysis'
  | 'competitor_intelligence'
  | 'community_voice'

export async function saveResearchResult(
  jobId: string,
  moduleName: ModuleName,  // Type-safe - can't typo this
  data: unknown
) {
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('research_results')
    .upsert({
      job_id: jobId,
      module_name: moduleName,  // Always correct
      data: JSON.parse(JSON.stringify(data)),
    }, { onConflict: 'job_id,module_name' })

  if (error) throw new Error(`Failed to save: ${error.message}`)
}
```

**Benefits:**
- Fix bugs once, not in every file
- Consistent behavior everywhere
- Type-safe module names (can't typo `'pain_analaysis'`)

---

### Pillar 3: Defensive Architecture - JSON Serialization

**The Problem:** Complex TypeScript types don't match database JSON types.

```typescript
interface MyResult {
  score: number
  signals: PainSignal[]  // Complex nested type
}

// This can fail with type mismatches
await supabase.from('table').insert({ data: myResult })
```

**The Solution:** Always serialize complex objects before saving.

```typescript
// GOOD - Explicit serialization ensures compatibility
await supabase.from('table').insert({
  data: JSON.parse(JSON.stringify(myResult))
})
```

**Why this works:**
- `JSON.stringify` converts to plain JSON (no class instances, no undefined)
- `JSON.parse` converts back to a clean object
- Result is guaranteed to be valid JSON for the database

**Apply this pattern to:**
- Any complex object going into a `jsonb` column
- Arrays of objects
- Nested data structures

---

### Pillar 4: Test Coverage - Integration Tests

**The Problem:** UI tests pass but data isn't actually saved.

```typescript
// UI test - this passes even if DB save fails!
test('research completes', async () => {
  await page.click('button[type="submit"]')
  await expect(page.locator('.results')).toBeVisible()  // ✅ Passes
  // But data might not be in the database!
})
```

**The Solution:** Test the data layer directly.

```typescript
// src/__tests__/research-flow.integration.test.ts
it('should save with correct column name', async () => {
  // Act - use the actual save function
  await saveResearchResult(testJobId, 'pain_analysis', mockData)

  // Assert - verify it's actually in the database
  const { data, error } = await adminClient
    .from('research_results')
    .select('*')
    .eq('job_id', testJobId)
    .eq('module_name', 'pain_analysis')  // Verify correct column
    .single()

  expect(error).toBeNull()
  expect(data).not.toBeNull()
  expect(data?.module_name).toBe('pain_analysis')
})
```

**What to test:**
- Data is saved with correct column names
- Upsert works without duplicates
- All module types save correctly
- Data can be retrieved after saving

---

## Pre-Commit Checklist

Run these before every commit:

```bash
# 1. Build - catches type errors that dev mode misses
npm run build

# 2. Tests - ensures all 66+ tests pass
npm run test:run
```

**Mental checklist:**

- [ ] `npm run build` passes with no errors
- [ ] `npm run test:run` passes (66+ tests)
- [ ] No `any` types added without clear justification
- [ ] Database operations use typed clients
- [ ] New DB operations use shared utilities (not inline code)
- [ ] Complex objects serialized before DB save

---

## Common Pitfalls to Avoid

| Pitfall | Why It's Bad | Do This Instead |
|---------|--------------|-----------------|
| Copy-paste DB operations | Bugs multiply across files | Use shared utilities |
| `any` type | Disables all type safety | Define proper types or use `unknown` |
| String column names | Typos are invisible | Generate DB types |
| Module-level initialization | Fails at build time | Use lazy initialization (functions) |
| Testing only UI | Misses data-layer bugs | Add integration tests |
| Skipping `npm run build` | Type errors slip through | Always build before commit |

---

## Quick Reference Commands

```bash
# Regenerate Supabase types (after schema changes)
npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts

# Run all tests
npm run test:run

# Run specific test file
npm run test:run -- src/__tests__/research-flow.integration.test.ts

# Build (catches type errors that dev mode misses)
npm run build

# Dev server
npm run dev
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/types/supabase.ts` | Auto-generated database types |
| `src/lib/research/save-result.ts` | Shared save utility for research |
| `src/lib/supabase/admin.ts` | Typed admin client |
| `src/lib/supabase/server.ts` | Typed server client |
| `src/lib/supabase/client.ts` | Typed browser client |
| `src/__tests__/research-flow.integration.test.ts` | Data layer integration tests |

---

## Summary: The Hardening Mindset

1. **Type everything** - If TypeScript can't check it, it can break silently
2. **Centralize operations** - One function, one place, one truth
3. **Serialize defensively** - Don't trust TypeScript types match DB types
4. **Test the data layer** - UI tests aren't enough
5. **Build before commit** - `npm run build` catches what `npm run dev` misses

These practices aren't overhead - they're insurance. The 30 seconds to run `npm run build` saves hours of debugging production issues.
