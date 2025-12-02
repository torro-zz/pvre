# PVRE - Technical Overview

*Last updated: 2025-12-01*

> This document provides a comprehensive overview of the PVRE (Pre-Validation Research Engine) codebase. Share with technical team members. Run `/update-overview` to refresh.

---

## What PVRE Does

PVRE is an **AI-powered pre-validation research tool** that helps founders assess business idea viability before building. Users enter a hypothesis (e.g., "Remote workers struggle with async communication") and the platform:

1. **Mines Reddit** for real customer pain points via Arctic Shift API
2. **Scores pain intensity** using 150+ keyword patterns + WTP signals
3. **Analyzes competitors** to map the competitive landscape
4. **Calculates a Viability Verdict** combining pain + competition scores
5. **Generates interview questions** to validate findings with real users

### The Core Value Proposition
> "From hypothesis to interview-ready in 5 minutes, not 5 weeks"

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js 15 (App Router) | 16.0.5 |
| **Frontend** | React + TypeScript | 19.2.0 / 5.x |
| **Styling** | Tailwind CSS 4 + Radix UI | 4.x |
| **Database** | Supabase (PostgreSQL) | - |
| **Auth** | Google OAuth via Supabase | - |
| **AI** | Anthropic Claude API | SDK 0.71.0 |
| **Data Source** | Arctic Shift API (Reddit) | - |

---

## External APIs & Services

### 1. Arctic Shift API (Free)
- **Purpose**: Access Reddit posts and comments without rate limits
- **URL**: `https://arctic-shift.photon-reddit.com`
- **Auth**: None required (public API)
- **Cost**: $0
- **Endpoints Used**:
  - `/api/posts` - Search posts by subreddit/keyword
  - `/api/comments` - Search comments
- **Rate Limiting**: Soft limit, 500ms delay between requests recommended

### 2. Anthropic Claude API (Paid)
- **Purpose**: AI analysis, theme extraction, competitor research, subreddit discovery
- **Models Used**:

| Model | Use Case | Cost per Run |
|-------|----------|--------------|
| `claude-3-haiku-20240307` | Subreddit discovery (fast, cheap) | ~$0.001 |
| `claude-sonnet-4-20250514` | Deep analysis, competitor intel | ~$0.05-0.10 |

- **Total cost per full research**: ~$0.05-0.15

### 3. Supabase (Freemium)
- **Purpose**: PostgreSQL database + Google OAuth + Row Level Security
- **Free Tier**: 500MB DB, 50k monthly active users
- **Features Used**: Auth, Database, RLS policies

---

## User Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Landing    │────▶│  Google     │────▶│  Dashboard  │
│  Page       │     │  Sign In    │     │  (History)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
     ┌─────────────────────────────────────────┘
     │
     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Enter      │────▶│  AI         │────▶│  Results    │
│  Hypothesis │     │  Processing │     │  + Verdict  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Detailed Flow

1. **Sign in** with Google OAuth (or dev bypass in development)
2. **Dashboard** shows research history with status badges
3. **Research page** - enter business hypothesis
4. **Community Voice Mining** (30-60 sec):
   - AI discovers 3-5 relevant subreddits
   - Fetches 300+ Reddit posts/comments via Arctic Shift
   - Calculates pain scores (0-10) using keyword detection
   - Detects WTP (willingness-to-pay) signals
   - Extracts themes and patterns via Claude
   - Generates Mom Test interview questions
5. **Competitor Intelligence** (separate module):
   - Identifies 4-8 competitors via AI research
   - Creates comparison matrix
   - Finds market gaps and opportunities
   - Assesses threat levels
6. **Viability Verdict** calculated and displayed
7. **Results saved** to database for future reference

---

## Viability Verdict Scoring System

The flagship feature - a composite score that combines research dimensions into an actionable assessment.

### Formula (4 Dimensions)

```javascript
VIABILITY_SCORE = (Pain × 0.35) + (Market × 0.25) + (Competition × 0.25) + (Timing × 0.15)
```

**Dynamic Weight Normalization:** When dimensions are missing, weights are recalculated to sum to 100%.

### Pain Score (35% weight)

Calculated from Reddit post analysis:

| Signal Type | Points | Examples |
|-------------|--------|----------|
| High Intensity Keywords | 3 | nightmare, hate, frustrated, desperate |
| Medium Intensity Keywords | 2 | struggle, difficult, problem, stuck |
| Low Intensity Keywords | 1 | wondering, curious, considering |
| Solution Seeking | 2 | looking for, recommendations, need help |
| Willingness to Pay (WTP) | 4 | would pay, budget, pricing, worth paying |

**Data Confidence Levels**:
- < 50 posts: Very Low confidence
- 50-100 posts: Low confidence
- 100-200 posts: Medium confidence
- 200+ posts: High confidence

### Competition Score (25% weight)

Calculated from AI competitor analysis:

| Factor | Impact | Logic |
|--------|--------|-------|
| Competitor Count | ±2 | 0 = greenfield (+2), 8+ = crowded (-1.5) |
| Funding Levels | ±1.5 | Well-funded = harder (-1.5), Bootstrapped = easier (+0.5) |
| User Satisfaction | ±2 | Low ratings = opportunity (+2), High ratings = barrier (-1) |
| Market Gaps | ±1 | 2+ gaps found = opportunity (+1) |

### Verdict Thresholds

| Score | Verdict | Color | Recommendation |
|-------|---------|-------|----------------|
| 7.5-10 | STRONG SIGNAL | Green | Proceed to interviews with confidence |
| 5.0-7.4 | MIXED SIGNAL | Yellow | Refine hypothesis, investigate weak areas |
| 2.5-4.9 | WEAK SIGNAL | Orange | Major concerns - consider pivoting |
| 0-2.4 | NO SIGNAL | Red | Likely not viable - pivot or abandon |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Landing page (public)
│   ├── globals.css                   # Tailwind + custom styles
│   ├── (auth)/login/                 # Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Dashboard shell with nav
│   │   ├── dashboard/page.tsx        # Research history
│   │   ├── admin/debug/page.tsx      # Debug info (dev only)
│   │   └── research/
│   │       ├── page.tsx              # Community Voice form
│   │       ├── [id]/page.tsx         # Results view + Viability Verdict
│   │       └── competitors/page.tsx  # Competitor analysis form
│   └── api/
│       ├── auth/callback/route.ts    # OAuth code exchange
│       ├── dev/login/route.ts        # Dev-only auth bypass
│       ├── admin/debug/route.ts      # Debug endpoint
│       └── research/
│           ├── community-voice/route.ts        # Reddit mining pipeline
│           ├── competitor-intelligence/route.ts # AI competitor analysis
│           ├── competitor-suggestions/route.ts  # AI competitor suggestions
│           └── jobs/route.ts                    # CRUD for research jobs
├── components/
│   ├── layout/header.tsx             # Navigation + auth status
│   ├── research/
│   │   ├── hypothesis-form.tsx       # Input form with examples
│   │   ├── community-voice-results.tsx # Pain themes, quotes, signals
│   │   ├── competitor-results.tsx    # Matrix, gaps, positioning
│   │   ├── viability-verdict.tsx     # Composite score dashboard
│   │   ├── research-progress.tsx     # Step progress indicator
│   │   ├── pain-score-card.tsx       # Individual post cards
│   │   └── pain-score-display.tsx    # Visual bar chart
│   └── ui/                           # Radix UI primitives (shadcn)
├── lib/
│   ├── anthropic.ts                  # Claude API client singleton
│   ├── arctic-shift/
│   │   └── client.ts                 # Reddit data fetching
│   ├── analysis/
│   │   ├── pain-detector.ts          # 150+ keyword scoring
│   │   ├── theme-extractor.ts        # Claude theme synthesis
│   │   └── viability-calculator.ts   # Composite score logic
│   ├── reddit/
│   │   └── subreddit-discovery.ts    # AI subreddit finder
│   └── supabase/
│       ├── client.ts                 # Browser client
│       ├── server.ts                 # SSR client (cookies)
│       └── admin.ts                  # Service role (bypasses RLS)
└── types/
    └── index.ts                      # TypeScript definitions
```

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts (synced from auth.users) | `id`, `email`, `full_name`, `avatar_url` |
| `research_jobs` | Research projects | `id`, `user_id`, `hypothesis`, `status`, `module_status` |
| `research_results` | Module outputs | `job_id`, `module_name`, `data` (JSONB) |
| `reddit_cache` | Reddit data cache (24h TTL) | `subreddit`, `search_query`, `posts`, `expires_at` |

### Key Relationships
```
auth.users (Supabase managed)
    │
    ▼
profiles ──────────────┐
    │                  │
    ▼                  │
research_jobs ─────────┤
    │                  │
    ▼                  │
research_results ──────┘
```

### Module Status Tracking

`research_jobs.module_status` is JSONB:
```json
{
  "community_voice": "completed",
  "competitor_intel": "pending",
  "interview_prep": "pending"
}
```

### Row Level Security

All tables enforce RLS - users can only access their own data:
- `profiles`: Own profile only
- `research_jobs`: Own jobs only
- `research_results`: Via job ownership
- `reddit_cache`: Read-only for authenticated users

---

## API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/research/community-voice` | POST | Run Reddit mining + analysis | Required |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis | Required |
| `/api/research/competitor-suggestions` | POST | Get AI-suggested competitors | Required |
| `/api/research/jobs` | GET | List user's research jobs | Required |
| `/api/research/jobs` | POST | Create new research job | Required |
| `/api/research/jobs` | PATCH | Update job status | Required |
| `/api/auth/callback` | GET | OAuth code exchange | - |
| `/api/dev/login` | POST | Dev-only auth bypass | Dev only |
| `/api/admin/debug` | GET | Debug info | Dev only |

### Community Voice Response Structure

```typescript
{
  painThemes: {
    title: string
    description: string
    intensity: 'high' | 'medium' | 'low'
    postCount: number
    topQuotes: string[]
  }[]
  painScore: number  // 0-10
  wtpSignals: {
    quote: string
    confidence: 'strong' | 'moderate' | 'weak'
  }[]
  interviewQuestions: {
    context: string[]
    problem: string[]
    solution: string[]
  }
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
}
```

---

## Environment Variables

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For admin operations

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

# Build for production
npm run build

# App runs at http://localhost:3000
```

### Dev Authentication

For testing without Google OAuth:

```bash
# Create dev session
curl -X POST http://localhost:3000/api/dev/login

# Check auth status
curl http://localhost:3000/api/dev/login
```

Creates a test user: `test-user@pvre-dev.local`

### Puppeteer Testing

```javascript
// 1. Navigate and login
await puppeteer_navigate({ url: 'http://localhost:3000' })
await puppeteer_evaluate({ script: `fetch('/api/dev/login', { method: 'POST' })` })

// 2. Go to dashboard
await puppeteer_navigate({ url: 'http://localhost:3000/dashboard' })

// 3. Run research
await puppeteer_navigate({ url: 'http://localhost:3000/research' })
await puppeteer_fill({ selector: 'textarea', value: 'Test hypothesis' })
await puppeteer_click({ selector: 'button[type="submit"]' })
```

---

## Implementation Status

| Module | Status | Completion | Notes |
|--------|--------|------------|-------|
| Landing Page | ✅ Complete | 100% | Tech-forward design with bento grid |
| Google OAuth | ✅ Complete | 100% | Via Supabase |
| Community Voice Mining | ✅ Complete | 100% | Arctic Shift + Claude with relevance filtering |
| Competitor Intelligence | ✅ Complete | 100% | AI-powered analysis |
| Market Sizing | ✅ Complete | 100% | TAM/SAM/SOM Fermi estimation |
| Timing Analysis | ✅ Complete | 100% | Tailwinds/headwinds analysis |
| Viability Verdict | ✅ Complete | 100% | 4-dimension scoring with transparency UI |
| Research History | ✅ Complete | 100% | Dashboard with status |
| Interview Questions | ✅ Complete | Embedded | Part of Community Voice |
| PDF Export | ✅ Complete | 100% | Full report via jspdf |
| Test Suite | ✅ Complete | 100% | Vitest with 64 tests |
| Research Resilience | ✅ Complete | 100% | Browser warning, error tracking, auto-refund |
| Credits/Billing | ✅ Complete | 100% | Stripe integration |
| Admin Dashboard | ✅ Complete | 100% | Analytics + user management |
| Dark Mode | ❌ Not started | 0% | Priority: Low |

**Overall MVP: ~99% complete**

---

## Cost Analysis

| Service | Per Research Run | Monthly (100 runs) |
|---------|------------------|-------------------|
| Arctic Shift | $0 | $0 |
| Claude API | ~$0.10 | ~$10 |
| Supabase | $0 (free tier) | $0 |
| Vercel (future) | $0 (free tier) | $0 |
| **Total** | **~$0.10** | **~$10** |

---

## Key Dependencies

```json
{
  "next": "16.0.5",
  "react": "19.2.0",
  "@supabase/supabase-js": "^2.86.0",
  "@supabase/ssr": "^0.8.0",
  "@anthropic-ai/sdk": "^0.71.0",
  "@radix-ui/react-tabs": "^1.1.13",
  "@radix-ui/react-progress": "^1.1.8",
  "tailwindcss": "^4",
  "lucide-react": "^0.555.0",
  "typescript": "^5"
}
```

---

## Architecture Decisions

### Why Arctic Shift over Reddit API?
- No rate limits or OAuth required
- Historical data access (years of posts)
- More reliable for bulk fetching
- Free forever

### Why Supabase?
- PostgreSQL with built-in Google OAuth
- Row Level Security out of the box
- Generous free tier (500MB DB)
- Real-time subscriptions (future use)

### Why Claude over OpenAI?
- Better at nuanced analysis and structured output
- Haiku model is fast + cheap for simple tasks
- Sonnet provides deep analysis when needed
- Strong JSON mode for structured responses

### Why Next.js App Router?
- Server components reduce client JS
- Built-in API routes
- Streaming responses support
- Vercel deployment optimized

---

## Future Roadmap

### Near Term (Completed ✅)
1. ~~**PDF Export**~~ - Done via jspdf
2. ~~**Test Suite**~~ - Vitest with 64 tests
3. ~~**Market Sizing Module**~~ - TAM/SAM/SOM Fermi estimation
4. ~~**Timing Module**~~ - Tailwinds/headwinds analysis
5. ~~**Research Resilience**~~ - Browser warnings, error tracking, auto-refund

### Medium Term
1. **Result Polling** - Let disconnected users see completed results
2. **Crisp Chat Integration** - In-app support chat
3. **API Health Dashboard** - Admin view of which APIs are failing
4. **Email Notifications** - Alert when research completes

### Long Term
5. **Team Sharing** - Collaborate on research
6. **Custom Data Sources** - Twitter, forums, G2 reviews
7. **Historical Tracking** - Score changes over time
8. **Dark Mode** - UI theme toggle

---

## Troubleshooting

### Common Issues

**"Results Not Available" on old research**
- Research jobs created before persistence was added won't have saved results
- Solution: Run new research

**Auth redirect loops**
- Clear cookies and try again
- Check Supabase auth configuration in dashboard

**Slow research processing**
- Arctic Shift has soft rate limiting (500ms between requests)
- Normal for 30-60 second processing time
- Large subreddits may take longer

**Claude API errors**
- Check ANTHROPIC_API_KEY is valid
- Ensure sufficient API credits
- Rate limits: 60 requests/minute on free tier

---

## Security Considerations

- All API routes check authentication
- RLS enforced at database level
- Service role key only used server-side
- Dev auth disabled in production
- No PII stored beyond email

---

## Contact

For questions about this codebase, reach out to the development team or check CLAUDE.md for implementation details.
