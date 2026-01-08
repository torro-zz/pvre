# Refactoring Continuation Plan

**Created:** January 8, 2026
**Status:** Approved by Codex review

---

## Context

- Route reduced from 1,700 → 1,376 lines (19% reduction achieved)
- 8 of 11 pipeline steps integrated (through Phase 4i)
- Build passing, 163 tests passing
- Dual-mode architecture must be preserved (Hypothesis + App Gap)

---

## Phase A: Stabilization Sprint (Immediate)

| Step | Action | Guard |
|------|--------|-------|
| A1 | Investigate 2 critical bugs | Do NOT touch `universal-filter.ts` |
| A2 | Fix bugs with minimal changes | Target: UI/display logic only |
| A3 | Add 2 targeted unit tests | Prevent regression |
| A4 | E2E test both modes | Hypothesis + App Gap |

### Critical Bugs to Fix

1. **Verdict messages contradict** — Yellow box says "proceed with caution" while verdict says "pivot"
2. **"Hypothesis Confidence" wrong for App Gap** — Should show "Signal Quality" instead

### New Tests to Add

```typescript
// Test 1: Verdict/banner alignment per mode
// Test 2: Mode label toggling ("Hypothesis Confidence" vs "Signal Quality")
```

---

## Phase B: Declare Victory (Short-term)

| Step | Action |
|------|--------|
| B1 | Document route as "good enough" at 1,376 lines |
| B2 | Add guardrails to prevent drift |
| B3 | Mark remaining extractions as optional |

### Guardrails

- **Line cap:** If route exceeds 1,500 lines → trigger Phase C
- **Do-not-touch list:** `universal-filter.ts` + adjacent call sites
- **Characterization tests:** For Job Status Manager & Adaptive Fetcher outputs

### Remaining Inline Code (Stable, Do Not Extract Unless Needed)

- Job Status Manager
- Adaptive Fetcher
- Filter Orchestrator (touches LOCKED code)

---

## Phase C: Future Consideration (Only if triggered)

### Triggers

- Route grows past 1,500 lines
- Repeated incidents in inline modules
- Significant feature addition requiring orchestration

### Rollback Playbook (if Phase 5 needed later)

1. Extract Result Compiler first (lowest coupling)
2. Then Job Status Manager
3. Adaptive Fetcher last (most mode-sensitive)
4. Full Orchestrator only after all extractions stable

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `universal-filter.ts` accidental changes | Explicit do-not-touch list |
| Mode-specific UI contract drift | Add parity tests for both modes |
| "Optional" becomes "never" | Define hard triggers for Phase C |
| Future contributors break stable inline code | Characterization tests + docs |

---

## Decision Rationale

- **80/20 rule:** We've gotten 80% of refactoring value; remaining 20% carries 80% of risk
- **Filter Orchestrator touches LOCKED code** — extraction would be dangerous
- **User value (bug fixes) > architectural purity**
- **Stability > completeness**

---

## Skip List

The following are explicitly **skipped** unless triggered:

- Phase 5: Full Orchestrator (over-engineering for current needs)
- Phase 6: Big-bang cleanup (will happen incrementally)

---

## References

- Original plan: `docs/REFACTORING_PLAN.md`
- Known issues: `docs/KNOWN_ISSUES.md`
- Main route: `src/app/api/research/community-voice/route.ts`
