# PVRE - Technical Overview

*Last updated: 2025-12-31 (Two-Stage Filter with Haiku AI Verification)*

> **Auto-Update**: This document should be updated on every significant push. See CLAUDE.md → "Documentation Updates" section.

> This document provides a comprehensive overview of the PVRE (Pre-Validation Research Engine) codebase. Share with technical team members. Run `/update-overview` to refresh.

**Related Documentation:**
- **CLAUDE.md** - AI agent behavior rules (in project root)
- **KNOWN_ISSUES.md** - Active bugs and recent fixes
- **HOW_IT_WORKS.md** - System flow documentation
- **redesign/** - Active UI/UX redesign project (MASTER_PLAN.md is the roadmap)
- **agent-learnings.md** - Agent system knowledge base

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
| **Database** | Supabase (PostgreSQL + pgvector) | - |
| **Auth** | Google OAuth via Supabase | - |
| **AI** | Anthropic Claude API | SDK 0.71.0 |
| **Embeddings** | OpenAI text-embedding-3-large | SDK 4.x |
| **Data Source** | Arctic Shift API (Reddit) | - |

---

## External APIs & Services

### 1. Arctic Shift API (Free)
- **Purpose**: Access Reddit posts and comments
- **URL**: `https://arctic-shift.photon-reddit.com`
- **Auth**: None required (public API)
- **Cost**: $0
- **Endpoints Used**:
  - `/api/posts/search` - Search posts by subreddit
  - `/api/comments/search` - Search comments by subreddit
- **Rate Limiting**: ~2000 requests/minute (very generous)
- **⚠️ Known Issue**: Multi-word `query` and `body` params cause server-side timeouts (422 errors). Fetch by subreddit + time range only; Claude relevance filter handles content filtering.

### 2. Google Trends API (Free)
- **Purpose**: Real trend data for timing analysis (replacing AI speculation)
- **Package**: `google-trends-api` npm package
- **Auth**: None required
- **Cost**: $0
- **Features**:
  - `interestOverTime` - 12-month trend data for keywords
  - Trend direction detection (rising/stable/falling)
  - Percentage change calculation
- **Caching**: 24 hours per keyword set (in-memory)
- **AI Keyword Extraction**: Uses Claude to extract problem-focused keywords from hypothesis (not demographics). Keywords are cached 7 days for deterministic results.
- **Fallback**: Graceful degradation if API fails - AI estimates shown with trust badge

**Key Files:**
- `src/lib/data-sources/google-trends.ts` - API wrapper + keyword extraction
- `src/lib/analysis/timing-analyzer.ts` - Integrates trends into timing score

### 3. Anthropic Claude API (Paid)
- **Purpose**: AI analysis, theme extraction, competitor research, subreddit discovery
- **Models Used**:

| Model | Use Case | Cost per Run |
|-------|----------|--------------|
| `claude-3-haiku-20240307` | Subreddit discovery (fast, cheap) | ~$0.001 |
| `claude-sonnet-4-20250514` | Deep analysis, competitor intel, keyword extraction | ~$0.05-0.10 |

- **Total cost per full research**: ~$0.05-0.15
- **⚠️ Note**: Some parts of codebase may still use deprecated model names (see KNOWN_ISSUES.md)

### 4. OpenAI Embeddings API (Paid)
- **Purpose**: Semantic similarity pre-filtering before AI analysis
- **Model**: `text-embedding-3-large` (1536 dimensions)
- **Cost**: ~$0.01 per search (~500 posts)
- **Features**:
  - Batch embedding generation (up to 100 texts per request)
  - Cosine similarity comparison
  - Supabase pgvector caching (embedding_cache table)
- **Thresholds** (calibrated Dec 2025):
  - HIGH (≥0.50): CORE candidate - directly about the problem
  - MEDIUM (≥0.35): RELATED candidate - same domain, might be relevant
  - LOW (<0.35): Filtered without AI call
- **Query Expansion**: Short hypotheses (≤3 words) auto-expand for better matching
  - "Slack" → "Problems, frustrations, and pain points with Slack..."
- **Impact**: 75% reduction in Haiku API calls

**Key Files:**
- `src/lib/embeddings/embedding-service.ts` - Core embedding service
- `src/lib/embeddings/index.ts` - Barrel exports

### 5. Supabase (Freemium)
- **Purpose**: PostgreSQL database + Google OAuth + Row Level Security
- **Free Tier**: 500MB DB, 50k monthly active users
- **Features Used**: Auth, Database, RLS policies

---

## User Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Landing    │───▶│   Login     │───▶│  Dashboard  │───▶│  Research   │───▶│   Results   │
│   Page      │    │  (Google)   │    │             │    │   Input     │    │   (Tabs)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     /                /login            /dashboard          /research        /research/[id]
```

### Step 1: Landing Page (`/`)

| Section | Content | Purpose |
|---------|---------|---------|
| Header | Logo + "How It Works" + "Sign In" + "Get Started" | Navigation |
| Hero | "Know if your idea has legs in 5 minutes, not 5 weeks" | Value prop |
| Problem | "90% of startups fail from building the wrong thing" (red pulsing) | Pain trigger |
| Old Way | 4 icons showing manual validation pain | Problem amplification |
| Features | Community Voice, Competitor Intel, 4-Dimension Verdict cards | Solution preview |
| Social Proof | 2 testimonial quotes | Trust building |
| Footer CTA | "Stop guessing. Start validating." | Conversion |

### Step 2: Authentication (`/login`)

- Single "Sign in with Google" OAuth button
- Auto-creates account for first-time users
- Redirects to `/dashboard` after auth

### Step 3: Dashboard (`/dashboard`)

| Section | Content | Condition |
|---------|---------|-----------|
| Welcome | "Welcome back, [First Name]!" | Always |
| Start New Research | Card with 4 feature badges + button | Always |
| Continue Your Research | Highlighted card with next step | If incomplete job exists |
| Recent Research | List of last 10 jobs with status badges | If jobs exist |

**Status Badges:** Completed (green), Processing (blue + spinner), Failed (red), [Step Name] (outline)

### Step 4: Research Input (`/research`)

**Input Elements:**

| Element | Type | Details |
|---------|------|---------|
| Hypothesis textarea | Multiline | Placeholder: "e.g., Training community for London Hyrox athletes" |
| Example buttons (4) | Quick-fill pills | Pre-written hypotheses to reduce blank-page anxiety |
| "Check Data Availability" | Primary button | Triggers FREE coverage preview |
| "Proceed with Research" | Primary button | Costs 1 credit, starts full analysis |
| "Refine Hypothesis" | Secondary button | Returns to editing |

**Coverage Preview (Free):**
- Confidence indicator (green/blue/yellow/red)
- Relevant subreddits with relevance badges (high/medium/low)
- Keywords extracted
- Recommendation text

### Step 5: Processing States

**Auto-Trigger (0-3s):**
```
[Spinner] "Starting Research"
"Initializing analysis for your hypothesis..."
```

**Active Processing (5-90s):**
```
[Spinner] "Research in Progress"
"Analyzing Reddit discussions..."
"Checking every 3s... (5 checks)"
```

**Timeout (After 5 min):**
```
[Amber] "Taking Longer Than Expected"
[Button: "Check Again"]
```

**Tab Close Warning:** Browser confirms before closing during research.

**Timing Breakdown:**

| Phase | Duration |
|-------|----------|
| Keyword extraction | <1s |
| Subreddit discovery | 2-5s |
| Reddit fetch | 3-10s |
| Relevance filtering | 5-15s |
| Pain analysis | 2-3s |
| Theme extraction | 3-5s |
| Interview questions | 2-3s |
| Market sizing | 5-10s |
| Timing analysis | 5-10s |
| **Total** | **30-70s** |

### Step 6: Results Page (`/research/[id]`)

**Header:** Back button, hypothesis, metadata, PDF download, status badge

**Progress Stepper:** Community Voice → Competitor Analysis → Viability Verdict

**5 Tabs:**

| Tab | Icon | Indicator | Key Content |
|-----|------|-----------|-------------|
| Verdict | Target | Score badge | Composite 0-10 score, dimension breakdown, dealbreakers, recommendations |
| Community | TrendingUp | Green dot | Pain themes, signals, quotes, interview guide, data quality |
| Market | PieChart | Green dot | TAM/SAM/SOM, revenue analysis, achievability |
| Timing | Timer | Green dot | Tailwinds, headwinds, timing window |
| Competitors | Shield | Green dot | Competitor cards, matrix, gaps, positioning strategies |

### Credit System

- **1 credit** charged upfront at research trigger
- Same credit covers all 4 modules (pain, market, timing, competitor)
- **Auto-refund** on failure (not shown in UI, balance restored)
- Header badge shows current balance

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

### Data Quality Considerations (Dec 2025)

**Known Issues (See KNOWN_ISSUES.md → Data Quality Initiative):**
- Quote selection prioritizes pain intensity over hypothesis relevance
- Reddit is poor for WTP signals (app reviews are better)
- No first-person language detection (filters out generic content)

**Target Metrics:**
| Metric | Current | Target |
|--------|---------|--------|
| Filter survival rate | ~15-25% | ~30-40% |
| Quote relevance | ~35% | >70% |
| WTP signal accuracy | Low | High (via app reviews) |
| Data confidence "High" | Rare | When deserved |

**Key Files for Data Quality:**
- `src/lib/filter/` - Two-stage filtering (embeddings + Haiku verification)
- `src/lib/analysis/pain-detector.ts` - Pain scoring + engagement
- `src/lib/analysis/theme-extractor.ts` - Quote selection (lines 517-524)

**Full Brief:** `docs/DATA_QUALITY_BRIEF.md`

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
| 4.0-4.9 | WEAK SIGNAL | Orange | Significant concerns - validate assumptions first |
| 0-3.9 | DO NOT PURSUE | Red | No viable signal - pivot to different problem/audience |

### Two-Axis Verdict System (Report Redesign v6) — Dec 22, 2025

**Problem Solved:** The single viability score was misleading. A search could show "7.6/10 STRONG SIGNAL" when the hypothesis wasn't found (11% relevance) but the market was active. Users felt confused and cheated.

**Solution:** Separate "Is there a market?" from "Did we find YOUR hypothesis?"

#### Axis 1: Hypothesis Confidence
*"Did we find YOUR specific hypothesis?"*

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Direct Signal % | 50% | CORE signals / total signals (CORE = direct hypothesis match) |
| Signal Volume | 25% | Total signals found (caps at 100 → 10/10) |
| Multi-Source | 25% | 3+ sources = 10, 2 sources = 7, 1 source = 4 |

**Levels:**
- `HIGH` (≥6): Strong evidence for your specific hypothesis
- `PARTIAL` (3-6): Some signals, but adjacent problems more prominent
- `LOW` (<3): Your angle wasn't found - see Adjacent Opportunities

#### Axis 2: Market Opportunity
*"Is there a viable market here?"*

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Market Size | 30% | From market sizing module |
| Timing | 25% | From timing analysis module |
| Activity Level | 25% | Posts analyzed + signal density |
| Competitor Presence | 20% | Competitors = validated market (5+ = 10) |

**Levels:**
- `STRONG` (≥7): Active market with validated demand
- `MODERATE` (5-7): Market exists, may need positioning
- `WEAK` (<5): Limited market signals

#### Key Files

| File | Purpose |
|------|---------|
| `src/lib/analysis/viability-calculator.ts` | `calculateHypothesisConfidence()`, `calculateMarketOpportunity()`, `TwoAxisInput` interface |
| `src/components/research/dual-verdict-display.tsx` | Two side-by-side score cards with gauges |
| `src/components/research/search-coverage-section.tsx` | "What We Searched" transparency |
| `src/components/research/adjacent-opportunities.tsx` | Pivot suggestions when hypothesis low |
| `src/lib/pdf/report-generator.ts` | PDF includes two-axis section |

#### Backward Compatibility

- Old results (without `filteringMetrics.coreSignals`): Show single-axis verdict only
- New results: Show both two-axis display AND legacy verdict
- `ViabilityVerdict` interface has optional `hypothesisConfidence` and `marketOpportunity` fields

### Engagement Transparency (Dec 29, 2025)

**Problem Solved:** Users couldn't distinguish high-engagement signals from low-engagement ones. All quotes looked equally valid.

**Solution:** Surface hidden engagement data that was already being collected but not displayed.

#### Data Flow

```
Arctic Shift API (score, num_comments)
       ↓
RedditPost (score, numComments)
       ↓
analyzePosts() / analyzeComments()
       ↓
PainSignal.source (upvotes, numComments)
       ↓
saveResearchResult() → JSON.stringify → Database
```

#### New Fields Added

| Interface | Field | Source |
|-----------|-------|--------|
| `PainSignal.source` | `upvotes` | post.score / comment.score |
| `PainSignal.source` | `numComments` | post.numComments |
| `PainSummary` | `discussionVelocity` | Calculated from timestamps |
| `ThemeAnalysis.keyQuotes` | `upvotes`, `numComments` | URL-matched from painSignals |

#### Discussion Velocity

Compares activity in recent 90 days vs previous 91-180 days:

```typescript
discussionVelocity: {
  percentageChange: number    // e.g., +36 or -20
  trend: 'rising' | 'stable' | 'declining'
  recentCount: number         // Posts in last 90 days
  previousCount: number       // Posts in 91-180 days
  confidence: 'low' | 'medium' | 'high'  // Based on sample size
}
```

**UI Display:** Market tab → Timing section alongside Google Trends, with "CALCULATED" badge.

#### Community Validated Badge

Signals with high engagement get a "Hot" badge:
- ≥100 upvotes OR ≥50 comments = "Community Validated"
- Displayed in both PainScoreCard (Signals tab) and QuoteCard (Quotes tab)

#### Confidence Intervals

TAM/SAM/SOM now show ranges instead of point estimates:
- Before: "~15.0M users"
- After: "10-20M users (±30%)"

#### Short Titles (Dec 28, 2025)

Research jobs now include a `short_title` field for better recognition:
- Before: "I think there's a market for productivity apps for remote workers who struggle with..."
- After: "Productivity apps for remote workers"

Generated via Claude (Haiku) during hypothesis interpretation. Stored in `research_jobs.coverage_data.shortTitle`.

**Key Files:**
| File | Changes |
|------|---------|
| `src/lib/analysis/pain-detector.ts` | `PainSignal.source.upvotes/numComments`, `PainSummary.discussionVelocity` |
| `src/lib/analysis/theme-extractor.ts` | keyQuotes enrichment via URL matching |
| `src/components/ui/quote-card.tsx` | EngagementDisplay component, "Hot" badge |
| `src/components/research/pain-score-card.tsx` | Engagement metrics display |
| `src/components/research/market-tab.tsx` | Discussion velocity card, TAM/SAM/SOM ranges |
| `src/app/api/research/interpret-hypothesis/route.ts` | Short title generation |
| `src/components/dashboard/research-job-list.tsx` | Short title display |

**Note:** Old research results won't have engagement data - only new research runs will populate these fields.

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
│   │       ├── page.tsx              # Hypothesis form + Coverage Preview
│   │       └── [id]/page.tsx         # Unified results view (5 tabs: Verdict, Community, Market, Timing, Competitors)
│   └── api/
│       ├── auth/callback/route.ts    # OAuth code exchange
│       ├── dev/login/route.ts        # Dev-only auth bypass
│       ├── admin/debug/route.ts      # Debug endpoint
│       ├── billing/
│       │   ├── checkout/route.ts     # LemonSqueezy checkout
│       │   └── webhook/route.ts      # LemonSqueezy webhook
│       └── research/
│           ├── coverage-check/route.ts          # Free data availability check
│           ├── community-voice/route.ts         # Reddit mining pipeline
│           ├── community-voice/stream/route.ts  # Streaming with progress
│           ├── pain-analysis/stream/route.ts    # Pain analysis streaming
│           ├── competitor-intelligence/route.ts # AI competitor analysis
│           ├── competitor-suggestions/route.ts  # AI competitor suggestions
│           └── jobs/route.ts                    # CRUD for research jobs
├── components/
│   ├── layout/header.tsx             # Navigation + auth status
│   ├── research/
│   │   ├── hypothesis-form.tsx       # Input form with examples
│   │   ├── coverage-preview.tsx      # Data availability preview
│   │   ├── community-voice-results.tsx # Pain themes, quotes, signals
│   │   ├── competitor-results.tsx    # Matrix, gaps, positioning
│   │   ├── viability-verdict.tsx     # Composite score dashboard
│   │   ├── research-progress.tsx     # Step progress indicator
│   │   ├── competitor-runner.tsx     # Inline competitor analysis runner
│   │   ├── research-trigger.tsx      # Auto-starts research + polling
│   │   ├── status-poller.tsx         # Status polling component
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
│   ├── embeddings/
│   │   ├── embedding-service.ts      # OpenAI embedding + caching
│   │   └── index.ts                  # Barrel exports
│   ├── lemonsqueezy/
│   │   └── server.ts                 # LemonSqueezy API client
│   ├── research/
│   │   └── save-result.ts            # Shared DB save utility
│   ├── reddit/
│   │   └── subreddit-discovery.ts    # AI subreddit finder
│   └── supabase/
│       ├── client.ts                 # Browser client
│       ├── server.ts                 # SSR client (cookies)
│       └── admin.ts                  # Service role (bypasses RLS)
└── types/
    ├── index.ts                      # TypeScript definitions
    └── supabase.ts                   # Generated DB types
```

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts (synced from auth.users) | `id`, `email`, `full_name`, `avatar_url`, `credits` |
| `research_jobs` | Research projects | `id`, `user_id`, `hypothesis`, `status`, `current_step`, `coverage_data` |
| `research_results` | Module outputs | `job_id`, `module_name`, `data` (JSONB) |
| `credit_transactions` | Credit history | `user_id`, `amount`, `balance_after`, `reason` |
| `credit_packs` | Purchasable credit packages | `credits`, `price_cents`, `stripe_price_id` |
| `reddit_cache` | Reddit data cache (24h TTL) | `subreddit`, `search_query`, `posts`, `expires_at` |
| `embedding_cache` | OpenAI embedding cache (pgvector) | `text_hash`, `embedding` (vector 1536), `model` |

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
| `/api/research/coverage-check` | POST | Check data availability (free) | Required |
| `/api/research/community-voice` | POST | Run Reddit mining + analysis | Required |
| `/api/research/community-voice/stream` | POST | Streaming research with progress | Required |
| `/api/research/pain-analysis/stream` | POST | Pain analysis with progress | Required |
| `/api/research/competitor-intelligence` | POST | Run competitor analysis | Required |
| `/api/research/competitor-suggestions` | POST | Get AI-suggested competitors | Required |
| `/api/research/jobs` | GET | List user's research jobs | Required |
| `/api/research/jobs` | POST | Create new research job | Required |
| `/api/research/jobs` | PATCH | Update job status | Required |
| `/api/billing/checkout` | POST | Create LemonSqueezy checkout | Required |
| `/api/billing/webhook` | POST | LemonSqueezy webhook handler | - |
| `/api/auth/callback` | GET | OAuth code exchange | - |
| `/api/dev/login` | POST | Dev-only auth bypass | Dev only |
| `/api/admin/debug` | GET | Debug info | Dev only |

### API Persistence Behavior (Important!)

The `/api/research/community-voice` endpoint behaves differently based on whether a `jobId` is provided:

| Scenario | Credit Deducted | Results Returned | Saved to DB |
|----------|-----------------|------------------|-------------|
| **With `jobId`** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Without `jobId`** | ✅ Yes | ✅ Yes | ❌ No |

**Why?** This is intentional design - allows stateless API calls for quick testing without polluting the database.

**Normal Flow (via UI):**
```
1. POST /api/research/jobs → Creates job, returns jobId
2. POST /api/research/community-voice with jobId → Processes & saves results
```

**Direct API Call (for testing):**
```
POST /api/research/community-voice without jobId → Credit deducted, results returned, NOT saved
```

**Code Location:** `src/app/api/research/community-voice/route.ts`
- Line 248: `const researchJobId = jobId || crypto.randomUUID()`
- Line 839: `if (jobId) { await saveResearchResult(...) }`

**Workaround for Testing:** Always create job first:
```bash
# Step 1: Create job
JOB=$(curl -s -X POST http://localhost:3000/api/research/jobs \
  -b /tmp/pvre-cookies.txt -H "Content-Type: application/json" \
  -d '{"hypothesis":"Your hypothesis here"}')
JOB_ID=$(echo $JOB | jq -r '.id')

# Step 2: Run research with job ID
curl -s -X POST http://localhost:3000/api/research/community-voice \
  -b /tmp/pvre-cookies.txt -H "Content-Type: application/json" \
  -d "{\"hypothesis\":\"Your hypothesis here\",\"jobId\":\"$JOB_ID\"}"
```

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
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations

# Anthropic (Required)
ANTHROPIC_API_KEY=your-anthropic-key

# OpenAI (Required for embedding pre-filter)
OPENAI_API_KEY=your-openai-key  # For semantic similarity filtering

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
| Pain Analysis | ✅ Complete | 100% | Real-time progress, relevance filtering |
| Competitor Intelligence | ✅ Complete | 100% | AI-powered analysis |
| Market Sizing | ✅ Complete | 100% | TAM/SAM/SOM Fermi estimation |
| Timing Analysis | ✅ Complete | 100% | Tailwinds/headwinds analysis |
| Viability Verdict | ✅ Complete | 100% | 4-dimension scoring with transparency UI |
| Research History | ✅ Complete | 100% | Dashboard with status |
| Coverage Preview | ✅ Complete | 100% | Free data availability check before committing credits |
| Interview Questions | ✅ Complete | Embedded | Part of Community Voice |
| PDF Export | ✅ Complete | 100% | Full report via jspdf |
| Test Suite | ✅ Complete | 100% | Vitest with 128 tests |
| Research Resilience | ✅ Complete | 100% | Browser warning, error tracking, auto-refund |
| Credits/Billing | ✅ Complete | 100% | LemonSqueezy integration |
| Admin Dashboard | ✅ Complete | 100% | Analytics + user management |
| View Unification | ✅ Complete | 100% | Single tabbed results view, removed wizard/steps views |
| Dark Mode | ❌ Not started | 0% | Priority: Low |

**Overall MVP: ~99% complete**

---

## Major Redesign: Q1 2025

A comprehensive UI/UX and data reliability redesign. See `docs/redesign/` for full details.

### Phase 1: Complete (Dec 23, 2025)

**Quick Wins Delivered:**

| Feature | Status | Details |
|---------|--------|---------|
| Trust Badges | ✅ Done | Visual badges distinguish VERIFIED, CALCULATED, AI-ESTIMATE data |
| Two-Axis Verdict | ✅ Done | Hypothesis Confidence + Market Opportunity (separate scores) |
| WTP in Hero | ✅ Done | WTP signals promoted to hero section visibility |
| Google Trends Integration | ✅ Done | Real trend data replaces AI speculation in timing module |
| AI Keyword Extraction | ✅ Done | Problem-focused keywords (not demographics), cached 7 days |

**Key Components Added:**

| Component | File | Purpose |
|-----------|------|---------|
| TrustBadge | `src/components/research/trust-badge.tsx` | Visual data source indicator |
| VerdictHero | `src/components/research/verdict-hero.tsx` | Two-axis display with gauges |
| QuoteCard | `src/components/research/quote-card.tsx` | Enhanced quote with engagement |
| Google Trends | `src/lib/data-sources/google-trends.ts` | API wrapper + AI keyword extraction |

### Phase 2: Dual-Layout (Dec 24, 2025) - Complete

**Dual-Layout Infrastructure Complete:**

| Component | File | Purpose |
|-----------|------|---------|
| fetchResearchData | `src/lib/research/fetch-research-data.ts` | Shared data fetching |
| ResearchDataProvider | `src/components/research/research-data-provider.tsx` | Data context |
| LayoutToggle | `src/components/research/layout-toggle.tsx` | Toggle UI |
| TabbedView | `src/components/research/layouts/tabbed-view.tsx` | Existing tabbed layout |
| ScrollView | `src/components/research/layouts/scroll-view.tsx` | New scroll layout (Beta) |
| ResultsLayout | `src/components/research/layouts/results-layout.tsx` | Layout switcher |

**Key Changes:**
- Results page reduced from ~1300 to ~400 lines
- Toggle persists in localStorage, URL param override available
- Both layouts share same data via Context provider

### Phase 3: Data Reliability (Dec 28-29, 2025) - Complete

**Engagement Transparency Delivered:**

| Feature | Status | Details |
|---------|--------|---------|
| Upvotes/Comments Display | ✅ Done | Visible on pain signals and quotes |
| Discussion Velocity | ✅ Done | Calculated from post timestamps, shows trend |
| "Hot" Badge | ✅ Done | Community-validated signals (≥100 upvotes or ≥50 comments) |
| Confidence Intervals | ✅ Done | TAM/SAM/SOM show ranges (±30%) |
| Short Titles | ✅ Done | Better hypothesis recognition on dashboard |

See "Engagement Transparency (Dec 29, 2025)" section above for full technical details.

### Remaining Phases

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 4 | Hacker News Algolia | Planned |
| Phase 5 | Gradual swap to scroll-only | Planned |
| Phase 6 | Polish, accessibility | Planned |

### Key Changes Summary

| Area | Before | After (Phase 1-3) |
|------|--------|-------------------|
| Data Reliability | 35% real | ~65% real (Google Trends + Discussion Velocity) |
| WTP Visibility | Buried in sub-tabs | Hero-level prominence |
| Trust Transparency | No distinction | Visual badges (Verified/Calculated/AI) |
| Trend Data | AI speculation | Real Google Trends API + Discussion Velocity |
| Engagement Visibility | Hidden | Upvotes, comments, "Hot" badges visible |
| Market Estimates | Point estimates | Ranges with ±30% confidence intervals |

**Full documentation:** `docs/redesign/MASTER_PLAN.md`

---

## Filtering Pipeline Architecture

**CRITICAL**: This section documents the filtering pipeline that controls AI costs. Bugs here cause cost overruns.

### Two-Stage Filter Pipeline (Dec 31, 2025)

**Status:** ✅ Production ready

The filtering pipeline uses a two-stage approach with cost-controlled AI verification:

```
┌────────────────────────────────────────────────────────────────────────┐
│                    TWO-STAGE FILTER PIPELINE                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  NormalizedPost[] (from any adapter)                                   │
│       ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 1: EMBEDDING FILTER (Loose, OpenAI ~$0.01)                 │ │
│  │                                                                  │ │
│  │ Threshold: 0.28 (loose to catch candidates)                      │ │
│  │ - Generate hypothesis embedding (problem-focused)                │ │
│  │ - Generate post embeddings (batch, cached in pgvector)           │ │
│  │ - Cosine similarity ≥ 0.28 → PASS                                │ │
│  │ - Query expansion for short hypotheses (≤3 words)                │ │
│  │                                                                  │ │
│  │ Output: ~150-300 semantically similar candidates                 │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ ~800-1100 candidates (from 2500 posts)                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 2: RANK + CAP (Cost Control)                               │ │
│  │                                                                  │ │
│  │ 1. Sort by embedding score (descending)                          │ │
│  │ 2. Take top 50 (AI_VERIFICATION_CAP)                             │ │
│  │                                                                  │ │
│  │ Guarantees fixed cost regardless of data volume                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ Exactly 50 posts (cost-capped)                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 3: HAIKU AI VERIFICATION (~$0.05)                          │ │
│  │                                                                  │ │
│  │ Model: claude-3-5-haiku-latest                                   │ │
│  │ Prompt: "Is this post SPECIFICALLY about [hypothesis]?"          │ │
│  │ Response: YES / NO only                                          │ │
│  │                                                                  │ │
│  │ Batches: 5 (10 per batch)                                        │ │
│  │ Rate limiting: 1.5s between batches                              │ │
│  │ Strict mode: Only "YES" passes                                   │ │
│  │                                                                  │ │
│  │ Output: ~10-16 verified signals (20-32% pass rate)               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ 10-16 verified, high-relevance signals                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Configuration (`src/lib/filter/config.ts`)

```typescript
export const FILTER_CONFIG = {
  EMBEDDING_THRESHOLD: 0.28,      // Loose to catch candidates
  HIGH_THRESHOLD: 0.50,           // High confidence threshold
  AI_VERIFICATION_CAP: 50,        // Max posts to verify (cost control)
  AI_MODEL: 'claude-3-5-haiku-latest',
  AI_STRICT: true,                // Only "YES" passes
  AI_MAX_TOKENS: 10,
  AI_BATCH_SIZE: 10,
} as const
```

### Key Files

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/filter/config.ts` | `FILTER_CONFIG` | All thresholds and caps |
| `src/lib/filter/universal-filter.ts` | `filterByEmbedding()` | Stage 1: Embedding filter |
| `src/lib/filter/ai-verifier.ts` | `verifyWithHaiku()` | Stage 3: AI verification |
| `src/lib/filter/index.ts` | `filterSignals()` | Full pipeline orchestration |
| `src/lib/adapters/types.ts` | `NormalizedPost` | Universal post interface |
| `src/lib/adapters/reddit-adapter.ts` | `normalizeRedditPosts()` | Reddit → NormalizedPost |

### Test Results (Dec 31, 2025)

| Hypothesis | Stage 1 | Stage 2 | Stage 3 | Rate |
|------------|---------|---------|---------|------|
| Freelancers struggling to get paid | 810 | 50 | 10 | 20% |
| Founders getting first customers | 1,086 | 50 | 16 | 32% |
| Developers frustrated with CI/CD | 776 | 50 | 16 | 32% |

**Key Metrics:**
- **Cost per search:** ~$0.06 (fixed)
- **Relevance:** 85-100% (based on sample title review)
- **Processing time:** ~33 seconds

### Cost Impact by Stage

| Stage | Model | Cost | Purpose |
|-------|-------|------|---------|
| Stage 1: Embeddings | OpenAI | ~$0.01 | Loose semantic filter |
| Stage 2: Cap | None | $0 | Cost control |
| Stage 3: Haiku | claude-3-5-haiku | ~$0.05 | Strict verification |
| **Total per search** | | **~$0.06** | Fixed regardless of data volume |

### Why Two-Stage?

**Problem:** Single embedding threshold (0.34) produced 100-150 signals but 30-50% were irrelevant.

**Solution:**
1. Lower threshold (0.28) catches more candidates
2. Cap at 50 ensures fixed cost
3. AI verification filters false positives

**Benefits:**
- **Cost predictability:** Always 50 max AI calls
- **High relevance:** Haiku filters false positives from embeddings
- **Scalability:** Can add more data sources without cost explosion

### Protected Code

The filter is locked to prevent accidental changes. See `src/lib/filter/LOCKED.md`.

**Files Protected:**
- `universal-filter.ts` — Core embedding filter
- `ai-verifier.ts` — Haiku verification
- `config.ts` — All thresholds and caps

**To Request Changes:**
1. Explain what's broken
2. Explain proposed fix
3. Wait for approval
4. Run full calibration test BEFORE and AFTER
5. Document results in LOCKED.md

### Adapter Pattern

The filter accepts any `NormalizedPost[]`, enabling multi-source support:

```typescript
interface NormalizedPost {
  id: string
  source: string           // 'reddit' | 'twitter' | 'trustpilot'
  title: string
  body: string
  author: string
  url: string
  createdAt: Date
  metadata: Record<string, unknown>  // Source-specific data
}
```

**Current Adapters:**
- `normalizeRedditPosts()` — Arctic Shift API posts

**Future Adapters:**
- Twitter/X
- Trustpilot reviews
- G2/Capterra reviews
- Hacker News

**Key Files:**
- `src/lib/embeddings/embedding-service.ts` — Core service with batch support + caching
- `src/lib/embeddings/index.ts` — Barrel exports
- `supabase/migrations/017_pgvector_embeddings.sql` — pgvector setup

**Database Schema:**
```sql
-- embedding_cache table with HNSW index
CREATE TABLE embedding_cache (
  id uuid PRIMARY KEY,
  text_hash text UNIQUE NOT NULL,
  text_preview text,
  embedding vector(1536),
  model text DEFAULT 'text-embedding-3-large',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON embedding_cache USING hnsw (embedding vector_cosine_ops);
```

**Requires:** `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` environment variables

---

## Cost Analysis

| Service | Per Research Run | Monthly (100 runs) |
|---------|------------------|-------------------|
| Arctic Shift | $0 | $0 |
| OpenAI Embeddings | ~$0.01 | ~$1 |
| Claude Haiku (filtering) | ~$0.05 | ~$5 |
| Claude Sonnet (analysis) | ~$0.05 | ~$5 |
| Supabase | $0 (free tier) | $0 |
| **Total** | **~$0.11** | **~$11** |

**Dec 31, 2025 Update:** Two-stage filter provides fixed, predictable cost (~$0.06 for filtering) regardless of data volume.

### Cost Breakdown by Stage

| Stage | Model | Cost | % of Total |
|-------|-------|------|------------|
| Embedding filter | OpenAI | ~$0.01 | 9% |
| Haiku verification (50 calls) | Haiku | ~$0.05 | 45% |
| Theme extraction | Sonnet | ~$0.02 | 18% |
| Pain detection | Sonnet | ~$0.02 | 18% |
| Other (sizing, questions) | Sonnet | ~$0.01 | 10% |

**Cost Control Features:**
1. **AI cap of 50** → Fixed Haiku cost regardless of input size
2. **Embedding caching** → Skip redundant embedding calls
3. **Batch processing** → Fewer API round-trips

---

## Key Dependencies

```json
{
  "next": "16.0.5",
  "react": "19.2.0",
  "@supabase/supabase-js": "^2.86.0",
  "@supabase/ssr": "^0.8.0",
  "@anthropic-ai/sdk": "^0.71.0",
  "openai": "^4.x",
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
- ~2000 requests/minute rate limit (very generous)
- No OAuth required
- Historical data access (years of posts)
- More reliable for bulk fetching
- Free forever
- **Limitation**: Multi-word full-text search times out; use subreddit + time filtering only

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
2. ~~**Test Suite**~~ - Vitest with 128 tests
3. ~~**Market Sizing Module**~~ - TAM/SAM/SOM Fermi estimation
4. ~~**Timing Module**~~ - Tailwinds/headwinds analysis
5. ~~**Research Resilience**~~ - Browser warnings, error tracking, auto-refund
6. ~~**Coverage Preview**~~ - Free data availability check before committing credits
7. ~~**Step-based Research Flow**~~ - Progressive 4-step workflow with real-time progress
8. ~~**Partial Results Display**~~ - Show completed modules while others process
9. ~~**Arctic Shift Query Pattern Fix**~~ - Fetch by subreddit only, Claude filters content
10. ~~**View Unification**~~ - Single tabbed results view, removed wizard/steps views

### Medium Term
1. **Pain Analysis Summary on Market Sizing** - Show what was discovered before asking for inputs
2. **Result Polling for Disconnected Users** - Let users see results even after closing browser
3. **Email Notifications** - Alert when research completes
4. **Crisp Chat Integration** - In-app support chat

### Long Term
6. **Team Sharing** - Collaborate on research
7. **Custom Data Sources** - Twitter, forums, G2 reviews
8. **Historical Tracking** - Score changes over time
9. **Dark Mode** - UI theme toggle

---

## Behavioral Insights

*For behavioral scientists and business developers working with the dev team.*

### Friction Points (Drop-off Risk)

| Friction | Location | Impact |
|----------|----------|--------|
| Google-only OAuth | `/login` | No alternative for users without Google accounts |
| Hypothesis minimum (10 chars) | `/research` | Low - prevents trivial inputs |
| Coverage preview step | `/research` | Medium - adds friction but reduces commitment anxiety |
| 30-70s wait time | Processing | High - tab must stay open |
| Credit requirement | `/research` | Medium - deters low-commitment users |

### Decision Moments

| Moment | Trigger | Mitigation |
|--------|---------|------------|
| Landing → Login | User decides to try | "Free · No credit card" messaging |
| Dashboard → Research | User starts new research | Clear "Start" vs "Continue" paths |
| Hypothesis → Coverage | User checks data availability | FREE preview reduces risk perception |
| Coverage → Proceed | User commits credit | Color-coded confidence guides decision |
| Community → Competitors | User continues research | Banner prompts next step |

### Anxiety Mitigation

| Anxiety | User Thought | Mitigation |
|---------|--------------|------------|
| "Is it stuck?" | No visual feedback | Live poll count + progress steps |
| "Will I lose my credit?" | Fear of wasted money | Tab warning + auto-refund on failure |
| "How long will this take?" | Uncertainty | "30-70 seconds" timing shown |
| "Is this data trustworthy?" | Quality concerns | Data quality card + filtering transparency |
| "What do I do next?" | Analysis paralysis | CTAs on every tab + recommendations list |

### Trust Builders

- **Social proof:** Testimonials on landing page
- **Transparency:** Data quality card shows filtering metrics
- **Attribution:** "Mom Test" reference for interview questions
- **Confidence indicators:** Score confidence levels shown
- **Research metadata:** Date ranges and sources visible

### Key UI Components by Purpose

| Purpose | Component | File |
|---------|-----------|------|
| Reduce blank-page anxiety | Example hypothesis buttons | `hypothesis-form.tsx` |
| Show progress during wait | Research trigger + poller | `research-trigger.tsx` |
| Build trust in results | Data quality card | `community-voice-results.tsx` |
| Guide next actions | Recommendations card | `viability-verdict.tsx` |
| Enable competitor input | Known competitors field | `competitor-runner.tsx` |

---

## Code Standards

*Practices that prevent bugs before they reach production.*

### The 4 Pillars

#### 1. Type Safety - Generate Database Types

```bash
# After any schema change
npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts
```

Use typed clients everywhere:
```typescript
import { Database } from '@/types/supabase'
export function createAdminClient() {
  return createClient<Database>(url, key)
}
```

#### 2. Single Source of Truth - Shared Utilities

Don't copy-paste database operations. Use:
```typescript
// src/lib/research/save-result.ts
await saveResearchResult(jobId, 'pain_analysis', data)
```

Type-safe module names prevent typos:
```typescript
type ModuleName = 'pain_analysis' | 'market_sizing' | 'timing_analysis' | 'competitor_intelligence' | 'community_voice'
```

#### 3. Defensive Architecture - JSON Serialization

Always serialize complex objects before DB save:
```typescript
data: JSON.parse(JSON.stringify(myResult))
```

#### 4. Test Coverage - Integration Tests

UI tests aren't enough. Test the data layer:
```typescript
await saveResearchResult(testJobId, 'pain_analysis', mockData)
const { data } = await adminClient.from('research_results').select('*').eq('job_id', testJobId).single()
expect(data?.module_name).toBe('pain_analysis')
```

### Pre-Commit Checklist

```bash
npm run build    # Catches type errors dev mode misses
npm run test:run # 128+ tests must pass
```

### Common Pitfalls

| Pitfall | Do This Instead |
|---------|-----------------|
| Copy-paste DB operations | Use shared utilities |
| `any` type | Define proper types or use `unknown` |
| String column names | Generate DB types |
| Testing only UI | Add integration tests |
| Skipping `npm run build` | Always build before commit |

### Key Files

| File | Purpose |
|------|---------|
| `src/types/supabase.ts` | Auto-generated database types |
| `src/lib/research/save-result.ts` | Shared save utility |
| `src/lib/supabase/admin.ts` | Typed admin client |
| `src/__tests__/research-flow.integration.test.ts` | Data layer tests |

---

## Troubleshooting

### Common Issues

**"Results Not Available" on old research**
- Research jobs created before persistence was added won't have saved results
- Solution: Run new research

**Pain Analysis fails to save**
- Check migration 011 was applied (adds `pain_analysis` to module_name constraint)
- Solution: Run `supabase/migrations/011_fix_module_name_constraint.sql`

**Competitor Analysis fails to save**
- Check migration 012 was applied (adds `competitor_intelligence` to module_name constraint)
- Solution: Run `supabase/migrations/012_fix_competitor_intelligence_constraint.sql`

**Auth redirect loops**
- Clear cookies and try again
- Check Supabase auth configuration in dashboard

**Slow research processing**
- Normal processing time is 60-180 seconds
- Arctic Shift requests are fast (0.2-0.5s each)
- Most time is spent on Claude API calls for relevance filtering
- Progress updates show real-time status

**Arctic Shift 422 Timeout errors**
- Multi-word `query` or `body` parameters cause server-side timeouts
- Solution: Don't use query/body params - fetch by subreddit + time range only
- Claude relevance filter handles content filtering instead

**Claude API errors**
- Check ANTHROPIC_API_KEY is valid
- Ensure sufficient API credits
- Rate limits: 60 requests/minute on free tier

**JSON Parsing errors in analysis**
- The extractJSONArray() function handles malformed Claude responses
- Multiple fallback strategies: direct parse, array extraction, markdown block extraction

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
