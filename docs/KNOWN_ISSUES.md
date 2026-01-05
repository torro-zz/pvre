# PVRE Known Issues

*Last updated: January 5, 2026*

---

## 🔴 CRITICAL — Fix First

### Comparison Matrix Completely Empty
**Status:** Open
**Impact:** Core feature shows no data — users get zero competitive insight
**Location:** Market tab > Competition section

Matrix shows all zeros with no competitors displayed. Completely broken visualization.

**Fix:** Populate matrix with competitor data from `competitorMatrix` in analysis. If data unavailable, hide the section rather than show empty grid.

---

### Verdict Messages Contradict Each Other
**Status:** Open
**Impact:** Users get conflicting guidance
**Location:** Verdict tab

Yellow recommendation box says "proceed with caution" while verdict section says "pivot". Mixed signals confuse users.

**Fix:** Ensure recommendation text aligns with verdict score and assessment.

---

### Hypothesis Confidence Wrong Metric for App Gap Mode
**Status:** Open
**Impact:** Two-axis viability assessment uses irrelevant metric
**Location:** Verdict tab

Shows "Hypothesis Confidence" axis in App Gap mode, but no hypothesis was tested — user analyzed an existing app.

**Fix:** For App Gap mode, replace "Hypothesis Confidence" with "Signal Quality" or "Data Confidence". Keep current metric for Hypothesis mode only.

---

## 🟡 MEDIUM — Next Sprint

### WTP Comments Truncated and Unreadable
**Status:** Open
**Impact:** Users can't read full willingness-to-pay signals
**Location:** Gaps tab > WTP section

Comments under "Willingness to Pay Signals" are cut off, unlike other sections which show full text.

**Fix:** Show full text for WTP signals, or add "expand" button. Match behavior of other sections.

---

### Google Trends Keyword Truncated
**Status:** Open
**Impact:** Incomplete data display
**Location:** Market tab > Timing section

Shows "dating apps for relation" cut off instead of full keyword.

**Fix:** Display full keyword. If space constrained, use tooltip for full text or truncate with "..." and show full on hover.

---

### Source Links Don't Go to Specific Reviews
**Status:** Open
**Impact:** Users can't verify source quotes
**Location:** Gaps tab > signal cards

"Original comment" link goes to general Google Play page, not specific review.

**Fix:** Change link text to clarify destination: "View on Google Play" instead of "Original comment". Add tooltip: "Links to app store page (specific review links not available)".

---

### Reddit Metrics Shown in App Gap Mode
**Status:** Open
**Impact:** Confusing metrics for App Store-only analysis
**Location:** Results header

Shows "0 communities" and "94 posts" for App Store reviews — wrong terminology.

**Fix:** Use "reviews" terminology in App Gap mode, hide Reddit-specific metrics.

---

### Market Score Unexplained
**Status:** Open
**Impact:** Users don't understand score meaning
**Location:** Market tab

Shows "1.0" and "Critical" with "11.1% penetration" but no context for what this means.

**Fix:** Add explanation of market score calculation and what penetration percentage represents.

---

## 🟢 LOW — Polish

### Investor Metrics Repeated on Every Tab
**Status:** Open
**Impact:** Wastes space, clutters views
**Location:** All tabs (App, Feedback, Market, Gaps, Verdict)

Same "Investor Metrics" section appears at top of every tab.

**Fix:** Make collapsible (collapsed by default), or move to dedicated Summary section.

---

### Sentiment Overview Format Confusing
**Status:** Open
**Impact:** Users can't quickly understand overall sentiment
**Location:** Feedback tab

Shows "46 one to two stars" with format that doesn't communicate sentiment at a glance. Missing overall rating for context.

**Fix:** Add overall rating prominently (e.g., "3.8 ★ from 274K reviews"). Redesign rating breakdown to be clearer.

---

### Opportunity Gaps UI Outdated
**Status:** Open
**Impact:** Looks unprofessional
**Location:** Market tab > Opportunities section

Cards show only headline + minimal detail. "Difficulty" tag and market opportunity icon look dated.

**Fix:** Redesign opportunity cards with: description, difficulty badge, potential impact, related signals.

---

## Recently Verified Fixed (January 5, 2026)

These were verified working with Tinder App Gap export:

| Issue | Verification |
|-------|--------------|
| App Store dates null | ✅ Timestamps present (e.g., `1763722867`) |
| Recency metrics zero | ✅ `last30Days: 33`, `last90Days: 37` |
| Self-competitor in list | ✅ "5 — 1 self-reference filtered" |
| Interview questions null | ✅ 15 questions in 3 categories |
| Google Trends weighted % | ✅ Shows +948%, rising |
| No [object Object] in export | ✅ 0 occurrences |
| No raw embeddings in export | ✅ Cleaned properly |

---

## File Reference

| Issue Category | Likely Files |
|----------------|--------------|
| Verdict | `src/components/research/verdict-hero.tsx`, `viability-verdict.tsx` |
| Market/Competition | `src/components/research/market-tab.tsx` |
| Gaps/WTP | `src/components/research/opportunities.tsx` |
| Feedback/Sentiment | `src/components/research/user-feedback.tsx` |
| Layout/Metrics | `src/components/research/layouts/` |
