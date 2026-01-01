# ⛔ LOCKED CODE - DO NOT MODIFY

**Last validated:** 2025-12-31
**Architecture:** Two-stage pipeline with cost cap
**Validated by:** Manual calibration + CEO approval

## Current Configuration

| Stage | Threshold/Cap | Purpose |
|-------|---------------|---------|
| Stage 1: Embeddings | 0.28 | Loose filter, catch candidates |
| Stage 2: Cap | 50 | Cost control |
| Stage 3: Haiku AI | YES/NO | Strict verification |

**Expected output:** ~25-35 verified signals from 50 candidates
**Cost per search:** ~$0.06 (embeddings + 50 Haiku calls)

## Files Protected
- `universal-filter.ts` - Core embedding filter
- `ai-verifier.ts` - Haiku verification
- `config.ts` - All thresholds and caps
- `types.ts` (in adapters/)

## Rules

1. **NO CHANGES** to these files without explicit CEO approval
2. Any change requires FULL regression test against gold nuggets
3. If you think you need to change the filter, STOP and ask first

## To Request Changes

1. Explain what's broken
2. Explain proposed fix
3. Wait for approval
4. Run full calibration test BEFORE and AFTER
5. Document results in this file

## Change History

| Date | Change | Reason | Test Results |
|------|--------|--------|--------------|
| 2025-12-31 | Initial lock | Filter validated at 75% hit rate | 6/8 gold nuggets |
| 2025-12-31 | Add Stage 2 AI verification | Improve relevance 50-70% → 80%+ | [TO BE TESTED] |

### Change Details: Two-Stage Pipeline (2025-12-31)

**Before:** Single-stage embedding filter at 0.34 threshold
- Output: ~144 signals
- Relevance: 50-70%
- No cost cap

**After:** Two-stage pipeline with cost cap
- Stage 1: Embeddings at 0.28 (loose) → ~150-300 candidates
- Stage 2: Rank + cap at 50 → cost control
- Stage 3: Haiku YES/NO → ~25-35 verified
- Expected relevance: 80%+
- Fixed cost: ~$0.06 per search

**Rationale:**
- Loose embedding threshold catches more candidates
- AI verification filters false positives
- 50-call cap guarantees fixed cost regardless of data volume
- Can scale to 10+ data sources without cost explosion

---

## Migration: Tiered Filter (in progress)

A new tiered filter pipeline is being developed in `tiered-filter.ts`:

| Feature | Legacy (current) | Tiered (future) |
|---------|-----------------|-----------------|
| Feature flag | `USE_TIERED_FILTER = false` | `USE_TIERED_FILTER = true` |
| AI calls | 50 Haiku calls (~$0.05) | 0 AI calls for filtering |
| Output | Binary pass/fail | Tiered: CORE/STRONG/RELATED/ADJACENT |
| Cost | ~$0.06/search | ~$0.01/search |

**Files affected when migration completes:**
- `ai-verifier.ts` → DELETE (marked @deprecated)
- `universal-filter.ts` → Keep (still used for scoring)
- `tiered-filter.ts` → Primary pipeline

**Do not delete ai-verifier.ts until USE_TIERED_FILTER is enabled by default.**

---

**If you're reading this, DO NOT MODIFY the filter without following the process above.**
