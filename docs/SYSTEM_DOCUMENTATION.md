# PVRE - Complete System Documentation

*Last updated: January 12, 2026 (Added Section 19: Arctic Shift Multi-User Rate Limiting)*

> **THE ONE DOCUMENT** - This consolidates all technical documentation for PVRE. For bugs and fixes, see `KNOWN_ISSUES.md`. For session handoffs, see `RESUME_HERE.md`.

---

## Table of Contents

1. [Overview & Value Proposition](#1-overview--value-proposition)
2. [Tech Stack & External APIs](#2-tech-stack--external-apis)
3. [User Journey](#3-user-journey)
4. [Research Pipeline (Input → Processing)](#4-research-pipeline-input--processing)
   - 4.1 Two Research Modes
   - 4.2 Hypothesis Mode Flow
   - 4.3 App-Centric Mode Flow
   - 4.4 Quality Preview Modal
   - 4.5 Adaptive Time-Stratified Fetching
5. [Filtering Pipeline](#5-filtering-pipeline)
   - 5.1 Current Production Pipeline
   - 5.2 Planned Two-Stage Filter
6. [Analysis Pipeline](#6-analysis-pipeline)
   - 6.1 Pain Signal Detection
   - 6.2 Theme Extraction
   - 6.3 Competitor Intelligence
   - 6.4 Interview Questions
   - 6.5 Market Sizing & Timing
7. [Results Page Architecture](#7-results-page-architecture)
   - 7.1 Data Flow Overview
   - 7.2 Mode Detection
   - 7.3 Tab Structure
   - 7.4 Component Hierarchy
   - 7.5 Score Display Locations
8. [Viability Verdict & Scoring](#8-viability-verdict--scoring)
   - 8.1 Formula & Weights
   - 8.2 Two-Axis Verdict System
   - 8.3 Data Quality Considerations
9. [Database Schema](#9-database-schema)
10. [API Endpoints](#10-api-endpoints)
11. [Project Structure](#11-project-structure)
12. [Implementation Status](#12-implementation-status)
13. [Code Standards](#13-code-standards)
14. [Configuration & Running Locally](#14-configuration--running-locally)
15. [Troubleshooting](#15-troubleshooting)
16. [Cost Analysis](#16-cost-analysis)
17. [Key Files Reference](#17-key-files-reference)
18. [Mode-Specific Code Paths & Filters](#18-mode-specific-code-paths--filters)
   - 18.1 Module Registry
   - 18.2 Data Flow Diagrams
   - 18.3 FILT-002: App Name Gate
   - 18.4 DISP-001: Categorization Logic
   - 18.5 Mode Boundary Rules
   - 18.6 Pre-Fix Testing Checklist
19. [Arctic Shift Multi-User Rate Limiting](#19-arctic-shift-multi-user-rate-limiting)
   - 19.1 Architecture Overview
   - 19.2 Dual-Queue System
   - 19.3 Request Coalescing
   - 19.4 Per-Job Fairness
   - 19.5 Elastic Rate Adjustment
   - 19.6 Queue Telemetry & ETA
   - 19.7 Key Files

---

## 1. Overview & Value Proposition

PVRE is an **AI-powered pre-validation research tool** that helps founders assess business idea viability before building. Users enter a hypothesis (e.g., "Remote workers struggle with async communication") and the platform:

1. **Mines Reddit** for real customer pain points via Arctic Shift API
2. **Scores pain intensity** using 150+ keyword patterns + WTP signals
3. **Analyzes competitors** to map the competitive landscape
4. **Calculates a Viability Verdict** combining pain + competition scores
5. **Generates interview questions** to validate findings with real users

### The Core Value Proposition
> "From hypothesis to interview-ready in 5 minutes, not 5 weeks"

---

## 2. Tech Stack & External APIs

### 2.1 Tech Stack

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

### 2.2 External APIs

#### Arctic Shift API (Free)
- **Purpose**: Access Reddit posts and comments
- **URL**: `https://arctic-shift.photon-reddit.com`
- **Auth**: None required (public API)
- **Cost**: $0
- **Endpoints Used**:
  - `/api/posts/search` - Search posts by subreddit
  - `/api/comments/search` - Search comments by subreddit
- **Rate Limiting**: ~2000 requests/minute (very generous)
- **Multi-User Architecture**: Dual-queue rate limiter with coverage priority, request coalescing, and per-job fairness. See **Section 19** for full architecture.
- **Known Issue**: Multi-word `query` and `body` params cause server-side timeouts (422 errors). Fetch by subreddit + time range only; Claude relevance filter handles content filtering.

#### Google Trends API (Free)
- **Purpose**: Real trend data for timing analysis (replacing AI speculation)
- **Package**: `google-trends-api` npm package
- **Auth**: None required
- **Cost**: $0
- **Features**:
  - `interestOverTime` - 12-month trend data for keywords
  - Trend direction detection (rising/stable/falling)
  - Percentage change calculation
- **Caching**: 24 hours per keyword set (in-memory)
- **AI Keyword Extraction**: Uses Claude to extract problem-focused keywords from hypothesis. Keywords are cached 7 days for deterministic results.
- **Fallback**: Graceful degradation if API fails - AI estimates shown with trust badge

**Key Files:**
- `src/lib/data-sources/google-trends.ts` - API wrapper + keyword extraction
- `src/lib/analysis/timing-analyzer.ts` - Integrates trends into timing score

#### Anthropic Claude API (Paid)
- **Purpose**: AI analysis, theme extraction, competitor research, subreddit discovery
- **Models Used**:

| Model | Use Case | Cost per Run |
|-------|----------|--------------|
| `claude-3-haiku-20240307` | Subreddit discovery (fast, cheap) | ~$0.001 |
| `claude-sonnet-4-20250514` | Deep analysis, competitor intel, keyword extraction | ~$0.05-0.10 |

- **Total cost per full research**: ~$0.05-0.15

#### OpenAI Embeddings API (Paid)
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
- **Impact**: 75% reduction in Haiku API calls

**Key Files:**
- `src/lib/embeddings/embedding-service.ts` - Core embedding service
- `src/lib/embeddings/index.ts` - Barrel exports

#### Supabase (Freemium)
- **Purpose**: PostgreSQL database + Google OAuth + Row Level Security
- **Free Tier**: 500MB DB, 50k monthly active users
- **Features Used**: Auth, Database, RLS policies

---

## 3. User Journey

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Landing    │───▶│   Login     │───▶│  Dashboard  │───▶│  Research   │───▶│   Results   │
│   Page      │    │  (Google)   │    │             │    │   Input     │    │   (Tabs)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     /                /login            /dashboard          /research        /research/[id]
```

### 3.1 Landing Page (`/`)

| Section | Content | Purpose |
|---------|---------|---------|
| Header | Logo + "How It Works" + "Sign In" + "Get Started" | Navigation |
| Hero | "Know if your idea has legs in 5 minutes, not 5 weeks" | Value prop |
| Problem | "90% of startups fail from building the wrong thing" (red pulsing) | Pain trigger |
| Old Way | 4 icons showing manual validation pain | Problem amplification |
| Features | Community Voice, Competitor Intel, 4-Dimension Verdict cards | Solution preview |
| Social Proof | 2 testimonial quotes | Trust building |
| Footer CTA | "Stop guessing. Start validating." | Conversion |

### 3.2 Authentication (`/login`)

- Single "Sign in with Google" OAuth button
- Auto-creates account for first-time users
- Redirects to `/dashboard` after auth

### 3.3 Dashboard (`/dashboard`)

| Section | Content | Condition |
|---------|---------|-----------|
| Welcome | "Welcome back, [First Name]!" | Always |
| Start New Research | Card with 4 feature badges + button | Always |
| Continue Your Research | Highlighted card with next step | If incomplete job exists |
| Recent Research | List of last 10 jobs with status badges | If jobs exist |

**Status Badges:** Completed (green), Processing (blue + spinner), Failed (red), [Step Name] (outline)

### 3.4 Research Input (`/research`)

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

### 3.5 Processing States

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

### 3.6 Results Page (`/research/[id]`)

**Header:** Back button, hypothesis, metadata, PDF download, status badge

**Progress Stepper:** Community Voice → Competitor Analysis → Viability Verdict

### Credit System

- **1 credit** charged upfront at research trigger
- Same credit covers all 4 modules (pain, market, timing, competitor)
- **Auto-refund** on failure (not shown in UI, balance restored)
- Header badge shows current balance

---

## 4. Research Pipeline (Input → Processing)

### 4.1 Two Research Modes

| Mode | Trigger | Data Sources | Focus |
|------|---------|--------------|-------|
| **Hypothesis Mode** | User describes problem/audience | Reddit + HN + app stores | "Is this problem worth solving?" |
| **App-Centric Mode** | User pastes app URL | App reviews + Reddit + HN | "Can I build a better competitor?" |

### 4.2 Hypothesis Mode Flow

```
USER INPUT (hypothesis text)
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Interpret Hypothesis (Claude Sonnet)               │
│  → audience, problem, searchPhrases, appDiscovery context   │
│                                                             │
│  Step 2: Find Subreddits (Claude Haiku × 3 prompts)         │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  COVERAGE CHECK + QUALITY PREVIEW                           │
│                                                             │
│  → Fetch sample posts from each source                      │
│  → Run sampleQualityCheck() (Haiku domain gate on sample)   │
│  → Show Quality Preview Modal to user                       │
│  → User confirms or refines hypothesis                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Fetch Multi-Source Data                            │
│  ├── Reddit (Arctic Shift) ✅ 500-800 posts                 │
│  ├── Google Play ✅ Reviews from matching apps              │
│  ├── App Store ✅ Reviews from matching apps                │
│  ├── Hacker News ✅ Stories + comments (if enabled)         │
│  └── Trustpilot ❌ Adapter exists, NOT integrated           │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  FILTERING PIPELINE (see Section 5)                         │
│  Result: ~50-150 embedding-filtered posts                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  ANALYSIS PIPELINE (see Section 6)                          │
│                                                             │
│  Pain Detection → Theme Extraction → Competitor Intel       │
│  → Interview Questions → Market + Timing                    │
└─────────────────────────────────────────────────────────────┘
    ↓
RESULTS PAGE (Hypothesis tabs: Summary, Evidence, Market, Action)
```

#### Step 1: Hypothesis Interpretation

**Files involved:**
- `src/app/api/research/interpret-hypothesis/route.ts`

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Claude analyzes the user's hypothesis and extracts:
- `audience` - Who is experiencing the problem
- `problem` - What the problem is
- `problemDomain` - The category/domain (e.g., "fitness motivation")
- `searchPhrases` - Keywords for Reddit/HN search
- `targetSubreddits` - Suggested communities
- `refinementSuggestions` - Ways to improve the hypothesis
- `appDiscovery` - Context for app store searches

#### Step 2: Find the Right Reddit Communities

**Files involved:**
- `src/lib/reddit/subreddit-discovery.ts`

**Who talks to who:** Server → Claude AI (Haiku model)

**What happens:** Claude figures out which subreddits discuss this problem. This is a 3-stage process:

1. **Domain Extraction:** Claude identifies the *problem domain* (not just the audience)
   - "Solo Hyrox athletes with motivation issues" → Domain = "fitness training motivation"

2. **Subreddit Discovery:** Claude suggests 8-12 relevant communities
   - Example: r/crossfit, r/Hyrox, r/fitness, r/homefitness

3. **Validation:** Claude double-checks each suggestion
   - Rejects subreddits that match the audience but NOT the problem

#### Step 3: Fetch Data from Multiple Sources

**Files involved:**
- `src/lib/data-sources/arctic-shift.ts` (Reddit)
- `src/lib/data-sources/adapters/google-play-adapter.ts`
- `src/lib/data-sources/adapters/app-store-adapter.ts`
- `src/lib/data-sources/adapters/hacker-news-adapter.ts`

**Reddit (Arctic Shift):**
- For each subreddit from Step 2, download up to 100-450 posts depending on depth setting
- We do NOT use `query` or `body` params - multi-word searches cause 422 timeouts
- Fetch by subreddit + time range only; Claude filters for relevance
- Uses adaptive time windows (see 4.5)

**Google Play & App Store:**
- Always checked (not just for mobile keywords)
- Uses multi-query discovery strategy
- Each app scored by Claude for relevance (0-10)
- Top apps' reviews fetched and converted to pipeline format

**Hacker News:**
- Search Algolia API with single primary keyword
- Fetch up to 50 stories + comments

**Result:** 500-1,000+ raw posts from all sources combined

### 4.3 App-Centric Mode Flow

```
USER INPUT (app URL)
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step A1: Parse App URL                                     │
│  Step A2: Fetch App Details (name, rating, description)     │
│  Step A3: Generate Problem Description (Claude Sonnet)      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  COVERAGE CHECK + QUALITY PREVIEW (same as hypothesis)      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step A4: Fetch App-Specific Reviews                        │
│  → getReviewsForAppId() - fetches BY APP ID, not keywords   │
│  → App Store: up to 100 reviews (paginated, 50/page)        │
│  → Google Play: up to 100 reviews (single request)          │
│                                                             │
│  Step A5: Also fetch Reddit/HN data (using generated terms) │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  SAME FILTERING + ANALYSIS PIPELINE                         │
└─────────────────────────────────────────────────────────────┘
    ↓
RESULTS PAGE (App tabs: App, Feedback, Market, Gaps, Verdict)
```

**Key difference from hypothesis mode:** Reviews are fetched by app ID, not by keyword search. This ensures we analyze reviews FOR THE SPECIFIC APP being researched.

### 4.4 Quality Preview Modal (Pre-Research Gate)

**Files involved:**
- `src/components/research/quality-preview-modal.tsx`
- `src/lib/research/relevance-filter.ts` → `sampleQualityCheck()`

**What happens:** Before spending credits, we sample posts to predict quality:

1. Take 40 random posts from selected communities
2. Run quality gate (free code-based filters)
3. Run embedding similarity check (OpenAI - ~$0.005)
4. Calculate predicted relevance: `(embeddingPassed / sampleSize) × 100`

**Displays to user:**

| Field | Purpose |
|-------|---------|
| **Predicted Relevance %** | Estimated % of posts that will match (0-100) |
| **Confidence Level** | very_low, low, medium, high |
| **Sample Posts** | Up to 3 posts that look relevant |
| **Filtered Topics** | What topics we're filtering OUT |
| **Broadening Suggestions** | Actionable ways to improve |
| **Removed Post Rate** | Warning if 30%+ of posts are deleted |

**Warning Thresholds:**

| Warning Level | Predicted Relevance | User Action Required |
|---------------|---------------------|---------------------|
| `strong_warning` | < 8% | Checkbox confirmation required |
| `caution` | 8-20% | Warning shown, can proceed |
| `none` | > 20% | Good to go |

### 4.5 Adaptive Time-Stratified Fetching (Reddit)

**Files involved:**
- `src/lib/data-sources/arctic-shift.ts` → `searchPosts()`, `getTimeWindows()`
- `src/lib/arctic-shift/rate-limiter.ts` → `rateLimitedFetch()`

**The Problem Solved:**
Before this system, fetching "100 recent posts" from active subreddits like r/entrepreneur only got 2-3 days of data. For market research, we need months of data to find recurring pain patterns.

**How It Works:**

1. **Posting Velocity Calculation:**
   ```
   postsPerDay = 100 / ((newest_timestamp - oldest_timestamp) / 86400)
   ```

2. **Activity Classification:**

   | Activity Level | Posts/Day | Time Windows |
   |----------------|-----------|--------------|
   | HIGH | >20 | 3 windows: [0-30d], [30-180d], [180-365d] |
   | MEDIUM | 5-20 | 2 windows: [0-90d], [90-365d] |
   | LOW | <5 | 1 window: [0-365d] |

3. **Adaptive Fetching:**
   For each subreddit, we fetch from multiple time windows to ensure year-round coverage.

**Analysis Depth Presets:**

| Depth | Posts/Subreddit | Time Coverage |
|-------|-----------------|---------------|
| **Quick** | 150 | 2+ months |
| **Standard** | 300 | 6+ months |
| **Deep** | 450 | Full year |

**Rate Limiter (Concurrent Users):**
The `bottleneck` library manages concurrent API requests:
- Max 20 parallel requests
- 50ms minimum between requests (20/sec sustained)
- Burst protection with token reservoir

---

## 5. Filtering Pipeline

**CRITICAL**: This section documents the filtering pipeline that controls AI costs. Bugs here cause cost overruns.

### 5.1 Current Production Pipeline

**Status:** ✅ In production (`src/lib/research/relevance-filter.ts`)

```
┌────────────────────────────────────────────────────────────────────────┐
│               CURRENT PRODUCTION PIPELINE                               │
│               (SKIP_AI_GATES = true)                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Raw posts from data sources                                           │
│       ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STEP 1: QUALITY GATE (Code only, FREE)                           │ │
│  │                                                                  │ │
│  │ qualityGateFilter():                                             │ │
│  │ - Remove deleted: [removed], [deleted], [unavailable]            │ │
│  │ - Remove too short: Less than 50 characters                      │ │
│  │ - Remove non-English content                                     │ │
│  │ - Remove spam: "follow me", "click here", "subscribe"            │ │
│  │ - KEEP title-only posts (marked, weighted 0.7x)                  │ │
│  │                                                                  │ │
│  │ Result: ~80-90% of posts survive                                 │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STEP 2: PRE-FILTER RANK (Code only, FREE)                        │ │
│  │                                                                  │ │
│  │ preFilterAndRank():                                              │ │
│  │ - Score by first-person language (40% weight)                    │ │
│  │ - Score by engagement (upvotes, comments)                        │ │
│  │ - Score by recency                                               │ │
│  │ - Take top 150 candidates                                        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ ~150 posts                                                     │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STEP 3: KEYWORD GATE (Code only, FREE)                           │ │
│  │                                                                  │ │
│  │ extractProblemFocus(hypothesis) → keywords + problemText         │ │
│  │ passesKeywordGate(post, keywords) → must contain 1+ keyword      │ │
│  │                                                                  │ │
│  │ Filters posts that don't mention the problem at all              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ ~80-120 posts                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STEP 4: EMBEDDING FILTER (OpenAI, ~$0.01)                        │ │
│  │                                                                  │ │
│  │ generateEmbedding(hypothesis) — HYPOTHESIS ONLY (deterministic)  │ │
│  │ generateEmbeddings(posts) — Batch, cached in pgvector            │ │
│  │                                                                  │ │
│  │ Thresholds:                                                      │ │
│  │ - HIGH (≥0.50): Strong match → CORE tier                         │ │
│  │ - MEDIUM (0.35-0.50): Related → CORE tier                        │ │
│  │ - LOW (<0.35): Filtered out                                      │ │
│  │                                                                  │ │
│  │ Coverage boost: +0.08 for thin-data hypotheses                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ ~50-150 embedding-filtered posts                               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ AI GATES — SKIPPED (SKIP_AI_GATES = true)                        │ │
│  │                                                                  │ │
│  │ Domain Gate (Haiku) — DISABLED                                   │ │
│  │ Problem Match (Haiku) — DISABLED                                 │ │
│  │                                                                  │ │
│  │ Reason: Calibrated embeddings handle relevance sufficiently      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ All posts pass to analysis (all in CORE tier)                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Design Decision (Dec 2025):**
Embeddings use `hypothesis` ONLY, not `problemText` or keywords. Why? Keywords vary between runs (Claude generates different ones each time). Pure hypothesis is deterministic.

**Key Files (Production):**

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/research/relevance-filter.ts` | `filterRelevantPosts()` | Main pipeline |
| `src/lib/research/relevance-filter.ts` | `filterRelevantComments()` | Comments pipeline |
| `src/lib/embeddings/embedding-service.ts` | `generateEmbedding()` | Embedding generation |

**Cost:** ~$0.01 per search (embeddings only, no Haiku calls)

### 5.2 Planned Two-Stage Filter Module (NOT YET INTEGRATED)

**Status:** ⏳ Built & tested, NOT integrated into production

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
│  │                                                                  │ │
│  │ Output: ~800-1100 semantically similar candidates                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ ~800-1100 candidates                                           │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 2: RANK + CAP (Cost Control)                               │ │
│  │                                                                  │ │
│  │ 1. Sort by embedding score (descending)                          │ │
│  │ 2. Take top 50 (AI_VERIFICATION_CAP)                             │ │
│  │                                                                  │ │
│  │ Guarantees fixed cost regardless of data volume                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ Exactly 50 posts (cost-capped)                                 │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 3: HAIKU AI VERIFICATION (~$0.05)                          │ │
│  │                                                                  │ │
│  │ Model: claude-3-5-haiku-latest                                   │ │
│  │ Prompt: "Is this post SPECIFICALLY about [hypothesis]?"          │ │
│  │ Response: YES / NO only                                          │ │
│  │                                                                  │ │
│  │ Batches: 5 (10 per batch)                                        │ │
│  │ Rate limiting: 1.5s between batches                              │ │
│  │                                                                  │ │
│  │ Output: ~10-16 verified signals (20-32% pass rate)               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│       ↓ 10-16 verified, high-relevance signals                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Configuration (`src/lib/filter/config.ts`):**

```typescript
export const FILTER_CONFIG = {
  EMBEDDING_THRESHOLD: 0.28,      // Loose to catch candidates
  HIGH_THRESHOLD: 0.50,           // High confidence threshold
  AI_VERIFICATION_CAP: 50,        // Max posts to verify (cost control)
  AI_MODEL: 'claude-3-5-haiku-latest',
  AI_STRICT: true,                // Only "YES" passes
} as const
```

**Test Results (Dec 31, 2025 - isolated testing):**

| Hypothesis | Stage 1 | Stage 2 | Stage 3 | Pass Rate |
|------------|---------|---------|---------|-----------|
| Freelancers struggling to get paid | 810 | 50 | 10 | 20% |
| Founders getting first customers | 1,086 | 50 | 16 | 32% |
| Developers frustrated with CI/CD | 776 | 50 | 16 | 32% |

**To Deploy:** Replace `filterRelevantPosts()` import in `community-voice/route.ts` with `filterSignals()` from `src/lib/filter/`

---

## 6. Analysis Pipeline

### 6.1 Pain Signal Detection

**Files involved:**
- `src/lib/analysis/pain-detector.ts`

**Who talks to who:** Just code - pattern matching

**What happens:** The system scans posts for "pain signals" - phrases that indicate real problems:
- Frustration markers: "I hate...", "so annoying", "drives me crazy"
- Problem admission: "I struggle with...", "can't seem to..."
- Need expression: "I wish there was...", "if only..."
- Financial pain: "costs too much", "can't afford"

Each pain signal gets:
- **Severity score** (1-10)
- **Tier** (CORE or RELATED based on relevance)
- **Source** (reddit, google_play, app_store)
- **Weight** (0.7x for title-only posts)

### 6.2 Theme Extraction

**Files involved:**
- `src/lib/analysis/theme-extractor.ts`

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Claude reads all the pain signals and groups them into themes.

**Multi-Source Tracking:**
Each theme tracks which sources contributed:
- `sources: ['reddit', 'google_play', 'app_store']`
- Counts: `redditCount`, `googlePlayCount`, `appStoreCount`

**Tier-Based Prioritization:**
- Analyzes CORE signals first, then RELATED
- Themes from mainly RELATED signals prefixed with `[CONTEXTUAL]`
- Each theme has `tier: 'core' | 'contextual'`

**Example output:**
- Theme 1: "Lack of accountability" (35% of signals) - core
- Theme 2: "Can't push to failure alone" (25% of signals) - core
- Theme 3: "[CONTEXTUAL] Boring repetitive workouts" (20% of signals) - contextual

### 6.3 Competitor Intelligence

**Files involved:**
- `src/lib/analysis/theme-extractor.ts` → competitor analysis

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Claude identifies competitors mentioned in the pain signals.

**Enhanced Competitor Intelligence:**
- `isActualProduct: boolean` - Claude assesses if it's a real product
- Categories: `direct_competitor | adjacent_solution | workaround`
- Includes `mentionCount`, `sentiment`, `context`, `confidence`

**Strategic Recommendations:**
Based on actual data signals, returns actionable recommendations:
- Action format: "Action verb + specific tactic"
- Example: "Position around 'hassle-free' messaging based on 23 mentions"

### 6.4 Interview Question Generation

**Files involved:**
- `src/lib/analysis/theme-extractor.ts` → `generateInterviewQuestions()`

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Based on the themes, Claude generates questions the user could ask in customer interviews.

**Example output:**
- "How do you stay motivated during solo training sessions?"
- "What happens when you hit a wall without a training partner?"
- "Have you tried any tools or methods to simulate accountability?"

### 6.5 Market Sizing & Timing Analysis

**Files involved:**
- `src/lib/analysis/market-sizing.ts`
- `src/lib/analysis/timing-analyzer.ts`

**Who talks to who:** Server → Claude AI (Sonnet model) + Google Trends API

**What happens:** Claude estimates:
- **Market size:** TAM/SAM/SOM with confidence intervals
- **Timing:** Tailwinds, headwinds, timing window
- **Trends:** Real Google Trends data integrated where available

---

## 7. Results Page Architecture

### 7.1 Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCE (Supabase)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  research_jobs   │  │ research_results │  │       profiles           │  │
│  │  - hypothesis    │  │ - community_voice│  │  - credits_balance       │  │
│  │  - status        │  │ - competitor_intel│ │                          │  │
│  │  - coverage_data │  │ - market_sizing  │  │                          │  │
│  │  - mode          │  │ - timing_analysis│  │                          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  fetchResearchData() (fetch-research-data.ts:122)           │
│                                                                             │
│  1. Fetch job by ID, verify user ownership                                  │
│  2. Fetch all research_results for job                                      │
│  3. Extract results by module_name:                                         │
│     - community_voice / pain_analysis                                       │
│     - competitor_intel / competitor_intelligence                            │
│     - market_sizing                                                         │
│     - timing_analysis                                                       │
│  4. Calculate score inputs (painScoreInput, competitionScoreInput, etc.)    │
│  5. Calculate viability via calculateViability()                            │
│  6. Add red flags from filtering metrics                                    │
│  7. Return ResearchPageData bundle                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  ResearchDataProvider (Context)                             │
│                  Wraps entire results page                                  │
│                                                                             │
│  Provides: job, communityVoiceResult, competitorResult, marketData,         │
│            timingData, viabilityVerdict, filteringMetrics, appData,         │
│            isAppAnalysis, painScoreInput, etc.                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ResultsLayout → TabbedView                           │
│                        (Main orchestration component)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Mode Detection

The mode is detected from `job.coverage_data.mode`:
- `'app-analysis'` → **App Search Mode** (5 tabs)
- Otherwise → **Hypothesis Search Mode** (4 tabs)

```typescript
// tabbed-view.tsx:47
const isAppAnalysis = data.isAppAnalysis
// Determined in fetch-research-data.ts from coverage_data.mode === 'app-analysis'
```

### 7.3 Tab Structure

#### HYPOTHESIS SEARCH MODE (4 tabs)

```
┌─────────┬─────────┬─────────┬─────────┐
│ Summary │Evidence │ Market  │ Action  │
└─────────┴─────────┴─────────┴─────────┘
```

| Tab | Component | What It Displays |
|-----|-----------|------------------|
| **Summary** | `SummaryTab` | Key insights, DualVerdictDisplay, ScoreBreakdownCard, MarketCard, TimingCard, CompetitionCard, RedFlagsCard |
| **Evidence** | `EvidenceTab` | Pain signals, themes, quotes (4 sub-tabs: Overview, Themes, Signals, Quotes) |
| **Market** | `MarketTab` | TAM/SAM/SOM, timing analysis, competitors, Google Trends |
| **Action** | `ActionTab` | Next steps, interview guide |

#### APP SEARCH MODE (5 tabs)

```
┌─────────┬──────────┬─────────┬───────────┬─────────┐
│   App   │ Feedback │ Market  │   Gaps    │ Verdict │
└─────────┴──────────┴─────────┴───────────┴─────────┘
```

| Tab | Component | What It Displays |
|-----|-----------|------------------|
| **App** | `AppOverview` | App icon, name, rating, reviews, store, category, description |
| **Feedback** | `UserFeedback` | Sentiment analysis, opportunities by category, Reddit discussions |
| **Market** | `MarketTab` | TAM/SAM/SOM, timing analysis, competitors, Google Trends |
| **Gaps** | `Opportunities` | Opportunity score, unmet needs, WTP signals, strategic recommendations |
| **Verdict** | `ViabilityVerdictDisplay` | Two-axis verdict, score breakdown, red flags, recommendations |

### 7.4 Component Hierarchy (Detailed)

#### Above Tabs (Always Shown)

```
TabbedView
├── CompetitorPromptModal (conditional: CV done but no competitors)
├── SearchCoverageSection ("What We Searched" transparency)
│   └── Shows: sources, posts found/analyzed, communities searched
└── InvestorMetricsHero
    ├── QuickMetricsRow
    │   ├── Pain Score (/10)
    │   ├── Signals count
    │   ├── WTP count
    │   ├── Market Score (/10)
    │   ├── Timing Score (/10)
    │   └── Verdict Score (/10)
    ├── Limited Data Banner (conditional)
    ├── Recommendation Panel
    └── Market Snapshot Panel (TAM/SAM formatted)
```

#### Summary Tab Structure

```
SummaryTab
├── DualVerdictDisplay (Two-Axis System)
│   ├── Hypothesis Confidence (0-10 with factors)
│   │   ├── Direct signals score
│   │   ├── Volume score
│   │   └── Multi-source score
│   ├── Market Opportunity (0-10 with factors)
│   │   ├── Market size contribution
│   │   ├── Timing contribution
│   │   ├── Activity contribution
│   │   └── Competitor contribution
│   └── "What This Means" section
├── ScoreBreakdownCard
│   ├── Pain Score (35% weight)
│   ├── Market Score (25% weight)
│   ├── Competition Score (25% weight)
│   └── Timing Score (15% weight)
├── Key Insights Section
├── DataQualityCard
├── MarketCard (TAM/SAM/SOM, penetration %)
├── TimingCard (tailwinds/headwinds, trend)
├── CompetitionCard (competitor count, gaps)
└── RedFlagsCard (if any red flags detected)
```

#### Evidence Tab Structure (4 Sub-tabs)

```
EvidenceTab
├── [Sub-tab: Overview]
│   ├── Pain Score Card (large gauge)
│   ├── Themes Card (top themes list)
│   ├── WTP Card (WTP signals count)
│   ├── Executive Summary
│   ├── TieredMetricsDisplay (Core/Strong/Related/Adjacent counts)
│   └── DataQualityInsights
│
├── [Sub-tab: Themes]
│   ├── Theme cards with intensity/frequency
│   ├── Customer Language section
│   └── Platforms Mentioned
│
├── [Sub-tab: Signals]
│   ├── PainScoreDisplay (main score gauge)
│   ├── Pain Intensity Breakdown (High/Med/Low)
│   └── PainScoreCard for each signal
│
└── [Sub-tab: Quotes]
    ├── QuoteList (all quotes with source/link/tier badge)
    └── WtpQuoteCard (WTP-specific quotes)
```

#### Market Tab Structure

```
MarketTab
├── Market Sizing Section
│   ├── TAM Card (Total Addressable Market)
│   ├── SAM Card (Serviceable Addressable Market)
│   ├── SOM Card (Serviceable Obtainable Market)
│   └── Penetration Required %
│
├── Timing Section
│   ├── Timing Score gauge
│   ├── Trend indicator (rising/stable/falling)
│   ├── Tailwinds/Headwinds lists
│   └── Google Trends chart (if available)
│
└── Competitors Section (CompetitorResults)
    ├── Summary Stats
    ├── Competitor Pricing Intelligence
    ├── Competition Score Analysis
    ├── Direct/Platforms/Adjacent Competitors
    └── Comparison Matrix
```

### 7.5 Score Display Locations (Potential Inconsistency Points)

| Score | Displayed In | Component | Source |
|-------|--------------|-----------|--------|
| **Overall Score** | Hero section | `InvestorMetricsHero` | `viabilityVerdict.overallScore` |
| **Overall Score** | Summary tab | `SummaryTab` → `ScoreBreakdownCard` | `verdict.overallScore` |
| **Overall Score** | Verdict tab | `ViabilityVerdictDisplay` | `verdict.overallScore` |
| **Pain Score** | Hero | `QuickMetricsRow` | `painScoreInput.overallScore` |
| **Pain Score** | Summary | `ScoreBreakdownCard` | `verdict.dimensions[0].score` |
| **Pain Score** | Evidence→Overview | `PainScoreCard` | `communityVoiceResult.painSummary` |
| **Market Score** | Hero | `QuickMetricsRow` | `marketData.score` |
| **Market Score** | Summary | `ScoreBreakdownCard` | `verdict.dimensions` |
| **Competition Score** | Hero | `QuickMetricsRow` | `competitorResult.competitionScore.score` |
| **Competition Score** | Summary | `ScoreBreakdownCard` | `verdict.dimensions` |
| **Timing Score** | Hero | `QuickMetricsRow` | `timingData.score` |
| **Timing Score** | Summary | `ScoreBreakdownCard` | `verdict.dimensions` |
| **Hypothesis Confidence** | Summary | `DualVerdictDisplay` | `verdict.hypothesisConfidence` |
| **Market Opportunity** | Summary | `DualVerdictDisplay` | `verdict.marketOpportunity` |

**Debugging Score Inconsistencies:**
When investigating score display issues:
1. Check data source: Is the score from `viabilityVerdict.dimensions[]` or directly from module results?
2. Check calculation timing: Is `calculateViability()` called once in `fetch-research-data.ts` or recalculated?
3. Check prop drilling: Follow score from `ResearchDataProvider` → component props → display

---

## 8. Viability Verdict & Scoring

### 8.1 Formula & Weights

```javascript
VIABILITY_SCORE = (Pain × 0.35) + (Market × 0.25) + (Competition × 0.25) + (Timing × 0.15)
```

**Dynamic Weight Normalization:** When dimensions are missing, weights are recalculated to sum to 100%.

**Score Calculation Pipeline:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     viability-calculator.ts                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  calculateViability(painScore, competitionScore, marketScore, timingScore) │
│                                                                             │
│  Steps:                                                                     │
│  1. Calculate raw weighted score                                            │
│  2. Apply score calibration (spread mid-range scores)                       │
│  3. Apply WTP Kill Switch (cap at 5.0 if 0 WTP)                            │
│  4. Apply Competition Cap (saturated market penalty)                        │
│  5. Calculate two-axis scores:                                              │
│     - HypothesisConfidence (directSignals, volume, multiSource)            │
│     - MarketOpportunity (marketSize, timing, activity, competitors)        │
│  6. Generate red flags                                                      │
│  7. Return ViabilityVerdict object                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Pain Score (35% weight)

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

#### Competition Score (25% weight)

| Factor | Impact | Logic |
|--------|--------|-------|
| Competitor Count | ±2 | 0 = greenfield (+2), 8+ = crowded (-1.5) |
| Funding Levels | ±1.5 | Well-funded = harder (-1.5), Bootstrapped = easier (+0.5) |
| User Satisfaction | ±2 | Low ratings = opportunity (+2), High ratings = barrier (-1) |
| Market Gaps | ±1 | 2+ gaps found = opportunity (+1) |

#### Verdict Thresholds

| Score | Verdict | Color | Recommendation |
|-------|---------|-------|----------------|
| 7.5-10 | STRONG SIGNAL | Green | Proceed to interviews with confidence |
| 5.0-7.4 | MIXED SIGNAL | Yellow | Refine hypothesis, investigate weak areas |
| 4.0-4.9 | WEAK SIGNAL | Orange | Significant concerns - validate assumptions first |
| 0-3.9 | DO NOT PURSUE | Red | No viable signal - pivot to different problem/audience |

### 8.2 Two-Axis Verdict System

**Problem Solved:** The single viability score was misleading. A search could show "7.6/10 STRONG SIGNAL" when the hypothesis wasn't found (11% relevance) but the market was active.

**Solution:** Separate "Is there a market?" from "Did we find YOUR hypothesis?"

#### Axis 1: Hypothesis Confidence
*"Did we find YOUR specific hypothesis?"*

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Direct Signal % | 50% | CORE signals / total signals |
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

### 8.3 Data Quality Considerations

**Known Issues (See KNOWN_ISSUES.md):**
- Quote selection prioritizes pain intensity over hypothesis relevance
- Reddit is poor for WTP signals (app reviews are better)
- No first-person language detection (filters out generic content)

**Target Metrics:**

| Metric | Current | Target |
|--------|---------|--------|
| Filter survival rate | ~15-25% | ~30-40% |
| Quote relevance | ~35% | >70% |
| WTP signal accuracy | Low | High (via app reviews) |

---

## 9. Database Schema

### 9.1 Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts (synced from auth.users) | `id`, `email`, `full_name`, `avatar_url`, `credits` |
| `research_jobs` | Research projects | `id`, `user_id`, `hypothesis`, `status`, `current_step`, `coverage_data` |
| `research_results` | Module outputs | `job_id`, `module_name`, `data` (JSONB) |
| `credit_transactions` | Credit history | `user_id`, `amount`, `balance_after`, `reason` |
| `credit_packs` | Purchasable credit packages | `credits`, `price_cents`, `stripe_price_id` |
| `reddit_cache` | Reddit data cache (24h TTL) | `subreddit`, `search_query`, `posts`, `expires_at` |
| `embedding_cache` | OpenAI embedding cache (pgvector) | `text_hash`, `embedding` (vector 1536), `model` |

### 9.2 Key Relationships

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

### 9.3 Module Status Tracking

`research_jobs.module_status` is JSONB:
```json
{
  "community_voice": "completed",
  "competitor_intel": "pending",
  "interview_prep": "pending"
}
```

### 9.4 Row Level Security

All tables enforce RLS - users can only access their own data:
- `profiles`: Own profile only
- `research_jobs`: Own jobs only
- `research_results`: Via job ownership
- `reddit_cache`: Read-only for authenticated users

---

## 10. API Endpoints

### 10.1 Endpoint Reference

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

### 10.2 API Persistence Behavior

The `/api/research/community-voice` endpoint behaves differently based on whether a `jobId` is provided:

| Scenario | Credit Deducted | Results Returned | Saved to DB |
|----------|-----------------|------------------|-------------|
| **With `jobId`** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Without `jobId`** | ✅ Yes | ✅ Yes | ❌ No |

**Why?** This allows stateless API calls for quick testing without polluting the database.

**Normal Flow (via UI):**
```
1. POST /api/research/jobs → Creates job, returns jobId
2. POST /api/research/community-voice with jobId → Processes & saves results
```

### 10.3 Community Voice Response Structure

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

## 11. Project Structure

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
│   │       └── [id]/page.tsx         # Results view (tabs)
│   └── api/
│       ├── auth/callback/route.ts    # OAuth code exchange
│       ├── dev/login/route.ts        # Dev-only auth bypass
│       ├── billing/                  # LemonSqueezy integration
│       └── research/                 # Research API endpoints
├── components/
│   ├── layout/header.tsx             # Navigation + auth status
│   ├── research/                     # Research-specific components
│   └── ui/                           # Radix UI primitives (shadcn)
├── lib/
│   ├── anthropic.ts                  # Claude API client singleton
│   ├── arctic-shift/                 # Reddit data fetching
│   ├── analysis/                     # Pain, theme, viability analysis
│   ├── embeddings/                   # OpenAI embedding service
│   ├── filter/                       # Two-stage filter (planned)
│   ├── research/                     # Research utilities
│   ├── reddit/                       # Subreddit discovery
│   └── supabase/                     # Database clients
└── types/
    ├── index.ts                      # TypeScript definitions
    └── supabase.ts                   # Generated DB types
```

---

## 12. Implementation Status

| Module | Status | Notes |
|--------|--------|-------|
| Landing Page | ✅ Complete | Tech-forward design with bento grid |
| Google OAuth | ✅ Complete | Via Supabase |
| Community Voice Mining | ✅ Complete | Arctic Shift + Claude with relevance filtering |
| Pain Analysis | ✅ Complete | Real-time progress, relevance filtering |
| Competitor Intelligence | ✅ Complete | AI-powered analysis |
| Market Sizing | ✅ Complete | TAM/SAM/SOM Fermi estimation |
| Timing Analysis | ✅ Complete | Tailwinds/headwinds + Google Trends |
| Viability Verdict | ✅ Complete | 4-dimension scoring + Two-Axis system |
| Research History | ✅ Complete | Dashboard with status |
| Coverage Preview | ✅ Complete | Free data availability check |
| Interview Questions | ✅ Complete | Part of Community Voice |
| PDF Export | ✅ Complete | Full report via jspdf |
| Test Suite | ✅ Complete | Vitest with 128 tests |
| Research Resilience | ✅ Complete | Browser warning, error tracking, auto-refund |
| Credits/Billing | ✅ Complete | LemonSqueezy integration |
| Admin Dashboard | ✅ Complete | Analytics + user management |
| Two-Stage Filter | ⏳ Built | Not yet integrated |
| Dark Mode | ❌ Not started | Priority: Low |

**Overall MVP: ~99% complete**

---

## 13. Code Standards

### 13.1 Type Safety

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

### 13.2 Shared Utilities

Don't copy-paste database operations. Use:
```typescript
// src/lib/research/save-result.ts
await saveResearchResult(jobId, 'pain_analysis', data)
```

Type-safe module names prevent typos:
```typescript
type ModuleName = 'pain_analysis' | 'market_sizing' | 'timing_analysis' | 'competitor_intelligence' | 'community_voice'
```

### 13.3 Pre-Commit Checklist

```bash
npm run build    # Catches type errors dev mode misses
npm run test:run # 176+ tests must pass
```

### 13.4 Test Suite

All tests are in `src/__tests__/`. Run with `npm run test:run`.

| Test File | Purpose | Key Scenarios |
|-----------|---------|---------------|
| `save-failure-handling.test.ts` | Error handling in community-voice route | Save failure marks job as `failed`, skips competitor analysis |
| `job-status-manager.test.ts` | Step status progression | Verifies `step_status` updates through competitor completion |
| `pain-detector.test.ts` | Pain signal extraction | WTP detection, firsthand experience, quote extraction |
| `relevance-filter.test.ts` | Post/comment filtering | Embedding gate, quality filtering, title-only posts |
| `adaptive-fetcher.test.ts` | Data fetching behavior | Legacy filter usage with tiered expansion |
| `viability-calculator.test.ts` | Verdict scoring | Score calculation, calibration |
| `verdict-display.test.tsx` | React component tests | App Gap vs Hypothesis mode labels |
| `pricing-extraction.test.ts` | Price parsing | Currency extraction, range handling |
| `research-flow.integration.test.ts` | End-to-end flow | Full pipeline integration (mostly skipped) |
| `format-clusters-for-prompt.test.ts` | Prompt formatting | Cluster formatting for AI prompts |

**Critical Tests:**
- `save-failure-handling.test.ts` — Ensures database errors don't leave jobs in inconsistent state (added Jan 2026)
- `job-status-manager.test.ts` — Ensures auto-competitor runs and step_status updates correctly

### 13.5 Common Pitfalls

| Pitfall | Do This Instead |
|---------|-----------------|
| Copy-paste DB operations | Use shared utilities |
| `any` type | Define proper types or use `unknown` |
| String column names | Generate DB types |
| Testing only UI | Add integration tests |
| Skipping `npm run build` | Always build before commit |
| No test for error paths | Add tests like `save-failure-handling.test.ts` |

---

## 14. Configuration & Running Locally

### 14.1 Environment Variables

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic (Required)
ANTHROPIC_API_KEY=your-anthropic-key

# OpenAI (Required for embedding pre-filter)
OPENAI_API_KEY=your-openai-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 14.2 Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# App runs at http://localhost:3000
```

### 14.3 Dev Authentication

For testing without Google OAuth:

```bash
# Create dev session
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# Check auth status
curl http://localhost:3000/api/dev/login -b /tmp/cookies.txt
```

Creates a test user: `test-user@pvre-dev.local`

### 14.4 Puppeteer/Playwright Testing

```javascript
// 1. Navigate and login
await browser_navigate({ url: 'http://localhost:3000' })
await browser_evaluate({ script: `fetch('/api/dev/login', { method: 'POST' })` })

// 2. Go to dashboard
await browser_navigate({ url: 'http://localhost:3000/dashboard' })

// 3. Run research
await browser_navigate({ url: 'http://localhost:3000/research' })
await browser_fill({ selector: 'textarea', value: 'Test hypothesis' })
await browser_click({ selector: 'button[type="submit"]' })
```

---

## 15. Troubleshooting

### Common Issues

**"Results Not Available" on old research**
- Research jobs created before persistence was added won't have saved results
- Solution: Run new research

**Pain Analysis fails to save**
- Check migration 011 was applied (adds `pain_analysis` to module_name constraint)

**Competitor Analysis fails to save**
- Check migration 012 was applied (adds `competitor_intelligence` to module_name constraint)

**Auth redirect loops**
- Clear cookies and try again
- Check Supabase auth configuration in dashboard

**Slow research processing**
- Normal processing time is 60-180 seconds
- Arctic Shift requests are fast (0.2-0.5s each)
- Most time is spent on Claude API calls for relevance filtering

**Arctic Shift 422 Timeout errors**
- Multi-word `query` or `body` parameters cause server-side timeouts
- Solution: Don't use query/body params - fetch by subreddit + time range only

**Claude API errors**
- Check ANTHROPIC_API_KEY is valid
- Ensure sufficient API credits
- Rate limits: 60 requests/minute on free tier

**JSON Parsing errors in analysis**
- The extractJSONArray() function handles malformed Claude responses
- Multiple fallback strategies: direct parse, array extraction, markdown block extraction

---

## 16. Cost Analysis

### 16.1 Per-Research Costs (Current Production)

| Step | AI Model | Cost |
|------|----------|------|
| Hypothesis Interpretation | Sonnet | ~$0.02 |
| Subreddit Discovery | Haiku × 3 | ~$0.003 |
| Quality Sampling (preview) | Haiku | ~$0.01 |
| Embedding Filter | OpenAI | ~$0.01 |
| AI Gates (Domain + Problem) | ~~Haiku~~ | **SKIPPED** |
| Pain Detection | Code | Free |
| Themes | Sonnet | ~$0.02 |
| Competitors | Sonnet | ~$0.02 |
| Questions | Sonnet | ~$0.01 |
| Market/Timing | Sonnet | ~$0.02 |
| **Total** | | **~$0.09** |

### 16.2 Monthly Projections

| Service | Per Research Run | Monthly (100 runs) |
|---------|------------------|-------------------|
| Arctic Shift | $0 | $0 |
| OpenAI Embeddings | ~$0.01 | ~$1 |
| Claude Haiku (filtering) | ~$0.05 | ~$5 |
| Claude Sonnet (analysis) | ~$0.05 | ~$5 |
| Supabase | $0 (free tier) | $0 |
| **Total** | **~$0.11** | **~$11** |

### 16.3 Cost Control Features

1. **AI cap of 50** → Fixed Haiku cost regardless of input size (planned two-stage)
2. **Embedding caching** → Skip redundant embedding calls
3. **Batch processing** → Fewer API round-trips
4. **AI gates skipped** → Production uses embeddings only, saving ~$0.05/search

---

## 17. Key Files Reference

### Research Pipeline

| Purpose | File Path |
|---------|-----------|
| Hypothesis interpretation | `src/app/api/research/interpret-hypothesis/route.ts` |
| Coverage check | `src/app/api/research/coverage-check/route.ts` |
| Main research endpoint | `src/app/api/research/community-voice/route.ts` |
| Relevance filtering | `src/lib/research/relevance-filter.ts` |
| Quality preview modal | `src/components/research/quality-preview-modal.tsx` |

### Data Sources

| Purpose | File Path |
|---------|-----------|
| Arctic Shift (Reddit) | `src/lib/data-sources/arctic-shift.ts` |
| Rate limiter | `src/lib/arctic-shift/rate-limiter.ts` |
| Google Play adapter | `src/lib/data-sources/adapters/google-play-adapter.ts` |
| App Store adapter | `src/lib/data-sources/adapters/app-store-adapter.ts` |
| Hacker News adapter | `src/lib/data-sources/adapters/hacker-news-adapter.ts` |
| Google Trends | `src/lib/data-sources/google-trends.ts` |

### Analysis

| Purpose | File Path |
|---------|-----------|
| Pain detection | `src/lib/analysis/pain-detector.ts` |
| Theme extraction | `src/lib/analysis/theme-extractor.ts` |
| Market sizing | `src/lib/analysis/market-sizing.ts` |
| Timing analysis | `src/lib/analysis/timing-analyzer.ts` |
| Viability calculator | `src/lib/analysis/viability-calculator.ts` |
| Save results | `src/lib/research/save-result.ts` |

### Results Display

| Purpose | File Path |
|---------|-----------|
| Results page | `src/app/(dashboard)/research/[id]/page.tsx` |
| Results layout | `src/components/research/layouts/results-layout.tsx` |
| Tabbed view | `src/components/research/layouts/tabbed-view.tsx` |
| Data fetching | `src/lib/research/fetch-research-data.ts` |
| Summary tab | `src/components/research/summary-tab.tsx` |
| Evidence tab | `src/components/research/evidence-tab.tsx` |
| Market tab | `src/components/research/market-tab.tsx` |
| Investor metrics hero | `src/components/research/investor-metrics-hero.tsx` |
| Dual verdict display | `src/components/research/dual-verdict-display.tsx` |
| Competitor results | `src/components/research/competitor-results.tsx` |

### App Search Specific

| Purpose | File Path |
|---------|-----------|
| App overview | `src/components/research/app-overview.tsx` |
| User feedback | `src/components/research/user-feedback.tsx` |
| Opportunities | `src/components/research/opportunities.tsx` |
| Viability verdict | `src/components/research/viability-verdict.tsx` |

### Filtering (Planned)

| Purpose | File Path |
|---------|-----------|
| Filter config | `src/lib/filter/config.ts` |
| Universal filter | `src/lib/filter/universal-filter.ts` |
| AI verifier | `src/lib/filter/ai-verifier.ts` |
| Filter pipeline | `src/lib/filter/index.ts` |

---

## 18. Mode-Specific Code Paths & Filters

> **Purpose:** Document code that behaves differently in Hypothesis vs App Gap mode to prevent mode-specific bugs.

### 18.1 Module Registry

| Module ID | Name | File Path | Mode | Description |
|-----------|------|-----------|------|-------------|
| **Data Sources** |
| ADAPT-001 | Reddit Adapter | `src/lib/data-sources/arctic-shift.ts` | Both | Fetches Reddit posts via Arctic Shift |
| ADAPT-002 | App Store Adapter | `src/lib/data-sources/adapters/app-store-adapter.ts` | App Gap | Fetches iOS App Store reviews |
| ADAPT-003 | Google Play Adapter | `src/lib/data-sources/adapters/google-play-adapter.ts` | App Gap | Fetches Google Play reviews |
| ADAPT-004 | Hacker News Adapter | `src/lib/data-sources/adapters/hacker-news-adapter.ts` | Both | Fetches HN posts (auto-detected) |
| **Filters** |
| FILT-001 | Tiered Filter | `src/lib/filter/tiered-filter.ts` | Both | Embedding-based relevance tiers (CORE/STRONG/RELATED/ADJACENT) |
| FILT-002 | App Name Gate | `src/app/api/research/community-voice/route.ts:739-836` | App Gap | Filters Reddit to app mentions only |
| FILT-003 | Relevance Filter | `src/lib/research/relevance-filter.ts` | Both | Legacy AI-based relevance filter |
| **Analysis** |
| ANAL-001 | Pain Detector | `src/lib/analysis/pain-detector.ts` | Both | Extracts pain signals from text |
| ANAL-002 | WTP Detector | `src/lib/analysis/pain-detector.ts` | Both | Detects willingness-to-pay signals |
| ANAL-003 | Theme Extractor | `src/lib/analysis/theme-extractor.ts` | Both | Groups pain signals into themes |
| ANAL-004 | Competitor Analyzer | `src/lib/research/competitor-analyzer.ts` | Both | Auto-detects and analyzes competitors |
| **Calculators** |
| CALC-001 | Viability Calculator | `src/lib/analysis/viability-calculator.ts` | Both | Computes verdict scores |
| CALC-002 | Market Sizing | `src/lib/analysis/market-sizing.ts` | Both | TAM/SAM/SOM calculations |
| **Display** |
| DISP-001 | Opportunities Display | `src/components/research/opportunities.tsx` | App Gap | Shows Gaps tab with categorized needs |
| DISP-002 | Verdict Hero | `src/components/research/verdict-hero.tsx` | Both | Top-level verdict display |

**Mode values:**
- `Hypothesis` — Only used in Hypothesis mode
- `App Gap` — Only used in App Gap mode (when `appData` is present)
- `Both` — Used in both modes

---

### 18.2 Data Flow Diagrams

#### Hypothesis Mode Flow

```
User Input (hypothesis text)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ ROUTE-001: community-voice/route.ts                     │
│                                                         │
│   ┌─────────────┐     ┌─────────────┐                  │
│   │ ADAPT-001   │     │ FILT-001    │                  │
│   │ Reddit      │────▶│ Tiered      │                  │
│   │ Adapter     │     │ Filter      │                  │
│   └─────────────┘     └──────┬──────┘                  │
│                              │                          │
│                              ▼                          │
│                       ┌─────────────┐                  │
│                       │ ANAL-001    │                  │
│                       │ Pain        │                  │
│                       │ Detector    │                  │
│                       └──────┬──────┘                  │
│                              │                          │
└──────────────────────────────┼──────────────────────────┘
                               │
                               ▼
                        [Pain Signals]
                               │
                               ▼
                    ┌─────────────────┐
                    │ CALC-001        │
                    │ Viability Calc  │
                    └────────┬────────┘
                             │
                             ▼
                      [Verdict Score]
```

#### App Gap Mode Flow

```
User Input (app name from store)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ ROUTE-001: community-voice/route.ts                     │
│                                                         │
│   ┌─────────────┐                                       │
│   │ ADAPT-002/3 │ ─── App Store reviews bypass filter   │
│   │ App Store   │     (all reviews included)            │
│   └──────┬──────┘                                       │
│          │                                              │
│   ┌──────┴──────┐     ┌─────────────┐                  │
│   │ ADAPT-001   │     │ FILT-001    │                  │
│   │ Reddit      │────▶│ Tiered      │                  │
│   │ Adapter     │     │ Filter      │                  │
│   └─────────────┘     └──────┬──────┘                  │
│                              │                          │
│                       ┌──────┴──────┐                  │
│                       │ FILT-002    │  ◀── App Name    │
│                       │ App Name    │      Gate        │
│                       │ Gate        │                  │
│                       └──────┬──────┘                  │
│                              │                          │
│                              ▼                          │
│                       ┌─────────────┐                  │
│                       │ ANAL-001    │                  │
│                       │ Pain        │                  │
│                       │ Detector    │                  │
│                       └──────┬──────┘                  │
│                              │                          │
└──────────────────────────────┼──────────────────────────┘
                               │
                               ▼
                        [Pain Signals]
```

---

### 18.3 FILT-002: App Name Gate

> **Purpose:** Filter Reddit signals to only include posts that mention the app name (in App Gap mode)

**Mode:** App Gap only
**File:** `src/app/api/research/community-voice/route.ts` (lines 739-836)
**Activation Condition:** `USE_TIERED_FILTER === true` AND `appData && appData.appId`

#### Inputs
- `analysisSignals`: Array of tiered signals from FILT-001
- `appData.name`: Full app name (e.g., "Loom: Screen Recorder")

#### Outputs
- `redditSignalsWithAppMention`: Only Reddit posts containing word-boundary match for app name
- `posts`: Filtered posts array for pain analysis
- Updated `filteringMetrics.coreSignals` and `filteringMetrics.relatedSignals`

#### Logic

```typescript
// Step 1: Extract core app name
const appName = appData.name.toLowerCase()
const coreAppName = appName.split(/[:\-–—]/)[0].trim()
// Example: "Loom: Screen Recorder" → "loom"

// Step 2: Build word-boundary regex
const appNameRegex = new RegExp(
  `\\b${coreAppName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
  'i'
)
// Example: /\bloom\b/i (won't match "bloom")

// Step 3: Filter Reddit signals
const redditSignalsWithAppMention = analysisSignals.filter(s => {
  if (s.post.source !== 'reddit') return false
  const text = `${s.post.title} ${s.post.body}`.toLowerCase()
  return appNameRegex.test(text)
})

// Step 4: App store reviews ALWAYS pass (bypass filter)
// They're already about the app by definition
```

#### Why App Store Reviews Bypass the Filter

App store reviews are fetched directly for a specific app ID, so they're guaranteed to be about that app. The App Name Gate only needs to filter Reddit posts, which may discuss unrelated apps.

#### Console Log Output

When running in App Gap mode, you'll see:
```
=== APP GAP MODE: Signal Distribution ===
  App store reviews in raw input: 500
  App store signals in tier buckets: 127
  App name filter: "loom"
    - Reddit with app mention: 23
    - Reddit without mention (excluded): 87
  Signals for clustering: 150 (23 Reddit + 127 App Store)
```

---

### 18.4 DISP-001: Categorization Logic

> **Purpose:** Group pain signals into feature categories for the Gaps tab

**File:** `src/components/research/opportunities.tsx`
**Function:** `categorizeFeature()` (lines 109-145)

#### Category Keywords

| Category | Keywords | Word-Boundary Required |
|----------|----------|------------------------|
| Ad-free experience | `ads*`, `advertisement`, `ad-free`, `no ads`, `remove ads` | `ads*` only |
| Pricing / Value | `price`, `expensive`, `cost`, `subscription`, `free*` | `free*` only |
| Offline mode | `offline`, `without internet`, `no connection` | No |
| Age / Content filters | `age*`, `filter`, `parental`, `kid`, `child`, `family` | `age*` only |
| Memory / Context | `memory`, `remember`, `context`, `history` | No |
| Stability / Performance | `crash`, `bug*`, `glitch`, `freeze`, `slow*`, `laggy`, `performance` | `bug*`, `slow*` only |
| UI / UX design | `ui*`, `interface`, `design`, `layout`, `ux*`, `navigation` | `ui*`, `ux*` only |
| Privacy / Security | `privacy`, `data`, `security`, `safe*` | `safe*` only |
| Customization | `customize`, `personalize`, `settings`, `options`, `control` | No |
| Customer support | `support`, `help*`, `customer service`, `response` | `help*` only |

**Word Boundary Matching:**
- Keywords ending with `*` use regex word boundaries (`\b`)
- This prevents "ads" from matching "adds" or "downloads"
- Example: `bug*` → `/\bbug\b/i` matches "bug" but not "debug"

#### Known Issues
1. **"ad" removed** — Too short, matched "add", "made", etc.
2. **Word boundaries inconsistent** — Only some keywords use them

---

### 18.5 ROUTE-001: Community Voice Route

> **Purpose:** Main orchestrator that coordinates all research modules for both Hypothesis and App Gap modes

**Mode:** Both
**File:** `src/app/api/research/community-voice/route.ts`

#### Inputs
- `hypothesis`: User's business hypothesis text
- `jobId`: Research job UUID for tracking
- `coverageData` (from job):
  - `structuredHypothesis`: Parsed audience/problem/context
  - `userSelectedSubreddits`: Override subreddits
  - `targetGeography`: Market scoping
  - `selectedDataSources`: Which sources to use
  - `appData`: App details for App Gap mode (triggers mode switch)

#### Outputs
- `CommunityVoiceResult`: Complete research output including:
  - `painSignals`: Analyzed pain points
  - `painSummary`: Aggregated statistics
  - `themeAnalysis`: Claude-extracted themes
  - `marketSizing`: TAM/SAM/SOM calculations
  - `timing`: Market timing analysis
  - `clusters`: Signal clusters (App Gap only)
  - `metadata`: Processing stats, token usage, filtering metrics

#### Processing Steps (Order Critical)

```
Step 1: Auth & Credits
   └─ Verify user, deduct 1 credit

Step 2: Extract Keywords (ANAL-004)
   └─ Generate search terms from hypothesis

Step 3: Discover Subreddits
   ├─ 3a: Reddit subreddits from Claude
   ├─ 3b: [App Gap] Fetch App Store reviews (ADAPT-002)
   └─ 3c: [App Gap] Fetch Google Play reviews (ADAPT-003)

Step 4: Fetch & Filter Data
   ├─ 4a: Fetch Reddit posts/comments (ADAPT-001)
   ├─ 4b: Run Tiered Filter (FILT-001)
   ├─ 4c: [App Gap] App Name Gate (FILT-002)
   ├─ 4d: Adaptive fetch if < MIN_CORE_SIGNALS (15)
   └─ 4e: [App Gap] FINAL App Name Gate (catches adaptive fetch)

Step 5: Pain Analysis (ANAL-001)
   └─ Analyze posts/comments for pain signals

Step 6: Summary Statistics
   └─ Aggregate pain summary

Step 7: Theme Extraction (ANAL-003)
   ├─ 7a: Claude theme synthesis
   └─ 7b: Calculate theme resonance

Step 8: Interview Questions
   └─ Generate validation questions

Step 9: Market Sizing (CALC-002)
   └─ Calculate TAM/SAM/SOM

Step 10: Timing Analysis (CALC-003)
   └─ Market timing signals

Step 11: [App Gap] Competitor Analysis
   └─ Analyze known/detected competitors

Step 12: Save Results
   └─ Persist to research_results table
```

#### Mode Divergence Points
- **Step 3b/3c**: Only in App Gap mode (when `appData.appId` exists)
- **Step 4c**: App Name Gate only in App Gap mode
- **Step 11**: Competitor analysis only in App Gap mode

#### Dependencies
- ADAPT-001 (Reddit Adapter) — fetches Reddit data
- ADAPT-002/003 (App Store/Play Adapters) — fetches app reviews
- FILT-001 (Tiered Filter) — relevance filtering
- FILT-002 (App Name Gate) — App Gap-specific filtering
- ANAL-001 (Pain Detector) — pain signal extraction
- ANAL-003 (Theme Extractor) — theme synthesis
- CALC-001/002/003 (Calculators) — scoring/sizing

#### Known Issues
- Adaptive fetch adds posts without App Name Gate check (fixed in Step 4e)
- Comments weren't being filtered by App Name Gate (fixed Jan 3, 2026)

---

### 18.6 ANAL-001: Pain Detector

> **Purpose:** Extract and score pain signals from text using keyword tiers and engagement weighting

**Mode:** Both
**File:** `src/lib/analysis/pain-detector.ts`

#### Inputs
- `posts`: Array of `RedditPost` (from any source)
- `comments`: Array of `RedditComment`

#### Outputs
- `PainSignal[]`: Array of detected pain points with:
  - `text`: Original text content
  - `score`: Pain score (0-10)
  - `intensity`: 'low' | 'medium' | 'high'
  - `signals`: Matched keywords
  - `solutionSeeking`: Boolean
  - `willingnessToPaySignal`: Boolean
  - `wtpConfidence`: 'none' | 'low' | 'medium' | 'high'
  - `wtpSourceReliability`: 'high' | 'medium' | 'low' (app reviews > HN > Reddit)
  - `emotion`: Detected emotion type
  - `tier`: 'CORE' | 'RELATED' (from filter)
  - `source`: Metadata (subreddit, URL, engagement)

#### Logic

```typescript
// 1. Calculate raw pain score from keyword tiers
rawScore = highIntensityCount * 3 +    // Tier 3: nightmare, frustrated, terrible...
           mediumIntensityCount * 2 +   // Tier 2: struggle, problem, confusing...
           lowIntensityCount * 1 +      // Tier 1: wondering, considering...
           solutionSeekingCount * 2 +   // looking for, recommendations...
           willingnessToPayCount * 4    // would pay, budget, subscription...

// 2. Apply multipliers
engagementMultiplier = Math.min(1.2, 1 + log10(upvotes) * 0.05)  // Capped at 1.2x
recencyMultiplier = getRecencyMultiplier(createdUtc)  // 0.5x-1.5x based on age

// 3. Apply penalties
if (hasNegativeContext) score *= 0.6  // Talking about competitors, hypothetical
if (hasWTPExclusion) skip WTP detection  // Budget cuts, pricing complaints

// 4. Intensity classification
high: score >= 7
medium: score >= 4
low: score < 4
```

#### Keyword Categories
- **High Intensity (3pts)**: nightmare, frustrated, desperate, exhausted, waste of time
- **Medium Intensity (2pts)**: struggle, problem, confusing, annoying, stuck
- **Low Intensity (1pt)**: wondering, curious, might, sometimes, wish there was
- **Solution Seeking (2pts)**: looking for, recommendations, need help, alternatives
- **WTP Strong (4pts)**: would pay, willing to pay, take my money
- **WTP Medium (4pts)**: budget, pricing, subscription, premium, upgrade

#### Dependencies
- None (pure processing module)

#### Used By
- ROUTE-001 (Step 5) — main analysis
- ANAL-003 (Theme Extractor) — uses PainSignal for synthesis

#### Known Issues
- WTP detection includes purchase regret ("got my money back" marked as WTP)
- See ANAL-002 for WTP-specific issues

---

### 18.7 ANAL-002: WTP Detector

> **Purpose:** Detect willingness-to-pay signals (integrated into Pain Detector)

**Mode:** Both
**File:** `src/lib/analysis/pain-detector.ts` (same file as ANAL-001)

#### Current Logic (v7.0)

```typescript
// WTP is detected by keyword matching in calculatePainScore()
const WILLINGNESS_TO_PAY_KEYWORDS = {
  strongIntent: ['would pay', 'willing to pay', 'take my money', 'worth paying'],
  financialDiscussion: ['budget', 'pricing', 'subscription', 'premium', 'upgrade'],
  purchaseIntent: ['where can i buy', 'looking to invest', 'considering paying'],
  valueSignals: ['worth the money', 'save time', 'pay for convenience'],
}

// Exclusion patterns (v7.0 - includes purchase regret detection)
const WTP_EXCLUSION_PATTERNS = [
  // Original exclusions (v2.0)
  /budget\s+(?:cut|meeting|review)/i,  // Budget as org term
  /pricing\s+is\s+(?:crazy|insane)/i,  // Pricing complaints
  /(?:can't|cannot)\s+afford/i,        // Affordability issues
  /(?:not|isn't)\s+worth/i,            // Negative value

  // v7.0: Purchase regret patterns
  /(?:get|want)\s+(?:my\s+)?(?:money\s+back|refund)/i,     // Refund requests
  /regret\s+(?:buying|purchasing|paying)/i,                 // Buyer's remorse
  /(?:debating|wondering)\s+if.*worth/i,                    // Questioning value
  /(?:paid|spent).*(?:disappointed|regret|waste)/i,        // Past purchase + negative
  /(?:biggest|worst)\s+waste\s+of\s+money/i,               // Explicit regret
]
```

#### ✅ Previously Known Issue (FIXED — January 3, 2026)

**Problem:** WTP signals captured purchase REGRET, not purchase INTENT.

**Example that was incorrectly matched:**
```
"I just upgraded to the paid version... now I'm debating if that was worth
the investment - I seriously feel like I should get my money back"
```

**Resolution:** Added 13 new exclusion patterns to detect:
- Refund requests
- Buyer's remorse language
- Questioning past purchase value
- Past tense payment + negative sentiment
- Explicit purchase dissatisfaction

**Tests added:** 4 new test cases in `pain-detector.test.ts` verify the fix

---

### 18.8 ANAL-003: Theme Extractor

> **Purpose:** Use Claude to synthesize pain signals into actionable themes

**Mode:** Both
**File:** `src/lib/analysis/theme-extractor.ts`

#### Inputs
- `painSignals`: Array of `PainSignal` (max 30 used)
- `hypothesis`: Business hypothesis text

#### Outputs
- `ThemeAnalysis`:
  - `themes`: Array of Theme with name, description, frequency, intensity, tier
  - `customerLanguage`: Exact phrases customers use
  - `alternativesMentioned`: Products/tools mentioned
  - `willingnessToPaySignals`: WTP quotes with source info
  - `keyQuotes`: Representative quotes with engagement data
  - `summary`: 2-3 sentence executive summary
  - `strategicRecommendations`: Actionable next steps
  - `keyOpportunity`: Biggest product opportunity

#### Logic

```typescript
// 1. Sort signals: CORE first, then RELATED
const sortedSignals = [...painSignals].sort((a, b) => {
  const tierOrder = { CORE: 0, RELATED: 1, undefined: 2 }
  return tierOrder[a.tier] - tierOrder[b.tier]
})

// 2. Take top 30 signals for analysis (token budget)
const topSignals = sortedSignals.slice(0, 30)

// 3. Call Claude (Haiku) with structured prompt
// Prompt includes:
// - CORE vs RELATED tier awareness
// - Source types (Reddit, App Store, Google Play)
// - Quote selection criteria (relevance > intensity)
// - Theme naming rules (3-6 words, descriptive)

// 4. Parse and validate response
// - Parse [CONTEXTUAL] prefix for tier marking
// - Enrich keyQuotes with engagement data from original signals
// - Validate theme quality (reject single-word names)
```

#### Theme Quality Rules (enforced in prompt)
- Theme names must be 3-6 words descriptive phrases
- CORE-derived themes appear first
- RELATED-derived themes prefixed with "[CONTEXTUAL]"
- Bad examples rejected: "Pain point: concerns", "Problems"

#### Dependencies
- ANAL-001 (Pain Detector) — provides PainSignal input
- Anthropic API (Claude Haiku) — synthesis

#### Used By
- ROUTE-001 (Step 7) — main analysis
- Theme display components — rendering

#### Known Issues (P1 — Broken)

**Problem:** Theme metadata shows undefined values:
```
- Signal Count: undefined
- Pain Intensity: undefined
- WTP Confidence: undefined
```

**Root Cause:** The `Theme` interface has optional fields (`resonance`, `tier`, `sources`) but the code path populating them may not be reached. The `calculateThemeResonance()` function is called but its output may not include all expected fields.

**Files to check:**
- `theme-resonance.ts` — resonance calculation
- Theme display component — what fields it expects

---

### 18.9 FILT-001: Tiered Filter

> **Purpose:** Classify signals into relevance tiers using embedding similarity

**Mode:** Both
**File:** `src/lib/filter/tiered-filter.ts`

#### Inputs
- `posts`: Array of `NormalizedPost` (from any adapter)
- `hypothesis`: Business hypothesis text
- `config`: Optional maxPosts, progress callback

#### Outputs
- `TieredSignals`:
  - `core`: Score ≥ 0.45 (direct match)
  - `strong`: Score ≥ 0.35 (highly relevant)
  - `related`: Score ≥ 0.25 (same problem space)
  - `adjacent`: Score ≥ 0.15 (nearby problems)
  - `stats`: Processing metrics

#### Logic

```typescript
// 1. Generate hypothesis embedding
const hypothesisEmbedding = await generateEmbedding(hypothesis)

// 2. Generate embeddings for all posts (batch)
const postEmbeddings = await generateEmbeddings(textsForEmbedding)

// 3. Score and classify each post
for (const post of posts) {
  const score = cosineSimilarity(hypothesisEmbedding, embedding)

  // Skip below 0.15 (too noisy)
  if (score < 0.15) continue

  // Classify into tier
  if (score >= 0.45) tier = 'core'
  else if (score >= 0.35) tier = 'strong'
  else if (score >= 0.25) tier = 'related'
  else tier = 'adjacent'

  // Apply source weights for analysis priority
  signal.sourceWeight = SOURCE_WEIGHTS[source]  // app_store=1.3, reddit=1.0
  signal.wtpWeight = WTP_SOURCE_WEIGHTS[source] // app_store=2.0, reddit=0.3
}
```

#### Thresholds (from `config.ts`)
```typescript
export const TIER_THRESHOLDS = {
  CORE: 0.45,      // Direct hypothesis match
  STRONG: 0.35,    // Highly relevant
  RELATED: 0.25,   // Same problem space
  ADJACENT: 0.15,  // Nearby problems (pivot opportunities)
}
```

#### Source Weights (for analysis prioritization)
```typescript
export const SOURCE_WEIGHTS = {
  app_store: 1.3,   // App reviews most valuable
  playstore: 1.3,
  trustpilot: 1.2,
  hackernews: 1.1,
  reddit: 1.0,      // Baseline
  other: 0.9,
}
```

#### Dependencies
- Embedding service (`@/lib/embeddings/embedding-service`)
- Config thresholds (`@/lib/filter/config`)

#### Used By
- ROUTE-001 (Step 4b) — main filtering
- Coverage preview — sample quality check

#### Key Difference from Legacy Filter
- No Haiku verification (saves 150 AI calls)
- All signals preserved in tiers (not binary pass/fail)
- AI budget moved to synthesis instead of gatekeeping

---

### 18.10 DISP-001: Opportunities Display (Expanded)

> **Purpose:** Group pain signals into feature categories and display in the Gaps tab

**Mode:** App Gap (primarily)
**File:** `src/components/research/opportunities.tsx`

#### Inputs
- `appData`: App details (name, rating, reviews)
- `painSignals`: Array of `PainSignal`
- `painSummary`: Aggregated statistics
- `wtpQuotes`: WTP signals for display

#### Outputs
- Rendered "Gaps" tab with:
  - Opportunity score and verdict
  - High-priority unmet needs
  - Medium-priority unmet needs
  - Strategic recommendations
  - WTP signals section

#### Categorization Logic (`categorizeFeature()`)

```typescript
const categories = [
  {
    keywords: ['ads*', 'advertisement', 'ad-free', 'no ads', 'too many ads'],
    label: 'Ad-free experience'
  },
  {
    keywords: ['price', 'expensive', 'subscription', 'free*'],
    label: 'Pricing / Value'
  },
  {
    keywords: ['offline', 'without internet'],
    label: 'Offline mode'
  },
  {
    keywords: ['crash', 'bug*', 'freeze', 'slow*', 'performance'],
    label: 'Stability / Performance'
  },
  {
    keywords: ['ui*', 'interface', 'design', 'ux*'],
    label: 'UI / UX design'
  },
  // ... 10 categories total
]

// Word boundary matching for short keywords
if (keyword.endsWith('*')) {
  const regex = new RegExp(`\\b${keyword.slice(0, -1)}\\b`, 'i')
  return regex.test(text)
}
```

#### Full Category Keywords List

| Category | Keywords | Word-Boundary |
|----------|----------|---------------|
| Ad-free experience | ads*, advertisement, ad-free, no ads, too many ads, remove ads | ads* |
| Pricing / Value | price, pricing, expensive, cost, subscription, free* | free* |
| Offline mode | offline, without internet, no connection | — |
| Age / Content filters | age*, filter, parental, kid, child, family | age* |
| Memory / Context | memory, remember, context, history | — |
| Stability / Performance | crash, bug*, glitch, freeze, slow*, laggy, performance | bug*, slow* |
| UI / UX design | ui*, interface, design, layout, ux*, navigation | ui*, ux* |
| Privacy / Security | privacy, data, security, safe* | safe* |
| Customization | customize, personalize, settings, options, control | — |
| Customer support | support, help*, customer service, response | help* |

#### Dependencies
- ANAL-001 (Pain Detector) — provides PainSignal data
- AppDetails — app metadata for scoring

#### Known Issues

**"Ads & Interruptions" Category Mismatch:**
The word "interruption" was triggering "Ads & Interruptions" category, but in non-ad apps (like Loom), "interruption" means:
- Technical interruptions (recording stops)
- Workflow interruptions (app crashes)

**Status:** "interruption" keyword removed. Category renamed to "Ad-free experience".

---

### 18.11 ADAPT-001: Reddit Adapter (Arctic Shift)

> **Purpose:** Fetch Reddit posts and comments via Arctic Shift API with adaptive time-stratified fetching

**Mode:** Both
**File:** `src/lib/data-sources/arctic-shift.ts`

#### Inputs
- `subreddits`: Array of subreddit names
- `limit`: Posts per subreddit (default 200)
- `timeRange`: Optional date constraints
- `subredditVelocities`: Map of subreddit → posts/day

#### Outputs
- `RedditPost[]`: Normalized posts with:
  - `id`, `title`, `body`, `author`, `subreddit`
  - `score`, `numComments`, `createdUtc`
  - `permalink`, `url`

#### Logic (Adaptive Time-Stratified Fetching)

```typescript
// 1. Determine activity level from velocity
if (postsPerDay > 20) {        // HIGH activity
  windows = [0-30d, 30-180d, 180-365d]
} else if (postsPerDay >= 5) {  // MEDIUM activity
  windows = [0-90d, 90-365d]
} else {                        // LOW activity
  windows = [0-365d]
}

// 2. Distribute fetch across windows
const postsPerWindow = Math.ceil(targetPerSubreddit / windows.length)

// 3. Fetch from each window
for (const window of windows) {
  const posts = await arcticSearchPosts({
    subreddit,
    limit: postsPerWindow,
    after: window.after,
    before: window.before,
    sort: 'desc',
  })
}
```

#### API Usage Notes
- **Base URL:** `https://arctic-shift.photon-reddit.com`
- **Rate limit:** ~2000 requests/minute (generous)
- **DO NOT use `query` or `body` params** — multi-word searches cause 422 timeouts
- Fetch by subreddit + time range only; let embedding filter handle relevance

#### Dependencies
- Arctic Shift client (`../arctic-shift/client`)
- No authentication required

#### Used By
- ROUTE-001 (Step 4a) — main data fetching
- Coverage preview — sample posts

---

### 18.12 ADAPT-002: App Store Adapter

> **Purpose:** Fetch iOS App Store reviews for App Gap analysis

**Mode:** App Gap only
**File:** `src/lib/data-sources/adapters/app-store-adapter.ts`

#### Inputs
- `appId`: Numeric App Store ID
- `limit`: Maximum reviews (default 500)
- `sortBy`: 'mostHelpful' | 'mostRecent'

#### Outputs
- `RedditPost[]` (normalized format for pipeline compatibility):
  - `id`: Review ID
  - `title`: Review title
  - `body`: Review text
  - `subreddit`: 'app_store' (for source identification)
  - `score`: Thumbs up count
  - `rating`: 1-5 star rating
  - `createdUtc`: Review timestamp
  - `permalink`: App Store URL

#### Logic

```typescript
// 1. Fetch reviews using app-store-scraper
const reviews = await store.reviews({
  id: appId,
  page: currentPage,
  country: 'us',
  sort: SORT.HELPFUL,
})

// 2. Paginate until limit reached
while (totalReviews < limit && currentPage <= maxPages) {
  const pageReviews = await store.reviews({ id, page: currentPage++ })
  allReviews.push(...pageReviews)
}

// 3. Detect IAP from description keywords
const hasIAP = detectIAPFromDescription(description, category, isFree)
// Keywords: subscription, premium, upgrade, monthly, yearly, etc.

// 4. Normalize to RedditPost format
return reviews.map(review => ({
  id: review.id,
  subreddit: 'app_store',  // Source marker
  title: review.title,
  body: review.text,
  score: review.thumbsUp || 0,
  rating: review.score,  // 1-5 stars
  // ...
}))
```

#### Package
Uses `app-store-scraper` npm package (free, no auth required).

#### Dependencies
- `app-store-scraper` — npm package for App Store data

#### Used By
- ROUTE-001 (Step 3b) — App Gap mode data fetching
- Coverage preview — app search/details

#### Notes
- Reviews bypass embedding filter (they're already about the specific app)
- Reviews bypass App Name Gate (guaranteed relevant)
- Current limit: 500 reviews (increased from 100 in Dec 2025)

---

### 18.13 Mode Boundary Rules

#### App Gap Mode ONLY

These modules should NEVER affect Hypothesis mode:

| Module | Activation Check |
|--------|------------------|
| FILT-002: App Name Gate | `appData && appData.appId` |
| ADAPT-002: App Store Adapter | `appData.store === 'app_store'` |
| ADAPT-003: Google Play Adapter | `appData.store === 'google_play'` |
| DISP-001: Opportunities | Only renders when `appData` prop exists |

#### Shared (Both Modes)

These modules are used by both — changes affect EVERYTHING:

| Module | Warning |
|--------|---------|
| FILT-001: Tiered Filter | Threshold changes affect all results |
| ANAL-001: Pain Detector | Keyword changes affect scoring everywhere |
| CALC-001: Viability Calculator | Formula changes affect all verdicts |
| DISP-002: Verdict Hero | Display changes visible in both modes |

⚠️ **WARNING:** Before modifying a shared module, verify the change works in BOTH modes using the testing checklist below.

---

### 18.14 Pre-Fix Testing Checklist

Before closing any issue that touches mode-specific code:

#### Hypothesis Mode Test
```
□ Run search: "People who need better project management"
□ Verify: Reddit signals are relevant to hypothesis
□ Verify: No app store data appears
□ Verify: Verdict score displays correctly
□ Verify: No "undefined" values in any display
```

#### App Gap Mode Test
```
□ Run search: Select "Loom" from App Store (or type "Loom: Screen Recorder")
□ Verify: App Store reviews appear and are relevant
□ Verify: Reddit signals mention "Loom" (if any appear)
□ Verify: Console shows "App name filter" log with correct counts
□ Verify: Categories make sense (no false positives like "Ads" for ad-free apps)
□ Verify: WTP signals show purchase INTENT, not regret
```

#### Score Consistency Test
```
□ Verify: Verdict score same in Hero and Verdict tab
□ Verify: Pain score consistent across all displays
□ Verify: Signal counts match between tabs
□ Verify: No NaN or undefined in any numeric display
```

#### Console Log Verification
When debugging App Gap mode, look for these key logs:
```
App-centric mode detected: { appId: "...", store: "...", name: "..." }
Step 3c: Fetching reviews for specific app: [AppName]
=== APP GAP MODE: Signal Distribution ===
  App name filter: "[app name]"
```

If "App-centric mode detected" doesn't appear, `appData` wasn't passed correctly from coverage_data.

---

## 19. Arctic Shift Multi-User Rate Limiting

*Added: January 12, 2026*

> **Purpose:** Handle 20+ concurrent users accessing Arctic Shift API with fair scheduling, preventing any single user from hogging bandwidth while ensuring coverage checks remain fast.

### 19.1 Architecture Overview

```
                                        ┌─→ [coverageLimiter] ─────┐
Request → [Cache] → [Coalesce] ──────→ │    8/sec, maxConc: 6     │──→ Arctic Shift API
                                        │    priority: HIGH        │
                                        │                          │
                                        └─→ [researchLimiter] ────┘
                                             12/sec, maxConc: 14
                                             + per-job max: 2
                                             + elastic boost
```

**Design Goals:**
1. **Coverage checks complete <3s** regardless of research queue depth
2. **Fair scheduling** - no single research job can hog all bandwidth
3. **Request efficiency** - identical requests share results via coalescing
4. **Adaptive throughput** - increase rate when API has headroom

**Scenario Handled:**
- 10 users doing coverage checks (10 × ~10 requests = 100)
- 10 users doing full research (10 × ~50 requests = 500)
- Total: 600 requests, completed in ~12-15s with fair distribution

---

### 19.2 Dual-Queue System

Two separate Bottleneck rate limiters with guaranteed capacity split:

| Queue | Capacity | maxConcurrent | Use Case |
|-------|----------|---------------|----------|
| `coverageLimiter` | 8 req/sec (40%) | 6 | Coverage checks - must be fast |
| `researchLimiter` | 12 req/sec (60%) | 14 | Research data fetching |

**Configuration:**
```typescript
// Coverage limiter: HIGH priority, guaranteed 40% capacity
export const coverageLimiter = new Bottleneck({
  maxConcurrent: 6,
  minTime: 125,              // ~8 req/sec
  reservoir: 40,
  reservoirRefreshAmount: 40,
  reservoirRefreshInterval: 5000,
})

// Research limiter: NORMAL priority, 60% capacity
export const researchLimiter = new Bottleneck({
  maxConcurrent: 14,
  minTime: 83,               // ~12 req/sec
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 5000,
})
```

**Why Two Queues Instead of Priority Numbers:**
- Priority alone can starve coverage if research floods the queue
- Dedicated capacity guarantees coverage never waits behind research
- Clear separation of concerns

---

### 19.3 Request Coalescing

If multiple users request the same URL simultaneously, only one API call is made.

```typescript
const inFlightRequests = new Map<string, Promise<Response>>()

async function coalescedFetch(url: string, fetchFn: () => Promise<Response>): Promise<Response> {
  const existing = inFlightRequests.get(url)
  if (existing) {
    console.log('[Coalesce] Sharing in-flight request:', url)
    return (await existing).clone()
  }

  const promise = fetchFn()
  inFlightRequests.set(url, promise)

  try {
    const response = await promise
    inFlightRequests.set(url, Promise.resolve(response.clone()))
    setTimeout(() => inFlightRequests.delete(url), 100)
    return response
  } finally {
    if (!inFlightRequests.has(url)) inFlightRequests.delete(url)
  }
}
```

**Impact:**
- 10 users researching similar topics → likely 30-50% request reduction
- Especially effective for popular subreddits (r/productivity, r/startups)

---

### 19.4 Per-Job Fairness

Each research job (user session) is limited to 2 concurrent requests to prevent one job from hogging all slots.

```typescript
const jobLimiters = new Map<string, Bottleneck>()

function getJobLimiter(jobId: string): Bottleneck {
  if (!jobLimiters.has(jobId)) {
    jobLimiters.set(jobId, new Bottleneck({
      maxConcurrent: 2,  // Max 2 concurrent per job
      minTime: 0,        // No additional delay
    }))
  }
  return jobLimiters.get(jobId)!
}
```

**Flow:**
```
Job A request → [Job A Limiter (max 2)] → [researchLimiter] → API
Job B request → [Job B Limiter (max 2)] → [researchLimiter] → API
```

**Result:** 10 users each progress at ~2 requests at a time, interleaved fairly.

---

### 19.5 Elastic Rate Adjustment

Dynamically adjusts throughput based on API response headers.

```typescript
function updateRateLimitState(headers: Headers): void {
  const remaining = parseInt(headers.get('X-RateLimit-Remaining') || 'Infinity')
  const limit = parseInt(headers.get('X-RateLimit-Limit') || '2000')
  const ratio = remaining / limit

  if (ratio > 0.6) {
    // Lots of headroom - increase rate
    researchLimiter.updateSettings({ minTime: Math.max(70, 83 - boost * 2) })
  } else if (ratio < 0.3) {
    // Getting low - decrease rate
    researchLimiter.updateSettings({ minTime: Math.min(120, 83 + slowdown * 2) })
  }
}
```

**Impact:**
- Normal operation: 20 req/sec total
- With headroom: Up to 25-30 req/sec
- Approaching limit: Throttles to 15-18 req/sec

---

### 19.6 Queue Telemetry & ETA

Exposes queue statistics for monitoring and user-facing ETA display.

```typescript
export function getQueueTelemetry(): QueueTelemetry {
  return {
    coverageQueueSize: coverageLimiter.counts().QUEUED,
    researchQueueSize: researchLimiter.counts().QUEUED,
    coverageRunning: coverageLimiter.counts().RUNNING,
    researchRunning: researchLimiter.counts().RUNNING,
    rateLimitRemaining,
    rateLimitResetTime,
    estimatedWaitMs: {
      coverage: coverageQueueSize * 125,  // 125ms per request
      research: researchQueueSize * 83,   // 83ms per request
    },
  }
}

export function formatQueueETA(priority: RequestPriority): string {
  const waitMs = getQueueTelemetry().estimatedWaitMs[priority]
  if (waitMs < 1000) return 'immediate'
  if (waitMs < 5000) return '~1-5 seconds'
  if (waitMs < 15000) return '~5-15 seconds'
  return '~30+ seconds'
}
```

**Future Use:** Display "Queued ~X seconds" in UI during high load.

---

### 19.7 Key Files

| File | Purpose |
|------|---------|
| `src/lib/arctic-shift/rate-limiter.ts` | Dual queues, coalescing, telemetry, elastic rate |
| `src/lib/arctic-shift/client.ts` | `setRequestContext()`, `clearRequestContext()`, priority routing |
| `src/app/api/research/coverage-check/route.ts` | Sets `'coverage'` priority context |
| `src/app/api/research/community-voice/route.ts` | Sets `'research'` priority with jobId |
| `src/lib/data-sources/index.ts` | Fast-first coverage sample size (50 vs 100) |

---

### 19.8 Usage Examples

**Coverage Check (high priority):**
```typescript
// In coverage-check/route.ts
import { setRequestContext, clearRequestContext } from '@/lib/arctic-shift/client'

export async function POST(req: Request) {
  setRequestContext('coverage')  // Uses coverageLimiter (8/sec)
  try {
    // ... coverage check logic
  } finally {
    clearRequestContext()
  }
}
```

**Research (fair scheduling per job):**
```typescript
// In community-voice/route.ts
setRequestContext('research', jobId)  // Uses researchLimiter + per-job limit
try {
  // ... research logic with 50+ Arctic Shift requests
} finally {
  clearRequestContext()
}
```

---

### 19.9 Caching Layers (Complements Rate Limiting)

The rate limiter works alongside existing caching:

| Layer | TTL | Purpose |
|-------|-----|---------|
| Query-level cache | 24h | Exact URL → cached JSON response |
| Subreddit-level cache | 90d | Processed posts per subreddit |
| In-memory stats cache | 30min | Post stats (count, velocity) |
| In-flight coalescing | 100ms | Share identical concurrent requests |

**Cache check order:**
1. Query cache → HIT? Return immediately
2. In-flight → EXISTING? Wait and share
3. MISS? Make request, cache result

---

## Related Documentation

- **CLAUDE.md** - AI agent behavior rules (in project root)
- **KNOWN_ISSUES.md** - Active bugs and recent fixes
- **RESUME_HERE.md** - Session handoff file
- **agent-learnings.md** - Agent system knowledge base
- **redesign/** - UI/UX redesign project files
