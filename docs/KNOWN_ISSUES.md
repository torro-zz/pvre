# KNOWN_ISSUES Update Notes

Based on verification of Timeleft export (Jan 3 job, pre-fix) and handoff doc.

## Status Check

### Items Marked "CLOSED" But Need Verification with Post-Fix Job

These are marked closed in KNOWN_ISSUES but the Timeleft export (Jan 3, BEFORE fixes) still showed the bugs. **This is expected** — we need to verify with the Loom export (Jan 4, AFTER fixes).

| Issue | KNOWN_ISSUES Status | Timeleft Export | Need Loom Verify |
|-------|---------------------|-----------------|------------------|
| Self-competitor filter | ✅ CLOSED | ❌ Still shows Timeleft as competitor #1 | YES |
| App Store dates | ✅ CLOSED | ❌ All 44 signals have `createdUtc: null` | YES |
| Interview questions | ✅ CLOSED | ❌ `interview_guide: null` | YES |
| Recency metrics | (Not explicitly listed) | ❌ `last30Days: 0, last90Days: 0` | YES |

**Action:** Run Loom export. If these still fail on post-fix job, reopen the issues.

---

## Items Correctly Still Open

These 3 CRITICAL UI issues are correctly marked open:

### 1. Verdict Messages Contradict Each Other ✓
Still open, still critical. Evidence from handoff doc confirms yellow box says "proceed" while verdict says "pivot".

### 2. Reddit Metrics Shown in App Gap Mode ✓
Still open. Shows "0 communities" and "94 posts" for App Store reviews.

### 3. Market Score Unexplained (1.0 "Critical") ✓
Still open. No context for what "11.1% penetration" means.

---

## Suggested KNOWN_ISSUES Updates

### Add: Verification Pending Note
Under the "Recently Closed (January 4, 2026)" section, add:

```markdown
**⚠️ Note:** These fixes were verified with code review. Production verification pending with Loom export (Job ID: dbf8ff61-2b4b-46e0-a37d-0ae432ae159f). The Timeleft export (Jan 3) predates these fixes.
```

### Add: Recency Metrics Issue
This isn't explicitly tracked but is a symptom of the dates bug:

```markdown
### Recency Metrics Always Zero When Dates Null
**Status:** Dependent on App Store dates fix
**Impact:** "Recency: 0%" shown, makes data look stale
**Root cause:** If `createdUtc` is null, recency calculation returns 0
**Fix:** Upstream — once dates are populated, recency will calculate correctly
```

### Clarify: Self-Competitor Filter Location
The current entry says "Self-exclusion filter added" but doesn't specify where. Update:

```markdown
### ✅ CLOSED: Analyzed App Appears in Own Competitor List
**Resolution:** Self-exclusion filter added in `scripts/export-research.ts`
**Verification:** Should show "7 — 1 self-reference filtered" in export
**Files:** `scripts/export-research.ts` (competitor rendering section)
```

---

## Summary

| Category | Count |
|----------|-------|
| CRITICAL - Open | 3 (UI contradictions) |
| Closed - Needs post-fix verification | 4 |
| Correctly closed | ~15 |

**Next action:** Export Loom job and verify the 4 items above actually work.
