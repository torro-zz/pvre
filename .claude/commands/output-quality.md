---
description: Evaluate research output quality using LeanSpark methodology
---

# Output Quality Review

Use the `output-quality` agent to evaluate if PVRE research results help founders make good Go/No-Go decisions.

## What output-quality Does

1. **Checks pain signal relevance** — Core vs Related vs Irrelevant
2. **Evaluates all dimensions** — Relevance (35%), WTP (25%), Intensity (20%), Timing (10%), Gaps (10%)
3. **Assesses decision quality** — Would a founder be able to decide?
4. **Flags critical issues** — Zero WTP, low relevance, misleading data
5. **Records learnings** — To shared learnings file

## Quality Thresholds

| Score | Assessment | Meaning |
|-------|------------|---------|
| 8-10 | Decision-Ready | Founder can confidently decide Go/No-Go |
| 6-7.9 | Useful but Incomplete | Provides value, needs supplementary research |
| 4-5.9 | Misleading Risk | May lead founder to wrong conclusion |
| 0-3.9 | Harmful | Would hurt decision-making |

## The 64% Problem

Testing revealed 64% of detected pain signals were completely irrelevant to business hypotheses. This agent specifically checks for this issue.

## Relevance Targets

- >70% CORE+RELATED = Good
- 50-70% = Acceptable
- <50% = Quality failure

## Usage

Run after any research completes:
```
/output-quality
```

Or ask Claude directly:
- "Review the quality of this research output"
- "Would this help a founder decide?"
- "Run a LeanSpark evaluation"

## Output

- Dimension scores with breakdown
- Relevance deep dive (CORE/RELATED/IRRELEVANT counts)
- WTP assessment with warnings
- Decision quality verdict
- Specific recommendations

## Related Agents

- `ceo-review` → For visual product walkthrough
- `flow-tester` → For E2E testing with logs
