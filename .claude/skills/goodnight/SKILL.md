---
name: goodnight
description: Save session state to RESUME_HERE.md before ending work. Trigger with /goodnight or "save session" or "end of day"
model: claude-sonnet-4-20250514
context: fork
---

# Goodnight Command

Capture session state to `docs/RESUME_HERE.md` for easy resume.

## Key Files to Check

| File | What to Extract |
|------|-----------------|
| `docs/KNOWN_ISSUES.md` | Current bugs and status |
| `docs/RESUME_HERE.md` | Previous session context |
| `CLAUDE.md` | Project rules |

**Project Path:** `/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE`

---

## Step 1: Gather Context

```bash
git status
git diff --stat
git log --oneline --since="6 hours ago"
npm run build 2>&1 | tail -20
npm run test:run 2>&1 | tail -10
lsof -i :3000 2>/dev/null | head -5
```

Read `docs/KNOWN_ISSUES.md` for remaining bugs.

---

## Step 2: Generate RESUME_HERE.md

```markdown
# Resume Point — {DATE}

**Last Session:** {DATE}

---

## What Was Just Completed
{Summary of git commits and changes}

---

## Uncommitted Changes

{If uncommitted:}
⚠️ **WARNING: You have uncommitted changes!**

| File | Status | Purpose |
|------|--------|---------|

{If all committed:}
✅ All changes committed

---

## Build & Test Status

| Check | Status |
|-------|--------|
| **Build** | ✅ Passing / ❌ Failing |
| **Tests** | X passing, Y skipped |
| **Dev Server** | Running on :3000 / Not running |

---

## What's Next
{From KNOWN_ISSUES.md or conversation context}

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Project instructions | `CLAUDE.md` |
| Known bugs | `docs/KNOWN_ISSUES.md` |
| Architecture | `docs/SYSTEM_DOCUMENTATION.md` |
| Quick reference | `docs/REFERENCE.md` |

---

## Quick Start Commands

\`\`\`bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev
npm run test:run
npm run build
\`\`\`

---

## User Notes
{From user input}
```

---

## Step 3: Ask User

**"Any notes to add before saving?"**

---

## Step 4: Save & Confirm

Write to `docs/RESUME_HERE.md` and display:

```
✅ Session saved to docs/RESUME_HERE.md
Goodnight!
```

---

## Rules

1. Always ask for user notes before saving
2. Actually run build/test commands for accurate status
3. Warn loudly about uncommitted changes (⚠️)
4. Include working directory in quick start
