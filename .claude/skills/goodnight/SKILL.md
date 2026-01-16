---
name: goodnight
description: Save session state to RESUME_HERE.md before ending work. Trigger with /goodnight or "save session" or "end of day"
model: claude-sonnet-4-20250514
context: fork
---

# Goodnight Command

Capture session state to `docs/RESUME_HERE.md` for easy resume.

**Project Path:** `/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE`

---

## Step 1: Gather Context

```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
git status
git diff --stat
git log --oneline --since="6 hours ago"
npm run build 2>&1 | tail -20
npm run test:run 2>&1 | tail -10
wc -l docs/KNOWN_ISSUES.md docs/RESUME_HERE.md 2>/dev/null
```

Read `docs/KNOWN_ISSUES.md` (first 50 lines) for remaining bugs.

---

## Step 2: Ask User for Context

**Ask these questions:**

1. "What was the main focus of this session?"
2. "Any decisions we made that future sessions should know about?"
3. "Anything that didn't work (so we don't retry it)?"
4. "Any other notes?"

---

## Step 3: Generate RESUME_HERE.md

**Target: <100 lines (overwrite, don't append)**

```markdown
# Resume Point — {DATE}

**Last Session:** {DATE}

---

## Session Focus
{From user input — 1-2 sentences}

---

## What Was Completed
{Summary of git commits from last 6 hours}

---

## Decisions Made This Session
{From user input — bullet points. Also append to docs/DECISIONS.md if significant}

---

## Things That Didn't Work
{From user input — so we don't retry}

---

## Uncommitted Changes

{If uncommitted:}
⚠️ **WARNING: Uncommitted changes!**

| File | Purpose |
|------|---------|

{If clean:}
✅ All changes committed

---

## What's Next
{From KNOWN_ISSUES.md open items or user input}

---

## Build & Test Status

| Check | Status |
|-------|--------|
| Build | ✅/❌ |
| Tests | X passing |

---

## Quick Start

\`\`\`bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev
npm run test:run
\`\`\`
```

---

## Step 4: Check File Size Limits

Before saving, verify:
- `docs/RESUME_HERE.md` will be <100 lines
- If `docs/KNOWN_ISSUES.md` >150 lines: remind user to archive resolved issues

---

## Step 5: Update DECISIONS.md (if needed)

If user reported significant decisions, append to `docs/DECISIONS.md`:

```markdown
### {Decision Title}
**Date:** {today}
**Context:** {why this came up}
**Decision:** {what we chose}
**Alternatives rejected:** {what didn't work}
```

---

## Step 6: Save & Confirm

Write to `docs/RESUME_HERE.md` and display:

```
✅ Session saved to docs/RESUME_HERE.md

Summary:
- Focus: {brief}
- Commits: {count}
- Decisions: {count} (added to DECISIONS.md: {yes/no})
- Next: {first item from What's Next}

Goodnight!
```

---

## Rules

1. **Always ask user questions** before generating — don't assume
2. **Keep RESUME_HERE.md <100 lines** — overwrite, don't append
3. **Capture decisions** — if significant, add to DECISIONS.md
4. **Warn about uncommitted changes** (⚠️)
5. **Run actual build/test commands** for accurate status
