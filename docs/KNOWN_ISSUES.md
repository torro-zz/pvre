# Known Issues & Backlog

Last updated: December 7, 2025

---


## UX Improvements

### Relevance Filter Matches Audience Instead of Problem Domain — Garbage Posts Slip Through (Dec 7)
**Source:** CEO review / JSON analysis
**Status:** Open, December 7th
**Issue:** The relevance filter marks posts as "Y" (relevant) if they mention the target audience with any problem, rather than the specific problem domain. Result: A skincare hypothesis for "men in their 50s" returns posts about sex ("I am 21 year old male and have little to no actual experience with sex"), loneliness, and clothing fit — none related to skincare. At £4/credit, this is unacceptable. At future VC pricing (£50+/research), this is product-killing. The filter sees "men" + "struggling" and says Y, when it should see "no mention of skin/aging/wrinkles" and say N.

**Proposed Solution:** Implement multi-stage relevance filtering:

**Stage 1 — Domain Gate (fast, cheap, first):**
Before any detailed analysis, ask a simple binary question: "Is this post about [primaryDomain]?" For skincare, reject anything about clothing, relationships, sex, loneliness, career, fitness, etc. Use Claude Haiku, batch 50+ posts, respond Y/N only. This eliminates 60-70% of garbage before expensive analysis. Be STRICT — when in doubt, reject.

**Stage 2 — Problem Match (current filter, improved):**
For posts that pass the domain gate, run the existing relevance filter but with clearer instructions: "Does this post discuss THIS SPECIFIC PROBLEM?" Not just the domain, but the actual problem (skin aging/wrinkling, not acne or eczema). Match the problem, not just the audience.

**Stage 3 — Quality Gate (automatic, no AI):**
Final pass to catch garbage: reject posts where body is "[removed]" or "[deleted]", body is under 50 characters, post is not in English, or title contains obvious spam patterns. No AI needed — just code filters.

**Expected outcome:**
- Stage 1 filters 60-70% (domain mismatch)
- Stage 2 filters 30-40% of remainder (problem mismatch)
- Stage 3 filters 10-20% of remainder (quality issues)
- Final: ~15-25% of original posts retained, but HIGH QUALITY
- Cost increase: ~10-15% (Stage 1 uses cheapest model)
- Zero sex posts in skincare results

---

### Low-Relevance Subreddits Auto-Selected Despite Being Marked "Low" (Dec 7)
**Source:** JSON analysis
**Status:** Open, December 7th
**Issue:** Subreddit discovery marks r/askmen as `relevanceScore: "low"` for a skincare hypothesis, but it's still pre-selected and searched. Low-relevance subreddits contribute mostly noise that pollutes themes and wastes API calls. User didn't manually add it — the system auto-selected it despite knowing it's low quality.

**Proposed Solution:** Change subreddit selection logic:
- Only auto-select subreddits with "high" or "medium" relevance scores
- "Low" relevance subreddits should either: (a) be shown but NOT pre-checked, letting user opt-in, or (b) not be shown at all
- If fewer than 3 high/medium subreddits found, show a warning rather than padding with low-relevance ones

---

### Simplify Hypothesis Input to Two Required Fields (Dec 7)
**Source:** UX review / target market analysis
**Status:** Open, December 7th
**Issue:** Current form requires/shows too many fields: audience, problem, problemLanguage, solution, exclusions, subreddit selection, MSC, geography, price. This is cognitive overload for entrepreneurs who just want to know "is this problem real?" The target market (and future VC/PM customers at higher price points) expects simplicity. Several fields don't affect search quality and can be AI-generated or moved.

**Proposed Solution:** Reduce visible required fields to two:

**User provides only:**
1. "Who's struggling?" (audience)
2. "What's frustrating them?" (problem)

**AI generates silently:**
- problemLanguage — infer from problem field ("what would they type into Reddit?")
- domain — extract from problem for subreddit discovery and domain gate
- exclusions — generate based on domain and apply automatically
- subreddits — discover based on domain, only pre-select high/medium relevance

**Move or hide:**
- Solution field → ask AFTER search completes (only needed for competitor analysis), or collapse into hidden "Advanced" section
- Exclusions → apply automatically, only show in "Advanced options" if user wants to override
- problemLanguage → generate automatically, only show in "Advanced options"
- MSC/geography/price → can remain in coverage preview step, or use smart defaults

**Show user a simple confirmation:**
"Found X relevant discussions in Y communities" with list of selected subreddits, expandable "Advanced options" for power users who want control.

---

### Add Auto-Generation of Problem Language from Problem Field (Dec 7)
**Source:** UX simplification
**Status:** Open, December 7th
**Issue:** The "How do THEY describe it?" field asks users to think like their customers and guess what they'd type into Reddit. Most users leave it blank or copy their problem statement. This field is valuable for search quality but creates friction and cognitive load.

**Proposed Solution:** Auto-generate problemLanguage using AI:

When user fills in audience + problem, call Claude to generate 3-5 natural phrases:
- Input: audience ("men in their 50s") + problem ("seeing themselves age, skin wrinkling")
- Output: ["my skin is getting wrinkly", "best anti-aging cream for men", "how do I reduce wrinkles", "losing skin elasticity"]

The prompt should generate:
- First-person language ("my skin is...", "I'm struggling with...")
- Natural Reddit phrasing, not marketing speak
- Specific to the problem, not generic

Show the AI-generated phrases in "Advanced options" so user can see/edit them, but don't require user input. Default to AI generation if user leaves field blank.


### Low-Priority

#### No Hypothesis Comparison Feature (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: Users with multiple ideas can't compare them. If hypothesis A scores 6.5, how does it stack against hypothesis B or C? No side-by-side view.
Proposed: Dashboard feature: side-by-side comparison of 2-4 hypotheses. "Which idea has better market signals?" Encourages running multiple researches (more credit usage, more value delivered).

---

## Completed Issues

*All resolved bugs, UX improvements, and feature requests.*

### December 7, 2025

#### ~~Keywords Extraction Still Includes Solution Field Words~~ ✅ FIXED
Source: JSON analysis — coverage_data.keywords
**Status: Fixed Dec 7** - Updated `coverage-check/route.ts` to use `extractSearchKeywords()` with structured hypothesis, which calls `formatHypothesisForSearch()` to explicitly exclude solution field. Keywords now only contain problem-domain terms like `["skin aging", "wrinkles"]` - no solution words.

#### ~~Low-Relevance Subreddits Should Be Excluded by Default~~ ✅ FIXED
Source: JSON analysis — subreddit selection
**Status: Fixed Dec 7** - Updated `coverage-preview.tsx` to only auto-select subreddits with `relevanceScore === 'high' || 'medium'`. Low-relevance subreddits are now shown but NOT pre-checked, so users must opt-in to include them.

#### ~~Relevance Filter Matches Audience Not Problem~~ ✅ FIXED
**Source:** JSON analysis — relevance decisions + theme analysis
**Status: Fixed Dec 7** - Updated `stream/route.ts` to pass structured hypothesis to filter functions. Filter prompts now include full domain context:
- `TARGET AUDIENCE`, `THEIR PROBLEM`, `LOOK FOR PHRASES LIKE`, `EXCLUDE TOPICS`
- Explicit instruction: "Match the PROBLEM DOMAIN, not just the AUDIENCE"
- Examples in prompt: `Posts about "men in 50s" but NOT about "skin aging" → N`

#### ~~Theme Analysis Includes Off-Topic Themes~~ ✅ EXPECTED IMPROVED
**Source:** PDF/JSON analysis — themeAnalysis.themes
**Status: Expected Improved Dec 7** - This was a downstream effect of the relevance filter passing off-topic posts. With the relevance filter fix (matching PROBLEM not AUDIENCE), fewer off-topic posts should reach theme analysis.

#### ~~Subreddit Discovery Returns Generic Demographic Communities~~ ✅ FIXED
**Source:** JSON/PDF analysis of men's skincare search
**Status: Fixed Dec 7** - Implemented 3-stage domain-first discovery pipeline in `subreddit-discovery.ts`:
1. Stage 1: Extract PROBLEM DOMAIN (e.g., "skincare" not "men")
2. Stage 2: Find subreddits about the PROBLEM, not just AUDIENCE
3. Stage 3: Validate subreddits actually discuss the problem
Result: Skincare hypothesis now returns r/SkincareAddiction, r/30PlusSkinCare, r/antiaging instead of r/malefashionadvice.

#### ~~Confusing Competitor Comparison Matrix~~ ✅ IMPROVED
Source: CEO review
**Status: Improved Dec 7** - Redesigned the competitor matrix UI:
1. Replaced small progress bars with color-coded score tiles (40x40px)
2. Added heat map coloring: green (8-10), light green (6-7), yellow (4-5), orange (2-3), red (0-1)
3. Added "Avg" column showing each competitor's average score across all categories
4. Notes now appear on hover (tooltip) instead of cluttering the table
5. Added zebra striping and hover states for better row tracking
6. Added color legend below the table explaining the scoring
7. Made competitor column sticky for horizontal scrolling

#### ~~Low Data Quality / Not Enough Posts~~ ✅ IMPROVED
Source: Testing / User
**Status: Improved Dec 7** - Increased data volume by ~50-100% via more subreddits:
1. Increased max subreddits from 6-8 to 10-12 (auto-discovered: 10, user-selected: 12)
2. Arctic Shift API caps at 100 posts/request (kept as-is for predictability)
3. Data volume now: 10-12 subreddits × 100 posts = 1,000-1,200 posts (was 600-800)

#### ~~Competitor Analysis Lacks Localization~~ ✅ FIXED
Source: CEO review
**Status: Fixed Dec 7** - Updated competitor-intelligence route to use geography from coverage_data:
1. Fetches `targetGeography` from job's coverage_data (location + scope)
2. Adds geography-specific instructions to Claude prompt for local/national scope
3. Instructs AI to prioritize local/regional competitors for the target market

#### ~~Google-Only Auth Limits Market~~ ✅ FIXED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 7** - Added email magic link authentication:
1. Login page now shows Google sign-in (primary) + "or" divider + email input form
2. Users enter email and receive a magic link via Supabase OTP
3. Success screen shows confirmation and allows trying different email

#### ~~Market Sizing Score Calculated Without User's Revenue Goal or Pricing~~ ✅ FIXED
Source: CEO review / LeanSpark methodology comparison
**Status: Fixed Dec 7** - Implemented full MSC and pricing inputs:
1. Added Revenue Goal selector in coverage preview with 4 presets: $100k (lifestyle), $500k (sustainable), $1M (growth), $10M+ (venture-scale)
2. Added Target Price input with $29/month default
3. Updated `CoverageData` interface to include `mscTarget` and `targetPrice`
4. Market sizing prompt now includes user's actual revenue goal and pricing in calculations

#### ~~Vercel Email - CVE-2025-66478~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Critical RCE vulnerability (CVSS 10.0) in React Server Components. Upgraded Next.js from 16.0.5 to 16.0.7 which contains the patch.

#### ~~Viability Verdict Messaging~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Updated all verdict descriptions to emphasize user interviews:
- Strong: "Proceed to user interviews with confidence"
- Mixed: "Conduct user interviews to validate assumptions"
- Weak: "User interviews are critical before proceeding"
- None: "Start with discovery interviews to understand if the problem space itself is viable"

#### ~~Cache each search~~ ✅ VERIFIED
Source: User
**Status: Verified Dec 7** - Caching is fully implemented in `src/lib/data-sources/cache.ts`:
- Table: `reddit_cache` in Supabase
- TTL: 90 days for cache entries
- Cache key: subreddits + keywords + time range

#### ~~Subreddit Perspective Problem~~ ✅ FIXED
Source: Relevance decision audit
**Status: Fixed Dec 7** - The subreddit discovery prompt now explicitly distinguishes first-person vs third-person perspective subreddits. Relevance filter also now rejects posts from wrong perspective.

#### ~~Keywords Extraction Includes Solution Words (P0)~~ ✅ FIXED
Source: JSON export analysis
**Status: Fixed Dec 7** - Added `formatHypothesisForSearch()` function that excludes solution field. Updated `extractSearchKeywords()` in `keyword-extractor.ts` to accept optional structured hypothesis.

#### ~~Subreddit Discovery Doesn't Consider Perspective (P1)~~ ✅ FIXED
Source: Relevance decision audit
**Status: Fixed Dec 7** - Updated subreddit discovery prompt with "CRITICAL PERSPECTIVE RULE" that explicitly asks: "Does this subreddit contain posts BY the target audience, or posts ABOUT the target audience?"

#### ~~False Positive: Foreign Language Posts (P1)~~ ✅ FIXED
Source: Relevance decision audit
**Status: Fixed Dec 7** - Added "AUTOMATIC REJECTION (always N)" section to relevance filter prompts including: (1) Post is NOT primarily in English, (2) Post author is clearly NOT the target audience, (3) Post is from wrong perspective.

#### ~~Viability Verdict Discrepancy~~ ✅ CLARIFIED
Source: CEO review
**Status: Clarified Dec 7** - The "discrepancy" was intentional: Raw JSON shows individual dimension scores, while the Viability Verdict is dynamically calculated including Competition (if run).

#### ~~Market Sizing Analysis Needs Geographic Scoping~~ ✅ FIXED
Source: CEO review / JSON export analysis
**Status: Fixed Dec 7** - Implemented full geographic scoping:
1. Added `TargetGeography` type with `scope` (local/national/global) and `location` fields
2. Added `detectGeographyFromAudience()` to auto-detect location from audience text
3. Updated coverage preview with Target Market selector

#### ~~Non-Functional "Add Competitors" Button~~ ✅ FIXED
Source: Testing
**Status: Fixed Dec 7** - Implemented proper solution using React Context:
1. Created `ResearchTabsContext` for shared tab state management
2. Created `ControlledTabs` wrapper component
3. Updated components to use context for tab navigation

#### ~~No AI-Suggested Competitors~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Added AI-suggested competitors feature to CompetitorRunner component:
1. Fetches suggestions from `/api/research/competitor-suggestions` endpoint
2. Displays clickable chips with competitor names from community discussions

#### ~~Reseting the search and starting over on Coverage Data~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Added `setTimeout(() => checkCoverage(), 0)` after reset to re-trigger the API call.

#### ~~Admin User Credit addition~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Added `$/Credit` column to Users table showing average spend per credit.

#### ~~Credits top Right~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Added Supabase real-time subscription in `header.tsx` that listens for `UPDATE` events on the user's profile row.

#### ~~Console error - Failed to fetch waitlist~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Created `src/app/api/admin/waitlist/route.ts` with GET (list) and DELETE (remove entry) endpoints.

#### ~~'Suggest exclusions based on your hypothesis' button~~ ✅ FIXED
Source: User
**Status: Fixed Dec 7** - Changed from subtle text link to prominent purple button with `animate-pulse-subtle` CSS animation.

### December 3, 2025

#### ~~Relevance Filter Missing Structured Context~~ ✅ IMPLEMENTED
Source: Claude Code exploration / Architecture analysis
**Status: Fixed Dec 3** - Relevance filter now receives full structured context:
- TARGET AUDIENCE, THEIR PROBLEM, LOOK FOR PHRASES LIKE, EXCLUDE TOPICS ABOUT
- Added `relevance_decisions` table (migration 013) to log individual Y/N decisions for quality audits.

#### ~~AI-Powered Exclusion Suggestions for Ambiguous Terms~~ ✅ IMPLEMENTED
Source: CEO review / UX analysis
**Status: Fixed Dec 3** - Added "Suggest exclusions based on your hypothesis" button. Claude Haiku analyzes the audience + problem fields and suggests relevant exclusions as clickable chips.

#### ~~Hypothesis Input Optimized for Solutions, Not Problems~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Structured input form now separates audience, problem, and customer language. Backend uses problem-language directly in search keywords.

#### ~~Single Text Field Doesn't Capture Search Intent~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Replaced single textarea with 4 structured fields:
1. "Who's struggling?" (audience)
2. "What's their problem?" (problem)
3. "How do THEY describe it?" (customer language)
4. "Your solution idea" (optional, collapsible)

#### ~~Missing "Problem Language" Extraction Step~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Coverage preview now shows "We'll search for people expressing:" with checkmarked phrases extracted from user's problem language input.

#### ~~No Audience Subreddit Validation~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Coverage preview now shows checkboxes for AI-suggested subreddits. Users can deselect irrelevant ones and add custom subreddits.

#### ~~Examples Don't Model Good Problem Articulation~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Examples updated to problem-first format with format hint: "[Audience] who [problem they face]"

#### ~~No Negative Keywords to Exclude Noise~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Added collapsible "Exclude irrelevant topics" field in hypothesis form.

#### ~~Research Overview: Tab Order and Labeling Confusion~~ ✅ IMPLEMENTED
Source: User feedback
**Status: Fixed Dec 3** - Tabs reordered to Community → Market → Timing → Competitors → Verdict. Default set to Community.

#### ~~Tab-Close Trap Creates Anxiety~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Replaced scary warning with friendly message: "Feel free to leave - your results will be saved automatically." Added browser notification when research completes.

#### ~~Competitor Analysis Credit Cost Unclear~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - CompetitorRunner now shows completion banner and badge "Included with your research credit - no extra charge".

#### ~~No First-Time User Onboarding~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Added dismissible "How It Works" guide on /research page. Shows 3-step process with icons.

#### ~~Example Buttons Don't Teach the Pattern~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Examples now use structured format and clicking them fills all 4 fields.

#### ~~No Clear Path to Buy More Credits~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Credit badge now yellow at ≤3, red at ≤1, with "Get More" link. Research page shows dedicated zero-credit state.

#### ~~Interview Guide Buried as Subtab~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Added prominent "View Interview Guide" CTA in Verdict recommendations section with green highlight.

---

## How to Use This File

Format your request as following:
### TITLE
Source: User
Status: Open, DATE
Issue:
Proposed Solution:


**For the user:**
- Add observations under "UX Improvements" with date and description
- Mark items as "In Progress" or "Done" when worked on

**For AI agents:**
- `/improve` reads this to find next priority
- Check bugs first, then UX improvements
