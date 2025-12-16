# PVRE Implementation Plan

Last updated: December 16, 2025

Master roadmap for PVRE development. For active bugs, see `KNOWN_ISSUES.md`.

---

## Vision Summary

**Today:** Validation tool for entrepreneurs using Reddit data
**Tomorrow:** Market intelligence platform serving entrepreneurs AND investors using multi-source data

**Key milestones:**
1. Fix current data quality issues (tiering, removed posts)
2. Add UX improvements inspired by Buzzabout competitor analysis
3. Expand to multi-source data (App Stores, YouTube, TikTok)
4. Launch VC-specific features and pricing tier
5. Build two-sided intelligence platform

---

## Phase 1: Data Quality Fixes (Current Sprint)

### 1.1 Signal Tiering System
**Priority:** P0
**Effort:** Medium
**Impact:** Fixes theme misalignment for multi-domain hypotheses

**Problem:** System finds posts matching ANY domain instead of ALL domains. User asks about "gym socialization," gets themes about general social anxiety.

**Solution:** Three-tier classification instead of binary Y/N:
- **CORE** — Intersection match (both context + problem)
- **RELATED** — Single-domain match (context OR problem)
- **N** — No match

**Implementation:**

Modify Problem Gate in `src/lib/research/relevance-filter.ts`:

```
TIERED RELEVANCE CHECK

HYPOTHESIS: {{hypothesis}}

DOMAIN BREAKDOWN:
- PRIMARY CONTEXT: {{primaryDomain}} (e.g., "gym/fitness environment")
- PROBLEM: {{problem}} (e.g., "wanting to socialize but not knowing how")

For each post, determine the RELEVANCE TIER:

CORE (intersection match):
- Post discusses the PROBLEM within the PRIMARY CONTEXT
- Example: "How do I talk to people at the gym?" → CORE

RELATED (single-domain match):
- Post discusses PROBLEM but not in PRIMARY CONTEXT, OR
- Post is about PRIMARY CONTEXT but not the specific PROBLEM
- Example: "I can't keep friends as an adult" → RELATED

N (no match):
- Post doesn't match either domain
- Post explicitly conflicts with hypothesis
- Example: "I hate gyms, workout at home" → N
```

**Theme extraction weighting:**
- Themes derived PRIMARILY from CORE signals
- RELATED signals labeled as "CONTEXTUAL"
- CORE themes appear first in report

**Report display:**
```
Total Signals: 36
├── Core Signals: 8 (directly about gym socialization)
└── Related Signals: 28 (broader context)

[CORE] Anxiety about approaching people at the gym
[CORE] Uncertainty about gym social etiquette
[CONTEXTUAL] General difficulty making adult friendships
```

**Detect when to apply tiering:**
Apply when primaryDomain is a SETTING (gym, workplace, school, home, restaurant) rather than a PROBLEM DOMAIN (validation, loneliness, productivity).

---

### 1.2 Always Include Removed Posts
**Priority:** P1
**Effort:** Low
**Impact:** +50-100% more signals

**Problem:** ~50% of Reddit content is [removed]. Currently only recovered when data sparse (<10 posts).

**Solution:** ALWAYS recover posts with substantive titles (>30 chars).

**Implementation:**

Modify quality gate:
```
if (post.body === '[removed]') {
  if (post.title.length >= 30 && !isSpamTitle(post.title)) {
    return { 
      decision: 'Y',
      reason: 'removed_recoverable',
      analysisMode: 'title_and_comments',
      body: `[Content removed by moderator] Title: ${post.title}`
    };
  }
}
```

**Weighting:** 0.7x for removed posts (not 0.5x — titles are often the clearest pain expression)

**Transparency in report:**
```
Content Analyzed: 84 items
├── Full posts: 24
├── Recovered posts: 42 (title + comments only)
└── Comments: 18
```

**Quote attribution:**
```
"How do I approach someone at the gym?"
— r/socialskills [from post title, body removed]
```

---

## Phase 2: UX Improvements (Inspired by Buzzabout)

### 2.1 Conversational Input Redesign
**Priority:** P0
**Effort:** High
**Impact:** Dramatically reduces friction, solves multi-domain problem at input stage

**Inspiration:** Buzzabout uses single text field + AI interpretation instead of structured forms.

**Current PVRE:** 3-4 structured fields (Audience, Problem, Language, Solution)
- Higher friction
- Users confused about which box to use
- Feels like homework

**New approach:** Single input → AI interprets → User confirms

**Implementation:**

**Step 1: Single Input Field**
```
┌─────────────────────────────────────────────────────────┐
│ 💡 What do you want to validate?                         │
│                                                          │
│ [People who want to make friends at the gym but feel___] │
│ [awkward approaching strangers_________________________] │
│                                                          │
│ Examples:                                                │
│ • "Busy parents who waste hours on meal planning"       │
│ • "Remote workers who feel isolated and lonely"         │
│ • "Freelancers struggling to find clients"              │
│                                                          │
│                              [Continue →]                │
└─────────────────────────────────────────────────────────┘
```

**Step 2: AI Interpretation & Confirmation**
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Here's what I understood:                             │
│                                                          │
│ 👥 Audience                                              │
│    People who go to gyms regularly                       │
│                                                          │
│ 😤 Problem                                               │
│    Want to socialize/make friends but feel awkward       │
│    approaching strangers                                 │
│                                                          │
│ 🗣️ They might say things like:                          │
│    • "How do I talk to people at the gym?"              │
│    • "Is it weird to approach someone between sets?"    │
│    • "Everyone wears headphones, how do I connect?"     │
│                                                          │
│ Does this look right?                                    │
│                                                          │
│ [✓ Yes, search this]    [✎ Let me adjust]               │
└─────────────────────────────────────────────────────────┘
```

**Step 3: If "Let me adjust" → Show Editable Fields**
```
┌─────────────────────────────────────────────────────────┐
│ ✎ Adjust your search:                                    │
│                                                          │
│ Audience (who's struggling?)                             │
│ [People who go to gyms regularly______________]          │
│                                                          │
│ Problem (what's their pain?)                             │
│ [Want to socialize but feel awkward approaching]         │
│                                                          │
│ Search phrases (how they describe it)                    │
│ [x] "How do I talk to people at the gym"                │
│ [x] "Is it weird to approach someone"                   │
│ [ ] "Gym etiquette for making friends"    [+ Add more]  │
│                                                          │
│ [← Back]                      [Continue with changes →]  │
└─────────────────────────────────────────────────────────┘
```

**Step 4: Refinement Suggestions (for vague inputs)**

If AI detects ambiguity or multi-domain hypothesis:
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 I can search for this, but you might get better      │
│    results with a more specific angle:                   │
│                                                          │
│ Your search: "gym socializing"                           │
│                                                          │
│ Suggested refinements:                                   │
│                                                          │
│ 👥 By audience:                                          │
│    • "introverts wanting gym friends"                   │
│    • "women who want to meet people at the gym"         │
│    • "older adults socializing through fitness"         │
│                                                          │
│ 🎯 By specific pain:                                     │
│    • "fear of being seen as creepy at the gym"          │
│    • "headphone culture making gym conversation hard"   │
│    • "not knowing gym social etiquette"                 │
│                                                          │
│ [Search as-is]  [Use a suggestion]  [Write my own]      │
└─────────────────────────────────────────────────────────┘
```

**Backend changes:**

New API endpoint: `/api/research/interpret-hypothesis`
```typescript
// Input
{ rawInput: "gym socializing" }

// Output
{
  interpretation: {
    audience: "People who go to gyms",
    problem: "Want to socialize but don't know how",
    searchPhrases: ["How do I talk to people at the gym", ...],
    confidence: "medium",
    ambiguities: ["Could mean gym-goers OR fitness instructors"]
  },
  refinementSuggestions: [
    { type: "audience", suggestion: "introverts at the gym" },
    { type: "pain", suggestion: "fear of being creepy" }
  ]
}
```

**Benefits:**
- One field = dramatically lower friction
- AI does the hard work of structuring
- User confirms understanding BEFORE spending credits
- Catches multi-domain issues early with refinement suggestions
- Structured form still available for power users

---

### 2.2 URL Analysis Mode (New Capability)
**Priority:** P1
**Effort:** Medium
**Impact:** New use case, competitive analysis

**Inspiration:** Buzzabout allows pasting URLs instead of typing queries.

**Implementation:**

Add URL option to input:
```
┌─────────────────────────────────────────────────────────┐
│ 💡 What do you want to validate?                         │
│                                                          │
│ [_______________________________________________]        │
│                                                          │
│ ─────────────── or ───────────────                       │
│                                                          │
│ 🔗 Paste a URL to analyze                                │
│ [https://___________________________________]            │
│                                                          │
│ Works with: Reddit threads, Product Hunt, competitor     │
│ websites, TikTok videos, app store pages                 │
└─────────────────────────────────────────────────────────┘
```

**Supported URL types:**

| URL Type | What We Extract |
|----------|-----------------|
| Reddit thread | Pain signals from post + all comments |
| Reddit search | Top posts matching query |
| Product Hunt | Launch feedback, feature requests |
| Competitor website | Positioning, value props, gaps |
| App Store page | Reviews, complaints, feature requests |
| TikTok video | Comments expressing needs |

**Example flow for Reddit URL:**
```
URL: reddit.com/r/socialskills/comments/abc123

┌─────────────────────────────────────────────────────────┐
│ 📄 Analyzing Reddit Thread:                              │
│    "How do I approach people at the gym?"               │
│                                                          │
│ Found: 1 post + 247 comments                            │
│                                                          │
│ Quick Analysis:                                          │
│ • Main pain: Fear of being perceived as creepy          │
│ • Sentiment: 72% frustrated, 18% seeking advice         │
│ • Top suggestion mentioned: "Wait for eye contact"      │
│                                                          │
│ [Run full analysis (1 credit)]  [Find similar threads]  │
└─────────────────────────────────────────────────────────┘
```

**Example flow for Competitor URL:**
```
URL: competitor-app.com

┌─────────────────────────────────────────────────────────┐
│ 🏢 Analyzing Competitor:                                 │
│    "GymBuddy - Find workout partners near you"          │
│                                                          │
│ Positioning: Social fitness app for finding gym buddies │
│ Pricing: Free + $9.99/mo premium                        │
│ Key features: Matching, scheduling, chat                │
│                                                          │
│ Want to find what their users complain about?           │
│                                                          │
│ [Analyze their app reviews]  [Find Reddit discussions]  │
└─────────────────────────────────────────────────────────┘
```

---

### 2.3 Live Post Preview Before Running
**Priority:** P0
**Effort:** Medium
**Impact:** Builds trust, reduces "wrong search" frustration

**Inspiration:** Buzzabout shows actual posts BEFORE spending credits.

**Implementation:**

After source selection, show:
```
Posts preview for: "gym AND socializing"

📍 Reddit (23 posts found)
• "How do I talk to people at the gym without being weird?" — r/socialskills
• "Is it weird to approach someone between sets?" — r/Fitness

📍 TikTok (45 videos found)
• "How I made gym friends as an introvert" — @fitnessgirl
• "Gym etiquette: when to talk to people" — @gymcoach

[Looks good] [Refine search]
```

**Benefits:**
- User sees what they'll get BEFORE spending credit
- Can refine if results look off
- Reduces refund requests

---

### 2.4 Multi-Source Selection UI
**Priority:** P1
**Effort:** Low
**Impact:** User control, transparency

**Inspiration:** Buzzabout has checkboxes for Reddit, TikTok, YouTube, Instagram, X, LinkedIn.

**Implementation:**
```
Sources:
☑ Reddit          ☑ TikTok         ☑ Hacker News
☐ Instagram       ☐ YouTube        ☐ Indie Hackers

Date range: Last 3 months ▼
Language: English ▼
```

**Note:** Only show sources we actually support. Add more as we build adapters.

---

### 2.5 "Ask Anything" Chat on Results
**Priority:** P1
**Effort:** High
**Impact:** High engagement, differentiation

**Inspiration:** Buzzabout has "Ask anything..." input on results page.

**Implementation:**

After showing report, add chat interface:
```
Ask about your results...

Suggested questions:
• "What's the most common complaint?"
• "Which subreddits had strongest signals?"
• "What price points are mentioned?"
• "Show me the most emotional posts"
```

**Technical approach:**
- Store raw signals in job record
- Chat queries the stored data with Claude
- Answers reference specific quotes/sources

---

### 2.6 Better Loading Experience
**Priority:** P2
**Effort:** Low
**Impact:** Delight, professionalism

**Inspiration:** Buzzabout has playful step names + quotes.

**Current steps:** Generic "Processing..."

**New steps:**
1. Firing up the engines
2. Gathering the juicy data
3. Picking out the hot takes
4. Connecting the dots
5. Calculating the numbers
6. Packaging your insights

**Add rotating quotes:**
- "What you show is more important than what you say." — David Ogilvy
- "Fall in love with the problem, not the solution." — Uri Levine
- "Your most unhappy customers are your greatest source of learning." — Bill Gates

---

### 2.7 Subscription Pricing Option
**Priority:** P2
**Effort:** Medium
**Impact:** Power user retention, predictable revenue

**Inspiration:** Buzzabout offers both one-time AND monthly.

**Current:** One-time packs only (£14/£39/£79)

**Add monthly tiers:**
| Tier | Price | Researches | Per Research |
|------|-------|------------|--------------|
| Starter | £29/mo | 5 | £5.80 |
| Pro | £79/mo | 15 | £5.27 |
| Team | £199/mo | 50 | £3.98 |

**Benefits:**
- Predictable revenue
- Power users stay subscribed
- Higher LTV than one-time purchases

---

### 2.8 Emotions Breakdown (Beyond Positive/Negative)
**Priority:** P2
**Effort:** Medium
**Impact:** Richer sentiment analysis

**Inspiration:** Buzzabout shows 6 emotions, not just positive/negative.

**Implementation:**

Instead of just sentiment score, break down by emotion:
```
Emotions in Community Discussions:

😊 Joy         ████████████████░░░░  43.4%
😐 Neutral     ██████████░░░░░░░░░░  28.1%
😢 Sadness     █████░░░░░░░░░░░░░░░  12.0%
😠 Anger       ██░░░░░░░░░░░░░░░░░░   5.7%
😮 Surprise    ██░░░░░░░░░░░░░░░░░░   4.9%
😨 Fear        █░░░░░░░░░░░░░░░░░░░   4.0%
```

**Prompt addition for theme extraction:**
```
For each signal, also classify the PRIMARY EMOTION:
- Joy (excitement, happiness, enthusiasm)
- Neutral (factual, informational)
- Sadness (disappointment, frustration, regret)
- Anger (complaints, outrage, annoyance)
- Surprise (unexpected discovery, amazement)
- Fear (worry, anxiety, concern)
```

**Value:** Tells user HOW people feel, not just what they say. Anger signals = urgent problems. Fear signals = risk concerns.

---

### 2.9 Actionable Executive Summary
**Priority:** P1
**Effort:** Medium
**Impact:** Higher perceived value

**Inspiration:** Buzzabout summaries include strategic recommendations with bolded key terms.

**Current PVRE:** Descriptive summaries ("People discuss X...")

**New format:**
```
EXECUTIVE SUMMARY

Conversation momentum is rising around gym socialization, with 
**social anxiety** and **etiquette uncertainty** as the dominant 
pain drivers. The most resonant content involves **approaching 
strangers** and **headphone culture** complaints.

STRATEGIC RECOMMENDATIONS:
1. Position around "low-pressure" social features (matches pain)
2. Address etiquette confusion with clear guidelines
3. Target the "introverted gym-goer" segment (highest pain intensity)

KEY OPPORTUNITY: "Gym buddy matching" mentioned 54 times with 
high emotional intensity — strong product signal.
```

**Prompt enhancement:**
```
End with 2-3 STRATEGIC RECOMMENDATIONS based on the data.
Format: Action verb + specific tactic + why (based on evidence)
Bold the key terms that would be important for positioning.
```

---

### 2.10 Topic Resonance Scoring
**Priority:** P2
**Effort:** Low
**Impact:** Better signal prioritization

**Inspiration:** Buzzabout shows "Resonance" (Low/Medium/High) per topic.

**Definition:** Resonance = Engagement relative to views
- High views, low engagement = Low resonance (people see but don't care)
- Lower views, high engagement = High resonance (people really care)

**Implementation:**
```
resonanceScore = (likes + comments * 2) / views * 1000

Thresholds:
- High: resonanceScore > 50
- Medium: resonanceScore 20-50
- Low: resonanceScore < 20
```

**Display in themes:**
```
[HIGH RESONANCE] Anxiety about approaching people at the gym
People engage strongly with this topic — 8.2% engagement rate

[LOW RESONANCE] General fitness advice
High volume but low engagement — people aren't as invested
```

---

### 2.11 Activity Timeline with Spike Detection
**Priority:** P2
**Effort:** High
**Impact:** Trend intelligence

**Inspiration:** Buzzabout shows activity over time with annotated spikes and AI explanations.

**Implementation:**

1. **Chart:** Plot mentions/signals over time (last 3 months)
2. **Spike detection:** Identify when volume > 2x average
3. **AI explanation:** "What caused this spike?"

**Example output:**
```
📈 ACTIVITY TIMELINE

Mentions Spike: September 22-26, 2025

There was a clear spike reaching 10,149 mentions—significantly 
higher than the surrounding 1,186 average.

Likely cause: Viral TikTok about "gym approach anxiety" posted 
Sep 21 by @fitnessgirl (2.3M views) triggered widespread discussion.

Takeaway: This topic has viral potential when framed around 
social anxiety rather than just fitness.
```

---

### 2.12 Pre-Built "Skills" for Chat
**Priority:** P2
**Effort:** Medium
**Impact:** Guided exploration, engagement

**Inspiration:** Buzzabout has clickable skills: Pain points mining, Executive summary, Positive/negative quotes.

**Implementation:**

After showing results, offer quick-action buttons:
```
Chat with your data:

[📊 Pain points mining]     [📝 Executive summary]
[💬 Key quotes]             [🎯 Product opportunities]
[📈 Trend analysis]         [🔍 Competitor mentions]
```

Each button runs a pre-built prompt against the stored signals.

**Example "Pain points mining" prompt:**
```
Analyze these signals and extract the TOP 5 specific pain points.
For each:
1. State the pain in user's language
2. Frequency (how many mentions)
3. Intensity (how emotional)
4. Quote example
5. Product implication
```

---

### 2.13 Topic Monitoring (Subscribe)
**Priority:** P3
**Effort:** High
**Impact:** Retention, ongoing value

**Inspiration:** Buzzabout has 🔔 Subscribe button for ongoing monitoring.

**Implementation:**

User can "subscribe" to a research topic:
- Weekly email digest of new mentions
- Alert when spike detected
- Monthly trend report

**Pricing:** Premium feature for subscribers only (not one-time purchases)

**Technical:** 
- Cron job runs searches weekly
- Compares to baseline
- Sends email via Resend/SendGrid

---

## Phase 3: Multi-Source Data Expansion

### 3.0 Data Source Assessment (Updated Dec 15, 2025)

**Confirmed Sources — Ready to Implement:**

| Source | Access Method | Cost | Commercial Use | PVRE Value |
|--------|---------------|------|----------------|------------|
| **Reddit** | Arctic Shift API | ✅ FREE | ✅ Yes | Pain signals from communities |
| **Google Play** | `google-play-scraper` npm | ✅ FREE | ✅ Yes | Competitor apps + user reviews |
| **App Store** | `app-store-scraper` npm | ✅ FREE | ✅ Yes | iOS competitor landscape |
| **YouTube** | Official Data API v3 | ✅ FREE (10k units/day) | ✅ Yes | Tutorial demand, problem searches |
| **TikTok** | `davidteather/TikTok-Api` | ✅ FREE | ✅ Yes | Emerging trends, Gen Z audience |
| **Hacker News** | Algolia HN Search API | ✅ FREE | ✅ Yes | Tech/SaaS validation, dev tools |

**Deprioritized Sources:**

| Source | Reason | Alternative |
|--------|--------|-------------|
| **Indie Hackers** | No official API, scraping required | HN covers similar audience |
| **Instagram** | API restrictions, high cost | TikTok covers similar ground |
| **GDELT** | News coverage ≠ consumer pain | Not useful for validation |
| **Wikipedia** | Encyclopedia views ≠ problem research | Not useful for validation |

**What Each Source Gives PVRE:**

| Source | Pain Signals | Competition Data | Trend/Timing | Market Size |
|--------|--------------|------------------|--------------|-------------|
| Reddit | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ |
| Google Play | ⭐⭐⭐⭐ (reviews) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ (installs) |
| App Store | ⭐⭐⭐⭐ (reviews) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| YouTube | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ (views) |
| TikTok | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Hacker News | ⭐⭐⭐⭐⭐ (tech) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

### 3.1 Unified Data Architecture

**CRITICAL: One Adapter Per Source File**

Each data source MUST have its own dedicated adapter file. This allows us to:
- Fix bugs in one source without affecting others
- Add/remove sources easily
- Test each adapter independently
- Handle rate limits and errors per-source

**File Structure:**
```
src/lib/data-sources/
├── types.ts                      # Unified signal schema (shared)
├── orchestrator.ts               # Source selection + merge logic
│
├── adapters/
│   ├── reddit-adapter.ts         # Arctic Shift API
│   ├── hacker-news-adapter.ts    # Algolia HN API  
│   ├── youtube-adapter.ts        # YouTube Data API v3
│   ├── google-play-adapter.ts    # google-play-scraper npm
│   ├── app-store-adapter.ts      # app-store-scraper npm
│   └── tiktok-adapter.ts         # davidteather/TikTok-Api
│
└── filters/
    └── relevance-filter.ts       # Claude API for filtering
```

**Data Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR                                    │
│                    (Selects sources based on hypothesis)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    ADAPTER    │           │    ADAPTER    │           │    ADAPTER    │
│    Reddit     │           │  Hacker News  │           │   YouTube     │
│               │           │               │           │               │
│ reddit-       │           │ hacker-news-  │           │ youtube-      │
│ adapter.ts    │           │ adapter.ts    │           │ adapter.ts    │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        │  Raw posts/comments       │  Raw stories/comments     │  Raw videos
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     UNIFIED SIGNAL SCHEMA     │
                    │                               │
                    │  { id, source, title, body,   │
                    │    author, community, url,    │
                    │    engagement_score,          │
                    │    source_type, created_at }  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      CLAUDE RELEVANCE         │
                    │         FILTER                │
                    │                               │
                    │  "Is this post relevant to    │
                    │   the hypothesis?"            │
                    │                               │
                    │  Returns: CORE / RELATED / N  │
                    │  + extracts pain signals      │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      FILTERED SIGNALS         │
                    │    (Ready for analysis)       │
                    └───────────────────────────────┘
```

**Unified Signal Interface (types.ts):**

```typescript
export interface UnifiedSignal {
  id: string;
  source: 'reddit' | 'hacker_news' | 'youtube' | 'google_play' | 'app_store' | 'tiktok';
  source_type: 'discussion' | 'review' | 'video' | 'comment';
  
  // Content
  title: string;
  body: string;
  url: string;
  
  // Metadata
  author: string;
  community: string;        // subreddit, "hackernews", channel name, app name
  created_at: Date;
  
  // Engagement (normalized 0-100)
  engagement_score: number;
  raw_engagement: {         // Original metrics for transparency
    upvotes?: number;
    comments?: number;
    views?: number;
    points?: number;
    rating?: number;        // For reviews: 1-5 stars
  };
}

export interface SearchOptions {
  maxResults?: number;
  dateRange?: { start: Date; end: Date };
  sortBy?: 'relevance' | 'date' | 'engagement';
}

export interface DataSourceAdapter {
  source: string;
  search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]>;
  getComments?(itemId: string): Promise<UnifiedSignal[]>;
  healthCheck(): Promise<boolean>;
}
```

**Example Adapter Implementation:**

```typescript
// adapters/hacker-news-adapter.ts
import { UnifiedSignal, DataSourceAdapter, SearchOptions } from '../types';

const HN_API_BASE = 'https://hn.algolia.com/api/v1';

export class HackerNewsAdapter implements DataSourceAdapter {
  source = 'hacker_news' as const;
  
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    try {
      // 1. Fetch from Algolia API
      const response = await fetch(
        `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50`
      );
      const data = await response.json();
      
      // 2. Transform to unified schema
      return data.hits.map(hit => this.transformToSignal(hit));
    } catch (error) {
      console.error('[HackerNewsAdapter] Search failed:', error);
      return []; // Return empty, don't throw
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${HN_API_BASE}/search?query=test&hitsPerPage=1`);
      return res.ok;
    } catch {
      return false;
    }
  }
  
  private transformToSignal(hit: any): UnifiedSignal {
    return {
      id: `hn_${hit.objectID}`,
      source: 'hacker_news',
      source_type: 'discussion',
      title: hit.title || '',
      body: hit.story_text || '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author || 'unknown',
      community: 'hackernews',
      created_at: new Date(hit.created_at_i * 1000),
      engagement_score: this.calculateEngagement(hit),
      raw_engagement: {
        points: hit.points,
        comments: hit.num_comments,
      }
    };
  }
  
  private calculateEngagement(hit: any): number {
    // Normalize to 0-100 based on HN typical ranges
    const points = hit.points || 0;
    const comments = hit.num_comments || 0;
    return Math.min(100, (points + comments * 2) / 5);
  }
}
```

**Orchestrator Usage:**

```typescript
// orchestrator.ts
export class DataSourceOrchestrator {
  private adapters: Map<string, DataSourceAdapter>;
  
  constructor() {
    this.adapters = new Map([
      ['reddit', new RedditAdapter()],
      ['hacker_news', new HackerNewsAdapter()],
      ['youtube', new YouTubeAdapter()],
      // ... register all adapters
    ]);
  }
  
  async searchAll(
    query: string, 
    sources: string[], 
    options?: SearchOptions
  ): Promise<UnifiedSignal[]> {
    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      sources.map(source => {
        const adapter = this.adapters.get(source);
        return adapter?.search(query, options) ?? [];
      })
    );
    
    // Merge successful results
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<UnifiedSignal[]>).value);
  }
}
```

**CRITICAL: Claude Relevance Filtering Step**

After fetching raw signals from adapters, we MUST filter through Claude to determine relevance to the hypothesis. This is where we decide what content to show the user.

```typescript
// filters/relevance-filter.ts
export async function filterSignals(
  signals: UnifiedSignal[],
  hypothesis: string
): Promise<FilteredSignal[]> {
  // Batch signals (e.g., 20 at a time) and send to Claude API
  // Claude determines: CORE / RELATED / N for each signal
  // Claude also extracts pain signals from relevant content
  // Returns only CORE + RELATED signals with extracted insights
}
```

**The flow is:**
1. **Adapters fetch RAW data** from sources (no filtering)
2. **Orchestrator merges** into unified format
3. **Claude filters for RELEVANCE** (is this about the hypothesis?)
4. **Only relevant signals** go to analysis/display

**Architecture Rules:**

✅ **DO:**
- Keep each adapter in its own file
- Always normalize to UnifiedSignal schema
- Handle errors gracefully (return `[]`, don't throw)
- Log adapter-specific errors with `[AdapterName]` prefix
- Implement rate limiting per adapter
- Test each adapter independently
- Cache responses where appropriate

❌ **DO NOT:**
- Mix adapter logic with filtering logic
- Put multiple sources in one file
- Skip the Claude filtering step
- Return source-specific data structures to the rest of the app
- Let one adapter failure crash the whole search

---

### 3.2 Google Play Store Adapter
**Priority:** P0 — Implement First
**Cost:** FREE
**Best for:** Mobile app validation, competitor analysis, user pain from reviews

**Library:** `google-play-scraper` npm package
```bash
npm install google-play-scraper
```

**Capabilities:**
```typescript
import gplay from 'google-play-scraper';

// Search for competing apps
const apps = await gplay.search({ 
  term: 'water reminder', 
  num: 20,
  country: 'us'
});

// Get app details (installs, rating, price)
const appDetails = await gplay.app({ appId: 'com.example.app' });

// Get user reviews (PAIN SIGNALS!)
const reviews = await gplay.reviews({ 
  appId: 'com.example.app',
  sort: gplay.sort.NEWEST,
  num: 100
});

// Get similar apps (competitive landscape)
const similar = await gplay.similar({ appId: 'com.example.app' });
```

**What we extract for PVRE:**
| Data Point | PVRE Use |
|------------|----------|
| App count for keyword | Competition saturation |
| Average rating | Solution quality in market |
| Install counts | Market size validation |
| Negative reviews (1-2 stars) | Unmet needs / pain signals |
| Feature requests in reviews | Product opportunity gaps |
| Pricing (free/paid/IAP) | Willingness to pay signals |

**Rate limits:** No official limit, but implement throttling (1 req/sec) to avoid blocks.

**Source weighting:** 1.0x for app data, 1.2x for review pain signals

---

### 3.3 Apple App Store Adapter
**Priority:** P0 — Implement with Google Play
**Cost:** FREE
**Best for:** iOS competitor landscape, premium user segment

**Library:** `app-store-scraper` npm package (same interface as Google Play)
```bash
npm install app-store-scraper
```

**Capabilities:**
```typescript
import store from 'app-store-scraper';

// Search apps
const apps = await store.search({ 
  term: 'water reminder', 
  num: 20,
  country: 'us'
});

// Get reviews
const reviews = await store.reviews({ 
  id: '123456789',
  sort: store.sort.RECENT,
  page: 1
});
```

**iOS-specific value:**
- Higher-value users (more likely to pay)
- Different competitive landscape than Android
- Review quality often higher/more detailed

**Source weighting:** 1.1x (slightly higher quality reviews)

---

### 3.4 YouTube Data API Adapter
**Priority:** P1 — Implement Week 3
**Cost:** FREE (10,000 quota units/day)
**Best for:** Tutorial demand, problem frequency, trend validation

**API:** Official YouTube Data API v3 (requires API key)
```typescript
// Search costs 100 units = ~100 searches/day on free tier
const response = await fetch(
  `https://www.googleapis.com/youtube/v3/search?` +
  `part=snippet&q=${encodeURIComponent(query)}` +
  `&type=video&maxResults=25&key=${API_KEY}`
);
```

**What we extract for PVRE:**
| Data Point | PVRE Use |
|------------|----------|
| Video count for "how to X" | Problem frequency |
| View counts | Interest level / demand |
| Publish dates | Trend timing (growing/declining) |
| Comment sentiment | Pain validation |
| "Solution" videos existing | Competition signal |

**Quota management:**
- Search: 100 units (100/day)
- Video details: 1 unit (10,000/day)
- Aggressive caching (24hr TTL for searches)

**Source weighting:** 0.8x (less direct than community discussions)

---

### 3.5 TikTok Adapter
**Priority:** P1 — Implement Week 3
**Cost:** FREE (open-source)
**Best for:** Emerging trends, consumer products, Gen Z audience

**Library:** `davidteather/TikTok-Api` (Python, 7.5k+ stars)
```bash
pip install TikTokApi
python -m playwright install
```

**How it works:**
- Unofficial wrapper using Playwright browser automation
- No commercial use restrictions mentioned
- Actively maintained, handles TikTok's anti-bot measures
- Requires `ms_token` from TikTok cookies
- May need proxies for reliability

**Capabilities:**
```python
from TikTokApi import TikTokApi
import asyncio

async def get_trending():
    async with TikTokApi() as api:
        await api.create_sessions(
            ms_tokens=[ms_token], 
            num_sessions=1,
            browser='chromium'
        )
        # Trending videos
        async for video in api.trending.videos(count=30):
            print(video.as_dict)
        
        # Hashtag search
        tag = api.hashtag(name="homegym")
        async for video in tag.videos(count=30):
            print(video.stats)  # views, likes, comments, shares
        
        # User videos
        user = api.user(username="fitnessgirl")
        async for video in user.videos(count=30):
            print(video.as_dict)
```

**What we extract for PVRE:**
| Data Point | PVRE Use |
|------------|----------|
| Hashtag video counts | Topic popularity |
| Video stats (views, likes, shares) | Engagement / trend momentum |
| Trending videos | What's hot now |
| User content analysis | Creator landscape |
| Video comments | Pain signals from Gen Z |

**Integration notes:**
- Python library → call from Node.js via child process or microservice
- Implement session recovery for reliability
- Cache results aggressively (TikTok may rate limit)
- Consider proxy rotation for production scale

**Unique value:** Shows what's EMERGING 6-18 months before mainstream adoption.

**Source weighting:** 1.3x for trend/timing, 0.7x for pain signals (less detailed than Reddit)

---

### 3.6 Hacker News Adapter
**Priority:** P1 — Implement Week 2
**Cost:** FREE, no auth required
**Best for:** Tech/SaaS validation, developer tools, startup challenges

**API:** Algolia HN Search API (free, unlimited, no auth)
```
https://hn.algolia.com/api/v1/search?query=KEYWORDS&tags=story
https://hn.algolia.com/api/v1/search?query=KEYWORDS&tags=ask_hn
```

**Capabilities:**
```typescript
// Search stories
const stories = await fetch(
  `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=50`
).then(r => r.json());

// Search Ask HN posts (direct pain signals!)
const askHN = await fetch(
  `https://hn.algolia.com/api/v1/search?query=${query}&tags=ask_hn&hitsPerPage=50`
).then(r => r.json());

// Search Show HN (competitor launches)
const showHN = await fetch(
  `https://hn.algolia.com/api/v1/search?query=${query}&tags=show_hn&hitsPerPage=50`
).then(r => r.json());

// Get comments for a story
const comments = await fetch(
  `https://hn.algolia.com/api/v1/items/${storyId}`
).then(r => r.json());
```

**What we extract for PVRE:**
| Data Point | PVRE Use |
|------------|----------|
| Ask HN posts | Direct pain signals ("How do you handle X?") |
| Show HN posts | Competitor launch tracking |
| Story points | Interest/engagement level |
| Comment discussions | Problem validation, opinions |
| Historical search | Trend over time |

**Why HN is valuable:**
- Same audience as PVRE target users (tech entrepreneurs)
- High-quality discussions, rarely spam
- Ask HN = people explicitly asking for solutions
- Show HN = competitor landscape
- No rate limits, no auth required

**Source weighting:** 1.2x (high quality, highly relevant for tech validation)

---

### 3.7 App Store Intelligence Module (NEW)
**Priority:** High
**Cost:** Free (Google Play) + ~$50/mo (Apple scraping)
**Best for:** Mobile app validation, competitor analysis, feature gaps

**This is a NEW MODULE, not just another data source.**

**User value:** "What's already working, and what do users complain about?"

**Implementation:**

Google Play: Use `google-play-scraper` npm package (free)
```
npm install google-play-scraper
```

Apple App Store: iTunes Search API (free) + scraping for reviews

**Output:**
```
📱 APP STORE ANALYSIS: Workout Tracking

Top Apps:
1. Strong (4.9⭐, 50K reviews) — $4.99/mo
2. JEFIT (4.7⭐, 120K reviews) — Freemium
3. Hevy (4.8⭐, 15K reviews) — $9.99/mo

Common Complaints (improvement opportunities):
• "Apple Watch sync unreliable" (89 mentions)
• "Can't customize rest timers" (67 mentions)
• "No social features" (54 mentions) ← YOUR ANGLE?

Feature Gaps (user requests):
• AI workout suggestions (34 mentions)
• Gym buddy matching (29 mentions)

Pricing Landscape:
• 40% Free (ad-supported)
• 35% Freemium ($5-10/mo premium)
• 25% Paid upfront ($3-10)
```

---

### 3.7 Source Orchestration

**Auto-select sources based on hypothesis domain:**

```
Hypothesis domain includes:    → Sources to use:
─────────────────────────────────────────────────
tech, startup, saas, dev      → Reddit + HN + IH
consumer, lifestyle           → Reddit + TikTok + Instagram
mobile, app                   → Reddit + App Stores
entrepreneur, bootstrap       → Reddit + IH + HN
fitness, health              → Reddit + TikTok + App Stores
```

**Source attribution in reports:**
```
Total Signals: 84
├── Reddit: 36 signals
├── Hacker News: 12 signals
├── Indie Hackers: 8 signals
└── App Store Reviews: 28 signals
```

---

## Phase 4: VC Features

### 4.1 VC Use Case

**Same engine, different packaging.**

**What VCs need:**
- Quick validation of pitch deck claims
- Competitive landscape the founder didn't mention
- Independent market demand verification
- Red flags to probe in founder calls

**PVRE answers:** "Is this founder's thesis correct?"

---

### 4.2 Investment Memo Export

**New report format for VCs:**

```
DUE DILIGENCE SUMMARY: [Startup Name]

THESIS VALIDATION
- Founder hypothesis: [X]
- PVRE validation score: 6.8/10
- Confidence: Medium (84 signals from 3 sources)

MARKET ASSESSMENT
- TAM: $50B (founder) vs $35-60B (PVRE estimate)
- Growth trend: Rising ↗
- Key tailwinds: [list]
- Key headwinds: [list]

COMPETITIVE LANDSCAPE
- Direct competitors: 7 found (founder mentioned 2)
- Threat level: Medium
- Market gaps identified: [list]

CUSTOMER VOICE
- Pain intensity: 7.2/10
- WTP signals: 4 detected
- Key supporting quotes: [list]
- Key concerning quotes: [list]

RED FLAGS
🚩 Competitor Blindspot — Founder mentioned 2, we found 7
🚩 Pricing Mismatch — $49/mo target vs $15-25 market expectation

RECOMMENDATION
[PROCEED TO CALL] / [PASS] / [NEED MORE DATA]

QUESTIONS FOR FOUNDER
1. Why will you win against [Competitor X]?
2. How do you justify $49/mo given market pricing?
3. What's your differentiation vs [Competitor Y]?
```

---

### 4.3 Founder Claim Validator

**Feature:** Compare founder claims against PVRE data

```
FOUNDER CLAIMS:
"$50B market growing 15% annually"

PVRE ANALYSIS:
✅ Market size: Plausible (estimate: $35-60B)
⚠️ Growth rate: Overstated (discussion volume growing 8%, not 15%)
❌ Missing risk: 3 well-funded competitors not mentioned
```

---

### 4.4 VC Pricing Tiers

| Tier | Price | Researches | Features |
|------|-------|------------|----------|
| Scout | £99/mo | 10 | Standard reports |
| Analyst | £299/mo | 30 | Investment memo, red flags |
| Partner | £599/mo | 100 | Bulk upload, portfolio monitoring |
| Fund | £1,499/mo | Unlimited | API, white-label, custom sources |

**Comparison:**
- CB Insights: £40,000+/year
- PVRE Partner: £7,188/year (80% cheaper)

---

### 4.5 VC Go-to-Market (London)

1. **Soft launch:** 5-10 friendly VCs for feedback
2. **Network:** Angel networks, VC events, LinkedIn outreach
3. **Content:** "We analyzed 500 YC companies" report
4. **Partnerships:** Seedcamp, Entrepreneur First, Techstars

---

## Phase 5: Two-Sided Platform (Future Vision)

### 5.1 The Insight

PVRE knows:
- What sectors entrepreneurs are validating (search activity)
- What sectors investors are researching (VC usage)
- What's trending on social (TikTok/Instagram growth)
- What's working in app stores (ratings, downloads)

**Combine these for unique intelligence.**

---

### 5.2 Sector Heat Map

```
                    Founder      Investor     Social
                    Activity     Interest     Trend
─────────────────────────────────────────────────────
AI Writing Tools    ████████     ██████       ↗ +45%
Meal Prep           █████        ████         ↗ +23%
Home Fitness        ████         ██           🔥 +89%
Creator Economy     ███          █████        → +5%

💡 Home Fitness: High social momentum, low investor 
   attention = potentially undervalued opportunity
```

---

### 5.3 Cross-Side Features (Opt-In)

**For founders:**
"3 investors researched your sector this month. Upgrade to see who's looking."

**For investors:**
"12 founders validated meal-prep ideas this month. Want deal flow alerts?"

---

### 5.4 Market Intelligence Reports

New revenue stream:
- "Q4 2025: The State of Creator Economy Startups"
- Combines: Founder activity + investor interest + social trends + app data
- Price: £500-2,000 per report
- Audience: VCs, accelerators, corporate innovation

---

## Timeline

### Q4 2025 (Now)
- [x] Signal tiering implementation ✅ (Dec 12)
- [x] Always include removed posts ✅ (Dec 12)
- [x] **Conversational input redesign** ✅ (Dec 12) — Single text field → AI interprets → User confirms
- [x] Hypothesis comparison feature ✅ (Dec 12)
- [x] **P0 Scoring Fixes** ✅ (Dec 14) — WTP kill switch, market score adjustments, competition cap
- [x] Live post preview ✅ (Dec 12)
- [x] Actionable executive summaries ✅ (Dec 12)
- [x] URL Analysis Mode ✅ (Dec 14) — Multi-source support (Reddit, Twitter, Product Hunt, etc.)
- [x] Better Loading Experience ✅ (Dec 14) — Fun phases + rotating founder quotes
- [x] Emotions Breakdown ✅ (Dec 14) — 6-emotion classification in Community Voice
- [x] Dark Mode ✅ (Dec 14) — System preference detection + manual toggle
- [x] Ask Anything Chat Sidebar ✅ (Dec 15) — Chat with your data on results page
- [x] Topic Resonance Scoring ✅ (Dec 15) — Shows engagement quality per theme (high/medium/low)

### Q4 2025 (continued) — Multi-Source Integration
**Data Source Adapters (Complete)**
- [x] Google Play adapter (`google-play-scraper` npm) ✅ (Dec 15)
- [x] App Store adapter (`app-store-scraper` npm) ✅ (Dec 15)
- [x] Hacker News adapter (Algolia API) ✅ (Dec 15)
- [x] Unified schema for app/review data ✅ (Dec 15)
- [x] Multi-source UI (checkboxes) ✅ (Dec 15) — Users can select Reddit, HN, Google Play, App Store
- [x] Full pipeline integration ✅ (Dec 16) — App stores now flow through research pipeline to pain signals
- [x] Source attribution in reports ✅ (Dec 16) — Pain signals show source (`google_play`, `app_store`, etc.)

### Q1 2026 — Platform Expansion
**Week 1-2: Video Platform Adapters**
- [ ] YouTube Data API integration
- [ ] TikTok adapter (`davidteather/TikTok-Api`)
- [ ] Trend/timing scores grounded in real data

**Week 3-4: Integration & Testing**
- [ ] Source orchestration logic (advanced routing)
- [ ] Cross-source signal weighting
- [ ] End-to-end testing with various hypothesis types

**Week 5-6: Polish**
- [ ] Competition score grounded in real app data
- [ ] Activity timeline with spike detection
- [ ] Pre-built "Skills" for chat

### Q2 2026
- [ ] Emotions breakdown
- [ ] Activity timeline with spikes
- [ ] VC report format
- [ ] VC pricing tiers
- [ ] VC soft launch (5-10 testers)

### Q3 2026
- [ ] Sector heat map
- [ ] Two-sided features (if validated)
- [ ] Topic monitoring (subscribe)
- [ ] Market intelligence reports
- [ ] Accelerator partnerships

---

## Cost Estimates

| Item | Cost | Status | Notes |
|------|------|--------|-------|
| Reddit (Arctic Shift) | FREE | ✅ Working | Primary pain signal source |
| Google Play scraper | FREE | ✅ Working | Full pipeline integration Dec 16 |
| App Store scraper | FREE | ✅ Working | Full pipeline integration Dec 16 |
| Hacker News | FREE | ✅ Working | Algolia API, no auth |
| YouTube Data API | FREE | 🔜 Q1 2026 | 10k quota units/day |
| TikTok | FREE | 🔜 Q1 2026 | `davidteather/TikTok-Api` (Python) |
| **Total new costs** | **£0/mo** | | All sources are free! |

**Comparison with previous plan:**
- Previous estimate: ~£150/mo (Apify for TikTok + Instagram)
- New estimate: £0/mo (free scrapers + official APIs)
- Savings: ~£150/mo

**ROI:** One VC customer at £299/mo covers any future paid source additions.

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Theme alignment | ~80% | >80% | ✅ Q4 2025 |
| Signals per search | 30-50 | 80-150 | Q1 2026 |
| Data sources | 4 (Reddit, HN, Google Play, App Store) | 6+ | Q1 2026 |
| VC customers | 0 | 10 | Q2 2026 |
| MRR from VCs | £0 | £3,000 | Q2 2026 |

---

## Files Reference

**Key files for Phase 1:**
- `src/lib/research/relevance-filter.ts` — Tiering logic
- `src/lib/analysis/theme-extractor.ts` — Theme weighting
- `src/components/research/coverage-preview.tsx` — Preview UI

**Implemented adapter files:**
- `src/lib/data-sources/adapters/hacker-news-adapter.ts` ✅
- `src/lib/data-sources/adapters/google-play-adapter.ts` ✅
- `src/lib/data-sources/adapters/app-store-adapter.ts` ✅
- `src/lib/data-sources/types.ts` ✅ — Unified signal schema

**Future adapter files:**
- `src/lib/data-sources/adapters/youtube-adapter.ts`
- `src/lib/data-sources/adapters/tiktok-adapter.ts`
- `src/lib/data-sources/orchestrator.ts` — Advanced routing logic
