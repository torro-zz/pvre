# PVRE Implementation Plan

Last updated: December 12, 2025

Master roadmap for PVRE development. For active bugs, see `KNOWN_ISSUES.md`.

---

## Vision Summary

**Today:** Validation tool for entrepreneurs using Reddit data
**Tomorrow:** Market intelligence platform serving entrepreneurs AND investors using multi-source data

**Key milestones:**
1. Fix current data quality issues (tiering, removed posts)
2. Add UX improvements inspired by Buzzabout competitor analysis
3. Expand to multi-source data (HN, Indie Hackers, TikTok, App Stores)
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

### 3.1 Unified Data Architecture

**Source Adapters:**
Each source has independent adapter that normalizes to unified schema:

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                             │
│  (Selects sources based on hypothesis domain)                │
└─────────────────────────────────────────────────────────────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   [Reddit]   [Hacker News] [Indie Hackers] [TikTok]  [App Store]
        │           │           │           │           │
        └───────────┴───────────┴───────────┴───────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │   UNIFIED POST SCHEMA   │
                 │   - id, source, title   │
                 │   - body, author        │
                 │   - community, url      │
                 │   - engagement_score    │
                 └─────────────────────────┘
```

---

### 3.2 Hacker News Adapter
**Priority:** High
**Cost:** Free
**Best for:** Tech, SaaS, developer tools, AI/ML, startup challenges

**API:** Algolia HN Search API (free, no auth)
```
https://hn.algolia.com/api/v1/search?query=KEYWORDS&tags=story
```

**Data quality:** Excellent. Rarely removed content. High-quality discussions.

**Source weighting:** 1.2x (higher quality than Reddit average)

---

### 3.3 Indie Hackers Adapter
**Priority:** High
**Cost:** Free
**Best for:** SaaS validation, solo founder challenges, monetization, bootstrapping

**API:** Algolia (same as HN, discoverable from their frontend)

**Data quality:** Excellent. Entrepreneurs sharing real struggles, revenue numbers.

**Source weighting:** 1.3x (highest relevance for validation use case)

---

### 3.4 TikTok Adapter
**Priority:** High
**Cost:** ~$50/mo (Apify scraper)
**Best for:** Emerging trends, consumer products, Gen Z audience

**API:** Apify TikTok Scraper (unofficial but reliable)

**What we get:**
- Hashtag video counts and growth rates
- Top videos with engagement metrics
- Comments expressing needs/frustrations
- Creator landscape (monetization signals)

**Unique value:** Shows what's EMERGING 6-18 months before mainstream.

**Example output:**
```
TikTok Trend Analysis: "Home Gym"

#homegym — 2.3M videos, +34% growth (30 days)
#apartmentgym — 156K videos, +89% growth (EMERGING!)

Top content themes:
• Small space setups (growing fastest)
• Budget equipment reviews
• Transformation videos

Creator economy: 12 creators with 1M+ followers monetizing this niche
```

---

### 3.5 Instagram Adapter
**Priority:** Medium
**Cost:** ~$50/mo (Apify scraper)
**Best for:** Mature trends, B2B, professional services, 25-44 audience

**API:** Apify Instagram Scraper

**Data quality:** Good. More mature/stable trends than TikTok.

---

### 3.6 App Store Intelligence Module
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
- [ ] Live post preview
- [ ] Actionable executive summaries

### Q1 2026
- [ ] URL analysis mode
- [ ] Hacker News adapter
- [ ] Indie Hackers adapter
- [ ] TikTok adapter (Apify)
- [ ] Multi-source UI
- [ ] "Ask anything" chat
- [ ] App Store module (Google Play)

### Q2 2026
- [ ] Apple App Store reviews
- [ ] Instagram adapter
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

| Item | Cost | Notes |
|------|------|-------|
| Apify (TikTok + Instagram) | ~$100/mo | Social trend scraping |
| Apple App Store scraping | ~$50/mo | Or DIY |
| Hacker News API | Free | |
| Indie Hackers | Free | Algolia |
| Google Play scraper | Free | npm package |
| **Total new costs** | **~$150/mo** | |

**ROI:** One VC customer at £299/mo covers all data source costs.

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Theme alignment | ~40% | >80% | Q4 2025 |
| Signals per search | 30-50 | 80-150 | Q1 2026 |
| Data sources | 1 | 5+ | Q1 2026 |
| VC customers | 0 | 10 | Q2 2026 |
| MRR from VCs | £0 | £3,000 | Q2 2026 |

---

## Files Reference

**Key files for Phase 1:**
- `src/lib/research/relevance-filter.ts` — Tiering logic
- `src/lib/analysis/theme-extractor.ts` — Theme weighting
- `src/components/research/coverage-preview.tsx` — Preview UI

**New files needed:**
- `src/lib/data-sources/hacker-news-adapter.ts`
- `src/lib/data-sources/indie-hackers-adapter.ts`
- `src/lib/data-sources/tiktok-adapter.ts`
- `src/lib/data-sources/app-store-adapter.ts`
- `src/lib/data-sources/orchestrator.ts`
- `src/lib/data-sources/types.ts` — Unified schema
