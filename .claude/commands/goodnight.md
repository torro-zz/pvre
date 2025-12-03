---
description: Save session state to RESUME_HERE.md before ending work (asks for notes)
---

# Goodnight Agent

Capture the current session state before shutting down, creating a comprehensive `docs/RESUME_HERE.md` file that makes resuming work effortless.

## Key Project Files (MUST READ THESE)

| File | What to Extract |
|------|-----------------|
| `docs/KNOWN_ISSUES.md` | Bugs table (Medium Priority), UX Improvements with ✅ IMPLEMENTED markers |
| `docs/IMPLEMENTATION_PLAN.md` | Current phase status, next priorities from 4-phase roadmap |
| `docs/RESUME_HERE.md` | Previous session context (what was done before) |
| `CLAUDE.md` | Project instructions, "Critical Quality Metric: Relevance" section |

**Project Path:** `/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE`

---

## Phase 1: Gather Context

Run these commands to understand the current state:

### 1.1 Git Status
```bash
git status
```
Capture: modified files, untracked files, staged changes

### 1.2 Git Diff Summary
```bash
git diff --stat
git diff --staged --stat
```
Capture: scope of changes (files changed, insertions, deletions)

### 1.3 Recent Commits (if any today)
```bash
git log --oneline --since="6 hours ago"
```
Capture: what was committed this session

### 1.4 Build Status
```bash
npm run build 2>&1 | tail -20
```
Capture: ✅ Passing or ❌ Failing (with error summary)

### 1.5 Test Status
```bash
npm run test:run 2>&1 | tail -10
```
Capture: X passing, Y failing, Z skipped

### 1.6 Dev Server Status
```bash
lsof -i :3000 2>/dev/null | head -5
```
Capture: Running or Not running

### 1.7 Read Key Files (CRITICAL - Do not skip!)

**File 1: `docs/KNOWN_ISSUES.md`**
- Extract: Bugs table entries (check status column)
- Extract: UX Improvements - note which are ✅ IMPLEMENTED vs pending
- Purpose: Identify remaining bugs and next UX priorities

**File 2: `docs/IMPLEMENTATION_PLAN.md`**
- Extract: Which phases are complete (Phase 1, 2, 3, 4)
- Extract: Current/next phase priorities with file paths
- Purpose: Know what's next in the 4-phase roadmap

**File 3: `docs/RESUME_HERE.md`**
- Extract: What was done in previous sessions
- Purpose: Provide continuity context

**File 4: `CLAUDE.md`**
- Extract: Key quality standards (66+ tests, build must pass)
- Extract: "Critical Quality Metric: Relevance" - the 64% problem
- Purpose: Remind next session of quality requirements

## Phase 2: Analyze Session

From the gathered context, determine:

1. **What was worked on** - Group modified files by feature/purpose
2. **What was completed** - Based on commits and file changes
3. **What's incomplete** - Uncommitted changes, failing tests
4. **Next priorities** - From `docs/IMPLEMENTATION_PLAN.md` (which phase is next?) and `docs/KNOWN_ISSUES.md` (remaining bugs)
5. **Phase status** - Which of the 4 phases in IMPLEMENTATION_PLAN.md are complete?

## Phase 3: Generate Preview

Create a draft of `docs/RESUME_HERE.md` with this structure:

```markdown
# Resume Point - {TODAY'S DATE}

## What Was Just Completed
{Summarize work done based on git commits and file changes}

## Files Modified This Session
| File | Status | Purpose |
|------|--------|---------|
| path/to/file.ts | Modified | Brief description |
| path/to/new.ts | New | Brief description |

## Uncommitted Changes
{If uncommitted changes exist:}
⚠️ **WARNING: You have uncommitted changes!**
{List of uncommitted files}

{If all committed:}
✅ All changes committed

## Build & Test Status
- **Build:** ✅ Passing / ❌ Failing
- **Tests:** X passing, Y failing, Z skipped
- **Dev Server:** Running on :3000 / Not running

## What Needs To Be Done Next
{Prioritized list from docs/IMPLEMENTATION_PLAN.md and docs/KNOWN_ISSUES.md}

### From Implementation Plan (4-Phase Roadmap)
{Current phase and next items - check which phases are complete}

### From Known Issues
{Remaining bugs from KNOWN_ISSUES.md Bugs table}
{Pending UX improvements (those without ✅ IMPLEMENTED)}

## Blockers or Open Questions
{Any unresolved issues discovered during the session}

## User Notes
{Will be filled after user input}

## Key Files Reference
| Purpose | File |
|---------|------|
| Project instructions | `CLAUDE.md` |
| Known bugs & UX backlog | `docs/KNOWN_ISSUES.md` |
| 4-phase implementation roadmap | `docs/IMPLEMENTATION_PLAN.md` |
| Technical overview | `docs/TECHNICAL_OVERVIEW.md` |
| {Context-specific files from session} | {paths} |

## Quick Start Commands
```bash
# Start dev server
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev

# Run tests
npm run test:run

# Build
npm run build
```
```

## Phase 4: User Review

Display the generated preview to the user and ask:

**"Here's the session summary. Any notes or context to add before saving?"**

Options:
- User provides notes → Add to "User Notes" section
- User says "none" or skips → Set "User Notes" to "None"

## Phase 5: Save & Confirm

1. Write the final document to `docs/RESUME_HERE.md`
2. Display confirmation message:

```
✅ Session state saved to docs/RESUME_HERE.md

Summary:
- Files tracked: X modified, Y new
- Build: ✅/❌
- Tests: X passing
- Uncommitted: Yes/No

Goodnight! 🌙
```

## Important Rules

1. **Never skip the user notes prompt** - Always ask before saving
2. **Be accurate about build/test status** - Actually run the commands
3. **Include ALL modified files** - Don't summarize away important details
4. **Prioritize next steps clearly** - Most important first
5. **Warn loudly about uncommitted changes** - Use ⚠️ emoji
6. **Include the working directory path** - In quick start commands

## Example Output

After running `/goodnight`, the user should see:

```
## Session Analysis Complete

📊 **Git Status:**
- 3 files modified
- 1 new file
- All changes committed ✅

🔨 **Build:** Passing ✅
🧪 **Tests:** 66 passing, 0 failing

---

## Preview of RESUME_HERE.md

# Resume Point - December 2, 2024

## What Was Just Completed

### LemonSqueezy Billing Fix
- Created migration for column renames
- Rewrote checkout route
- Rewrote webhook route
- Updated TypeScript types

## Files Modified This Session
| File | Status | Purpose |
|------|--------|---------|
| src/app/api/billing/checkout/route.ts | Modified | LemonSqueezy checkout |
| src/app/api/billing/webhook/route.ts | Modified | LemonSqueezy webhooks |
| src/types/supabase.ts | Modified | Updated column types |
| supabase/migrations/008_restore_lemonsqueezy.sql | New | DB migration |

...

---

**Any notes or context to add before saving?**
(Type your notes or "none" to skip)
```
