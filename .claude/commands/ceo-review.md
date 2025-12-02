---
description: Run a comprehensive CEO-ready product review with detailed UX/UI analysis, data quality assessment, and strategic recommendations
---

# CEO Product Review

A demanding CEO walkthrough. See what users see. Be brutally honest.

**Duration:** ~15 minutes | **Credits Used:** 1 | **Output:** `docs/ceo-review-report-YYYY-MM-DD.md`

## Core Rules

1. **LOOK at every screenshot** - Describe what you literally see
2. **Check console errors after EVERY navigation** - `mcp__browser-tools__getConsoleErrors`
3. **Be honest** - This is for fixing problems, not for praise
4. **Save the report** - Must write to `docs/ceo-review-report-[DATE].md`

## Test Hypothesis
```
A tool to help freelancers manage their invoicing and client payments
```

---

## PHASES

### 1. Landing Page
```
puppeteer_navigate → http://localhost:3000
mcp__browser-tools__takeScreenshot
mcp__browser-tools__getConsoleErrors
puppeteer_evaluate → window.scrollBy(0, 800)
mcp__browser-tools__takeScreenshot
```
**Describe:** Hero clarity, CTA visibility, value prop, features section, footer

### 2. Auth + Dashboard
```
puppeteer_evaluate → fetch('/api/dev/login', { method: 'POST' })
puppeteer_navigate → http://localhost:3000/dashboard
mcp__browser-tools__takeScreenshot
```
**Describe:** Welcome message, layout, navigation, research history, credits

### 3. Research Flow (Uses 1 Credit)
```
puppeteer_navigate → http://localhost:3000/research
puppeteer_fill → textarea: [hypothesis]
puppeteer_click → button[type="submit"]
[Screenshot every 15s during processing]
[Wait up to 2 minutes]
mcp__browser-tools__takeScreenshot
```
**Describe:** Progress feedback, completion, time taken

### 4. Results Analysis
For each tab (Verdict, Community, Market, Timing, Competitors):
```
puppeteer_click → [tab]
mcp__browser-tools__takeScreenshot
```
**Describe for each:**
- Verdict: Score, 4 dimensions, weights, recommendations
- Community: Pain score, signals, quotes, interview prep
- Market: TAM/SAM/SOM, methodology
- Timing: Tailwinds/headwinds, trend direction
- Competitors: Analysis or prompt to run

### 5. Account & Admin
```
puppeteer_navigate → http://localhost:3000/account
puppeteer_navigate → http://localhost:3000/admin
[Screenshot and check errors for each]
```

### 6. PDF Export
```
Click PDF download button
[Verify download works]
```

---

## Report Template

Save to: `docs/ceo-review-report-YYYY-MM-DD.md`

```markdown
# CEO Review Report - [DATE]

**Duration:** [X] min | **Credits:** 1 | **Grade:** [A-F]

## 30-Second Summary
[What would you tell the board?]

## What Works
1. [Strength] - [Evidence]
2. [Strength] - [Evidence]

## Critical Issues (Fix This Week)
1. **[Issue]** - [What you saw] → [Fix]

## UX Issues (Fix This Month)
1. **[Issue]** - [What you saw] → [Fix]

## Page Analysis

| Page | Grade | Key Issues |
|------|-------|------------|
| Landing | [A-F] | [Brief] |
| Dashboard | [A-F] | [Brief] |
| Research | [A-F] | [Brief] |
| Results | [A-F] | [Brief] |
| Admin | [A-F] | [Brief] |

## Data Quality
- Pain Score: X/10
- Signals: X found
- Quote Quality: [Authentic/Generic]
- Would I trust this? [Yes/No]

## Console Errors
[List all errors with pages]

## Bottom Line
**Would I invest?** [Yes/No/Maybe]
**One thing to fix first:** [Most critical]
```

---

## Success Checklist

- [ ] Every page visited and screenshotted
- [ ] Console errors checked after each navigation
- [ ] Full research flow completed
- [ ] All result tabs inspected
- [ ] Report saved with actionable recommendations
- [ ] Honest grade assigned
