---
description: Run CEO-level product walkthrough using ceo-review agent
---

# CEO Product Review

Use the `ceo-review` agent for a demanding product walkthrough.

## What ceo-review Does

1. **Screenshots every page** — Visual documentation
2. **Checks console errors** — After every navigation
3. **Tests full research flow** — Uses 1 credit
4. **Grades honestly** — A-F with justification
5. **Records learnings** — To shared learnings file

## Grading Rubric

| Grade | Meaning |
|-------|---------|
| A | Ship it. Minor polish only. |
| B | Good foundation. Fix critical issues. |
| C | Functional but needs work. 1-2 weeks. |
| D | Significant problems. Major rework. |
| F | Broken. Do not show to users. |

## Test Hypothesis

```
A tool to help freelancers manage their invoicing and client payments
```

## Pages Checked

1. Landing page (hero, CTA, pricing)
2. Dashboard (welcome, credits, history)
3. Research form (input, submit)
4. Research progress (feedback, timing)
5. Results (all tabs, data quality)
6. Account & Admin

## Output

Report saved to: `docs/archive/ceo-review-[DATE].md`

Includes:
- 30-second board summary
- Grade with justification
- Critical issues (fix this week)
- UX issues (fix this month)
- Console/network errors
- Data quality assessment
- "Would I pay £14?" verdict

## After Review

- Fix critical issues first
- Record learnings to `docs/agent-learnings.md`
- Update status if needed

## Related Agents

- `output-quality` → For detailed LeanSpark evaluation
- `flow-tester` → For comprehensive E2E logging
- `ui-specialist` → For accessibility/responsiveness
