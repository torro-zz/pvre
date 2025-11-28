# PVRE - Claude Code Kickoff Package
## Pre-Validation Research Engine: Standalone SaaS Build

---

## 🎯 WHAT TO TELL CLAUDE CODE

Copy this entire prompt into Claude Code to initialize your project:

---

### INITIAL PROMPT FOR CLAUDE CODE

```
I want to build a SaaS called PVRE (Pre-Validation Research Engine) - a tool that helps entrepreneurs validate business ideas BEFORE customer interviews by automating market research.

## THE PROBLEM WE'RE SOLVING

Entrepreneurs waste 14-26 hours on manual research before they can even start customer interviews:
- Browsing Reddit/forums for pain signals
- Researching competitors manually
- Estimating market size with guesswork
- Reading news for timing signals

PVRE automates this into a 30-minute research report.

## CORE VALUE PROPOSITION

"From hypothesis to interview-ready in 30 minutes, not 30 hours"

Input: A business hypothesis (e.g., "Training community for London Hyrox athletes")
Output: Comprehensive research report with:
- Pain signals from real community discussions
- Competitor landscape map
- Market size estimation
- Timing/trend analysis
- Pricing intelligence
- Interview guide with prioritized hypotheses

## TECH STACK DECISION

Build as a modern web SaaS with:
- **Frontend:** Next.js 14 with App Router, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes (serverless)
- **Database:** Supabase (Postgres + Auth + Storage)
- **AI:** Anthropic Claude API for analysis
- **Data Sources:** Reddit API (PRAW-style), Google Trends, web scraping
- **Payments:** Stripe (for future monetization)
- **Deployment:** Vercel

## MVP SCOPE (V1)

For the first version, build these 3 core modules:

### Module 1: Community Voice Mining
- Search Reddit for relevant posts based on hypothesis
- Calculate "pain scores" for each post
- Extract customer language patterns
- Use Claude to synthesize themes
- Output: Pain signal report with quotes and intensity scores

### Module 2: Competitor Intelligence
- Take known competitor names OR discover via search
- Scrape basic info (pricing if available, positioning)
- Generate competitive landscape map
- Identify gaps/opportunities
- Output: Competitor matrix and positioning analysis

### Module 3: Interview Prep Generator
- Synthesize findings from modules 1-2
- Generate prioritized hypotheses to test
- Create interview script with targeted questions
- Build post-interview analysis template
- Output: Ready-to-use interview pack

## USER FLOW

1. User signs up / logs in (Supabase Auth)
2. User enters business hypothesis on dashboard
3. User clicks "Run Research"
4. System runs modules sequentially (show progress)
5. Results displayed in tabs (Community Voice | Competitors | Interview Prep)
6. User can download full report as PDF/Markdown
7. Reports saved to user's history

## DATABASE SCHEMA

```sql
-- Users (handled by Supabase Auth)

-- Research Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  hypothesis text not null,
  status text default 'pending', -- pending, running, completed, failed
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Research Results
create table research_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  module_name text not null, -- community_voice, competitor_intel, interview_prep
  data jsonb not null,
  created_at timestamp default now()
);

-- Reddit Posts Cache (to avoid re-scraping)
create table reddit_cache (
  id uuid primary key default gen_random_uuid(),
  subreddit text not null,
  keyword text not null,
  posts jsonb not null,
  fetched_at timestamp default now()
);
```

## FILE STRUCTURE

```
pvre/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing page
│   ├── dashboard/
│   │   ├── page.tsx                # Main dashboard
│   │   └── projects/
│   │       └── [id]/
│   │           └── page.tsx        # Project results view
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── api/
│       ├── research/
│       │   └── route.ts            # Main research endpoint
│       ├── reddit/
│       │   └── route.ts            # Reddit scraping
│       ├── competitors/
│       │   └── route.ts            # Competitor analysis
│       └── analyze/
│           └── route.ts            # Claude analysis
├── components/
│   ├── ui/                         # shadcn components
│   ├── research-form.tsx
│   ├── results-tabs.tsx
│   ├── pain-score-card.tsx
│   ├── competitor-matrix.tsx
│   └── interview-guide.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── reddit/
│   │   └── scraper.ts
│   ├── analysis/
│   │   ├── pain-detector.ts
│   │   └── theme-extractor.ts
│   └── utils.ts
├── types/
│   └── index.ts
└── .env.local
```

## ENVIRONMENT VARIABLES NEEDED

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Reddit API
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=PVRE/1.0

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## PRIORITY ORDER FOR BUILDING

1. **Day 1:** Project setup, Supabase connection, basic auth
2. **Day 2:** Landing page, dashboard layout, project creation form
3. **Day 3:** Reddit scraping API endpoint + pain score calculation
4. **Day 4:** Claude integration for theme analysis
5. **Day 5:** Community Voice results display
6. **Day 6:** Competitor intelligence module (basic)
7. **Day 7:** Interview prep generator
8. **Day 8:** Polish, PDF export, error handling
9. **Day 9:** Testing, deployment to Vercel
10. **Day 10:** Launch MVP

## DESIGN PRINCIPLES

- Clean, minimal UI (think Linear or Notion)
- Progress indicators during research (takes 2-5 minutes)
- Results should feel like a professional research report
- Mobile-responsive but desktop-first
- Dark mode support

## START NOW

Let's begin by:
1. Creating the Next.js project with all dependencies
2. Setting up the file structure
3. Creating the Supabase schema
4. Building the landing page and auth flow

Start with step 1 - create the project and install dependencies.
```

---

## 🔧 FOLLOW-UP PROMPTS FOR CLAUDE CODE

After the initial setup, use these prompts to build each feature:

### Building the Reddit Scraper

```
Now let's build the Reddit scraping functionality.

Create lib/reddit/scraper.ts that:
1. Uses the snoowrap library (Reddit API wrapper for Node.js)
2. Has a function searchSubreddit(subreddit, keywords, limit) that returns posts
3. Has a function discoverSubreddits(hypothesis) that suggests relevant subreddits
4. Caches results in Supabase to avoid rate limits
5. Handles Reddit API rate limiting gracefully

Also create the API route at app/api/reddit/route.ts that:
1. Accepts POST with { hypothesis, subreddits?, keywords? }
2. Calls the scraper
3. Returns structured post data

Include error handling and TypeScript types.
```

### Building the Pain Detector

```
Now let's build the pain signal detection system.

Create lib/analysis/pain-detector.ts that:
1. Takes an array of Reddit posts
2. Calculates a pain score (0-10) for each post based on:
   - High intensity keywords (struggle, frustrated, hate, nightmare)
   - Medium intensity keywords (difficult, hard, challenge, problem)
   - Solution-seeking language (looking for, recommendations, anyone know)
3. Returns posts sorted by pain score with detected signals

Create lib/analysis/theme-extractor.ts that:
1. Takes the top 30 posts by pain score
2. Sends them to Claude API with a prompt to extract:
   - Top pain themes with frequency
   - Customer language patterns
   - Existing alternatives mentioned
   - Willingness-to-pay signals
3. Returns structured theme analysis

Use the Anthropic SDK for Claude integration.
```

### Building the Results Display

```
Now let's build the results display components.

Create these components:

1. components/results-tabs.tsx
   - Tabs for: Community Voice | Competitors | Interview Prep
   - Each tab shows the relevant module results
   - Loading states for each module

2. components/pain-score-card.tsx
   - Displays a single Reddit post with:
   - Title, snippet of body
   - Pain score badge (color-coded: red >7, yellow 4-7, green <4)
   - Detected pain signals as tags
   - Link to original post

3. components/community-voice-summary.tsx
   - Overall pain score for the research
   - Top 5 pain themes
   - Customer language word cloud or list
   - Key quotes carousel

Make them visually polished using shadcn/ui and Tailwind.
```

### Building the Interview Prep Module

```
Now let's build the interview preparation module.

Create lib/interview/generator.ts that:
1. Takes community voice analysis + competitor data as input
2. Uses Claude to generate:
   - 5 prioritized hypotheses to test (ranked by evidence strength)
   - 15 interview questions organized by section:
     * Context questions (5)
     * Problem exploration questions (5)
     * Solution testing questions (5)
   - Post-interview analysis template
3. Returns structured interview pack

Create components/interview-guide.tsx that:
1. Displays the generated interview pack
2. Has expandable sections for each part
3. Has a "Copy to Clipboard" button for easy use
4. Has a "Download as PDF" button

The interview questions should be based on "The Mom Test" principles - no leading questions, focus on past behavior, avoid hypotheticals.
```

### Building the Full Research Flow

```
Now let's wire everything together into the main research flow.

Create app/api/research/route.ts that:
1. Accepts POST with { hypothesis, userId }
2. Creates a new project in database with status 'running'
3. Runs modules sequentially:
   a. Reddit scraping → save results
   b. Pain analysis → save results
   c. Competitor discovery (basic) → save results
   d. Interview prep generation → save results
4. Updates project status to 'completed'
5. Uses streaming to send progress updates to frontend

Create a custom hook useResearch() that:
1. Handles the research API call
2. Manages loading/progress state
3. Handles errors gracefully
4. Returns { startResearch, progress, results, error }

Update the dashboard to:
1. Show research form
2. Show progress during research (which module is running)
3. Display results when complete
4. Save to history
```

---

## 📋 SETUP CHECKLIST

Before starting with Claude Code, prepare these:

### 1. Reddit API Credentials
Go to https://www.reddit.com/prefs/apps and create an app:
- Type: Script
- Name: PVRE Research
- Redirect URI: http://localhost:3000
- You'll get: client_id and client_secret

### 2. Supabase Project
Go to https://supabase.com and create a project:
- Note the URL and anon key
- You'll set up the schema via Claude Code

### 3. Anthropic API Key
Go to https://console.anthropic.com:
- Create an API key
- Note: You'll need credits for Claude API calls

### 4. Vercel Account (for deployment)
Go to https://vercel.com:
- Connect your GitHub
- You'll deploy here later

---

## 💰 MONETIZATION STRATEGY (Future)

Once MVP is validated, add Stripe for:

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 3 researches/month |
| Pro | $29/mo | 20 researches/month |
| Team | $79/mo | Unlimited + team features |

This can be added later - focus on building a useful tool first.

---

## 🚀 RECOMMENDED WORKFLOW

### Session 1 (2-3 hours)
- Initial project setup
- Supabase configuration
- Basic auth flow
- Landing page

### Session 2 (2-3 hours)
- Dashboard layout
- Research form
- Reddit scraper API

### Session 3 (2-3 hours)
- Pain detector
- Claude integration
- Theme extraction

### Session 4 (2-3 hours)
- Results display components
- Community voice view

### Session 5 (2-3 hours)
- Competitor module (basic)
- Interview prep generator

### Session 6 (2-3 hours)
- Full flow integration
- PDF export
- Polish and testing

### Session 7 (1-2 hours)
- Deploy to Vercel
- Test production
- Launch!

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Reddit Rate Limiting
- Cache results in Supabase
- Add delays between requests
- Use smaller batch sizes

### Claude API Costs
- Batch posts before sending to Claude
- Use claude-3-haiku for simple tasks
- Cache analysis results

### Long Research Times
- Show progress indicators
- Use streaming responses
- Consider background jobs for heavy processing

---

## 📝 QUICK START COMMAND

Once you're in Claude Code, paste this to begin:

```
Let's build PVRE. Start by:

1. Create a new Next.js 14 project with:
   - TypeScript
   - Tailwind CSS
   - App Router
   - ESLint

2. Install these dependencies:
   - @supabase/supabase-js
   - @supabase/auth-helpers-nextjs
   - @anthropic-ai/sdk
   - snoowrap (Reddit API)
   - shadcn/ui components (button, card, tabs, input, form)
   - lucide-react (icons)
   - react-hot-toast (notifications)
   - jspdf (PDF export)

3. Set up the file structure as specified in the docs

4. Create a .env.example with all required variables

Let's start with step 1.
```

---

You're ready to build! 🚀
