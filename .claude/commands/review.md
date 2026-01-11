---
description: Run a comprehensive codebase review using code-hardener agent
---

# PVRE Codebase Review

Use the `code-hardener` agent for a comprehensive audit.

## Quick Review (Before Commits)

```bash
# Trigger code-hardener quick audit
# Checks: build, tests, types, security, console.logs
```

## Full Audit (Periodic)

```bash
# Trigger code-hardener full audit
# Adds: dead code, refactoring opportunities, performance
```

## What Gets Checked

| Category | Checks |
|----------|--------|
| **Build** | TypeScript compilation |
| **Tests** | 66+ tests pass |
| **Types** | No `any` usage |
| **Security** | No secrets, input validation, auth |
| **Performance** | N+1 queries, large files |
| **Dead Code** | Unused exports |

## After Review

- Fix any critical/high issues before commit
- Record learnings to `docs/agent-learnings.md`
- Update `CLAUDE.md` if status changed

## Related Agents

- `output-quality` → For research result quality
- `ui-specialist` → For visual/accessibility review
- `ceo-review` → For product walkthrough
