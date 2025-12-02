---
description: Comprehensive end-to-end test of PVRE research flow via Puppeteer
---

# E2E Test Flow

Automated Puppeteer test of the complete PVRE research flow.

## Test Modes

| Mode | Duration | Credits | Use When |
|------|----------|---------|----------|
| Smoke | ~2 min | 0 | Quick sanity check |
| Full | ~5 min | 1 | Before release, after major changes |

## Test Hypothesis
```
A tool to help freelancers manage their invoicing and client payments
```

---

## Pre-Flight

```bash
# Check if dev server running
lsof -i :3000 | head -1

# Start if needed
npm run dev
```

---

## SMOKE TEST (No credits)

### 1. Homepage
```
puppeteer_navigate → http://localhost:3000
mcp__browser-tools__getConsoleErrors
puppeteer_screenshot → 'home'
✓ CTA visible, no errors
```

### 2. Auth
```
puppeteer_evaluate → fetch('/api/dev/login', { method: 'POST' })
puppeteer_navigate → http://localhost:3000/dashboard
puppeteer_screenshot → 'dashboard'
✓ "Welcome back, Test User (Dev)!"
```

### 3. Research Page
```
puppeteer_navigate → http://localhost:3000/research
mcp__browser-tools__getConsoleErrors
puppeteer_screenshot → 'research'
✓ Form visible, submit button present
```

### 4. Admin
```
puppeteer_navigate → http://localhost:3000/admin
mcp__browser-tools__getConsoleErrors
puppeteer_screenshot → 'admin'
✓ Analytics visible
```

---

## FULL TEST (Uses 1 credit)

Includes smoke test PLUS:

### 5. Run Research
```
puppeteer_fill → textarea: "[hypothesis]"
puppeteer_click → button[type="submit"]
[Wait up to 120s, screenshot every 30s]
mcp__browser-tools__getConsoleErrors
puppeteer_screenshot → 'results'
✓ Pain score, signals, verdict displayed
```

### 6. Verify Each Tab
```
Click and screenshot: Verdict, Community, Market, Timing, Competitors
✓ All tabs render with data
```

### 7. Data Persistence
```
puppeteer_navigate → http://localhost:3000/dashboard
✓ New research appears in history
```

### 8. PDF Export
```
Click PDF download button
✓ Downloads without error
```

---

## Error Detection

**CRITICAL: Check after EVERY navigation:**
```
mcp__browser-tools__getConsoleErrors
mcp__browser-tools__getNetworkErrors
```

---

## Report Format

```markdown
## E2E Test Results

**Date:** [timestamp]
**Duration:** [X]s
**Mode:** Smoke/Full
**Status:** PASS/FAIL

| Test | Status | Notes |
|------|--------|-------|
| Homepage | ✓/✗ | |
| Auth | ✓/✗ | |
| Dashboard | ✓/✗ | |
| Research Form | ✓/✗ | |
| Research Complete | ✓/✗ | [X]s |
| Results Display | ✓/✗ | |
| Admin | ✓/✗ | |

### Console Errors
[None / List with pages]

### Network Errors
[None / List]

### Issues Found
[Any problems to investigate]
```

---

## Success Criteria

- [ ] All pages load without JS errors
- [ ] Auth works (dev login)
- [ ] Research completes (if full test)
- [ ] Results display correctly
- [ ] Data persists to dashboard
- [ ] Admin accessible
