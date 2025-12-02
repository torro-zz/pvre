# Known Issues & Bugs

Last updated: December 2, 2024

---

## Critical

*No critical issues*

---

## High Priority

### Keyword Search Quality in Community Voice
**Status:** Needs Investigation
**Description:** User reported: "The Hypothesis is split into keywords and it seems like the AI is searching for these keywords in Reddit communities. Hence the selection of comments and submissions are irrelevant to our search."
**Example:** Hypothesis "workout app for entrepreneurs short on time" returns irrelevant posts.
**Root cause:** Too-broad subreddit selection and keyword matching.

### Pricing Packages Not Displayed Correctly
**Status:** Needs Fix
**Description:** Pricing packages in user settings/billing page don't show correct information.
**Location:** Account settings page

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

## Archive

See `docs/archive/` for historical issues that have been resolved:
- `HARDENING_PLAN.md` - Completed Dec 2, 2024 (type safety, shared utilities, integration tests)
- `ceo-review-report-2025-12-01.md` - Historical review findings
