---
description: Debug bugs with systematic root cause analysis
---

# Debugger

Use the `debugger` agent for systematic root cause analysis of bugs and errors.

## What debugger Does

1. **Captures errors** — Console, network, stack traces
2. **Reproduces** — Documents exact steps
3. **Locates** — Traces through code path
4. **Hypothesizes** — States cause explicitly
5. **Verifies** — Tests hypothesis with evidence
6. **Fixes** — Minimal change with explanation
7. **Records learnings** — To shared learnings file

## Known PVRE Error Patterns

| Error | Likely Cause | Quick Check |
|-------|--------------|-------------|
| "Results Not Available" | `saveResearchResult()` not called | DB insert, JSON serialization |
| Credit deduction failed | RLS policy, balance check | `profiles` table RLS |
| Arctic Shift timeout | Using `query`/`body` params | Network tab, 422 response |
| Auth redirect loop | Session not persisting | Middleware, cookies |

## Debug Protocol

1. **Capture** — Get console errors, network errors
2. **Reproduce** — Document exact steps
3. **Locate** — grep/glob for error text
4. **Trace** — Follow code path step by step
5. **Hypothesize** — "Error occurs because X"
6. **Verify** — console.log, puppeteer_evaluate
7. **Fix** — Minimal change
8. **Verify Fix** — Confirm error gone

## Usage

```
/debug
```

Or ask Claude directly:
- "Debug this error: [message]"
- "Why is this broken?"
- "Fix this bug"
- Include error messages or stack traces

## Escalation

After 30 minutes without progress:
- Document what was tried
- List remaining hypotheses
- Ask for guidance

## Output

- Bug report with reproduction steps
- Investigation trail
- Root cause (not symptom)
- Evidence with file:line references
- Minimal fix with explanation
- Verification steps
- Prevention recommendation

## Related Agents

- `flow-tester` → For E2E testing after fix
- `code-hardener` → For security review of fix
