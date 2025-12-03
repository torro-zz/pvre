# PVRE - Claude Code Instructions

## Behavior Guidelines

### Code Changes
- Prefer minimal, targeted changes over comprehensive refactors
- Modify existing files before creating new ones
- No new abstractions, helper classes, or patterns unless explicitly requested
- When asked to "refactor" without specifics, ask for scope first

### Exploration First
- When fixing bugs, read the relevant module AND its dependencies first
- Understand data flow before proposing changes
- Don't guess at surrounding context - explore it with grep/search

### Tool Usage
- Use tools when genuinely needed, not preemptively
- For research tasks, refine queries based on previous results
- Complete each step before moving to next (avoid parallel speculation)

### Output Style
- After multi-step tasks, summarize what was done
- Prose for explanations, code blocks for code
- Concise but not terse

---

## Code Quality Standards

**Full guide:** `docs/TECHNICAL_OVERVIEW.md` → "Code Standards" section

### Database Operations
Use typed Supabase clients (`Database` type from `src/types/supabase.ts`).
Use `saveResearchResult()` from `src/lib/research/save-result.ts` for research data.
Serialize complex objects with `JSON.parse(JSON.stringify(data))` before DB saves.

*Why: Untyped operations caused silent failures in production. The shared utilities prevent copy-paste bugs and ensure consistent error handling.*

### Before Committing
Run `npm run build` - catches type errors that `npm run dev` misses.
Run `npm run test:run` - ensures 66+ tests pass.

*Why: Dev mode is permissive. Build mode catches issues before they reach users.*

### Type Safety
Regenerate Supabase types after schema changes:
```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts
```
Avoid `any` - use proper types or `unknown`.
Use `ModuleName` type for research module names.

*Why: Type mismatches between code and DB schema caused the "balance_after" bug that broke all research.*

### Payment Provider
This project uses **LemonSqueezy** (not Stripe). See `docs/KNOWN_ISSUES.md`.

---

## Critical Quality Metric: Relevance

**The 64% Problem:** Testing revealed 64% of detected pain signals were completely irrelevant to business hypotheses, with 0% directly relevant.

When working on Community Voice or pain detection:
- The relevance filter in `src/app/api/research/community-voice/route.ts` (lines 64-247) is critical
- Claude Haiku rates each post Y/N for relevance before analysis
- Changes to this code require extra scrutiny

When reviewing research output quality:
- Check: "Does this pain signal actually relate to the hypothesis?"
- Tally relevant vs irrelevant signals
- Target: >70% relevance rate

---

## Quick Start Testing

### Dev Authentication
```bash
# Authenticate as test user
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# Check auth status  
curl http://localhost:3000/api/dev/login -b /tmp/cookies.txt
```

Only works when `NODE_ENV !== 'production'`.

### Puppeteer Flow
```javascript
// 1. Login
await puppeteer_navigate({ url: 'http://localhost:3000' })
await puppeteer_evaluate({ script: `fetch('/api/dev/login', { method: 'POST' })` })

// 2. Dashboard - should show "Welcome back, Test User (Dev)!"
await puppeteer_navigate({ url: 'http://localhost:3000/dashboard' })

// 3. Research
await puppeteer_navigate({ url: 'http://localhost:3000/research' })
await puppeteer_fill({ selector: 'textarea', value: 'A tool to help freelancers manage invoicing' })
await puppeteer_click({ selector: 'button[type="submit"]' })
```

---

## Architecture Quick Reference

### Key Paths
```
src/app/api/research/community-voice/  → Main research endpoint + relevance filter
src/lib/research/save-result.ts        → Database save utility (use this!)
src/lib/analysis/                      → Pain detection, market sizing, timing
src/types/supabase.ts                  → Generated DB types (regenerate after schema changes)
```

### Database Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User data + `credits` balance |
| `research_jobs` | Research projects, status, `error_source` |
| `research_results` | Module outputs (JSON) |
| `credit_transactions` | Credit history with `balance_after` |

### Error Source Tracking
When research fails, `error_source` in `research_jobs` shows where:
- `anthropic` → Claude API (check key, rate limits)
- `arctic_shift` → Reddit data API (check if down)
- `database` → Supabase (check connection, RLS)

### Arctic Shift API
- **Rate limit:** ~2000 requests/minute (very generous)
- **DO NOT use `query` or `body` params** - multi-word searches cause 422 timeouts
- Fetch by subreddit + time range only; Claude relevance filter handles filtering
- See `src/lib/data-sources/arctic-shift.ts`

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/review` | Review against CLAUDE.md specs |
| `/test-flow` | E2E test via Puppeteer |
| `/ceo-review` | Full visual walkthrough with screenshots |
| `/improve` | Find and implement next priority |
| `/goodnight` | Save state to `docs/RESUME_HERE.md` |

---

## Sub-Agents

Specialized agents in `.claude/agents/`. Each has safety boundaries and product context.

| Agent | Purpose | Key Feature |
|-------|---------|-------------|
| `ceo-review` | Visual inspection | Screenshots every page, checks relevance |
| `code-quality` | Standards enforcement | Runs before commits |
| `debugger` | Root cause analysis | 30-min escalation trigger |
| `test-runner` | E2E automation | Smoke (0 credits) + Full (1 credit) |
| `improver` | Improvement planning | Waits for approval |

**Relevance checking:** `ceo-review`, `code-quality`, and `test-runner` all check for the 64% relevance issue.

---

## Implementation Status

**MVP: ~99% complete.** See `docs/TECHNICAL_OVERVIEW.md` for full status.

### Recent (Dec 1-2, 2025)
- Research resilience: browser warning, error tracking, auto-refund
- Code hardening: typed Supabase, shared utilities, 66 tests
- **Migration 007 required** - run in Supabase SQL Editor
- Fixed Arctic Shift 422 timeouts by removing query/body params

### Remaining (Low Priority)
- PVREError class with error codes
- Result polling for disconnected users
- Dark mode

---

## Environment Variables

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

**Optional:**
```
NEXT_PUBLIC_WHATSAPP_SUPPORT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Known Issues

- Old research jobs show "Results Not Available" (pre-persistence)
- Dev server must be on port 3000 before testing
- Migration 007 required for research to work