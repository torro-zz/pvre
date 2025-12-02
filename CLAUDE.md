# PVRE - Claude Code Instructions

## Code Quality Standards (Always Follow)

**Read `docs/CODE_HARDENING_GUIDE.md` for the full guide.**

### Database Operations
- ALWAYS use typed Supabase clients (`Database` type from `src/types/supabase.ts`)
- ALWAYS use `saveResearchResult()` from `src/lib/research/save-result.ts` for research data
- ALWAYS serialize complex objects with `JSON.parse(JSON.stringify(data))` before DB saves
- NEVER copy-paste database operations - create shared utilities instead

### Before Committing
- RUN `npm run build` - catches type errors that `npm run dev` misses
- RUN `npm run test:run` - ensures 66+ tests pass
- CHECK for TypeScript errors, not just runtime behavior

### Type Safety Rules
- REGENERATE Supabase types after any schema change: `npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts`
- AVOID `any` type - define proper types or use `unknown`
- USE the `ModuleName` type for research module names (prevents typos)

### Payment Provider
- This project uses **LemonSqueezy** for payments (NOT Stripe)
- See `docs/KNOWN_ISSUES.md` for current billing status

---

## Quick Start Testing

### Dev Authentication
The app uses Google OAuth, but for autonomous testing there's a dev-only bypass:

```bash
# Authenticate as test user
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# Check auth status
curl http://localhost:3000/api/dev/login -b /tmp/cookies.txt
```

- **Endpoint:** `POST /api/dev/login`
- **Test user:** `test-user@pvre-dev.local`
- **Only works in development mode** (NODE_ENV !== 'production')

### Puppeteer Testing Flow
```javascript
// 1. Navigate and login
await puppeteer_navigate({ url: 'http://localhost:3000' })
await puppeteer_evaluate({ script: `fetch('/api/dev/login', { method: 'POST' })` })

// 2. Go to dashboard - should show "Welcome back, Test User (Dev)!"
await puppeteer_navigate({ url: 'http://localhost:3000/dashboard' })

// 3. Run research
await puppeteer_navigate({ url: 'http://localhost:3000/research' })
await puppeteer_fill({ selector: 'textarea', value: 'Test hypothesis about user pain points' })
await puppeteer_click({ selector: 'button[type="submit"]' })

// 4. Wait for results and verify
// Results should display and be saved to database
```

### Manual Testing Steps
1. POST to `/api/dev/login` to authenticate as test user
2. Navigate to `/dashboard` - should show "Welcome back, Test User (Dev)!"
3. Go to `/research` and enter a hypothesis
4. Results should display and be saved to database
5. Check `/dashboard` - new research should appear in history

---

## Implementation Status

*Last updated: 2025-12-02 (Code hardening complete)*

| Module | Status | Completion | Notes |
|--------|--------|------------|-------|
| Community Voice Mining | DONE | 100% | Full Reddit analysis via Arctic Shift + Claude |
| Competitor Intelligence | DONE | 100% | Full competitive landscape analysis via Claude |
| Market Sizing | DONE | 100% | TAM/SAM/SOM Fermi estimation via Claude |
| Timing Analysis | DONE | 100% | Tailwinds/headwinds analysis via Claude |
| Interview Prep Generator | DONE | 100% | 3 sections (Context, Problem, Solution) embedded in Community Voice |
| Viability Verdict | DONE | 100% | 4-dimension scoring: Pain (35%) + Market (25%) + Competition (25%) + Timing (15%) |
| Transparency UI | DONE | 100% | Dimension breakdown with weights, progress bars, status labels |
| PDF Export | DONE | 100% | Full research report export via jspdf |
| Test Suite | DONE | 100% | Vitest with 66 tests (including integration tests) |
| Landing Page | DONE | 100% | Tech-forward design with bento grid features section |
| Post Relevance Filter | DONE | 100% | Claude Haiku filters irrelevant posts before analysis |
| Refund Monitoring | DONE | 100% | Admin alerts on 3rd+ refund (auto-approve continues) |
| Competitor Prompt | DONE | 100% | Modal prompts user to run competitor analysis after Community Voice |
| WhatsApp Support | DONE | 100% | Support links in footer, account, and report problem |
| Error Handling | PARTIAL | 70% | Error source tracking + auto-refund; PVREError class not implemented |
| Research Resilience | DONE | 100% | Browser warning, error tracking, auto-refund for failures |
| Code Hardening | DONE | 100% | Supabase types, shared utilities, integration tests |

### Overall MVP Completion: ~99%

---

## Recent Changes (Dec 1, 2025)

### Research Resilience & Error Tracking (New)
- **Migration 007**: Fixes `balance_after` column + adds `error_source`, `refunded_at` to research_jobs
- **Browser Warning**: `beforeunload` listener prevents accidental tab close during research
- **Visual Warning Banner**: Amber alert "Please keep this tab open" during research
- **Error Source Tracking**: Tracks `anthropic`, `arctic_shift`, `database` failures
- **Auto-Refund Endpoint**: `/api/admin/cleanup-stale-jobs` - auto-refunds confirmed failures

### Files Added/Modified
- `supabase/migrations/007_fix_credit_transactions.sql` (new)
- `src/app/(dashboard)/research/page.tsx` - browser warnings
- `src/app/api/research/community-voice/route.ts` - error tracking
- `src/app/api/admin/cleanup-stale-jobs/route.ts` (new)
- `src/lib/notifications/admin-alerts.ts` - new alert types

### Apply Migration Required
**Run this in Supabase SQL Editor:**
```sql
-- Copy contents of supabase/migrations/007_fix_credit_transactions.sql
```

---

## Feature Checklist

### Completed Items ✅

1. ~~**Market Sizing Module**~~ **DONE**
   - `src/lib/analysis/market-sizing.ts`
   - TAM/SAM/SOM Fermi estimation via Claude
   - MSC analysis with penetration required calculation

2. ~~**Timing Analysis Module**~~ **DONE**
   - `src/lib/analysis/timing-analyzer.ts`
   - Tailwinds/headwinds identification
   - Trend direction and timing window

3. ~~**4-Dimension Viability Score**~~ **DONE**
   - Pain (35%) + Market (25%) + Competition (25%) + Timing (15%)
   - Dynamic weight normalization
   - Dealbreaker detection (<3.0 threshold)

4. ~~**Transparency UI**~~ **DONE**
   - Dimension breakdown with progress bars
   - Weight percentages shown
   - Status labels (Strong/Adequate/Needs Work/Critical)

5. ~~**PDF Export**~~ **DONE**
   - Full report with all research sections
   - `src/lib/pdf/report-generator.ts`

6. ~~**Test Suite**~~ **DONE**
   - Vitest with 64 tests
   - Run with: `npm run test` or `npm run test:run`

7. ~~**Research Resilience**~~ **DONE** (New)
   - Browser warning on tab close
   - Error source tracking
   - Auto-refund for confirmed failures

### Remaining Items

1. **Structured Error Handling** - Partial
   - Error source tracking done ✅
   - Missing: PVREError class, error codes, withRetry wrapper
   - Priority: LOW (non-blocking for MVP)

2. **Result Polling for Disconnected Users** - Not implemented
   - Users who return should see results if server completed
   - Priority: MEDIUM

3. **API Health Dashboard** - Not implemented
   - Admin view of which APIs are failing
   - Priority: LOW

4. **Dark Mode** - Not implemented
   - Priority: LOW

---

## Remaining Optional Enhancements

### Low Priority
1. **Structured Error Handling** - Add PVREError class with error codes
2. **Dark Mode** - Theme toggle
3. **Analytics Instrumentation** - Track user behavior events

---

## Phase 3 Features (Polish & Quality)

### Post Relevance Filtering
- **Location:** `src/app/api/research/community-voice/route.ts` (lines 64-247)
- **How it works:** Claude Haiku rates each post/comment Y/N for relevance
- **Threshold:** Only Y items kept for analysis
- **Batching:** Posts in groups of 20, comments in groups of 25 for API efficiency
- **Fallback:** On API error, all items from failed batch are kept

### Report Problem Flow
- **Location:** `src/components/research/report-problem.tsx`
- **Details required:** Minimum 20 characters to submit
- **Auto-refund:** Credit is refunded automatically on submit

### Refund Abuse Monitoring
- **Location:** `src/app/api/feedback/report-problem/route.ts`
- **Behavior:** On 3rd+ refund, admin is alerted (but refund still auto-approves)
- **Admin alerts:** Logged to `admin_alerts` table + console
- **Helper:** `src/lib/notifications/admin-alerts.ts`

### Research Resilience (New)
- **Browser Warning:** `beforeunload` listener in `src/app/(dashboard)/research/page.tsx`
- **Visual Banner:** Amber alert shown during loading state
- **Error Tracking:** `error_source` column tracks `anthropic`, `arctic_shift`, `database`
- **Auto-Refund:** `refund_credit` RPC function + cleanup endpoint
- **Admin Alerts:** New types: `auto_refund`, `stuck_jobs`, `api_health`

### Competitor Analysis Prompt
- **Modal:** `src/components/research/competitor-prompt-modal.tsx`
- **Trigger:** Shows after Community Voice completes if no competitor analysis exists
- **Storage:** Dismissal saved to localStorage per job ID
- **Banner:** Persistent banner in Verdict tab when competitors missing

### WhatsApp Support
- **Env var:** `NEXT_PUBLIC_WHATSAPP_SUPPORT_URL` (wa.me/YOUR_NUMBER)
- **Locations:**
  - Landing page footer
  - Account settings page
  - Report problem form ("Need more help?")

---

## Architecture Overview

### File Structure
```
src/
├── app/
│   ├── page.tsx             # Landing page (tech-forward design)
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── dashboard/       # User dashboard with research history
│   │   ├── admin/           # Admin pages
│   │   │   ├── debug/       # Debug info page
│   │   │   └── page.tsx     # Admin analytics dashboard
│   │   ├── account/         # User account settings
│   │   └── research/        # Research input + results pages
│   │       ├── [id]/        # Individual research detail view
│   │       └── competitors/ # Competitor intelligence page
│   ├── api/
│   │   ├── dev/login/       # Dev-only auth bypass
│   │   ├── admin/
│   │   │   ├── debug/       # Debug endpoint
│   │   │   ├── analytics/   # Analytics data
│   │   │   ├── credits/     # Credit management
│   │   │   └── cleanup-stale-jobs/  # Auto-refund endpoint (NEW)
│   │   ├── billing/         # Stripe checkout + webhooks
│   │   ├── feedback/        # Report problem endpoint
│   │   └── research/
│   │       ├── community-voice/         # Main research endpoint
│   │       ├── community-voice/stream/  # SSE streaming endpoint
│   │       ├── competitor-intelligence/ # Competitor analysis
│   │       ├── competitor-suggestions/  # AI-powered suggestions
│   │       ├── coverage-check/          # Data availability check
│   │       ├── market-sizing/           # Standalone market sizing
│   │       ├── timing/                  # Standalone timing analysis
│   │       ├── results/                 # Fetch saved results
│   │       └── jobs/                    # Job management CRUD
│   └── auth/                # Auth callbacks
├── components/
│   ├── layout/
│   │   └── header.tsx       # Navigation + auth status
│   └── research/
│       ├── community-voice-results.tsx
│       ├── competitor-results.tsx
│       ├── competitor-prompt-modal.tsx
│       ├── coverage-preview.tsx
│       ├── hypothesis-form.tsx
│       ├── pain-score-card.tsx
│       ├── pain-score-display.tsx
│       ├── pdf-download-button.tsx
│       ├── report-problem.tsx
│       ├── research-progress.tsx
│       ├── step-progress.tsx
│       └── viability-verdict.tsx
├── lib/
│   ├── supabase/
│   │   ├── admin.ts         # Service role client (bypasses RLS)
│   │   ├── server.ts        # Server-side client
│   │   └── client.ts        # Browser client
│   ├── arctic-shift/        # Reddit API client
│   ├── data-sources/        # Unified data fetching layer
│   ├── credits/             # Credit system
│   ├── notifications/       # Admin alerts
│   ├── pdf/
│   │   └── report-generator.ts
│   ├── reddit/
│   │   ├── subreddit-discovery.ts
│   │   └── keyword-extractor.ts
│   └── analysis/
│       ├── pain-detector.ts
│       ├── theme-extractor.ts
│       ├── market-sizing.ts
│       ├── timing-analyzer.ts
│       ├── viability-calculator.ts
│       ├── subreddit-weights.ts
│       └── token-tracker.ts
├── __tests__/               # Vitest test files
└── types/                   # TypeScript definitions
```

### Database Tables
- `profiles` - User data (synced from auth.users) + `credits` balance
- `research_jobs` - Research projects with status, `error_source`, `refunded_at`
- `research_results` - Module outputs (JSON data)
- `reddit_cache` - Arctic Shift response cache
- `credit_transactions` - Credit purchase/usage history with `balance_after`
- `admin_alerts` - Admin notification queue
- `feedback_reports` - User feedback + refund tracking

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/community-voice` | POST | Run community voice research |
| `/api/research/community-voice/stream` | POST | SSE streaming version |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis |
| `/api/research/competitor-suggestions` | POST | Get AI-suggested competitors |
| `/api/research/coverage-check` | POST | Check data availability (free) |
| `/api/research/market-sizing` | POST | Standalone market sizing |
| `/api/research/timing` | POST | Standalone timing analysis |
| `/api/research/results` | GET | Fetch saved results |
| `/api/research/jobs` | POST/GET/PATCH | Job management CRUD |
| `/api/admin/cleanup-stale-jobs` | GET/POST | Stale job stats + auto-refund |
| `/api/admin/analytics` | GET | Admin analytics data |
| `/api/admin/credits` | POST | Manual credit adjustment |
| `/api/billing/checkout` | POST | Stripe checkout session |
| `/api/feedback/report-problem` | POST | Report problem + auto-refund |
| `/api/dev/login` | POST/GET | Dev auth (dev only) |

---

## Known Issues

- Old research jobs (created before persistence was implemented) show "Results Not Available" even if completed
- Must ensure dev server is running on port 3000 before testing
- **Migration 007 must be applied** for research to work (fixes `balance_after` column)

---

## Development Tips

### Starting Fresh
```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev
```

### Running Tests
```bash
npm run test      # Watch mode
npm run test:run  # Single run
```

### Database Migrations
Migrations are in `supabase/migrations/`. Apply via Supabase dashboard SQL Editor.

**Current migrations:**
- 001_initial_schema.sql
- 002_research_tables.sql
- 003_account_system.sql
- 004_phase2_updates.sql
- 005_feedback_refund.sql
- 006_step_based_research.sql
- **007_fix_credit_transactions.sql** (NEW - must apply!)

### Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
- `ANTHROPIC_API_KEY`

Optional:
- `NEXT_PUBLIC_WHATSAPP_SUPPORT_URL` - WhatsApp Business link (wa.me/YOUR_NUMBER)
- `STRIPE_SECRET_KEY` - For payments
- `STRIPE_WEBHOOK_SECRET` - For webhook verification

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/review` | Review codebase against CLAUDE.md specifications |
| `/test-flow` | End-to-end test via Puppeteer with console error checking |
| `/improve` | Identify and implement the next priority improvement |
| `/ceo-review` | CEO walkthrough with "user eyes" - screenshots, console errors, full report |
| `/update-overview` | Update `docs/TECHNICAL_OVERVIEW.md` with current state |
| `/goodnight` | Save session state to `docs/RESUME_HERE.md` before ending work |

---

## Sub-Agents

Specialized autonomous agents in `.claude/agents/` with safety boundaries, product knowledge, and quality standards.

### Agent Summary

| Agent | Model | Purpose | Safety | Relevance Check |
|-------|-------|---------|--------|-----------------|
| `ceo-review` | Sonnet | Visual product inspection | localhost only | **Yes** (64% issue) |
| `code-quality` | Haiku | Code standards enforcement | no destructive ops | **Yes** (64% issue) |
| `debugger` | Sonnet | Root cause analysis | read-only + escalation | No |
| `test-runner` | Haiku | E2E testing with Puppeteer | localhost only | **Yes** (64% issue) |
| `improver` | Haiku | Find/prioritize improvements | approval required | No |

### Key Features (All Agents)

Every agent now includes:
1. **Safety Boundaries** - Allowed/Never lists, environment verification
2. **Product Knowledge** - Role-specific PVRE context
3. **"What Good Looks Like"** - Quality benchmarks with examples
4. **Grading Rubric** - A-F with clear definitions
5. **Quality Bar** - Completion checklist

### The 64% Relevance Issue

**Critical quality metric tracked by 3 agents:**
- Historical problem: 64% of pain signals were completely irrelevant to hypotheses
- Agents now explicitly check: "Does this pain signal relate to the hypothesis?"
- Required: Tally relevant/irrelevant and calculate percentage

### Agent Details

**ceo-review** - Visual Inspection Specialist
- Environment verification REQUIRED before any testing
- Takes screenshots with `mcp__browser-tools__takeScreenshot`
- Checks console errors after EVERY navigation
- Runs full research flow (uses 1 credit)
- **MUST review 5+ pain signals for relevance**
- Grades product A-F with justification
- Saves report to `docs/ceo-review-report-[DATE].md`

**code-quality** - Code Guardian (PROACTIVE)
- Branch verification before commit review
- Enforces: typed Supabase, saveResearchResult(), no `any`
- **Watches for relevance filtering changes in Community Voice code**
- Grading: A (ship) → F (critical security issue)
- Recommendation: SAFE TO COMMIT / FIX FIRST / BLOCK

**debugger** - Root Cause Analyst
- 30-minute escalation trigger
- Knows PVRE error patterns (Results Not Available, Credit issues, etc.)
- Systematic: Reproduce → Isolate → Hypothesis → Verify → Fix
- Proposes minimal fixes with verification steps
- Documents prevention strategies

**test-runner** - E2E Test Automation
- Environment verification REQUIRED (localhost only)
- Smoke tests (2 min, 0 credits): Page loads, auth, navigation
- Full tests (5 min, 1 credit): Complete research flow
- **MUST check 5+ pain signals for relevance in full flow**
- Console/network error detection after every navigation

**improver** - Improvement Planner
- Reads KNOWN_ISSUES.md, CLAUDE.md, scans TODOs
- Priority framework: P0 (critical) → P3 (backlog)
- **Always waits for user approval before implementing**
- Grading: A (do now) → F (don't do - over-engineering)

### Proactive Agent Usage

Claude will automatically invoke:
- **code-quality** before suggesting commits
- **debugger** when errors are encountered
- **test-runner** for verification after changes

### Agent Files

Located in `.claude/agents/`:
```
.claude/agents/
├── ceo-review.md      # ~500 lines - comprehensive visual review
├── code-quality.md    # ~260 lines - code standards guardian
├── debugger.md        # ~290 lines - root cause analyst
├── improver.md        # ~240 lines - improvement planner
└── test-runner.md     # ~270 lines - E2E test automation
```

---

## Error Source Tracking (New)

When research fails, the `error_source` column in `research_jobs` tracks WHERE it failed:

| Error Source | Meaning | Action |
|--------------|---------|--------|
| `anthropic` | Claude API failed | Check API key, rate limits |
| `arctic_shift` | Reddit data API failed | Check if API is down |
| `database` | Supabase write failed | Check DB connection, RLS |
| `timeout` | Request timed out | May need retry |
| `unknown` | Untracked error | Check server logs |

Admin can run `/api/admin/cleanup-stale-jobs` to:
1. Auto-refund jobs with confirmed failures (`error_source` set)
2. Get alerts for stuck "processing" jobs (no auto-refund, needs review)
3. See API health breakdown by error source
