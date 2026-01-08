# Protected Code

These files are **LOCKED** — don't modify without explicit user approval:

- `src/lib/filter/universal-filter.ts`
- `src/lib/filter/LOCKED.md`

## Why?

The filter was calibrated with 75% hit rate. Changes break calibration.

## What To Do Instead

If you need to change filter behavior:
1. Ask the user first
2. Document the change rationale
3. Run full test suite before and after
4. Manually test both Hypothesis and App Gap modes
