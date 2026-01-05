# PVRE - Claude Code Instructions

**Read at every session start. These rules are MANDATORY.**

*Last updated: January 5, 2026*

---

## Dual-Mode Architecture

PVRE has TWO modes. Know which you're working in:

| Mode | Trigger | Data Sources | Key Filter |
|------|---------|--------------|------------|
| **Hypothesis** | User types problem | Reddit + App Stores | Embedding filter |
| **App Gap** | User selects app | App Store reviews | App Name Gate |

**If changing shared code, test BOTH modes.**

---

## Before Any Code Change

1. **Check `docs/KNOWN_ISSUES.md`** — Is it already fixed?
2. **Read the relevant file** — Don't guess what code does
3. **Test both modes** if touching shared code

---

## Before Modifying Filters/Adapters

The module map in `docs/SYSTEM_DOCUMENTATION.md` Section 18 shows:
- Which mode each module serves (Hypothesis / App Gap / Both)
- What depends on what
- Which filter gates which data source

**Read Section 18 before touching:** `pain-detector`, `relevance-filter`,
`app-store-adapter`, `arctic-shift`, `community-voice` route.

---

## Pre-Commit Checklist

```bash
npm run build        # Must pass
npm run test:run     # 163+ tests must pass
```

**Manual tests:**
- Hypothesis mode: Search "Remote workers async communication" → relevant signals?
- App Gap mode: Search Loom URL → all reviews about Loom?

---

## Never Do These

1. **Never bypass filters** — App Name Gate exists for a reason
2. **Never add parallel code paths** — One way to add signals
3. **Never close without testing** — Both modes, build, tests

---

## Code Standards

```typescript
// Use typed Supabase clients
import { Database } from '@/types/supabase'

// Use shared save utility
import { saveResearchResult } from '@/lib/research/save-result'

// Serialize before DB saves
const clean = JSON.parse(JSON.stringify(data))
```

**Before commit:** `npm run build` catches what dev mode misses.

---

## Protected Code

These files are LOCKED — don't modify without approval:
- `src/lib/filter/universal-filter.ts`
- `src/lib/filter/LOCKED.md`

The filter was calibrated with 75% hit rate. Changes break calibration.

---

## Key Files

| Purpose | File |
|---------|------|
| Pain Detection | `src/lib/analysis/pain-detector.ts` |
| Theme Extraction | `src/lib/analysis/theme-extractor.ts` |
| Main API Route | `src/app/api/research/community-voice/route.ts` |
| Relevance Filter | `src/lib/research/relevance-filter.ts` |
| App Store Adapter | `src/lib/data-sources/adapters/app-store-adapter.ts` |

**Full file list:** `docs/REFERENCE.md`

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

---

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

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/goodnight` | Save session state to `docs/RESUME_HERE.md` |

---

## Quality Metric: Relevance

**The 64% Problem:** Most pain signals were irrelevant to hypotheses.

When working on pain detection:
- Does the signal relate to the hypothesis?
- Is it a firsthand experience?
- Target: >70% relevance rate

---

## References

- **Full architecture:** `docs/SYSTEM_DOCUMENTATION.md`
- **Known bugs:** `docs/KNOWN_ISSUES.md`
- **File locations & recipes:** `docs/REFERENCE.md`
- **Quick architecture overview:** `docs/ARCHITECTURE_SUMMARY.md`

---

## Behavior

- Prefer minimal changes over refactors
- Modify existing files before creating new ones
- Read code before modifying it
- Concise output, no over-engineering
