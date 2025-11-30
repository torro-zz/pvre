# PVRE - Technical Overview

*Last updated: 2025-11-29*

> This document provides a comprehensive overview of the PVRE (Pre-Validation Research Engine) codebase for team reference. Run `/update-overview` to refresh this document.

---

## What PVRE Does

PVRE is an AI-powered research tool that helps founders validate business ideas before building. Users enter a hypothesis (e.g., "Remote workers struggle with async communication") and the platform:

1. **Mines Reddit** for real customer pain points and discussions
2. **Analyzes competitors** in the space
3. **Generates interview questions** to validate findings with real users

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.0.5 |
| **Frontend** | React + TypeScript | 19.2.0 / 5.x |
| **Styling** | Tailwind CSS + Radix UI | 4.x |
| **Database** | Supabase (PostgreSQL) | - |
| **Auth** | Google OAuth via Supabase | - |
| **AI** | Anthropic Claude API | SDK 0.71.0 |
| **Data Source** | Arctic Shift API | - |

---

## External APIs & Services

### 1. Arctic Shift API (Free)
- **Purpose**: Access Reddit posts and comments without rate limits
- **URL**: `https://arctic-shift.photon-reddit.com`
- **Auth**: None required (public API)
- **Cost**: $0
- **Used for**: Fetching Reddit discussions related to user hypotheses

### 2. Anthropic Claude API (Paid)
- **Purpose**: AI analysis, theme extraction, competitor research
- **Models Used**:
  | Model | Use Case | Cost |
  |-------|----------|------|
  | `claude-3-haiku-20240307` | Subreddit discovery (fast) | ~$0.001/run |
  | `claude-sonnet-4-20250514` | Deep analysis, competitors | ~$0.05-0.10/run |
- **Total cost per research**: ~$0.05-0.15

### 3. Supabase (Freemium)
- **Purpose**: PostgreSQL database + Google OAuth + Row Level Security
- **Cost**: Free tier (500MB DB, 50k MAU)
- **Dashboard**: Accessible via Supabase project console

---

## User Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Landing    │────▶│  Google     │────▶│  Dashboard  │
│  Page       │     │  Sign In    │     │  (History)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Results    │◀────│  AI         │◀────│  Enter      │
│  Display    │     │  Processing │     │  Hypothesis │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Sign in** with Google OAuth
2. **Dashboard** shows research history
3. **Research page** - enter business hypothesis
4. **Community Voice Mining** (30-60 sec):
   - AI discovers relevant subreddits
   - Fetches 300+ Reddit posts/comments
   - Detects pain signals via keyword analysis
   - Extracts themes and patterns
   - Generates interview questions
5. **Competitor Intelligence**:
   - Identifies 4-8 competitors
   - Creates comparison matrix
   - Finds market gaps
6. **Results saved** for future reference

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/              # Login page
│   ├── (dashboard)/
│   │   ├── dashboard/             # Research history
│   │   └── research/
│   │       ├── page.tsx           # Main research form
│   │       ├── [id]/              # Individual result view
│   │       └── competitors/       # Competitor module
│   └── api/
│       ├── auth/callback/         # OAuth callback
│       ├── dev/login/             # Dev auth bypass
│       └── research/
│           ├── community-voice/   # Reddit mining
│           ├── competitor-intelligence/
│           └── jobs/              # CRUD for research jobs
├── components/
│   ├── layout/header.tsx          # Nav + auth status
│   ├── research/
│   │   ├── hypothesis-form.tsx
│   │   ├── community-voice-results.tsx
│   │   ├── competitor-results.tsx
│   │   └── pain-score-card.tsx
│   └── ui/                        # Radix UI components
├── lib/
│   ├── anthropic.ts               # Claude API client
│   ├── arctic-shift/client.ts     # Reddit data fetching
│   ├── analysis/
│   │   ├── pain-detector.ts       # Keyword scoring
│   │   └── theme-extractor.ts     # AI theme synthesis
│   ├── reddit/
│   │   └── subreddit-discovery.ts # AI subreddit finder
│   └── supabase/
│       ├── client.ts              # Browser client
│       ├── server.ts              # SSR client
│       └── admin.ts               # Service role client
└── types/                         # TypeScript definitions
```

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts | `id`, `email`, `full_name` |
| `research_jobs` | Research projects | `id`, `user_id`, `hypothesis`, `status` |
| `research_results` | Module outputs | `job_id`, `module_name`, `data` (JSON) |
| `reddit_cache` | Reddit data cache | `subreddit`, `posts`, `expires_at` |

### Key Relationships
- `profiles.id` → `auth.users.id` (Supabase managed)
- `research_jobs.user_id` → `profiles.id`
- `research_results.job_id` → `research_jobs.id`

### Row Level Security
All tables enforce RLS - users can only access their own data.

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/research/community-voice` | POST | Run Reddit mining + analysis |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis |
| `/api/research/jobs` | GET | List user's research jobs |
| `/api/research/jobs` | POST | Create new research job |
| `/api/research/jobs` | PATCH | Update job status |
| `/api/auth/callback` | GET | OAuth code exchange |
| `/api/dev/login` | POST | Dev-only auth bypass |

---

## Environment Variables

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic (Required)
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# App runs at http://localhost:3000
```

### Dev Authentication
For testing without Google OAuth:
```bash
curl -X POST http://localhost:3000/api/dev/login
```
This creates a test user session (dev mode only).

---

## Implementation Status

| Module | Status | Completion |
|--------|--------|------------|
| Community Voice Mining | ✅ Complete | 100% |
| Competitor Intelligence | ✅ Complete | 100% |
| Interview Prep | ✅ Complete | Embedded in Community Voice |
| Google OAuth | ✅ Complete | 100% |
| Research History | ✅ Complete | 100% |
| PDF Export | ❌ Not started | 0% |
| Dark Mode | ❌ Not started | 0% |
| Test Suite | ❌ Not started | 0% |

**Overall MVP: ~90% complete**

---

## Cost Analysis

| Service | Per Research Run | Monthly (100 runs) |
|---------|------------------|-------------------|
| Arctic Shift | $0 | $0 |
| Claude API | ~$0.10 | ~$10 |
| Supabase | $0 (free tier) | $0 |
| **Total** | **~$0.10** | **~$10** |

---

## Key Dependencies

```json
{
  "next": "16.0.5",
  "react": "^19.2.0",
  "@supabase/supabase-js": "^2.86.0",
  "@supabase/ssr": "^0.8.0",
  "@anthropic-ai/sdk": "^0.71.0",
  "@radix-ui/react-tabs": "^1.1.12",
  "tailwindcss": "^4.1.1",
  "typescript": "^5"
}
```

---

## Architecture Decisions

### Why Arctic Shift over Reddit API?
- No rate limits or authentication required
- Historical data access (years of posts)
- More reliable for bulk fetching
- Free forever

### Why Supabase?
- PostgreSQL with built-in auth
- Row Level Security out of the box
- Generous free tier
- Real-time subscriptions (future use)

### Why Claude over OpenAI?
- Better at nuanced analysis and structured output
- Haiku model is fast + cheap for simple tasks
- Sonnet provides deep analysis when needed

---

## Future Roadmap

1. **PDF Export** - Allow users to download research as PDF
2. **Test Suite** - Add Jest/Vitest for reliability
3. **Email Notifications** - Alert when research completes
4. **Team Sharing** - Share research with team members
5. **Custom Data Sources** - Beyond Reddit (Twitter, forums)

---

## Troubleshooting

### Common Issues

**"Results Not Available" on old research**
- Research jobs created before persistence was added won't have saved results
- Solution: Run new research

**Auth redirect loops**
- Clear cookies and try again
- Check Supabase auth configuration

**Slow research processing**
- Arctic Shift has rate limiting (500ms between requests)
- Normal for 30-60 second processing time

---

## Contact

For questions about this codebase, reach out to the development team.
