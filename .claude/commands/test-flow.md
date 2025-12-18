---
description: Run detailed E2E test using flow-tester agent
---

# E2E Test Flow

Use the `flow-tester` agent for detailed end-to-end testing with full logging.

## What flow-tester Does

1. **Documents everything** — Every input, output, screenshot logged
2. **Traces API calls** — All requests/responses captured
3. **Captures timing** — How long each operation takes
4. **Checks console** — Errors logged at every step

## Test Scenarios

| Scenario | Credits | Purpose |
|----------|---------|---------|
| Happy Path | 1 | Full research flow |
| Edge Cases | 0 | Validation, limits |
| Error States | 0 | Failure handling |

## Standard Test Hypothesis

```
A tool to help freelancers manage their invoicing and client payments
```

## Output

The flow-tester produces a detailed report where a human can understand exactly what happened at each step, including:
- Exact inputs entered
- Visual state before/after
- API calls made
- Console activity
- Timing for each operation

## After Testing

- Review report for unexpected behavior
- Record learnings to `docs/agent-learnings.md`
- Fix any issues found

## Related Agents

- `ceo-review` → Visual product walkthrough
- `output-quality` → Research result quality check
- `debugger` → If errors need investigation
