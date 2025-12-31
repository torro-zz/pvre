# PVRE Agent Learnings

**Purpose:** Shared knowledge base for all agents. Every agent reads this before starting work and writes learnings when they discover something important.

---

## How This Works

1. **Every agent reads this file first** — Before any work, agents check for relevant learnings
2. **Agents write discoveries here** — When something important is found, add it below
3. **Learner agent synthesizes** — Periodically, patterns are identified and agents are updated

---

## Entry Format

```markdown
## [DATE] - [Category]: [Brief Title]
**Agent:** [which agent found this]
**Context:** [what was being done]
**Finding:** [what was discovered]
**Impact:** [why it matters]
**Action:** [what to do about it]
```

**Categories:** Bug Pattern | Quality Issue | UI Finding | Security Finding | Flow Issue | Performance | Data Quality

---

## Active Learnings

### 2025-12-31 - Architecture: Two-Stage Filter Solved The Relevance Problem
**Agent:** Claude Code (main)
**Context:** Implementing two-stage filter to replace complex Domain Gate + Problem Match pipeline
**Finding:** The 64% irrelevance problem was solved by simplifying the architecture:
- Stage 1: Loose embedding filter (0.28 threshold) catches ~800-1100 candidates
- Stage 2: Rank + cap at 50 for cost control
- Stage 3: Haiku YES/NO verification filters false positives

Test results showed 85-100% relevance on verified signals (vs. 36-64% before).

**Key Insight:** Simpler is better. Instead of complex multi-prompt AI chains (domain gate + problem match + keyword gate), a single strict YES/NO prompt works better because:
1. Less AI "interpretation" = less drift
2. Fixed cost cap = predictable economics
3. Easier to debug and tune

**Impact:**
- Cost fixed at ~$0.06 per search (vs. variable $0.10-0.20)
- Relevance 85-100% (vs. 60-70%)
- 10-16 verified signals per search

**Action:**
1. Use the locked filter at `src/lib/filter/` - don't modify without CEO approval
2. When relevance drops, check the Haiku prompt first (ai-verifier.ts)
3. If adding data sources, just implement adapter → NormalizedPost interface

---

### 2025-12-18 - Data Quality: The 64% Irrelevance Problem
**Agent:** Manual testing
**Context:** Reviewing Community Voice results for freelancer invoicing hypothesis
**Finding:** 64% of detected pain signals were completely irrelevant to the business hypothesis. Posts about general frustration, unrelated complaints, and off-topic content were being surfaced as "pain signals."
**Impact:** Founders could make wrong Go/No-Go decisions based on misleading data. This is THE critical quality issue for PVRE.
**Action:** 
- Always manually check 10+ pain signals for relevance when reviewing output
- Target >70% relevance rate
- The relevance filter at `src/app/api/research/community-voice/route.ts` lines 64-247 is critical

### 2025-12-18 - Data Quality: WTP Score Inflation
**Agent:** Output quality review
**Context:** Analyzing viability scores across multiple researches
**Finding:** WTP (Willingness to Pay) scores were sometimes high (6-7) even when zero explicit WTP signals were detected. The score was being inferred from pain intensity alone.
**Impact:** Founders might think people will pay when there's no actual evidence of purchase intent.
**Action:**
- If WTP signals = 0 AND sample size < 20, cap viability score at 5.0
- Flag any research with 0 WTP signals prominently in output

### 2025-12-18 - Flow Issue: Research Timeout Patterns
**Agent:** Flow testing
**Context:** Running full research flows
**Finding:** Research occasionally hangs at the Arctic Shift API call step, especially with multi-word queries in certain parameters.
**Impact:** Users see spinner forever, credits may be deducted without results.
**Action:**
- Never use `query` or `body` params with Arctic Shift (causes 422 timeouts)
- Implement 90-second timeout with clear error message
- Check `error_source` field for debugging

---

## Processed Learnings

*Learnings that have been synthesized into agent updates are moved here with date processed.*

---

## Pattern Watch List

*Learnings that are appearing repeatedly, candidates for systematic fixes:*

1. ~~**Relevance filtering effectiveness**~~ — ✅ SOLVED with two-stage filter (Dec 31, 2025)
2. **Score inflation** — Scores higher than evidence supports
3. **API timeout handling** — External service failures

### 2025-12-31 - Process: Stop Shotgun Testing, Collaborate First
**Agent:** Claude Code (main)
**Context:** Debugging embedding/filter pipeline - ran 4+ full research tests burning Sonnet/Haiku/embedding credits without user input
**Finding:** After context compaction, Claude tends to forget collaborative behavior and goes into "shotgun mode" - making rapid changes and running expensive tests without explaining or getting approval. This wastes:
- Sonnet credits (Problem Match filter)
- Haiku credits (Domain Gate filter, keyword extraction)
- OpenAI embedding credits
- User's time and patience
**Impact:** Burned through credits debugging when a simple data export + manual review would have been faster and cheaper.
**Action:**
1. **Before running any test that calls AI APIs:** Stop and explain what you're about to test and why
2. **After context compaction:** Re-read CLAUDE.md and this file to reset collaborative behavior
3. **When debugging filters:** Export raw data FIRST, let user find ground truth, THEN identify which filter is failing
4. **Default to summaries:** Explain findings before proposing solutions
5. **One change at a time:** Don't stack 5 fixes and test - make one fix, explain, get approval

---

*Last updated: 2025-12-31*

---

## File Organization Standards (For All Agents)

### Where to Put Files

| File Type | Location | Purpose |
|-----------|----------|---------|
| Test results, raw JSON, PDFs | `docs/data-quality/` | Baseline testing and quality tracking |
| Agent learnings | `docs/agent-learnings.md` | This file - shared knowledge |
| CEO reviews | `docs/data-quality/` | Named `ceo-review-YYYY-MM-DD.md` |
| Session state | `docs/RESUME_HERE.md` | For context handoff between sessions |

### Sharing Files with External Claude Instances

When files need to be shared with another Claude instance that has different directory access:
1. Keep canonical copy in `docs/data-quality/`
2. Copy to `~/Downloads/pvre-data-quality/` for sharing
3. Command: `cp -r docs/data-quality/* ~/Downloads/pvre-data-quality/`

### Naming Conventions for Test Files

```
# Baseline/comparison tests
pre-phase0_[test-name]_raw.json     # Before improvements
test1_[test-name]_raw.json          # After improvements (numbered)
test1_[test-name]_job.json          # Job metadata

# Reports and reviews
[test-name]_report.pdf              # PDF exports
ceo-review-YYYY-MM-DD.md            # CEO review notes
```

### When Agents Find Important Data

1. **Add learning to this file** in the "Active Learnings" section
2. **Export raw data** to `docs/data-quality/` with descriptive filename
3. **Update README.md** in data-quality folder with new file description
4. **Note the finding** in `RESUME_HERE.md` if it affects next session priorities

---

## 2025-12-22 - Data Quality: Phase 0 Implementation Results
**Agent:** Manual testing (Claude Code)
**Context:** Testing Phase 0 data quality improvements (pronoun detection, two-stage filtering, Sonnet upgrade, relevance-weighted quotes)
**Finding:**
- Hypothesis mode (Freelancer invoicing): 11% relevance - LOW but expected (hypothesis doesn't match Reddit discourse)
- App mode (Headspace): 80-85% relevance - EXCELLENT (proves filtering works)
- The difference is data source match, NOT filtering quality
**Impact:** Phase 0 improvements ARE working. Low relevance in hypothesis mode is valid output - tells founder their hypothesis doesn't match market discourse.
**Action:**
- Full test documentation in `docs/data-quality/PHASE0_TEST_RESULTS.md`
- Raw JSON exports in `docs/data-quality/test1_*.json` and `test2_*.json`
- This is now the BASELINE for future comparisons

---

## 2025-12-18 - CALIBRATION: Output Quality Agent Scoring Rules
**Agent:** Manual review (Julien + Claude)
**Context:** Independent analysis of Calm/sleep research revealed agent scored 7.2/10 when actual quality was closer to 6.5/10
**Finding:** Agent was missing critical system warnings and being too generous. Specific gaps:
1. Raw data contained `dataConfidence: "low"` — not surfaced
2. Raw data contained `narrowProblemWarning: true` — not surfaced  
3. Average pain score was 5.4/10, but report emphasized 8.5/10 high-intensity examples
4. WTP source not separated (100% from App Store competitor reviews)
5. Filter rate was 94.94% — potentially over-filtering
6. Some "signals" were spam/advice, not actual pain signals

**Impact:** Founder could make overconfident Go decision based on inflated score.

**Calibration Rules Now Applied:**

| Condition | Score Impact |
|-----------|-------------|
| `dataConfidence: "low"` | -0.5, cap at 7.0 |
| `narrowProblemWarning: true` | -0.3, cap at 7.0 |
| WTP = 0 from Reddit | -1.0 |
| 100% WTP from competitor reviews | -0.5 |
| Average pain < 6.0 | -0.3 |
| Filter rate > 90% | -0.2 |
| App-centric + no Reddit WTP | Cap at 6.5 |

**Status:** Applied to output-quality.md agent on 2025-12-18

---

## 2025-12-18 - Data Quality: App-Centric Mode WTP Bias
**Agent:** output-quality
**Context:** Evaluating research for Calm app (sleep/meditation hypothesis)
**Finding:** When PVRE runs in app-centric mode (analyzing existing app), WTP signals predominantly come from app store reviews of satisfied customers rather than organic Reddit discussions. In this case, 5 WTP signals total with 3-4 from App Store reviews vs 0-1 from Reddit.
**Impact:** This creates a false confidence problem. Founders see "people will pay" but the evidence shows "existing Calm customers are happy," not "unserved market will pay for a new solution." Critical distinction for Go/No-Go decisions.
**Action:**
- Track WTP signal sources separately (Reddit vs App Store vs other)
- Add warning in verdict: "WTP signals from [APP] reviews represent satisfied customers of existing solution. Independent market validation recommended before assuming similar WTP for new entrant."
- Consider prompting user: "Do you want to validate WTP for a NEW solution or understand an EXISTING product's satisfaction?"

## 2025-12-18 - Data Quality: Underserved Niche Detection
**Agent:** output-quality
**Context:** Analyzing sleep/meditation research, noticed specific high-pain niches
**Finding:** Within broad market (sleep/meditation), found 3 specific underserved niches with HIGH pain but different needs: (1) ADHD-specific sleep issues, (2) child/teen insomnia with parental anxiety, (3) corporate wellness B2B. These represent potential wedge markets vs competing head-on with Calm/Headspace.
**Impact:** Current PVRE analysis doesn't surface these as distinct opportunities. Founders may miss the "wedge strategy" and incorrectly conclude they need to "build a better Calm" (low probability of success) vs "own ADHD sleep vertical" (much more viable).
**Action:**
- Add "Underserved Niche Opportunities" section to analysis
- When multiple distinct audience types appear (children, ADHD, corporate), flag as potential wedges
- Recommend founder pick ONE niche for MVP vs trying to serve entire market

## 2025-12-18 - Quality Issue: Low Reddit WTP Despite High Pain
**Agent:** output-quality
**Context:** Sleep/meditation research had 8.5/10 pain intensity but only 6.6% WTP signals
**Finding:** Reddit signals showed intense pain (exhaustion, desperation, "please help") but almost zero willingness-to-pay indicators. App Store signals showed WTP but for competitor product. This disconnect is concerning.
**Impact:** High pain + low WTP could mean: (1) people don't believe digital solutions work, (2) free alternatives exist, (3) they'll only pay after proof of value. Without understanding WHY, founder can't build right monetization model.
**Action:**
- When pain >7/10 but WTP <10%, flag as "Monetization Risk"
- Add analysis: "Why might people not be paying despite high pain?"
- Suggest follow-up research: Look for negative reviews of free alternatives, or Reddit discussions about "why I won't pay for apps"

---

## 2025-12-24 - Technical: Web Scraping Without Puppeteer (Trustpilot Case Study)

**Agent:** Claude Code (main)
**Context:** Building Trustpilot data source adapter for PVRE

**Initial (Wrong) Approach:**
- Used Puppeteer + `tp2json` npm package for scraping
- Assumed Trustpilot required JavaScript rendering
- Added `@sparticuz/chromium` for serverless compatibility
- This approach had issues: Puppeteer doesn't work on Vercel, adds 50MB+ to bundle, slow (15-30s per search)

**The Investigation Process:**
1. User correctly questioned "how will this work in production?"
2. Searched for alternatives: GitHub repos, David Teather's web scraping course
3. Found Python scrapers (hakimkhalafi/trustpilot-scraper, irfanalidv/trustpilot_scraper) that use simple HTTP + BeautifulSoup
4. Key insight: If Python scrapers work without Selenium, the data must be in static HTML

**Key Discovery:**
Trustpilot uses Next.js with **server-side rendering**. The `__NEXT_DATA__` JSON blob IS present in the HTML response for:
- `/review/{company}` pages - Contains 20 reviews with full content
- `/search?query={term}` pages - Contains businessUnits array with matching companies

**Working Solution:**
```typescript
// Simple HTTP fetch - no Puppeteer needed!
const response = await fetch(url, { headers: { 'User-Agent': '...' } })
const html = await response.text()
const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
const data = JSON.parse(match[1])
return data.props.pageProps // Contains all the data
```

**What Didn't Work:**
- Trustpilot's official API - Requires business authentication
- Third-party APIs (RapidAPI) - Requires paid subscription
- Puppeteer on Vercel - Size limits, timeout issues

**Impact:**
- Removed 3 npm packages (tp2json, @sparticuz/chromium, puppeteer-core)
- Adapter now works on any serverless platform
- Response time: ~2-3 seconds vs 15-30 seconds with Puppeteer

**Generalized Lesson:**
Before assuming a site needs Puppeteer/Selenium:
1. Check if existing scrapers (Python/JS) use simple HTTP
2. Look for `__NEXT_DATA__`, `window.__INITIAL_STATE__`, or similar embedded JSON
3. Many Next.js/Nuxt/React apps server-render their data
4. Test with `curl` first - if data is in response, no browser needed

**Files:**
- Adapter: `src/lib/data-sources/adapters/trustpilot-adapter.ts`
- Registered in: `src/lib/data-sources/orchestrator.ts`
- Auto-triggers for: B2B, SaaS, services, insurance, banking, hosting keywords

---

## 2025-12-24 - Bug Pattern: New Code Not Wired Into All Pipelines

**Agent:** Claude Code (main)
**Context:** Auditing why API costs were higher than expected after adding filtering improvements

**The Bug Pattern:**
When adding new pre-filter functions (like `preFilterAndRank()`), they were only wired into the posts pipeline, not the comments pipeline. This caused:
- Posts: 700 → 150 sent to AI (78% reduction) ✓
- Comments: 700 → 400 sent to AI (no reduction) ✗

**Root Cause:**
`filterRelevantPosts()` and `filterRelevantComments()` are separate functions. When adding `preFilterAndRank()`, only posts was updated. Comments continued to send everything after quality gate directly to AI.

**Detection Method:**
1. User noticed costs weren't dropping as expected
2. Added detailed logging to trace data flow at each stage
3. Logs revealed: `→ Sent to AI: 385` for posts but no reduction for comments

**Prevention Checklist:**
When modifying the filtering pipeline:
- [ ] Check `filterRelevantPosts()`
- [ ] Check `filterRelevantComments()`
- [ ] Run test and verify BOTH pipelines show expected numbers
- [ ] Add logging that shows counts at each stage

**Key Files:**
- `src/lib/research/relevance-filter.ts` - Both functions are here
- `src/app/api/research/community-voice/route.ts` - Logging shows pipeline output

**Impact:** 30% cost increase ($0.10 → $0.13) until fixed

---

## 2025-12-24 - Bug Pattern: Naive Keyword Auto-Triggers

**Agent:** Claude Code (main)
**Context:** Trustpilot was being queried for hypothesis searches like "freelancers struggle with invoicing"

**The Bug:**
`shouldIncludeTrustpilot()` used simple keyword matching:
```typescript
// BAD: Triggers on any mention of "invoicing"
const TRUSTPILOT_KEYWORDS = ['software', 'invoicing', 'accounting', ...]
return TRUSTPILOT_KEYWORDS.some(k => hypothesis.includes(k))
```

This caused Trustpilot to query for "invoicing" businesses when the hypothesis was about **freelancer payment problems**, not about **reviewing invoicing software**.

**Why It's Wrong:**
- Trustpilot reviews of FreshBooks tell us "what users think of FreshBooks"
- They do NOT tell us "do freelancers struggle with late payments"
- Wasted API calls fetching irrelevant product reviews

**Correct Logic:**
Trustpilot should only auto-trigger when:
1. Hypothesis mentions a specific product name (QuickBooks, Stripe, etc.)
2. Hypothesis uses research patterns ("users of X", "alternative to Y")
3. User explicitly enables it

**Prevention Rule:**
When adding auto-trigger logic for data sources:
- Ask: "Does this trigger based on WHAT user wants to research?"
- NOT: "Does this trigger based on keywords that happen to appear?"
- Test with hypothesis that contains trigger keyword but doesn't need the source

**Key Files:**
- `src/lib/data-sources/orchestrator.ts` - `shouldIncludeTrustpilot()`

---

## 2025-12-24 - Technical: Always Audit Data Flow Before AI

**Agent:** Claude Code (main)
**Context:** Debugging why costs were higher than expected

**The Pattern:**
Before assuming AI costs are correct, verify the pre-AI filtering is actually running:

1. **Add logging at each filter stage:**
```typescript
console.log(`Stage 3 (Quality Gate): ${filtered} removed`)
console.log(`PreFilter: ${skipped} skipped`)
console.log(`→ Sent to AI: ${remaining}`)
```

2. **Check the math:**
- Input - Stage3Filtered - PreFilterSkipped = SentToAI
- If numbers don't add up, something is bypassing filters

3. **Compare posts vs comments:**
- Both should show similar reduction ratios
- If one is much higher, check if pre-filter is wired in

**Real Example:**
```
=== POST FILTER PIPELINE ===
  Input: 677 posts
  Stage 3: 107 filtered
  PreFilter: 185 skipped
  → Sent to AI: 385  ← Math checks: 677-107-185=385 ✓

=== COMMENT FILTER PIPELINE ===
  Input: 698 comments
  Stage 3: 316 filtered
  PreFilter: 0 skipped   ← BUG! Should be ~200
  → Sent to AI: 382      ← Too high!
```

**Key Insight:**
The cost breakdown showed Haiku was 57% of total cost. If pre-filtering isn't working, Haiku calls multiply.

---

## 2025-12-26 - UI Finding: Playwright Screenshot Checklist

**Agent:** Claude Code (main)
**Context:** Taking full-page screenshots for UI review after Phase 5 dashboard polish

**The Problem:**
1. Cookie consent banner overlay covered content in ALL screenshots
2. Some pages weren't captured properly (missed scrollable content)
3. Screenshots were taken without verifying the page was ready

**Pre-Screenshot Checklist:**
Before taking ANY Playwright screenshots:

1. **Dismiss overlays first:**
   ```javascript
   // Look for and click cookie consent buttons
   await puppeteer_evaluate({ script: `
     const buttons = document.querySelectorAll('button');
     buttons.forEach(b => {
       if (b.textContent.match(/accept|agree|got it|ok|dismiss/i)) {
         b.click();
       }
     });
   `})
   ```

2. **Wait for page to stabilize:**
   ```javascript
   await browser_wait_for({ time: 1 }) // Wait 1 second for animations
   ```

3. **Use fullPage for scrollable content:**
   ```javascript
   await mcp__playwright__browser_take_screenshot({
     fullPage: true,
     filename: 'descriptive-name.png'
   })
   ```

4. **Verify screenshot captured correctly:**
   - Check file size (too small = something wrong)
   - Quick visual check if possible
   - Take 2-3 screenshots of same page if critical

**Common Overlays to Dismiss:**
- Cookie consent banners (most common)
- Newsletter popups
- "Install our app" banners
- Chat widgets
- Onboarding tooltips

**Action:** Always read this checklist before using Playwright for screenshots.

---

*Last updated: 2025-12-26*

## 2025-12-30 - Data Quality: 30% of Metrics are AI Estimates

**Agent:** pvre-documenter
**Context:** Deep documentation of two research flows (Hypothesis + App Gap) with full data source classification

**Key Findings:**

1. **Data Classification Breakdown:**
   - 45% VERIFIED (from real APIs/databases)
   - 24% = CALCULATED (formulas on inputs)
   - 30% AI ESTIMATE (Claude generation without external verification)
   - 1% UNKNOWN (need to verify source)

2. **Specific AI Estimates NOT Labeled in UI:**
   - TAM/SAM/SOM market sizes
   - Tailwinds and headwinds
   - Competitor profiles and attributes
   - User satisfaction estimates
   - Pain scores on quotes (0-10)
   - Relevance scores on quotes (0-10)
   - Strategic recommendations
   - Timing window predictions

3. **Critical Discrepancies Found:**
   - **TAM Underestimate:** AI estimated 190M freelancers when industry reports cite 1.5B+
   - **Velocity Nonsense:** +4100% velocity from base of 1 signal is meaningless
   - **Theme Frequency Too Low:** Showing themes with 1-3 mentions when minimum should be 5

4. **Formulas Are Transparent:**
   - All calculated metrics use documented formulas in code
   - Locations: pain-detector.ts, market-sizing.ts, timing-analyzer.ts, viability-calculator.ts

**Impact:** Users may treat AI estimates as verified facts. Without labeling, founders could make overconfident decisions based on Claude's training data rather than real market research.

**Recommendations (Priority Order):**

1. **HIGH:** Add visual indicator in UI for AI-generated numbers (asterisk, icon, color)
2. **HIGH:** When velocity base period <5 signals, show "Insufficient data" not percentage
3. **MEDIUM:** Don't display themes with frequency <5 (sample too small)
4. **MEDIUM:** Compare TAM against industry benchmarks, flag if >50% difference
5. **LOW:** Show confidence intervals for AI estimates (e.g., "TAM: 40-80M")

**Files Created:**
- `/Users/julientorriani/Downloads/HYPOTHESIS_SEARCH_DEEP_DIVE.md`
- `/Users/julientorriani/Downloads/APP_GAP_SEARCH_DEEP_DIVE.md`
- `/Users/julientorriani/Downloads/RAW_DATA_SAMPLES.json`
- `/Users/julientorriani/Downloads/CALCULATION_FORMULAS.md`
- `/Users/julientorriani/Downloads/INTERVIEW_QUESTIONS_GENERATED.md`
- `/Users/julientorriani/Downloads/ONE_PAGE_SUMMARY.md`
- `/Users/julientorriani/Downloads/DATA_QUALITY_AUDIT.md`

---

*Last updated: 2025-12-30*
