# Internal FAQ: How Community Voice Research Works

> **INTERNAL DOCUMENT** - Not for public distribution. This explains the technical flow for developers and stakeholders.
>
> Last updated: December 31, 2025 (Two-Stage Filter with Haiku AI Verification)

---

## Overview

When a user submits a research query through the Community Voice Research page, the system executes a multi-step pipeline that fetches data from multiple sources, filters it for relevance, and analyzes it for pain signals.

**Two Research Modes:**
1. **Hypothesis Mode** - User describes a problem/audience, system searches Reddit + HN + app stores
2. **App-Centric Mode** - User pastes an app URL, system fetches reviews for that specific app

---

## The User Experience

### Hypothesis Mode (Default)
1. User fills in "Who's struggling?" (e.g., "Solo athletes preparing for Hyrox races")
2. User fills in "What's their problem?" (e.g., "Training alone kills motivation")
3. User clicks "Check Data Availability"
4. **Quality Preview Modal** appears showing:
   - Predicted relevance % (how many posts will match)
   - Sample relevant posts (3 examples)
   - Filtered topics (what we're filtering OUT)
   - Warnings if quality is low
5. User clicks "Start Research" (or goes back to refine)

### App-Centric Mode
1. User clicks "Paste URL" tab
2. User pastes an App Store or Google Play URL (e.g., `https://apps.apple.com/app/calm/id571800810`)
3. System fetches app details and shows confirmation (name, rating, review count)
4. AI generates problem description and search phrases based on app
5. Quality Preview Modal appears (same as above)
6. User clicks "Start Research"

---

## Quality Preview Modal (Pre-Research Gate)

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
| **Filtered Topics** | What topics we're filtering OUT (helps user understand bias) |
| **Broadening Suggestions** | Actionable ways to improve (e.g., "Remove 'christmas' to find year-round discussions") |
| **Removed Post Rate** | Warning if 30%+ of posts are deleted by moderators |

**Warning Thresholds:**
| Warning Level | Predicted Relevance | User Action Required |
|---------------|---------------------|---------------------|
| `strong_warning` | < 8% | Checkbox confirmation required |
| `caution` | 8-20% | Warning shown, can proceed |
| `none` | > 20% | Good to go |

---

## App-Centric Mode: Technical Flow

When a user pastes an app URL, the flow is different:

### Step A1: Parse App URL
**Files involved:**
- `src/lib/data-sources/app-url-utils.ts`

**What happens:** Extract app ID and store type from URL:
- `https://apps.apple.com/app/calm/id571800810` → `{store: 'app_store', appId: '571800810'}`
- `https://play.google.com/store/apps/details?id=com.calm.android` → `{store: 'google_play', appId: 'com.calm.android'}`

### Step A2: Fetch App Details
**Files involved:**
- `src/lib/data-sources/adapters/app-store-adapter.ts` → `getAppDetails()`
- `src/lib/data-sources/adapters/google-play-adapter.ts` → `getAppDetails()`

**Who talks to who:** Server → App Store Scraper / Google Play Scraper (npm packages)

**What happens:** Fetch app metadata: name, developer, category, rating, review count, description, IAP status.

### Step A3: Generate Problem Description
**Files involved:**
- `src/app/api/research/interpret-hypothesis/route.ts`

**Who talks to who:** Server → Claude AI (Sonnet)

**What happens:** Claude reads the app description and generates:
- Primary problem the app solves
- Target users (audience)
- Search phrases for Reddit/HN
- App discovery context (domain keywords, expected categories, competitor apps)

### Step A4: Fetch App-Specific Reviews
**Files involved:**
- `src/app/api/research/community-voice/route.ts`
- `src/lib/data-sources/adapters/app-store-adapter.ts` → `getReviewsForAppId()`
- `src/lib/data-sources/adapters/google-play-adapter.ts` → `getReviewsForAppId()`

**Who talks to who:** Server → App Store/Google Play Scrapers

**What happens:**
- Extract `appData` from `coverageData` (contains app ID and store type)
- Call the appropriate adapter's `getReviewsForAppId()` method
- Fetch up to 100 reviews directly for that specific app
- App Store: Paginated (50 reviews per page)
- Google Play: Single request

**Key difference from hypothesis mode:** Reviews are fetched by app ID, not by keyword search. This ensures we analyze reviews FOR THE SPECIFIC APP being researched.

### Step A5: Merge with Other Data Sources
The app-specific reviews are merged with:
- Reddit posts (searched by generated keywords)
- Hacker News posts (if enabled)
- Additional app store reviews (from related apps)

All posts then flow through the same analysis pipeline (Steps 7-10).

---

## Hypothesis Mode: Step-by-Step Technical Flow

### Step 1: Hypothesis Interpretation

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
- `appDiscovery` - Context for app store searches:
  - `domainKeywords` - Core domain terms (e.g., ["expat", "health insurance"])
  - `expectedCategories` - App store categories to search
  - `antiCategories` - Categories to exclude
  - `competitorApps` - Known relevant apps

---

### Step 2: Find the Right Reddit Communities

**Files involved:**
- `src/lib/reddit/subreddit-discovery.ts`

**Who talks to who:** Server → Claude AI (Haiku model)

**What happens:** Claude figures out which subreddits discuss this problem. This is a 3-stage process:

1. **Domain Extraction:** Claude identifies the *problem domain* (not just the audience)
   - "Solo Hyrox athletes with motivation issues" → Domain = "fitness training motivation"
   - NOT just "athletes" (that's too broad)

2. **Subreddit Discovery:** Claude suggests 8-12 relevant communities
   - Example: r/crossfit, r/Hyrox, r/fitness, r/homefitness

3. **Validation:** Claude double-checks each suggestion
   - Rejects subreddits that match the audience but NOT the problem
   - Example: r/solotravel would be rejected (matches "solo" but not fitness)

---

### Step 3: Fetch Data from Multiple Sources

**Files involved:**
- `src/lib/data-sources/arctic-shift.ts` (Reddit)
- `src/lib/data-sources/adapters/google-play-adapter.ts`
- `src/lib/data-sources/adapters/app-store-adapter.ts`
- `src/lib/data-sources/adapters/hacker-news-adapter.ts`

**Who talks to who:** Server → Multiple APIs
- Arctic Shift API (Reddit archive)
- Google Play Scraper (npm: `google-play-scraper`)
- App Store Scraper (npm: `app-store-scraper`)
- Algolia HN Search API (Hacker News)

**What happens:**

**Reddit (Arctic Shift):**
- For each subreddit from Step 2, download up to 100-450 posts depending on depth setting
- We do NOT use `query` or `body` params - multi-word searches cause 422 timeouts
- Fetch by subreddit + time range only; Claude filters for relevance
- Uses adaptive time windows (see Step 3b)

**Google Play & App Store:**
- Always checked (not just for mobile keywords)
- Uses multi-query discovery strategy:
  - Original hypothesis search
  - Domain keywords from interpretation
  - Competitor app names
- Each app scored by Claude for relevance (0-10)
- Top apps' reviews fetched and converted to pipeline format

**Hacker News:**
- Search Algolia API with single primary keyword (multi-word causes poor relevance)
- Fetch up to 50 stories + comments

**Result:** 500-1,000+ raw posts from all sources combined

---

### Step 3b: Adaptive Time-Stratified Fetching (Reddit)

**Files involved:**
- `src/lib/data-sources/arctic-shift.ts` → `searchPosts()`, `getTimeWindows()`
- `src/lib/arctic-shift/rate-limiter.ts` → `rateLimitedFetch()`
- `src/app/api/research/coverage-check/route.ts` → `postsPerDay` calculation

**The Problem Solved:**

Before this system, fetching "100 recent posts" from active subreddits like r/entrepreneur only got 2-3 days of data. For market research, we need months of data to find recurring pain patterns.

**How It Works:**

1. **Posting Velocity Calculation (Coverage Check)**
   During the coverage check phase, we calculate how fast each subreddit posts:
   ```
   postsPerDay = 100 / ((newest_timestamp - oldest_timestamp) / 86400)
   ```
   This tells us: r/entrepreneur = 50 posts/day, r/microsaas = 2 posts/day

2. **Activity Classification**
   Based on posting velocity, subreddits are classified:
   | Activity Level | Posts/Day | Time Windows |
   |----------------|-----------|--------------|
   | HIGH | >20 | 3 windows: [0-30d], [30-180d], [180-365d] |
   | MEDIUM | 5-20 | 2 windows: [0-90d], [90-365d] |
   | LOW | <5 | 1 window: [0-365d] |

3. **Adaptive Fetching**
   For each subreddit, we fetch from multiple time windows to ensure year-round coverage:
   - HIGH activity sub with 150 posts target → 50 posts from each of 3 windows
   - LOW activity sub → all 150 posts from single year-long window

**Analysis Depth Presets:**

Users choose their analysis depth in the Coverage Preview:

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

This prevents API overload when multiple users run research simultaneously.

---

### Step 4: Quality Filter (Free, No AI)

**Files involved:**
- `src/lib/research/relevance-filter.ts` → `qualityGateFilter()`

**Who talks to who:** Just code - no AI needed

**What happens:** Remove garbage posts before wasting AI analysis on them:
- Deleted posts: `[removed]`, `[deleted]`, `[unavailable]`
- Too short: Less than 50 characters
- Non-English content
- Spam: "follow me", "click here", "subscribe"

**Title-Only Posts (NEW):**
- Posts with removed body but substantive title (30+ chars) are KEPT
- Marked with `_titleOnly: true` for downstream processing
- Weighted at 0.7x in pain detection due to limited context

**Result:** ~80-90% of posts survive this filter

---

### Step 4.5-6: Two-Stage Filter Pipeline — NEW Dec 31, 2025

**Files involved:**
- `src/lib/filter/config.ts` → All thresholds and caps
- `src/lib/filter/universal-filter.ts` → Embedding filter
- `src/lib/filter/ai-verifier.ts` → Haiku verification
- `src/lib/filter/index.ts` → `filterSignals()` orchestration

**Who talks to who:**
- Stage 1: Server → OpenAI Embeddings API → Supabase pgvector cache
- Stage 2: Code-only (sorting)
- Stage 3: Server → Claude Haiku

**The Pipeline:**

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: EMBEDDING FILTER (Loose, ~$0.01)                       │
│                                                                 │
│ Threshold: 0.28 (loose to catch candidates)                     │
│ - Generate hypothesis embedding (problem-focused)               │
│ - Generate post embeddings (batch, cached in pgvector)          │
│ - Cosine similarity ≥ 0.28 → PASS                               │
│                                                                 │
│ Output: ~800-1100 candidates from 2500 posts                    │
├─────────────────────────────────────────────────────────────────┤
│ STAGE 2: RANK + CAP (Cost Control, FREE)                        │
│                                                                 │
│ 1. Sort by embedding score (descending)                         │
│ 2. Take top 50 (AI_VERIFICATION_CAP)                            │
│                                                                 │
│ Guarantees fixed cost regardless of data volume                 │
├─────────────────────────────────────────────────────────────────┤
│ STAGE 3: HAIKU AI VERIFICATION (~$0.05)                         │
│                                                                 │
│ Model: claude-3-5-haiku-latest                                  │
│ Prompt: "Is this post SPECIFICALLY about [hypothesis]?"         │
│ Response: YES / NO only                                         │
│                                                                 │
│ Output: ~10-16 verified signals (20-32% pass rate)              │
└─────────────────────────────────────────────────────────────────┘
```

**Why Two-Stage?**

| Old Approach | Problem |
|--------------|---------|
| Domain Gate + Problem Match | Complex, inconsistent, expensive |
| Single embedding threshold (0.34) | 30-50% irrelevant signals |

| New Approach | Benefit |
|--------------|---------|
| Loose embeddings (0.28) + AI verify | Simple, strict, cheap |
| Cap at 50 | Fixed cost regardless of data volume |

**Test Results (Dec 31, 2025):**

| Hypothesis | Stage 1 | Verified | Relevance |
|------------|---------|----------|-----------|
| Freelancers getting paid | 810 | 10 | 100% |
| Founders first customers | 1,086 | 16 | 90%+ |
| Developers slow CI/CD | 776 | 16 | 80%+ |

**Query Expansion for Short Hypotheses:**
- Hypotheses with ≤3 words auto-expand for better embeddings
- "Slack" → "Problems, frustrations, and pain points with Slack..."

**Verification Prompt:**
```
Hypothesis: "Freelancers struggling to get paid on time by clients"

Post:
Title: "We Lost $120k to Client Nonpayment: our story"
Body: "After 3 years of freelancing..."

Is this post SPECIFICALLY about the problem described in the hypothesis?
Answer ONLY "YES" or "NO".
```

**Result:** 10-16 highly relevant signals with 85-100% relevance rate

---

### Step 7: Pain Signal Detection

**Files involved:**
- `src/lib/analysis/pain-detector.ts`

**Who talks to who:** Just code - pattern matching

**What happens:** The system scans the remaining posts for "pain signals" - phrases that indicate real problems:
- Frustration markers: "I hate...", "so annoying", "drives me crazy"
- Problem admission: "I struggle with...", "can't seem to..."
- Need expression: "I wish there was...", "if only..."
- Financial pain: "costs too much", "can't afford"

Each pain signal gets:
- **Severity score** (1-10)
- **Tier** (CORE or RELATED based on relevance)
- **Source** (reddit, google_play, app_store)
- **Weight** (0.7x for title-only posts)

---

### Step 8: Theme Extraction

**Files involved:**
- `src/lib/analysis/theme-extractor.ts`

**Who talks to who:** Server → Claude AI (Sonnet model - smarter)

**What happens:** Claude reads all the pain signals and groups them into themes.

**Multi-Source Tracking (NEW):**
Each theme tracks which sources contributed:
- `sources: ['reddit', 'google_play', 'app_store']`
- Counts: `redditCount`, `googlePlayCount`, `appStoreCount`

**Tier-Based Prioritization (NEW):**
- Analyzes CORE signals first, then RELATED
- Themes from mainly RELATED signals prefixed with `[CONTEXTUAL]`
- Each theme has `tier: 'core' | 'contextual'`

**Example output:**
- Theme 1: "Lack of accountability" (35% of signals) - core
- Theme 2: "Can't push to failure alone" (25% of signals) - core
- Theme 3: "[CONTEXTUAL] Boring repetitive workouts" (20% of signals) - contextual

**Key Opportunity Identification (NEW):**
When there's a strong frequency + intensity signal, returns:
- `keyOpportunity: "High demand for real-time form feedback in home workouts"`

---

### Step 9: Competitor Intelligence

**Files involved:**
- `src/lib/analysis/theme-extractor.ts` → competitor analysis

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Claude identifies competitors mentioned in the pain signals.

**Enhanced Competitor Intelligence (NEW):**
- `isActualProduct: boolean` - Claude assesses if it's a real product
- Categories: `direct_competitor | adjacent_solution | workaround`
- Includes `mentionCount`, `sentiment`, `context`, `confidence`

**Strategic Recommendations (NEW):**
Based on actual data signals, returns actionable recommendations:
- Action format: "Action verb + specific tactic"
- Example: "Position around 'hassle-free' messaging based on 23 mentions"

---

### Step 10: Interview Question Generation

**Files involved:**
- `src/lib/analysis/theme-extractor.ts` → `generateInterviewQuestions()`

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Based on the themes, Claude generates questions the user could ask in customer interviews.

**Example output:**
- "How do you stay motivated during solo training sessions?"
- "What happens when you hit a wall without a training partner?"
- "Have you tried any tools or methods to simulate accountability?"

---

### Step 11: Market Sizing & Timing Analysis

**Files involved:**
- `src/lib/analysis/market-sizing.ts`
- `src/lib/analysis/timing-analyzer.ts`

**Who talks to who:** Server → Claude AI (Sonnet model)

**What happens:** Claude estimates:
- **Market size:** How many people have this problem × what they'd pay
- **Timing:** Is this a growing trend? Good time to enter?

---

## Full Data Flow Diagram

### Hypothesis Mode
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
│  → Run sampleQualityCheck() for relevance prediction        │
│  → Show Quality Preview Modal to user                       │
│  → User confirms or refines hypothesis                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Fetch Multi-Source Data                            │
│  ├── Reddit (Arctic Shift): 500-800 posts, adaptive windows │
│  ├── Google Play: Reviews from matching apps (LLM-scored)   │
│  ├── App Store: Reviews from matching apps (LLM-scored)     │
│  └── Hacker News: Stories + comments (if enabled)           │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  TWO-STAGE FILTERING PIPELINE                               │
│                                                             │
│  Step 4: Quality Gate (code only, free)                     │
│  → Remove deleted, short, non-English, spam                 │
│  → Keep title-only posts (marked, weighted 0.7x)            │
│                                                             │
│  Step 5: Embedding Filter (OpenAI, ~$0.01)                  │
│  → Semantic similarity at 0.28 threshold (loose)            │
│  → Rank by score, cap at 50 candidates                      │
│                                                             │
│  Step 6: Haiku Verification (Claude Haiku, ~$0.05)          │
│  → YES/NO: "Is this SPECIFICALLY about [hypothesis]?"       │
│  → Only "YES" passes (strict mode)                          │
│                                                             │
│  Result: 10-16 verified signals with 85-100% relevance      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  ANALYSIS PIPELINE                                          │
│                                                             │
│  Step 7: Pain Detection (code) - tier-aware, source-tracked │
│  Step 8: Theme Extraction (Claude Sonnet) - multi-source    │
│  Step 9: Competitor Intelligence (Claude Sonnet)            │
│  Step 10: Interview Questions (Claude Sonnet)               │
│  Step 11: Market + Timing (Claude Sonnet)                   │
└─────────────────────────────────────────────────────────────┘
    ↓
RESULTS PAGE (Community Voice tabs)
```

### App-Centric Mode
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
│  SAME TWO-STAGE FILTER + ANALYSIS PIPELINE (Steps 4-11)     │
└─────────────────────────────────────────────────────────────┘
    ↓
RESULTS PAGE (App-Centric tabs: App, Feedback, Market, Gaps, Verdict)
```

---

## App-Centric Results: The Feedback Tab

In app-centric mode, the results page shows different tabs than hypothesis mode:

| Tab | Content |
|-----|---------|
| **App** | App details, description, what it solves |
| **Feedback** | Pain points, feature requests from app reviews |
| **Market** | Market sizing and competitor analysis |
| **Gaps** | Opportunities and unmet needs |
| **Verdict** | Overall viability score |

### How the Feedback Tab Gets Data

The Feedback tab (`src/components/research/user-feedback.tsx`) filters pain signals to show only those from app store sources:

```typescript
const appStoreSignals = signals.filter(
  s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
)
```

**Important:** If `getReviewsForAppId()` isn't called, the Feedback tab will show ZERO data because:
1. The keyword-based search (`searchReviewsLegacy()`) searches for apps matching keywords
2. It might find different apps, not the specific app being analyzed
3. The `subreddit` field must be exactly `'google_play'` or `'app_store'`

---

## App Discovery Learning System (NEW)

**Files involved:**
- `supabase/migrations/014_app_discovery_events.sql`
- (Future: learning integration)

**Purpose:** Track app discovery patterns for continuous improvement.

**Tracks:**
| Field | Purpose |
|-------|---------|
| `discovery_method` | How app was found: keyword_search, competitor_search, category_search |
| `llm_relevance_score` | Claude's relevance score (0-10) |
| `llm_relevance_reason` | Why Claude scored it this way |
| `was_auto_selected` | Did we auto-select this app? |
| `user_kept_selected` | Did user keep it selected or deselect? |
| `user_manually_added` | Did user add this app themselves? |
| `signals_from_app` | Post-research: how many pain signals found |
| `core_signal_count` | How many were CORE tier |

**Learning Applications:**
- Identify which apps Claude scores correctly (correlation with signals_from_app)
- Find patterns in manual additions vs auto-selection
- Improve app relevance scoring over time

---

## Why the Two-Stage Filter Matters

**The Problem:** Early testing showed 64% of "pain signals" were completely irrelevant to the business hypothesis.

**Example failure:** User asks about "men over 50 with aging skin". System found posts from men over 50, but many were about:
- Dating problems
- Career advice
- Financial issues
- Health issues unrelated to skin

**The Solution (Dec 31, 2025):** The two-stage filter:
1. **Loose embedding filter** (0.28 threshold) catches broad candidates
2. **Cap at 50** ensures fixed cost regardless of data volume
3. **Haiku YES/NO verification** filters false positives

**Why This Works Better:**
- **Simple:** One threshold + one AI prompt (vs. domain gate + problem match + keyword gate)
- **Cheap:** Fixed $0.06 cost (vs. variable $0.10-0.20)
- **Accurate:** 85-100% relevance (vs. 60-70% with old approach)

**Result:** 10-16 highly relevant signals per search with 85-100% relevance rate

---

## Cost Structure

| Step | AI Model | Cost per Research |
|------|----------|-------------------|
| Hypothesis Interpretation | Sonnet | ~$0.02 |
| Subreddit Discovery | Haiku × 3 | ~$0.003 |
| Quality Sampling (preview) | Haiku | ~$0.01 |
| **Embedding Filter** | OpenAI | ~$0.01 |
| **Haiku Verification (50 calls)** | Haiku | ~$0.05 |
| Pain Detection | Code | Free |
| Themes | Sonnet | ~$0.02 |
| Competitors | Sonnet | ~$0.02 |
| Questions | Sonnet | ~$0.01 |
| Market/Timing | Sonnet | ~$0.02 |
| **Total** | | **~$0.11** |

**Dec 31, 2025:** Two-stage filter provides fixed, predictable cost (~$0.06 for filtering) regardless of data volume.

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| **API Endpoints** | |
| Hypothesis interpretation | `src/app/api/research/interpret-hypothesis/route.ts` |
| Coverage check | `src/app/api/research/coverage-check/route.ts` |
| Main research endpoint | `src/app/api/research/community-voice/route.ts` |
| **Filtering & Quality** | |
| Relevance filtering | `src/lib/research/relevance-filter.ts` |
| Quality preview modal | `src/components/research/quality-preview-modal.tsx` |
| **Data Sources** | |
| Arctic Shift (Reddit) | `src/lib/data-sources/arctic-shift.ts` |
| Arctic Shift client | `src/lib/arctic-shift/client.ts` |
| Rate limiter | `src/lib/arctic-shift/rate-limiter.ts` |
| Google Play adapter | `src/lib/data-sources/adapters/google-play-adapter.ts` |
| App Store adapter | `src/lib/data-sources/adapters/app-store-adapter.ts` |
| Hacker News adapter | `src/lib/data-sources/adapters/hacker-news-adapter.ts` |
| App URL parser | `src/lib/data-sources/app-url-utils.ts` |
| **Analysis** | |
| Pain detection | `src/lib/analysis/pain-detector.ts` |
| Theme extraction | `src/lib/analysis/theme-extractor.ts` |
| Market sizing | `src/lib/analysis/market-sizing.ts` |
| Timing analysis | `src/lib/analysis/timing-analyzer.ts` |
| Save results | `src/lib/research/save-result.ts` |
| **Discovery & Learning** | |
| Subreddit discovery | `src/lib/reddit/subreddit-discovery.ts` |
| Keyword extraction | `src/lib/reddit/keyword-extractor.ts` |

---

## Error Handling

When research fails, the `error_source` field in `research_jobs` table indicates where:

| Error Source | Meaning | Common Causes |
|--------------|---------|---------------|
| `anthropic` | Claude API failed | Rate limits, invalid key, timeout |
| `arctic_shift` | Reddit data API failed | Service down, timeout |
| `database` | Supabase failed | Connection issues, RLS policies |
| `timeout` | Request took too long | Large data volume |

**Theme Extraction Error Handling (NEW):**
- Rate limit detection (429 errors) → "Please try again in a few minutes"
- Authentication errors (401) → "Please contact support"
- JSON parsing errors → "Please try again"

On failure, credits are automatically refunded via the `refund_credit` database function.

---

## Testing the Flow

```bash
# 1. Start dev server
npm run dev

# 2. Authenticate as test user
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# 3. Run research (costs 1 credit)
curl -X POST http://localhost:3000/api/research/community-voice \
  -b /tmp/cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"hypothesis":"Freelancers struggling with client management"}'
```

Or use Puppeteer via the `/test-flow` slash command.

### Testing Quality Preview
The quality preview runs during coverage check. Look for:
- `[QualitySample]` log entries showing sampling process
- `predictedRelevance` in coverage response
- Quality warning thresholds being applied

### Testing Adaptive Fetching
- Check for `[PostStats]` log entries showing posts/day per subreddit
- Check for `[AdaptiveFetch]` log entries showing activity classification
- Verify Quick/Standard/Deep depth settings work correctly
