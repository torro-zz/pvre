# Known Issues & Bugs

Last updated: December 2, 2024

---

## Critical

*No critical issues*

---

## High Priority

*No high priority issues*

---

## Medium Priority

### "Run Full Research" Button Stays Active
**Status:** Needs Fix
**Description:** After research completes, the "Run full Research" button remains clickable instead of being disabled.
**Location:** Research results page

### "Check API Health" Button Not Working
**Status:** Needs Fix
**Description:** The API health check button in Admin panel doesn't respond or show results.
**Location:** `/admin` page

### Claude API Costs Always Shows 0
**Status:** Needs Investigation
**Description:** The Admin Dashboard "Claude API Costs" section always displays $0.00.
**Location:** `/admin` page
**Possible cause:** Token tracking not being saved or displayed correctly.

---

## Recently Fixed (Dec 2, 2024)

### Arctic Shift 422 Timeout Errors
**Status:** ✅ Fixed
**Root Cause:** Multi-word full-text queries (`query` and `body` params) cause Arctic Shift server-side timeouts (7-8 seconds → 422 error).
**Fix:** Removed `query` and `body` parameters from Arctic Shift API calls. Now fetch by subreddit + time range only. Claude's relevance filter handles content filtering instead.
**Performance:** Requests now complete in 0.2-0.5s instead of timing out.
**Files changed:** `src/lib/data-sources/arctic-shift.ts`

### Keyword Search Quality in Community Voice
**Status:** ✅ Fixed
**Fix:** Improved keyword extraction prompt, limited search to 2 most relevant keywords, improved subreddit discovery to focus on niche communities instead of generic business subreddits.
**Files changed:** `src/lib/reddit/keyword-extractor.ts`, `src/lib/reddit/subreddit-discovery.ts`, `src/lib/data-sources/arctic-shift.ts`, `src/lib/data-sources/pullpush.ts`

### Pricing Packages Not Displayed Correctly
**Status:** ✅ Fixed (was already working)
**Fix:** Verified pricing displays correctly. Removed broken waitlist form that called deleted API endpoint.
**Files changed:** `src/app/(dashboard)/account/billing/page.tsx`

---

## Archive

See `docs/archive/` for historical issues that have been resolved:
- `HARDENING_PLAN.md` - Completed Dec 2, 2024 (type safety, shared utilities, integration tests)
- `ceo-review-report-2025-12-01.md` - Historical review findings
