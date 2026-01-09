# Resume Point — January 9, 2026

**Last Session:** January 9, 2026 (Morning)

---

## What Was Just Completed

### 1. Relevance Filter Fixes (Codex Review)
Fixed 5 issues in `relevance-filter.ts`:
- Word-boundary matching for pain/curiosity detection (prevents `pain` → `painting` false positives)
- Domain gate defaults missing AI responses to 'Y' (pass)
- Problem match defaults missing responses to 'R' (related)
- Non-English threshold tuned to 50% + min 10 chars
- Removed dead code (unused `antiDomains`, `lenientMode` params)

**Commit:** `349caa7 fix: Improve relevance filter accuracy with 5 targeted fixes`

### 2. Self-Competitor Bug Fix + Result Page Improvements
- App no longer appears as its own competitor (filtered in 4 places)
- Result page title prefers app name over URL for app analyses
- Processing time falls back to competitor metadata
- Data sources use actual sources, not hard-coded 'reddit'
- Reddit signal count clamped to prevent negative values

**Commit:** `9384957 fix: Prevent self-competitor bug and improve result page display`

### 3. Dynamic Signal Caps by Search Depth
Signal caps now scale with search depth:
| Depth | Sample Size | Signal Cap |
|-------|-------------|------------|
| Quick | 150 | 50 |
| Standard | 300 | 100 |
| Deep | 450 | 200 |

Added centralized config in `src/lib/filter/config.ts`.

**Commit:** `3256d10 feat: Dynamic signal caps based on search depth`

### 4. Credit System Planning
Added comprehensive planning entry to `docs/KNOWN_ISSUES.md` for designing fair credit/fuel system across all search types.

---

## Build & Test Status

| Check | Status |
|-------|--------|
| **Build** | Passing |
| **Tests** | 167 passing, 6 skipped |
| **Git** | Clean (all committed & pushed) |

---

## TODO for Next Session

### 1. Test Today's Fixes (HIGH PRIORITY)
Manual testing needed:
- [ ] Self-competitor fix — Notion shouldn't appear as competitor of itself
- [ ] Dynamic signal caps — Deep search should show up to 200 signals
- [ ] Result page title — should show app name, not URL

### 2. AI Discussion Trends Data Quality (USER REQUEST)
Check if AI Discussion Trends have enough data to give good results:
- Are the AI subreddits returning enough posts?
- Is the 30d/90d comparison meaningful?
- Does the trend detection work for various hypotheses?

### 3. Review AI Discussion Trends with Codex (STILL PENDING)
From `docs/KNOWN_ISSUES.md` — 4 fixes were applied but need verification:
| Fix | File | Lines |
|-----|------|-------|
| `finalTrend` matches `trendSource` | `timing-analyzer.ts` | 229-237 |
| Rate-limit key format | `rate-limit/index.ts` | 188-206 |
| Strategy B AI terms filter | `ai-discussion-trends.ts` | 206-212 |
| UI backward compatibility | `market-tab.tsx` | 982-990 |

### 4. Credit/Fuel System Design (PLANNING)
Start designing the credit system — see `docs/KNOWN_ISSUES.md` for full requirements.

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Signal cap config | `src/lib/filter/config.ts` |
| AI Discussion Trends | `src/lib/data-sources/ai-discussion-trends.ts` |
| Relevance filter | `src/lib/research/relevance-filter.ts` |
| Competitor detector | `src/lib/research/steps/competitor-detector.ts` |
| Known issues & planning | `docs/KNOWN_ISSUES.md` |

---

## Quick Start Commands

```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev
npm run test:run
npm run build
```

---

## User Notes

- Check AI Discussion Trends data quality — ensure enough data for good results
- Credit system needs to be fair for users while protecting margin (marketing, servers, APIs)
- All today's commits reviewed by Codex CLI
