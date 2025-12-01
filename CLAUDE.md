# PVRE - Claude Code Instructions

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

*Last updated: 2025-12-01 (Phase 3 polish & quality improvements)*

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
| Test Suite | DONE | 100% | Vitest with 64 tests for core modules |
| Landing Page | DONE | 100% | Tech-forward design with bento grid features section |
| Post Relevance Filter | DONE | 100% | Claude Haiku filters irrelevant posts before analysis |
| Refund Monitoring | DONE | 100% | Admin alerts on 3rd+ refund (auto-approve continues) |
| Competitor Prompt | DONE | 100% | Modal prompts user to run competitor analysis after Community Voice |
| WhatsApp Support | DONE | 100% | Support links in footer, account, and report problem |
| Error Handling | PARTIAL | 60% | Basic try/catch; structured PVREError not implemented |

### Overall MVP Completion: ~99%

### V2 Kickoff Spec Checklist
- [x] P0: Market Sizing module
- [x] P0: Timing Analysis module
- [x] P0: 4-Dimension viability scoring
- [x] P0: Transparency UI for verdict
- [x] P1: PDF Export
- [x] P1: Landing page redesign
- [ ] P1: Structured error handling (PVREError class)
- [x] Phase 3: Test Suite (done early)
- [x] Phase 3: Post relevance filtering
- [x] Phase 3: Refund abuse monitoring
- [x] Phase 3: Competitor analysis prompt
- [x] Phase 3: WhatsApp support integration

---

## Phase 3 Features (Polish & Quality)

### Post Relevance Filtering
- **Location:** `src/app/api/research/community-voice/route.ts` (lines 36-171)
- **How it works:** After fetching posts/comments, Claude Haiku rates each item 1-5 for relevance to the hypothesis
- **Threshold:** Only items rated 3+ are kept for analysis
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
- **Future:** WhatsApp notification preference in account/notifications

---

## Key Gaps vs V2 Kickoff Spec

Based on `docs/PVRE_CLAUDE_CODE_KICKOFF_V2.md`:

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

### Remaining Items

1. **Structured Error Handling** - Partial
   - Basic try/catch in place
   - Missing: PVREError class, error codes, withRetry wrapper
   - Priority: LOW (non-blocking for MVP)

2. **Dark Mode** - Not implemented
   - Priority: LOW

3. **Phase 2 Analytics Instrumentation** - Not implemented
   - Track events for user behavior
   - Priority: FUTURE

---

## Priority Roadmap

### Completed ✅

1. ~~**Community Voice Mining**~~ **DONE**
2. ~~**Competitor Intelligence**~~ **DONE**
3. ~~**Market Sizing Module**~~ **DONE**
4. ~~**Timing Analysis Module**~~ **DONE**
5. ~~**4-Dimension Viability Score**~~ **DONE**
6. ~~**Transparency UI**~~ **DONE**
7. ~~**PDF Export**~~ **DONE**
8. ~~**Test Suite**~~ **DONE**
9. ~~**Landing Page Redesign**~~ **DONE**

### Optional Enhancements (Post-Launch)

1. **Structured Error Handling**
   - Add PVREError class with error codes
   - Implement withRetry wrapper for API calls
   - Complexity: MEDIUM

2. **Dark Mode**
   - Complexity: LOW

3. **Analytics Instrumentation** (Phase 2)
   - Track user behavior events
   - Complexity: MEDIUM

---

## Architecture Overview

### File Structure
```
src/
├── app/
│   ├── page.tsx             # Landing page (tech-forward design)
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── dashboard/       # User dashboard with research history
│   │   ├── admin/debug/     # Admin debug page
│   │   └── research/        # Research input + results pages
│   │       ├── [id]/        # Individual research detail view
│   │       └── competitors/ # Competitor intelligence page
│   ├── api/
│   │   ├── dev/login/       # Dev-only auth bypass
│   │   ├── admin/debug/     # Debug endpoint
│   │   └── research/
│   │       ├── community-voice/         # Community Voice research endpoint (includes market sizing + timing)
│   │       ├── competitor-intelligence/ # Competitor analysis endpoint
│   │       ├── competitor-suggestions/  # AI-powered competitor suggestions
│   │       ├── market-sizing/           # Standalone market sizing endpoint
│   │       ├── timing/                  # Standalone timing analysis endpoint
│   │       └── jobs/        # Job management CRUD
│   └── auth/                # Auth callbacks
├── components/
│   └── research/
│       ├── community-voice-results.tsx
│       ├── competitor-results.tsx
│       ├── hypothesis-form.tsx
│       ├── pain-score-card.tsx
│       ├── pain-score-display.tsx      # Visual bar chart display
│       ├── pdf-download-button.tsx     # PDF export button component
│       ├── research-progress.tsx       # Step progress indicator
│       └── viability-verdict.tsx       # 4-dimension verdict display
├── lib/
│   ├── supabase/
│   │   ├── admin.ts         # Service role client (bypasses RLS)
│   │   ├── server.ts        # Server-side client
│   │   └── client.ts        # Browser client
│   ├── arctic-shift/        # Reddit API client
│   ├── pdf/
│   │   └── report-generator.ts    # PDF report generation with jspdf
│   └── analysis/
│       ├── pain-detector.ts       # Pain scoring with 150+ keywords
│       ├── theme-extractor.ts     # Claude-powered theme analysis
│       ├── market-sizing.ts       # TAM/SAM/SOM Fermi estimation
│       ├── timing-analyzer.ts     # Tailwinds/headwinds analysis
│       └── viability-calculator.ts # 4-dimension composite score
├── __tests__/               # Vitest test files
│   ├── setup.ts             # Test setup and mocks
│   ├── viability-calculator.test.ts  # 30 tests
│   └── pain-detector.test.ts         # 34 tests
└── types/                   # TypeScript definitions
```

### Database Tables
- `profiles` - User data (synced from auth.users)
- `research_jobs` - Research projects with status tracking
- `research_results` - Module outputs (JSON data)
- `reddit_cache` - Arctic Shift response cache

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/community-voice` | POST | Run community voice research (includes market sizing + timing) |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis |
| `/api/research/competitor-suggestions` | POST | Get AI-suggested competitors |
| `/api/research/market-sizing` | POST | Standalone market sizing analysis |
| `/api/research/timing` | POST | Standalone timing analysis |
| `/api/research/jobs` | POST | Create new research job |
| `/api/research/jobs` | GET | List user's research jobs |
| `/api/research/jobs` | PATCH | Update job status |
| `/api/dev/login` | POST | Dev auth (dev only) |
| `/api/dev/login` | GET | Check auth status (dev only) |
| `/api/admin/debug` | GET | Debug info (dev only) |

---

## Known Issues

- Old research jobs (created before persistence was implemented) show "Results Not Available" even if completed
- Must ensure dev server is running on port 3000 before testing

---

## Development Tips

### Starting Fresh
```bash
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev
```

### Database Migrations
Migrations are in `supabase/migrations/`. Apply via Supabase dashboard or CLI.

### Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
- `ANTHROPIC_API_KEY`

Optional:
- `NEXT_PUBLIC_WHATSAPP_SUPPORT_URL` - WhatsApp Business link (wa.me/YOUR_NUMBER)

---

## Slash Commands

- `/review` - Review codebase against design spec, update this file
- `/test-flow` - Run autonomous test of the research flow
- `/improve` - Identify and implement the next priority improvement
- `/update-overview` - Update `docs/TECHNICAL_OVERVIEW.md` with current codebase state (run weekly)
