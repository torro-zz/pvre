# Dual-Mode Architecture

PVRE has TWO modes. Know which you're working in:

| Mode | Trigger | Data Sources | Key Filter |
|------|---------|--------------|------------|
| **Hypothesis** | User types problem | Reddit + App Stores | Embedding filter |
| **App Gap** | User selects app | App Store reviews | App Name Gate |

**If changing shared code, test BOTH modes.**

## Before Modifying Filters/Adapters

1. **Quick check:** `docs/ARCHITECTURE_SUMMARY.md` → "Module Map by Mode"
2. **Deep dive:** `docs/SYSTEM_DOCUMENTATION.md` Section 18

The module map shows:
- Which mode each module serves (Hypothesis / App Gap / Both)
- What depends on what
- Which filter gates which data source

**Check the map before touching:** `pain-detector`, `relevance-filter`,
`app-store-adapter`, `arctic-shift`, `community-voice` route.

## Key Files by Mode

| Purpose | File |
|---------|------|
| Pain Detection | `src/lib/analysis/pain-detector.ts` |
| Theme Extraction | `src/lib/analysis/theme-extractor.ts` |
| Main API Route | `src/app/api/research/community-voice/route.ts` |
| Relevance Filter | `src/lib/research/relevance-filter.ts` |
| App Store Adapter | `src/lib/data-sources/adapters/app-store-adapter.ts` |
