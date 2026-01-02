# Known Issues

Last updated: January 2, 2026

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## Recently Closed (January 2, 2026)

### ✅ CLOSED: Two-Step Analysis Flow Causing Score Changes
**Status:** Fixed — January 2, 2026
**Resolution:** Automated competitor analysis into single unified flow. Verdict now includes competition score from the start. No more "numbers changed" confusion.

**Files modified:**
- `src/lib/research/known-competitors.ts` (new)
- `src/lib/research/competitor-analyzer.ts` (new)
- `src/app/api/research/community-voice/route.ts`
- UI components (removed CompetitorPromptModal, added refinement mode)

---

### ✅ CLOSED: Verdict Score Inconsistent Across Tabs
**Status:** Fixed — January 2, 2026
**Resolution:** With automated competitor flow, verdict now shows consistent score (5.0/10) across Hero and Verdict tab. Root cause was displaying incomplete verdict before competition analysis.

---

### ✅ CLOSED: Market Score 7-Point Gap (9.3 vs 2.2)
**Status:** Not a bug — January 2, 2026
**Resolution:** These are intentionally different metrics:
- Two-Axis "Market Opportunity": 9.0 (raw score)
- Score Breakdown: 2.2 (adjusted, with note "adjusted from 9.0")

The UI already explains this. No fix needed.

---

### ✅ CLOSED: Competitor Classification Misclassifying High-Threat Competitors
**Status:** Fixed — January 2, 2026
**Resolution:** Classification logic now checks threat level FIRST before keyword matching. Microsoft Teams, Discord, Google Chat now correctly show as Direct Competitors for Slack.

**File modified:** `src/components/research/competitor-results.tsx:139-149`

---

## Critical — Score Calculation Pipeline

### Timing Score Minor Mismatch (8.2 vs 8.4)
**Status:** Open — January 2, 2026 — **LOW PRIORITY**
**Impact:** Minor — 0.2 difference is not trust-breaking.

**Problem:** Timing shows 8.2 in Hero/Score Breakdown but 8.4 in Two-Axis Assessment.

**Solution:** Likely rounding difference. Investigate only if users report confusion. Not blocking launch.

---

### "3.5 WTP Found" — Fractional Signal Count
**Status:** Open — January 2, 2026
**Impact:** Users don't understand what 0.5 of a signal means.

**Problem:** WTP count displays as "3.5" or similar fractional values. Signals should be integers.

**Solution:** Check WTP calculation — likely averaging or weighting producing decimals. Round or fix display.

---

## High Priority — Data Display Bugs

### App Store Review Count Mismatch (39,668 → 16)
**Status:** Open — January 2, 2026
**Impact:** Users expect analysis of available reviews; getting <0.1% analyzed feels broken.

**Problem:** App tab shows Slack has 39,668 reviews. Feedback tab says "Insights from 16 app store reviews." Where are the other 39,652?

**Solution:** Investigate app store fetch API — is it returning only 16? Or is relevance filter dropping them? App store reviews should bypass relevance filter entirely.

---

### Same Comment Appears in Multiple Categories
**Status:** Open — January 2, 2026
**Impact:** Users think they're seeing duplicate data; inflates apparent evidence.

**Problem:** Identical review text appears under "Ads & Interruptions," "Performance & Bugs," AND "Missing Features."

**Solution:** Either deduplicate (show each review once in primary category) or add visual indicator "Also tagged: Bugs, Features" without repeating full text.

---

### Sources Header Ignores App Store
**Status:** Open — January 2, 2026
**Impact:** Header misrepresents data sources used.

**Problem:** In App Gap mode, header shows "Sources Covered: Reddit 112 signals (90 core)" but doesn't mention App Store reviews at all.

**Solution:** Update header to show "Reddit: 112 signals | App Store: 16 reviews" or similar.

---

### Truncated Comments Not Expandable
**Status:** Open — January 2, 2026
**Impact:** Users cannot read full evidence; unverifiable claims.

**Problem:** Comments in Unmet Needs and WTP sections are truncated. Clicking "Read more" doesn't reveal full text.

**Solution:** Fix click handler to expand full comment text.

---

### "45x" Label Undefined
**Status:** Open — January 2, 2026
**Impact:** Users don't know what metric they're seeing.

**Problem:** A "45x" badge appears next to "Ad-free experience" unmet need. Undefined what it means.

**Solution:** Define clearly in UI: "45 mentions" or add tooltip explaining the metric.

---

### Analyzed App Appears in Own Competitor List
**Status:** Open — January 2, 2026 — **NEW**
**Impact:** Minor confusion — Slack shows as competitor to Slack.

**Problem:** When analyzing Slack, "Slack" appears in the Direct Competitors list.

**Solution:** Filter out the analyzed app from competitor results before display.

---

## High Priority — Transparency / Traceability

### No Links to Original Sources
**Status:** Open — January 2, 2026
**Impact:** Evidence is unverifiable; users cannot fact-check.

**Problem:** WTP signals, pain quotes, and Reddit comments have no links to original posts.

**Solution:** Store and display source URLs. Add "View on Reddit ↗" or "View in App Store ↗" links.

---

### Hover-Only Definitions for Core vs Supporting
**Status:** Open — January 2, 2026
**Impact:** Key terminology unexplained; users confused by "90 core" without context.

**Problem:** "112 signals (90 core)" only explains what "core" vs "supporting" means on hover.

**Solution:** Add inline explanation or info icon with persistent tooltip.

---

### How Feedback Generates Gaps is Opaque
**Status:** Open — January 2, 2026
**Impact:** Users don't trust AI recommendations without methodology.

**Problem:** Gaps tab shows opportunities but doesn't explain how user feedback was analyzed to produce them.

**Solution:** Add "Based on X reviews mentioning..." attribution to each gap. Clustering implementation should help here.

---

### Opportunities/Positioning Methodology Hidden
**Status:** Open — January 2, 2026
**Impact:** Recommendations feel like AI speculation rather than data-driven insights.

**Problem:** Positioning strategies appear without explaining what data supports them.

**Solution:** Add provenance: "Based on 23 users requesting simpler workflows..."

---

### Market Figures (TAM/SAM) Methodology Unclear
**Status:** Open — January 2, 2026
**Impact:** Users don't know how to interpret AI estimates.

**Problem:** TAM/SAM labeled "FERMI ESTIMATE" but calculation methodology not shown.

**Solution:** Add expandable section showing Fermi calculation steps.

---

## High Priority — Logic / Accuracy Bugs

### "Ad-free Experience" as Top Unmet Need (45x)
**Status:** Open — January 2, 2026
**Impact:** Signal from wrong context polluting results.

**Problem:** "Ad-free experience" shows as #1 opportunity for Slack. But Slack doesn't have ads.

**Solution:** Tighten relevance filtering for App Gap mode.

---

### WTP Signals Aren't Actually WTP
**Status:** Open — January 2, 2026
**Impact:** False confidence in monetization potential.

**Problem:** "Willingness to Pay Signals" section shows bug reports and praise, not purchase intent.

**Solution:** WTP detection needs to verify: (1) statement is about paying, (2) for something solving the hypothesis problem, (3) not about the app being analyzed.

---

### Velocity "0 Prior" = Statistically Meaningless
**Status:** Open — January 2, 2026
**Impact:** Misleading trend data; infinite growth from zero baseline.

**Problem:** Discussion velocity calculates massive percentage growth from 0 baseline.

**Solution:** When prior period is 0-4 posts, show "Insufficient baseline data" instead of percentage.

---

### Entry Difficulty Still Potentially Underestimated
**Status:** Open — January 2, 2026 — **MONITOR**
**Impact:** May mislead users about effort required.

**Problem:** Entry difficulty now shows 5.0-5.5/10 "Moderate barrier" for Slack competitor. Better than before (was 4.0 "Low barrier") but still may underestimate real difficulty.

**Solution:** Monitor user feedback. Consider adding factors: competitor funding, technical complexity, network effects.

---

## Medium Priority — UI/UX Confusion

### Verdict Tab Has Too Many Score Constructs
**Status:** Open — January 2, 2026
**Impact:** Information overload; users don't know which number to trust.

**Problem:** Verdict tab displays: Viability Verdict, Market Opportunity, Hypothesis Confidence, Score Breakdown, Two-Axis Assessment.

**Solution:** Consolidate into single clear verdict with supporting breakdown.

---

### "Proceed with Confidence" vs "Dealbreakers Detected"
**Status:** Open — January 2, 2026
**Impact:** Contradictory guidance on same research.

**Problem:** Hero shows "Proceed with Confidence" while Verdict tab shows "Dealbreakers Detected."

**Solution:** Hero message should reflect verdict, not just signal count.

---

### SAM Notation Confusing (105000-195000K)
**Status:** Open — January 2, 2026
**Impact:** Users can't interpret market size correctly.

**Problem:** Notation mixes K and raw numbers inconsistently.

**Solution:** Standardize notation: always use "150M" format.

---

### Community Discussions Section Buried
**Status:** Open — January 2, 2026
**Impact:** Users miss valuable Reddit data.

**Problem:** Community Discussions section is below 5 expandable app store categories.

**Solution:** Move higher or add count badge to draw attention.

---

### Reddit vs App Store Sources Not Visually Distinct
**Status:** Open — January 2, 2026
**Impact:** Users can't tell provenance of evidence at a glance.

**Problem:** App Store reviews and Reddit comments look similar in the UI.

**Solution:** Add distinct visual treatment: colored border or source icon.

---

## Existing Open Items

### Connect Help Button to Canny
**Status:** Open — Deferred
**Impact:** Help button non-functional.

---

### Clarify Purpose of API Keys
**Status:** Open
**Impact:** Feature purpose unclear.

---

### Investigate Two-Panel Section
**Status:** Open
**Impact:** Layout expectations unclear.

---

### Redesign Research Page Layout
**Status:** Partial
**Impact:** Inefficient use of screen space. Goal is bento grid layout.

---

## Business Model Notes

### Credit System Reconsideration
**Status:** Needs Discussion

Options: Fuel model, subscription tiers, hybrid, query limits.
**Decision deferred** — revisit when usage patterns are clearer.

---

## Future Enhancements (P3)

- AI vs Code Audit
- App Analysis Results Parity  
- PDF Exports Professional Redesign
- TAM/SAM/SOM External Data Sources
- TikTok Data Source Wrapper
- Google Trends API Expansion

---

## Non-Blocking Technical Issues

### Embedding Cache Errors
- **Impact:** None - embeddings still work
- **Priority:** Low

### 414 Request-URI Too Large
- **Impact:** None - falls back to computing embeddings
- **Priority:** Low

---

## Architecture Reference

**Key files:**
- Score calculation: `viability-calculator.ts`
- Data fetching: `fetch-research-data.ts`
- Competitor analysis: `competitor-analyzer.ts` (new)
- Known competitors: `known-competitors.ts` (new)
- Context provider: `ResearchDataProvider`

---

## Session Progress (January 2, 2026)

| Item | Status |
|------|--------|
| Automated competitor flow | ✅ Done |
| Verdict score consistency | ✅ Fixed |
| Market score "mismatch" | ✅ Closed (not a bug) |
| Competitor classification | ✅ Fixed |
| Timing 0.2 mismatch | 🟡 Deprioritized |
| Self-in-competitor-list | 🟡 Minor, noted |

**Next priorities:** Data display bugs (review count, duplicates, sources header)

---

## How to Use This File

**For CC:** 
1. Check Recently Closed to avoid re-fixing
2. Work Critical → High → Medium priority
3. Reference Architecture section for key files