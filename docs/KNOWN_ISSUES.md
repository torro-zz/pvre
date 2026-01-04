# Known Issues

Last updated: January 3, 2026

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## 🔴 CRITICAL — Data Quality Bugs

### ⏳ IN PROGRESS: Praise Filter Needs Embedding-Based Approach
**Status:** Architecture Mismatch Identified — January 3, 2026
**Impact:** Pure praise reviews slipping through as pain signals

**Current State:**
- v10.1 praise filter uses regex patterns
- Unit tests pass (9/9) but real-world verification invalid
- Timeleft test was against Reddit data, not App Store reviews

**The Problem:**
PVRE uses embedding-based architecture throughout:
- Relevance filtering → embeddings
- Semantic categorization → embeddings (signal-categorizer.ts)
- Praise filtering → ❌ regex (inconsistent)

Regex-based filtering is brittle and doesn't match the established pattern.

**The Solution:**
Build praise filter using the SAME pattern as `signal-categorizer.ts`:

```typescript
// Consistent with existing architecture
const PRAISE_ANCHOR = "Amazing app, love it, perfect, highly recommend, game changer, best ever, exceeded expectations";
const COMPLAINT_ANCHOR = "Broken, crashes, doesn't work, frustrating, missing features, wish it had, needs fixing, terrible";

// Pre-compute embeddings (cache like category embeddings)
const praiseEmbedding = await embed(PRAISE_ANCHOR);
const complaintEmbedding = await embed(COMPLAINT_ANCHOR);

// For each signal
const signalEmbedding = await embed(signal.text);
const praiseSim = cosineSimilarity(signalEmbedding, praiseEmbedding);
const complaintSim = cosineSimilarity(signalEmbedding, complaintEmbedding);

// Filter if clearly praise + high rating
if (rating >= 4 && praiseSim > complaintSim + 0.15 && praiseSim > 0.5) {
  // Filter as praise
}
```

**Why This Is Better:**
- Consistent with existing PVRE architecture
- Uses same embedding model already in use
- Semantic understanding vs brittle keyword matching
- Can tune thresholds like semantic categorization

**Next Steps:**
1. Verify current v10.1 with Loom (working App Store app)
2. Build embedding-based praise filter following signal-categorizer.ts pattern
3. Compare results, keep whichever performs better

---

### ⏳ INVESTIGATING: App Gap Mode Fallback Behavior
**Status:** Open — January 3, 2026
**Impact:** May show irrelevant Reddit data when App Store fails

**Problem:** When Timeleft App Store API returned 404:
- System showed 44 "pain signals"
- These were Reddit dating posts, NOT app reviews
- Coverage metadata showed "Data Sources: Reddit" in App Gap mode

**Questions to Answer:**
1. Is there fallback logic when App Store returns 404/error?
2. Should App Gap mode fail gracefully instead of falling back to Reddit?
3. Did the "Skip Reddit" logic not trigger, or is there undocumented fallback?

**Affected Files:**
- `src/app/api/research/community-voice/route.ts` — App Gap mode logic
- `src/lib/data-sources/adapters/app-store-adapter.ts` — 404 handling

**Workaround:** Use apps confirmed to work (Loom, Headspace, Slack)

---

### ✅ CLOSED: "Ads & Interruptions" Category Matching Wrong Context
**Status:** Fixed — January 3, 2026
**Resolution:** Removed problematic keywords from `user-feedback.tsx`

---

### Theme Analysis Metadata All Undefined
**Status:** Cannot Reproduce — January 3, 2026

---

### ✅ CLOSED: WTP Signals Show Purchase Regret, Not Purchase Intent
**Status:** Fixed — January 3, 2026
**Resolution:** Added 13 exclusion patterns to `WTP_EXCLUSION_PATTERNS`

---

### ✅ CLOSED: Pure Praise Reviews Classified as Pain Signals (Regex Approach)
**Status:** Fixed but Suboptimal — January 3, 2026

**Note:** v8.0 → v9.0 → v10.1 used regex patterns. This works for unit tests but:
- Doesn't match PVRE's embedding-based architecture
- Creates maintenance burden (endless pattern additions)
- Less semantic understanding than embeddings

**Recommendation:** Replace with embedding-based approach (see first issue above)

---

## Recently Closed (January 3, 2026)

### ✅ CLOSED: Complete Module Specifications (HIGH Priority)
**Status:** Completed — January 3, 2026

### ✅ CLOSED: App Gap Mode Shows Irrelevant Reddit Posts
**Status:** Fixed — January 3, 2026
**Resolution:** Added App Name Gate filter for posts AND comments

### ✅ CLOSED: Architecture Documentation Section 18
**Status:** Completed (Partial) — January 3, 2026

---

## Recently Closed (January 2, 2026)

### ✅ CLOSED: Two-Step Analysis Flow Causing Score Changes
### ✅ CLOSED: Verdict Score Inconsistent Across Tabs
### ✅ CLOSED: Market Score 7-Point Gap (9.3 vs 2.2)
### ✅ CLOSED: Competitor Classification Misclassifying High-Threat Competitors
### ✅ CLOSED: Analyzed App Appears in Own Competitor List
### ✅ CLOSED: App Store Review Count Mismatch (39,668 → 16)
### ✅ CLOSED: Same Comment in Multiple Categories
### ✅ CLOSED: UI Polish Items (Batch)

---

## Medium Priority — Architecture

### ✅ CLOSED: App Store-First Architecture for App Gap Mode
**Status:** All Phases Complete — January 3, 2026

---

## Medium Priority — UI Redesign

### Verdict Page Has Too Many Score Constructs
**Status:** Partially Complete — January 2, 2026
**Remaining:** Part 4: User preference toggle (needs DB change)

---

## Low Priority — Logic / Accuracy

### Entry Difficulty Still Potentially Underestimated
**Status:** Open — MONITOR

### Timing Score Minor Mismatch (8.2 vs 8.4)
**Status:** Open — LOW PRIORITY

### "3.5 WTP Found" — Fractional Signal Count
**Status:** Needs Reproduction

---

## Existing Open Items

- Connect Help Button to Canny (Deferred)
- Clarify Purpose of API Keys
- Investigate Two-Panel Section
- Redesign Research Page Layout (Partial)

---

## Architecture Reference

**Key files:**
- Pain detection: `pain-detector.ts`
- Signal categorization: `signal-categorizer.ts` ← **Follow this pattern for praise filter**
- Theme extraction: `theme-extractor.ts`
- Community voice: `community-voice/route.ts`
- App Store adapter: `app-store-adapter.ts`

**Embedding Pattern (use this for all semantic classification):**
```typescript
// From signal-categorizer.ts - the established pattern
const categoryEmbeddings = await Promise.all(
  categories.map(cat => embed(cat.description))
);
const signalEmbedding = await embed(signal.text);
const similarity = cosineSimilarity(signalEmbedding, categoryEmbedding);
// Use threshold for confidence
```

**Architecture Docs:** `docs/SYSTEM_DOCUMENTATION.md` Section 18

---

## How to Use This File

**For CC:** 
1. 🔴 CRITICAL bugs first
2. **Check existing patterns before implementing** — Use embeddings, not regex
3. Follow `signal-categorizer.ts` pattern for any semantic classification
4. Reference Architecture section for key files
5. Run Pre-Fix Testing Checklist before closing