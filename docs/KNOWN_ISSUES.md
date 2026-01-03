# Known Issues

Last updated: January 3, 2026

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## 🔴 CRITICAL — Data Quality Bugs

### "Ads & Interruptions" Category Matching Wrong Context
**Status:** Open — January 2, 2026
**Impact:** Non-ad apps show "Ads" category with irrelevant content.

**Problem:** The word "interruption" triggers "Ads & Interruptions" category, but in Loom reviews it means:
- Technical interruptions (recording stops)
- Workflow interruptions (app crashes)

**Evidence from Loom export:**

Review #5 (categorized as "Ads & Interruptions"):
> "all it did was chop off my recordings in the middle of my sessions. It got annoying and when I would actually finish without any **interruptions**, my recording would mute"

This is about **technical issues**, not advertising.

**Solution:** 
1. Remove "interruption" from Ads category keywords
2. Rename to just "Ads" or "Advertising"
3. Keep only: ads*, "too many ads", "remove ads", advertisement, commercial

**File to fix:** `src/components/research/opportunities.tsx` (categorizeFeature function, line ~107-143)

**Estimated effort:** 5 minutes

---

### Theme Analysis Metadata All Undefined
**Status:** Open — January 2, 2026
**Impact:** Theme section shows broken data, undermines trust.

**Problem:** All themes in export show:
```
- Signal Count: undefined
- Pain Intensity: undefined
- WTP Confidence: undefined
```

**Solution:** Trace theme generation pipeline:
1. Find where themes are created (likely `theme-extractor.ts` or `pain-detector.ts`)
2. Check if `signalCount`, `painIntensity`, `wtpConfidence` fields are being populated
3. Fix the mapping between theme extraction and display

**Files to investigate:** 
- `src/lib/analysis/theme-extractor.ts`
- `src/lib/analysis/pain-detector.ts`
- Theme display component in results

**Estimated effort:** 30-60 minutes

---

### WTP Signals Show Purchase Regret, Not Purchase Intent
**Status:** Open — January 2, 2026
**Impact:** WTP metric misleads users about monetization potential.

**Problem:** WTP signals are supposed to indicate people would PAY for an alternative. But signals marked as WTP are actually:

**Example (marked as `WTP Confidence: medium`):**
> "I just upgraded to the paid version... now I'm debating if that was worth the investment - I seriously feel like I should get my money back"

This is **purchase regret** about the EXISTING app, not willingness to pay for an ALTERNATIVE.

**What WTP should capture:**
- "I'd pay $X for something that does Y better"
- "I switched to [competitor] because it was worth the money"
- "Would gladly pay for a version without [problem]"

**Solution:** WTP detection needs CONTEXT:
1. Check for negative sentiment + payment keywords = REGRET (exclude)
2. Check for future/conditional tense = INTENT (include)
3. For App Gap mode: exclude statements about the app being analyzed

**File to fix:** `src/lib/analysis/pain-detector.ts` (WTP detection logic)

**Estimated effort:** 1-2 hours

---

## Recently Closed (January 3, 2026)

### ✅ CLOSED: Complete Module Specifications (HIGH Priority)
**Status:** Completed — January 3, 2026
**Resolution:** Added 8 HIGH priority module specifications to Section 18 of SYSTEM_DOCUMENTATION.md.

**Modules documented:**
- ROUTE-001: Community Voice Route (18.5) — main orchestrator with full step-by-step flow
- ANAL-001: Pain Detector (18.6) — keyword tiers, scoring logic
- ANAL-002: WTP Detector (18.7) — current logic + known issues (detecting regret not intent)
- ANAL-003: Theme Extractor (18.8) — Claude synthesis + known issues (undefined metadata)
- FILT-001: Tiered Filter (18.9) — thresholds, source weights
- DISP-001: Opportunities Display (18.10) — full category keywords list
- ADAPT-001: Reddit Adapter (18.11) — adaptive time-stratified fetching
- ADAPT-002: App Store Adapter (18.12) — pagination, IAP detection

**Remaining (MEDIUM/LOW priority):**
- ADAPT-003: Google Play Adapter
- CALC-001: Viability Calculator
- CALC-002: Market Sizer
- CALC-003: Timing Analyzer
- DISP-002: Verdict Display

---

### ✅ CLOSED: App Gap Mode Shows Irrelevant Reddit Posts
**Status:** Fixed — January 3, 2026
**Resolution:** Added App Name Gate filter for BOTH posts AND comments.

**Root Cause:** Two bypasses in `community-voice/route.ts`:
1. Adaptive fetch bypass — posts added via adaptive fetch were not filtered
2. Comment bypass — `finalComments` was never filtered

**Fix Applied (lines 1109-1154):**
- Added "Step 4.6: FINAL App Name Gate filter"
- Filters `finalCoreItems`, `finalRelatedItems`, AND `finalComments`
- App Store/Google Play reviews always kept

**Verification:**
- Before: 26 Reddit signals, 0 mentioned "Loom"
- After: 0 Reddit signals (correctly filtered)
- App Store signals: 23 (unaffected)

---

### ✅ CLOSED: Architecture Documentation Section 18
**Status:** Completed (Partial) — January 3, 2026
**Resolution:** Added Section 18 to SYSTEM_DOCUMENTATION.md with:
- Module Registry (14 modules with IDs, paths, modes)
- Data Flow Diagrams (ASCII for both modes)
- FILT-002 App Name Gate specification (full detail)
- DISP-001 Categorization keywords (partial)
- Mode Boundary Rules
- Pre-Fix Testing Checklist

**Remaining:** Full specifications for other 13 modules (tracked above)

---

## Recently Closed (January 2, 2026)

### ✅ CLOSED: Two-Step Analysis Flow Causing Score Changes
**Resolution:** Automated competitor analysis into single unified flow.

### ✅ CLOSED: Verdict Score Inconsistent Across Tabs
**Resolution:** With automated competitor flow, verdict now shows consistent score.

### ✅ CLOSED: Market Score 7-Point Gap (9.3 vs 2.2)
**Resolution:** Not a bug — different metrics, UI explains the difference.

### ✅ CLOSED: Competitor Classification Misclassifying High-Threat Competitors
**Resolution:** Classification logic now checks threat level FIRST.

### ✅ CLOSED: Analyzed App Appears in Own Competitor List
**Resolution:** Added filtering to exclude analyzed app.

### ✅ CLOSED: App Store Review Count Mismatch (39,668 → 16)
**Resolution:** Transparent messaging about pipeline (now 500 reviews).

### ✅ CLOSED: Same Comment in Multiple Categories
**Resolution:** Deduplication with "Also in:" tags.

### ✅ CLOSED: UI Polish Items (Batch)
- "45x" → "45 mentions"
- SAM notation → human-readable
- Hero vs Verdict contradiction → checks dealbreakers
- Core vs Supporting → tooltips added
- Source links → "View source" on quotes
- Verdict redesign Parts 1-3
- Methodology tooltips
- Community Discussions → moved up
- Source badges → colored by type

---

## Medium Priority — Architecture

### App Store-First Architecture for App Gap Mode
**Status:** Phase 1 Complete — January 2, 2026

**Completed:**
- ✅ Phase 1: Increased review limit 100 → 500

**Remaining:**
- Phase 2: Add dedicated Google Play Store adapter
- Phase 3: Embedding-based categorization (replace keyword matching)
- Phase 4: Reddit as secondary source only (for WTP/competitor intel)

---

## Medium Priority — UI Redesign

### Verdict Page Has Too Many Score Constructs
**Status:** Partially Complete — January 2, 2026

**Completed:**
- ✅ Part 1: VerdictHero component
- ✅ Part 2: Collapsible details
- ✅ Part 3: Responsive CSS grid

**Remaining (Deferred):**
- Part 4: User preference toggle (needs DB change)

---

## Low Priority — Logic / Accuracy

### Entry Difficulty Still Potentially Underestimated
**Status:** Open — MONITOR
**Impact:** May mislead users about effort required.

### Timing Score Minor Mismatch (8.2 vs 8.4)
**Status:** Open — LOW PRIORITY
**Impact:** 0.2 difference, not trust-breaking.

### "3.5 WTP Found" — Fractional Signal Count
**Status:** Needs Reproduction
**Impact:** Database audit shows integers. May be fixed.

---

## Existing Open Items

- Connect Help Button to Canny (Deferred)
- Clarify Purpose of API Keys
- Investigate Two-Panel Section
- Redesign Research Page Layout (Partial)

---

## Business Model Notes

### Credit System Reconsideration
**Status:** Needs Discussion
Options: Fuel model, subscription tiers, hybrid, query limits.

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

- Embedding Cache Errors (Low)
- 414 Request-URI Too Large (Low)

---

## Architecture Reference

**Key files:**
- Score calculation: `viability-calculator.ts`
- Data fetching: `fetch-research-data.ts`
- Competitor analysis: `competitor-analyzer.ts`
- Known competitors: `known-competitors.ts`
- App Store adapter: `app-store-adapter.ts`
- Google Play adapter: `google-play-adapter.ts`
- Clustering: `clustering.ts`
- Pain detection: `pain-detector.ts`
- Theme extraction: `theme-extractor.ts`
- Community voice: `community-voice/route.ts`
- Opportunities display: `opportunities.tsx`
- Context provider: `ResearchDataProvider`

**Architecture Docs:** `docs/SYSTEM_DOCUMENTATION.md` Section 18

---

## How to Use This File

**For CC:** 
1. 🔴 CRITICAL bugs first — these are blocking quality
2. Check Recently Closed to avoid re-fixing
3. Reference Architecture section for key files
4. **Before making changes:** 
   - Check Section 18 of SYSTEM_DOCUMENTATION.md for module specs
   - Verify which mode(s) the code affects
   - Run Pre-Fix Testing Checklist before closing