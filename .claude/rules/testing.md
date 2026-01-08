# Testing Requirements

## Pre-Commit Checklist

```bash
npm run build        # Must pass
npm run test:run     # 167+ tests must pass
```

## Manual Tests

Always test both modes before committing:

- **Hypothesis mode:** Search "Remote workers async communication" → relevant signals?
- **App Gap mode:** Search Loom URL → all reviews about Loom?

## Quick Testing

```bash
# Dev login
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# Run research via curl
curl -X POST http://localhost:3000/api/research/community-voice \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"hypothesis":"test hypothesis"}'
```

## Quality Metric: Relevance

**The 64% Problem:** Most pain signals were irrelevant to hypotheses.

When working on pain detection:
- Does the signal relate to the hypothesis?
- Is it a firsthand experience?
- Target: >70% relevance rate
