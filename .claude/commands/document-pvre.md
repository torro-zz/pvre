---
description: Run deep PVRE documentation with data source audit (creates 7 files)
---

# PVRE Documentation Deep Dive

Use the `pvre-documenter` agent for comprehensive data source documentation.

## What It Does

1. **Runs TWO searches via Playwright UI:**
   - Hypothesis: "Solo founders struggling to get their first 10 paying customers"
   - App Gap: "Notion"

2. **Classifies EVERY number:**
   - ✓ Verified (from real APIs)
   - ⚠️ AI Estimate (Claude guesses)
   - = Calculated (formula applied)
   - ❌ Discrepancy (AI vs reality >20%)

3. **Creates 7 output files in ~/Downloads/:**
   - `HYPOTHESIS_SEARCH_DEEP_DIVE.md`
   - `APP_GAP_SEARCH_DEEP_DIVE.md`
   - `RAW_DATA_SAMPLES.json`
   - `CALCULATION_FORMULAS.md`
   - `INTERVIEW_QUESTIONS_GENERATED.md`
   - `ONE_PAGE_SUMMARY.md`
   - `DATA_QUALITY_AUDIT.md`

## Prerequisites

- Dev server running on :3000
- Test user with 2+ credits
- Playwright MCP connected

## Key Outputs

### Per Search Documentation
- Screenshots at every step (15+)
- Every number classified
- 3-5 REJECTED posts per filter stage
- Date distribution (actual counts, not just %)

### RAW_DATA_SAMPLES.json
- Arctic Shift API responses
- Exact Claude prompts (copy-paste from code)
- Google Trends raw data
- Filtered vs rejected posts

### DATA_QUALITY_AUDIT.md
- Summary: % verified vs AI estimates
- Discrepancies flagged (AI vs verifiable)
- Recommendations for improvement

## The Honesty Principle

If a number is bullshit, say it's bullshit.

Example:
> ⚠️ AI ESTIMATE: `userSatisfaction: 3.2` is Claude's guess. App Store shows 4.6★. ❌ 44% discrepancy.

## After Running

Check ~/Downloads/ for all 7 files.
Review DATA_QUALITY_AUDIT.md for summary of findings.

## Related

- `/ceo-review` - Product walkthrough
- `/test-flow` - E2E flow testing
- `/output-quality` - LeanSpark evaluation
