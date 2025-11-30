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

*Last updated: 2025-11-28*

| Module | Status | Completion | Notes |
|--------|--------|------------|-------|
| Community Voice Mining | DONE | 100% | Full Reddit analysis via Arctic Shift + Claude |
| Competitor Intelligence | DONE | 100% | Full competitive landscape analysis via Claude |
| Interview Prep Generator | PARTIAL | 70% | Questions embedded in Community Voice tabs |

### Overall MVP Completion: ~90%

---

## Key Gaps vs Design Spec

Based on `docs/PVRE_DESIGN_SPEC.md`:

1. ~~**Competitor Intelligence module** - Not implemented~~ **DONE**
   - Implemented at `/research/competitors`
   - Includes: market overview, competitor matrix, gap analysis, positioning recommendations

2. **Interview Prep standalone** - Partial
   - Currently embedded in Community Voice output (3 sections: Context, Problem, Solution)
   - Could benefit from dedicated module with more structured interview scripts
   - Priority: LOW (current implementation is functional)

3. **PDF Export** - Not implemented
   - Users should be able to export research as PDF
   - Priority: MEDIUM

4. **Dark Mode** - Not implemented
   - Low priority, UX enhancement
   - Priority: LOW

5. **Test Suite** - Not implemented
   - No Jest/Vitest tests yet
   - Priority: MEDIUM

---

## Priority Roadmap

1. ~~**Module 2: Competitor Intelligence**~~ **DONE**
   - Implemented with Claude API analysis

2. **PDF Export**
   - Complexity: LOW-MEDIUM
   - Dependencies: react-pdf or similar

3. **Test Suite**
   - Complexity: MEDIUM
   - Dependencies: Jest/Vitest setup

4. **Interview Prep standalone** (optional enhancement)
   - Complexity: LOW
   - Current implementation is functional

---

## Architecture Overview

### File Structure
```
src/
├── app/
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── dashboard/       # User dashboard with research history
│   │   └── research/        # Research input + results pages
│   │       ├── [id]/        # Individual research detail view
│   │       └── competitors/ # Competitor intelligence page
│   ├── api/
│   │   ├── dev/login/       # Dev-only auth bypass
│   │   └── research/
│   │       ├── community-voice/       # Community Voice research endpoint
│   │       ├── competitor-intelligence/ # Competitor analysis endpoint
│   │       └── jobs/        # Job management CRUD
│   └── auth/                # Auth callbacks
├── components/
│   └── research/
│       ├── community-voice-results.tsx
│       ├── competitor-results.tsx     # NEW
│       ├── hypothesis-form.tsx
│       └── pain-score-card.tsx
├── lib/
│   ├── supabase/
│   │   ├── admin.ts         # Service role client (bypasses RLS)
│   │   ├── server.ts        # Server-side client
│   │   └── client.ts        # Browser client
│   └── arctic-shift/        # Reddit API client
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
| `/api/research/community-voice` | POST | Run community voice research |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis |
| `/api/research/jobs` | POST | Create new research job |
| `/api/research/jobs` | GET | List user's research jobs |
| `/api/research/jobs` | PATCH | Update job status |
| `/api/dev/login` | POST | Dev auth (dev only) |
| `/api/dev/login` | GET | Check auth status (dev only) |

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

---

## Slash Commands

- `/review` - Review codebase against design spec, update this file
- `/test-flow` - Run autonomous test of the research flow
- `/improve` - Identify and implement the next priority improvement
- `/update-overview` - Update `docs/TECHNICAL_OVERVIEW.md` with current codebase state (run weekly)
