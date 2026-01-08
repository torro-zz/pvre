# PVRE - Claude Code Instructions

**Read at every session start. These rules are MANDATORY.**

*Last updated: January 8, 2026*

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

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

---

## Commands

| Command | Purpose |
|---------|---------|
| `/goodnight` | Save session state to `docs/RESUME_HERE.md` |

---

## References

| Doc | Purpose |
|-----|---------|
| `docs/KNOWN_ISSUES.md` | Current bugs |
| `docs/RESUME_HERE.md` | Session resume point |
| `docs/REFERENCE.md` | File locations |
| `docs/ARCHITECTURE_SUMMARY.md` | Quick architecture |
| `docs/SYSTEM_DOCUMENTATION.md` | Full architecture |

---

## Behavior

- Prefer minimal changes over refactors
- Modify existing files before creating new ones
- Read code before modifying it
- Concise output, no over-engineering
- Use lighter models (haiku/sonnet) for simple agent tasks
