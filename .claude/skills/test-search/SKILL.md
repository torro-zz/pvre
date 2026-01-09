---
name: test-search
description: Run E2E search test via Playwright and report observations. Trigger with /test-search [hypothesis] or /test-search [app-url]
model: claude-sonnet-4-20250514
context: fork
---

# Test Search Skill

Run an E2E search test and report detailed observations without consuming main context.

**Project Path:** `/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE`

---

## Arguments

The skill accepts an optional argument:
- **Hypothesis mode:** `/test-search Remote workers need async communication tools`
- **App Gap mode:** `/test-search https://apps.apple.com/app/notion/id1232780281`
- **No argument:** Uses default test hypothesis

---

## Step 1: Environment Check

```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
lsof -i :3000 2>/dev/null | head -3
```

If dev server not running:
```bash
npm run dev &
sleep 5
```

---

## Step 2: Dev Login

```bash
curl -X POST http://localhost:3000/api/dev/login -c /tmp/pvre-test-cookies.txt -s
```

Verify login success before proceeding.

---

## Step 3: Navigate to App

Use Playwright to navigate:

```
browser_navigate: http://localhost:3000/research
```

Take a snapshot to verify the page loaded:

```
browser_snapshot
```

---

## Step 4: Enter Search Query

**Default hypothesis (if no argument provided):**
> "Remote workers need better async video communication tools"

1. Find the search input field
2. Fill in the hypothesis or app URL
3. Submit the search

```
browser_fill_form or browser_type into the search field
browser_click the submit/search button
```

---

## Step 5: Observe Search Progress

Monitor the search flow. Take snapshots at key moments:

| Stage | What to Look For |
|-------|------------------|
| **Initial** | Loading indicator appears |
| **Pain Signals** | Signals start appearing with scores |
| **Themes** | Theme clusters extracted |
| **Competitors** | Competitor analysis runs (should auto-start!) |
| **Complete** | All tabs populated |

**Key observation:** Does competitor analysis auto-run or show "Complete Your Research" prompt?

Take snapshots every 10-15 seconds during loading:
```
browser_snapshot
browser_wait_for: { time: 10 }
browser_snapshot
```

---

## Step 6: Check Competition Tab

Navigate to the Competition tab and observe:

1. Is competitor data populated?
2. Or does it show "Complete Your Research" button?
3. What is the verdict score (X/4 dimensions)?

```
browser_click: Competition tab
browser_snapshot
```

---

## Step 7: Database Verification

After search completes, verify database state:

```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npx tsx scripts/check-competitor-status.ts 2>&1 | head -50
```

Check for:
- Latest job status: `completed` vs `failed`
- `step_status.competitor_analysis`: `completed` vs `failed`
- `competitor_intelligence` record exists: YES vs NO

---

## Step 8: Generate Report

Create a structured observation report:

```markdown
# Test Search Report — {TIMESTAMP}

## Search Details
- **Query:** {hypothesis or app URL}
- **Mode:** Hypothesis / App Gap
- **Duration:** ~X seconds

## UI Observations

| Stage | Status | Notes |
|-------|--------|-------|
| Page Load | ✅/❌ | |
| Pain Signals | ✅/❌ | X signals found |
| Theme Extraction | ✅/❌ | X themes |
| Competitor Analysis | ✅/❌ | Auto-ran / Manual prompt shown |
| Final Verdict | X/4 | |

## Database State

| Field | Value |
|-------|-------|
| Job Status | completed/failed |
| competitor_analysis step | completed/failed |
| competitor_intelligence record | YES/NO |

## Key Finding

{One sentence summary: Did the fix work? Did competitor analysis auto-run?}

## Screenshots Taken
- {List of key snapshots}
```

---

## Step 9: Return Summary

Return the report to the main context for opus to summarize.

---

## Rules

1. **Take snapshots frequently** - They're the evidence
2. **Wait for loading** - Don't rush, let steps complete
3. **Check database** - UI can lie, database is truth
4. **Report failures clearly** - If something breaks, describe exactly what
5. **Note timing** - How long did each step take?

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Dev server not running | Start with `npm run dev &` |
| Login fails | Check if server is responding |
| Page doesn't load | Verify localhost:3000 is accessible |
| Competitor stuck | Check console for errors |
