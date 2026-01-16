# PVRE - Claude Code Instructions

**Read at every session start. These rules are MANDATORY.**

*Last updated: January 16, 2026*

---

## Session Start (DO THIS FIRST)

1. **Read `docs/RESUME_HERE.md`** — Where we left off, what's in progress
2. **Scan `docs/KNOWN_ISSUES.md`** (first 50 lines) — What's currently broken
3. **If RESUME_HERE.md is >3 days old:** Ask user "Where did we leave off?"

---

## Session End (BEFORE CLOSING)

Run `/goodnight` to save context for next session.

---

## Capture Immediately (SURVIVES COMPACTION)

Context compacts ~10 times per session. **Write to files immediately, not later:**

| Event | Action | File |
|-------|--------|------|
| **Decision made** (chose X over Y) | Append immediately | `docs/DECISIONS.md` |
| **Approach failed** (tried X, didn't work) | Append immediately | `docs/DECISIONS.md` |
| **Bug discovered** | Add immediately | `docs/KNOWN_ISSUES.md` |
| **Gotcha learned** (surprising behavior) | Append immediately | `docs/agent-learnings.md` |

**Format for quick decisions:**
```markdown
### {Title}
**Date:** {today}
**Decision:** {what we chose}
**Why:** {1 sentence}
```

**If you're about to say "let's remember this for later" — write it NOW instead.**

---

## Quick Reference

| Rule | Location |
|------|----------|
| Dual-mode architecture | `.claude/rules/dual-mode.md` |
| Protected/LOCKED code | `.claude/rules/protected-code.md` |
| Testing requirements | `.claude/rules/testing.md` |
| Code standards | `.claude/rules/code-standards.md` |
| Agent optimization | `.claude/rules/agent-optimization.md` |

---

## Critical Rules (Always Apply)

1. **Two modes exist:** Hypothesis + App Gap — test both if touching shared code
2. **LOCKED files:** Don't touch `universal-filter.ts` without approval
3. **Pre-commit:** `npm run build` + `npm run test:run` must pass
4. **Read before edit:** Don't guess what code does

---

## File Size Limits (ENFORCE)

Keep docs lean to avoid token bloat:

| File | Max Size | Strategy |
|------|----------|----------|
| `RESUME_HERE.md` | <100 lines | Overwrite each session (don't append) |
| `KNOWN_ISSUES.md` | <150 lines | Archive resolved to `docs/archive/` |
| `agent-learnings.md` | <200 lines | Run `/learner` monthly to compress |
| `DECISIONS.md` | <50 entries | Archive oldest when exceeded |

**When updating these files:** Check line count. If over limit, prune/archive first.

---

## Commands

| Command | Purpose |
|---------|---------|
| `/goodnight` | Save session state (ALWAYS run before ending) |
| `/test-search [query]` | Run E2E search test (forked context, sonnet) |
| `/learner` | Compress learnings, update agent knowledge |

### Testing Mode Selection (CRITICAL)

**STOP and think before running `/test-search`:**

| Context | Use This |
|---------|----------|
| Fixing App Gap issues | `/test-search app: Notion` or `/test-search` (defaults to App Gap) |
| Fixing Hypothesis issues | `/test-search hypothesis: [problem statement]` |
| General testing after shared code changes | **Run BOTH modes** |

**Common mistake:** Passing plain text triggers Hypothesis mode. If debugging App Gap, use `app:` prefix.

---

## References

| Doc | Purpose |
|-----|---------|
| `docs/RESUME_HERE.md` | Session resume point (read first!) |
| `docs/KNOWN_ISSUES.md` | Current bugs (open issues only) |
| `docs/DECISIONS.md` | Why we chose X over Y |
| `docs/CONTEXT_SYSTEM.md` | How context preservation works (reusable template) |
| `docs/REFERENCE.md` | File locations |
| `docs/ARCHITECTURE_SUMMARY.md` | Quick architecture |
| `docs/SYSTEM_DOCUMENTATION.md` | Full architecture |

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

---

## Behavior

- Prefer minimal changes over refactors
- Modify existing files before creating new ones
- Read code before modifying it
- Concise output, no over-engineering
- Use lighter models (haiku/sonnet) for simple agent tasks
