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

**Root Causes (Dec 2025 Analysis):**
1. **Quote selection by pain intensity, not relevance** - High-pain quotes may be unrelated to hypothesis
2. **No first-person language filtering** - Generic observations mixed with real experiences
3. **Reddit-only WTP signals** - People don't say "I'd pay $X" on Reddit

**Full Brief:** `docs/data-quality/DATA_QUALITY_BRIEF.md` contains comprehensive analysis and solutions

When working on Community Voice or pain detection:
- The relevance filter in `src/app/api/research/community-voice/route.ts` (lines 64-247) is critical
- Quote selection in `src/lib/analysis/theme-extractor.ts` (lines 517-524) needs relevance weighting
- Consider first-person language as a signal boost
- App reviews are better for WTP than Reddit

When reviewing research output quality:
- Check: "Does this pain signal actually relate to the hypothesis?"
- Check: "Is this a firsthand experience or generic observation?"
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

## Agent System

Specialized agents in `.claude/agents/` with **shared learning** capability.

### Agent Roster

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `output-quality` | LeanSpark evaluation: "Does this help founders decide?" | After research, before releases |
| `flow-tester` | Detailed E2E testing with full input/output logging | Testing features, debugging flows |
| `code-hardener` | Security, types, refactoring, performance | Before commits, audits |
| `ui-specialist` | Visual polish, accessibility, responsiveness | UI changes, design reviews |
| `ceo-review` | CEO-level visual product walkthrough | Before releases, product checks |
| `debugger` | Root cause analysis for bugs | Error messages, "why is this broken" |
| `learner` | Meta-agent: synthesizes patterns, improves other agents | Periodically, after incidents |

### Self-Learning System

All agents share knowledge through `docs/agent-learnings.md`:

1. **Every agent reads it first** — Before starting work, agents check for relevant learnings
2. **Agents write discoveries** — When something important is found, it's added to the file
3. **Learner synthesizes** — Periodically identifies patterns and proposes agent updates

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ output-     │   │ flow-       │   │ code-       │
│ quality     │   │ tester      │   │ hardener    │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └────── WRITE ────┼────── WRITE ────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  docs/agent-learnings.md │
            │                        │
            │  [All agents READ this │
            │   before starting]     │
            └────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │      learner agent     │
            │  (synthesizes patterns │
            │   & updates agents)    │
            └────────────────────────┘
```

### Deploying Agents

CC should proactively use agents when:
- **output-quality** → After any research completes, to verify quality
- **flow-tester** → When testing new features or debugging
- **code-hardener** → Before commits, especially for API/security changes
- **ui-specialist** → After UI changes, before releases
- **ceo-review** → Before any release, for final product check
- **debugger** → When encountering errors or unexpected behavior
- **learner** → Weekly, or after incidents

### Agent Quality Focus

All agents check for the **64% relevance issue** — the critical quality metric where pain signals must actually relate to the business hypothesis.

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