# PVRE UX Improvement Implementation Plan

## Executive Summary

18 UX improvements identified from CEO review. This plan organizes them into 4 implementation phases based on:
- **Impact on relevance quality** (the 64% problem)
- **Dependencies** between features
- **Risk/complexity** of changes
- **Value delivery speed**

---

## Phase 1: Quick Wins (Low Risk, High Visibility)
*Can start immediately*

### 1.1 Tab Order & Default Fix
**Files:** `src/app/(dashboard)/research/[id]/page.tsx`
**Change:**
- Reorder TabsTrigger elements: Community → Market → Timing → Competitors → Verdict
- Change `defaultValue="community"` (already correct, but tabs visual order wrong)
- Remove conflicting step headers or harmonize with tabs

**Lines to modify:** 290-328 (partial results), 520-558 (completed results)

### 1.2 Example Pattern Teaching
**Files:** `src/app/(dashboard)/research/page.tsx`, `src/components/research/hypothesis-form.tsx`
**Change:**
- Add label: "Format: [Audience] struggling with [Problem]"
- Update 4 examples to problem-first format:
  - Before: "Meal planning app for busy parents with picky eaters"
  - After: "Busy parents who waste hours figuring out what to cook because their kids reject everything"

### 1.3 Credit Warning States
**Files:** `src/components/layout/header.tsx` or credit display component
**Change:**
- Badge turns yellow at ≤3 credits
- Badge turns red at ≤1 credit
- Add "Get More" link next to badge

### 1.4 Interview Guide Prominence
**Files:** `src/app/(dashboard)/research/[id]/page.tsx`
**Change:**
- After Verdict tab content, add CTA: "Download Interview Guide" (prominent)
- Link to existing interview questions in Community tab

---

## Phase 2: Structured Input Redesign (Core Product)
*This is the big one - addresses 64% relevance problem*

### 2.1 New Input Form Schema
**Files:**
- `src/components/research/hypothesis-form.tsx` (major rewrite)
- `src/types/research.ts` (add StructuredHypothesis type)

**New Structure:**
```typescript
interface StructuredHypothesis {
  audience: string        // "Who's struggling?"
  problem: string         // "What's their problem?"
  problemLanguage?: string // "How do THEY describe it?" (optional)
  solution?: string       // "Your solution idea" (optional)
}
```

**UI Changes:**
- Replace single textarea with 3-4 step wizard
- Step 1: "Who's struggling?" (required)
- Step 2: "What's their problem?" (required)
- Step 3: "How do THEY describe it?" (optional, with hint)
- Step 4: "Your solution idea" (optional, collapsible)

### 2.2 Problem Language Extraction Preview
**Files:**
- `src/app/api/research/coverage-check/route.ts` (enhance)
- `src/components/research/coverage-preview.tsx` (enhance)

**New Flow:**
```
User submits structured input
    ↓
AI generates problem-language phrases:
  "We'll search for people expressing:"
  ✓ "kids won't eat anything"
  ✓ "dinner time is a nightmare"
    ↓
User sees subreddits:
  "In communities like:"
  ✓ r/Parenting (1,200 posts)
  + Add your own subreddit
  - Remove r/business (too broad)
    ↓
[Looks right] [Edit search terms]
```

### 2.3 Backend: Use Structured Input
**Files:**
- `src/lib/reddit/keyword-extractor.ts` (accept structured input)
- `src/app/api/research/community-voice/route.ts` (pass structured fields)

**Changes:**
```typescript
// Instead of extracting keywords from free-form hypothesis,
// use structured fields directly:
extractSearchKeywords({
  audience: input.audience,
  problem: input.problem,
  customerLanguage: input.problemLanguage // Use as-is if provided
})
```

### 2.4 Subreddit Validation UI
**Files:**
- `src/components/research/coverage-preview.tsx` (add edit capability)
- `src/app/api/research/coverage-check/route.ts` (validate user additions)

**Changes:**
- Show AI-suggested subreddits with checkboxes
- "Add subreddit" input field
- Validate via Arctic Shift getPostCount()
- Store user selections with job

---

## Phase 3: Flow & Messaging Improvements
*Medium complexity*

### 3.1 Competitor Analysis Clarity
**Files:** `src/app/(dashboard)/research/[id]/page.tsx`
**Change:**
- After Community Voice completes, show message:
  "✓ Pain Analysis, Market Sizing, and Timing Analysis complete"
  "→ Run Competitor Analysis to complete your research"
- Make it clear this is included in the credit, just user-triggered

### 3.2 Negative Keywords Support
**Files:**
- `src/components/research/hypothesis-form.tsx` (add optional field)
- `src/lib/reddit/keyword-extractor.ts` (accept user exclusions)

**Change:**
- Add collapsible "Exclude topics" field in Step 3
- Pre-suggest exclusions based on ambiguous terms (AI detects "training" → suggest "corporate training, dog training")

### 3.3 First-Time User Guidance
**Files:**
- `src/app/(dashboard)/research/page.tsx` (detect first research)
- New: `src/components/research/onboarding-modal.tsx`

**Change:**
- Check if user has 0 completed researches
- Show modal with:
  - How it works (3 simple steps)
  - What you'll get (pain signals, market size, verdict)
  - Link to FAQ/video

### 3.4 Zero-Credit State
**Files:**
- `src/app/(dashboard)/research/page.tsx`
- `src/components/research/hypothesis-form.tsx`

**Change:**
- If credits === 0, show full-screen "Unlock More Research" instead of form
- Value reinforcement: "Your last research found 23 pain signals..."
- Clear pricing CTA

---

## Phase 4: Future Enhancements (Defer)
*Track but don't implement now*

### 4.1 Async Processing with Email (Major Architecture)
- Requires: Email service integration (Resend/SendGrid)
- Changes: Job processing, result polling, notification system
- Deferred because: Current sync flow works, users can wait 60-90s

### 4.2 Email Magic Link Auth
- Requires: Supabase auth config changes
- Changes: Login page, auth callbacks
- Deferred because: Google auth covers majority of users

### 4.3 Hypothesis Comparison
- Requires: New dashboard view, comparison UI
- Changes: Research history, side-by-side rendering
- Deferred because: Nice-to-have after core flow is solid

---

## Files Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/app/(dashboard)/research/[id]/page.tsx` | 1, 3 | Tab order, interview CTA, competitor clarity |
| `src/app/(dashboard)/research/page.tsx` | 1, 3 | Examples, onboarding, zero-credit |
| `src/components/research/hypothesis-form.tsx` | 1, 2, 3 | Structured input, exclusions |
| `src/components/research/coverage-preview.tsx` | 2 | Problem language preview, subreddit editing |
| `src/components/layout/header.tsx` | 1 | Credit warnings |
| `src/lib/reddit/keyword-extractor.ts` | 2, 3 | Accept structured input, exclusions |
| `src/app/api/research/coverage-check/route.ts` | 2 | Return problem phrases |
| `src/app/api/research/community-voice/route.ts` | 2 | Accept structured hypothesis |
| `src/types/research.ts` | 2 | StructuredHypothesis type |
| NEW: `src/components/research/onboarding-modal.tsx` | 3 | First-time user modal |

---

## Risk Mitigation

1. **Phase 2 is complex** - Test thoroughly before deploying
2. **Structured input changes DB** - May need migration for hypothesis storage
3. **Backward compatibility** - Keep supporting old free-form hypotheses during transition

---

## Success Metrics

- **Relevance rate:** Target >70% (from current 36%)
- **Research completion rate:** Users who start → finish
- **Credit purchase rate:** After seeing valuable results
