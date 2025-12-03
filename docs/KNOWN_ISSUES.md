# Known Issues & Backlog

Last updated: December 3, 2024

---

## Bugs

### Medium Priority

| Issue | Location | Status |
|-------|----------|--------|
| ~~"Run Full Research" button stays active after completion~~ | ~~Research results page~~ | Cannot Reproduce (Dec 3 - button may have been renamed/removed in unified view refactor) |
| ~~"Check API Health" button not working~~ | ~~`/admin` page~~ | ✅ Fixed Dec 3 - Added error state handling and UI feedback |
| ~~Claude API Costs always shows $0~~ | ~~`/admin` page~~ | ✅ Fixed Dec 3 - Analytics route was using user-scoped client with RLS; changed to adminClient to bypass RLS and see all users' data |

---

## UX Improvements

### AI-Powered Exclusion Suggestions for Ambiguous Terms (Dec 3)
Source: CEO review / UX analysis
Issue: The "Exclude irrelevant topics" field is empty by default. Users don't know what noise sources exist until they see bad results—by which point they've spent a credit. The placeholder example ("corporate training, dog training, machine learning") only helps if the user's query contains "training." For a visa query, this example is irrelevant and teaches nothing.
Proposed: After user fills fields 1-2, trigger a lightweight Claude Haiku call that identifies ambiguous terms and suggests exclusions. Display as toggleable chips user can accept/reject before searching.
Technical Specification
Trigger Conditions
Fire the suggestion request when:

Field 1 (Who's struggling?) has ≥3 characters AND
Field 2 (What's their problem?) has ≥10 characters AND
User blurs out of field 2, OR clicks a "Suggest exclusions" helper link

Debounce: 500ms after blur to avoid excessive API calls.
Do NOT fire if:

Exclusions field already has user-typed content (don't overwrite)
Suggestion already fetched for this exact input (cache by hash of fields 1+2)

*User observations and product feedback. Add items here as you notice them.*

### ~~Hypothesis Input Optimized for Solutions, Not Problems (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Structured input form now separates audience, problem, and customer language. Backend uses problem-language directly in search keywords.
~~Issue: Current hypothesis format ("X for Y with Z") captures the user's solution idea, but Reddit users don't discuss solutions—they vent about problems.~~

### ~~Single Text Field Doesn't Capture Search Intent (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Replaced single textarea with 4 structured fields:
1. "Who's struggling?" (audience)
2. "What's their problem?" (problem)
3. "How do THEY describe it?" (customer language - key innovation)
4. "Your solution idea" (optional, collapsible)
~~Issue: Free-form hypothesis textarea conflates four distinct things.~~

### ~~Missing "Problem Language" Extraction Step (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Coverage preview now shows "We'll search for people expressing:" with checkmarked phrases extracted from user's problem language input.
~~Issue: Current flow: Hypothesis → Keywords → Search. But keywords extracted from solution-language don't match Reddit's problem-language.~~

### ~~No Audience Subreddit Validation (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Coverage preview now shows checkboxes for AI-suggested subreddits. Users can deselect irrelevant ones and add custom subreddits they know. User selections are passed to community-voice endpoint and used instead of re-discovering.
~~Issue: AI guesses relevant subreddits, but user often knows better. A founder building for "freelance designers" knows their audience lives in r/freelanceDesigners, r/graphic_design, not r/Entrepreneur.~~

### ~~Examples Don't Model Good Problem Articulation (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Examples updated to problem-first format with format hint: "[Audience] who [problem they face]"
~~Issue: Current examples are solution-formatted: "Remote collaboration tools for distributed design teams." This teaches users to write solutions. Better examples would model problem-first thinking.~~

### ~~No Negative Keywords to Exclude Noise (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Added collapsible "Exclude irrelevant topics" field in hypothesis form. User can add comma-separated exclusions (e.g., "corporate training, dog training") which are merged with AI-generated exclude keywords for pre-filtering.
~~Issue: Some searches return massive noise. "Training" pulls fitness, corporate training, dog training, ML training. No way to exclude irrelevant contexts.~~

### ~~[Research Overview: Tab Order and Labeling Confusion] (Dec 3)~~ ✅ IMPLEMENTED
Source: User feedback
**Status: Fixed Dec 3** - Tabs reordered to Community → Market → Timing → Competitors → Verdict. Default set to Community.
~~Issue: The overview shows step labels ("Community Voice Step 1, Step 2; Competitors Step 3; Verdict") alongside clickable tabs ("Verdict, Community, Market, Timing, Competitors"). This creates confusion, and "Verdict" appears first, which feels premature and misaligned with the prior flow.~~

### ~~Tab-Close Trap Creates Anxiety (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Replaced scary warning with friendly message: "Feel free to leave - your results will be saved automatically." Added "In Progress" banner on dashboard for returning users. Added browser notification when research completes (if user grants permission).
~~Issue: Warning "Please keep this tab open... Closing may lose your results and credit" feels like a threat.~~

### ~~Competitor Analysis Credit Cost Unclear (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - CompetitorRunner now shows completion banner ("Research Progress Complete" with Pain, Market, Timing checkmarks) and badge "Included with your research credit - no extra charge".
~~Issue: 1 credit triggers Community Voice + Market + Timing (bundled), but Competitor Analysis is a separate manual step. Progress stepper shows 3 steps, tabs show 5. User expectation mismatch: "I paid, why isn't everything done?"~~ 

### ~~No First-Time User Onboarding (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Added dismissible "How It Works" guide on /research page. Shows 3-step process (Describe Problem → We Mine Reddit → Get Verdict) with icons. Persists dismissal state in localStorage.
~~Issue: New users on /research face blank-page paralysis. Flow assumes understanding of what a good hypothesis looks like, what output will be, how to interpret scores, and what to do with results.~~

### Google-Only Auth Limits Market (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: OAuth-only blocks enterprise users (can't use personal Google), privacy-conscious users, and international users in markets where Google isn't dominant.
Proposed: Add email magic link as secondary option. Position as: [Sign in with Google] (primary button) + "or" + [Sign in with Email] (text link). Supabase supports this natively.

### ~~Example Buttons Don't Teach the Pattern (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Examples now use structured format and clicking them fills all 4 fields with audience, problem, problem language, and solution. Examples teach the pattern by demonstration.
~~Issue: Four example hypotheses span different domains. Users don't see the common formula or understand what makes a good input.~~

### ~~No Clear Path to Buy More Credits (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Credit badge now yellow at ≤3, red at ≤1, with "Get More" link shown when low. **Enhanced Dec 3**: Research page now shows dedicated zero-credit state with CTA to purchase when credits = 0.
~~Issue: Credits shown in header but no prompts when low, no visible pricing, no clear zero-credit state. Users may hit wall without understanding purchase path.~~

### ~~Interview Guide Buried as Subtab (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Added prominent "View Interview Guide" CTA in Verdict recommendations section with green highlight.
~~Issue: Mom Test interview questions are arguably the most actionable output—what users need to DO next. Currently hidden inside Community → Interview Guide subtab.~~

## Low-Priority
### No Hypothesis Comparison Feature (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: Users with multiple ideas can't compare them. If hypothesis A scores 6.5, how does it stack against hypothesis B or C? No side-by-side view.
Proposed: Dashboard feature: side-by-side comparison of 2-4 hypotheses. "Which idea has better market signals?" Encourages running multiple researches (more credit usage, more value delivered).
---

## How to Use This File

**For the user:**
- Add observations under "UX Improvements" with date and description
- Mark items as "In Progress" or "Done" when worked on

**For AI agents:**
- `/improve` reads this to find next priority
- Check bugs first, then UX improvements
