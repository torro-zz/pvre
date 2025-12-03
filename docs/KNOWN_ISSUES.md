# Known Issues & Backlog

Last updated: December 3, 2024

---

## Bugs

### Medium Priority

| Issue | Location | Status |
|-------|----------|--------|
| ~~"Run Full Research" button stays active after completion~~ | ~~Research results page~~ | Cannot Reproduce (Dec 3 - button may have been renamed/removed in unified view refactor) |
| "Check API Health" button not working | `/admin` page | Needs Fix |
| Claude API Costs always shows $0 | `/admin` page | Needs Investigation |

---

## UX Improvements

*User observations and product feedback. Add items here as you notice them.*

### Hypothesis Input Optimized for Solutions, Not Problems (Dec 3)
Source: CEO review / Core product mechanics analysis
Issue: Current hypothesis format ("X for Y with Z") captures the user's solution idea, but Reddit users don't discuss solutions—they vent about problems. Searching for "training community Hyrox" finds almost nothing. Searching for "hate training alone" + "Hyrox" finds the pain.
Proposed: Restructure input to extract the underlying problem first, then use problem-language for search. The AI should translate solution-thinking into problem-language before querying Arctic Shift.

### Single Text Field Doesn't Capture Search Intent (Dec 3)
Source: CEO review / Core product mechanics analysis
Issue: Free-form hypothesis textarea conflates four distinct things: (1) the audience, (2) the problem they have, (3) the solution being proposed, (4) the context/niche. AI must infer all four from one sentence, often incorrectly.
Proposed: Replace single textarea with structured input:
WHO are you helping?
→ "Solo Hyrox athletes in London"

WHAT problem do they have?
→ "Training alone kills motivation and hurts race performance"

HOW might they describe this problem?
→ "no one to train with" / "can't push myself" / "hate gym alone"

WHAT's your solution idea? (optional)
→ "Training partner matching app"
The third field ("how might they describe it") is the key innovation—it forces users to think in customer language, which directly improves search quality.

### Missing "Problem Language" Extraction Step (Dec 3)
Source: CEO review / Core product mechanics analysis
Issue: Current flow: Hypothesis → Keywords → Search. But keywords extracted from solution-language don't match Reddit's problem-language. The relevance filtering downstream can't fix garbage-in.
Proposed: Add explicit extraction step shown to user:

Your hypothesis: "Meal planning app for busy parents with picky eaters"

We'll search for people expressing:
✓ "kids won't eat anything"
✓ "dinner time is a nightmare"
✓ "picky eater driving me crazy"
✓ "don't know what to cook anymore"

In communities like:
✓ r/Parenting
✓ r/MealPrepSunday
✓ r/Mommit

[Looks right] [Edit search terms]

### No Audience Subreddit Validation (Dec 3)
Source: CEO review / Core product mechanics analysis
Issue: AI guesses relevant subreddits, but user often knows better. A founder building for "freelance designers" knows their audience lives in r/freelanceDesigners, r/graphic_design, not r/Entrepreneur.
Proposed: During coverage preview, let users:

See AI-suggested subreddits
Add subreddits they know ("I know my audience is in r/XXX")
Remove irrelevant ones ("r/business is too broad")

This human-in-the-loop step dramatically improves signal quality.

### ~~Examples Don't Model Good Problem Articulation (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Core product mechanics analysis
**Status: Fixed Dec 3** - Examples updated to problem-first format with format hint: "[Audience] who [problem they face]"
~~Issue: Current examples are solution-formatted: "Remote collaboration tools for distributed design teams." This teaches users to write solutions. Better examples would model problem-first thinking.~~

### No Negative Keywords to Exclude Noise (Dec 3)
Source: CEO review / Core product mechanics analysis
Issue: Some searches return massive noise. "Training" pulls fitness, corporate training, dog training, ML training. No way to exclude irrelevant contexts.
Proposed: Add optional "Exclude" field:
EXCLUDE posts about:
→ "corporate training" / "dog training" / "machine learning"
Or smarter: AI suggests likely noise sources based on ambiguous terms, user confirms exclusions.

Recommended Input Redesign
Current State
┌─────────────────────────────────────────────────┐
│ Enter your hypothesis                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ e.g., Training community for London Hyrox   │ │
│ │ athletes                                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Example] [Example] [Example] [Example]         │
│                                                 │
│ [Check Data Availability]                       │
└─────────────────────────────────────────────────┘

Proposed State
┌─────────────────────────────────────────────────┐
│ Step 1: Who's struggling?                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Solo Hyrox athletes preparing for races     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Step 2: What's their problem?                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ Training alone kills motivation, can't push │ │
│ │ hard enough, poor race day performance      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Step 3: How do THEY describe it? (optional)     │
│ ┌─────────────────────────────────────────────┐ │
│ │ "no one to train with" "hate training alone"│ │
│ └─────────────────────────────────────────────┘ │
│ ℹ️ Think: what would they type into Reddit?     │
│                                                 │
│ [Check Data Availability]                       │
└─────────────────────────────────────────────────┘

### ~~[Research Overview: Tab Order and Labeling Confusion] (Dec 3)~~ ✅ IMPLEMENTED
Source: User feedback
**Status: Fixed Dec 3** - Tabs reordered to Community → Market → Timing → Competitors → Verdict. Default set to Community.
~~Issue: The overview shows step labels ("Community Voice Step 1, Step 2; Competitors Step 3; Verdict") alongside clickable tabs ("Verdict, Community, Market, Timing, Competitors"). This creates confusion, and "Verdict" appears first, which feels premature and misaligned with the prior flow.~~

### Tab-Close Trap Creates Anxiety (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: Warning "Please keep this tab open... Closing may lose your results and credit" feels like a threat. Users feel trapped, can't switch apps on mobile, and blame the product if anything goes wrong—even with auto-refund.
Proposed: Process asynchronously. Replace with "We'll email you when ready (1-2 min). Feel free to close this tab." Send email notification with direct link to results. Turns friction into re-engagement trigger.

### Competitor Analysis Credit Cost Unclear (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: 1 credit triggers Community Voice + Market + Timing (bundled), but Competitor Analysis is a separate manual step. Progress stepper shows 3 steps, tabs show 5. User expectation mismatch: "I paid, why isn't everything done?"
Proposed: Bundle all 5 outputs into 1 credit so the user understands that. The competitor analsysis doesnt start automatically becasue we want the user to have the option to add any known competitors. 

### No First-Time User Onboarding (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: New users on /research face blank-page paralysis. Flow assumes understanding of what a good hypothesis looks like, what output will be, how to interpret scores, and what to do with results.
Proposed: A faq that will help them understand how it works, as well as a video from the coe to show them how to use the tool.

### Google-Only Auth Limits Market (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: OAuth-only blocks enterprise users (can't use personal Google), privacy-conscious users, and international users in markets where Google isn't dominant.
Proposed: Add email magic link as secondary option. Position as: [Sign in with Google] (primary button) + "or" + [Sign in with Email] (text link). Supabase supports this natively.

### Example Buttons Don't Teach the Pattern (Dec 3)
Source: CEO review / Flow documentation analysis
Issue: Four example hypotheses span different domains. Users don't see the common formula or understand what makes a good input.
Proposed: Add label above examples: "Format: [Solution type] for [specific audience] with [specific problem]" — then show examples as illustrations of this pattern.

### ~~No Clear Path to Buy More Credits (Dec 3)~~ ✅ IMPLEMENTED
Source: CEO review / Flow documentation analysis
**Status: Fixed Dec 3** - Credit badge now yellow at ≤3, red at ≤1, with "Get More" link shown when low.
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
