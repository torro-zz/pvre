# Known Issues

Last updated: January 3, 2026

Technical issues and bugs that need fixing. For strategic features and roadmap, see `IMPLEMENTATION_PLAN.md`.

---

## 🔴 CRITICAL — Data Quality Bugs

### ✅ CLOSED: "Ads & Interruptions" Category Matching Wrong Context
**Status:** Fixed — January 3, 2026
**Resolution:** Removed problematic keywords from `user-feedback.tsx`:
- Removed `'interrupt'` keyword (matched technical "interruptions")
- Removed `'ad'` keyword (too short, matched "add", "made")
- Renamed label to `'Ads'`

Note: `opportunities.tsx` was already fixed (label = "Ad-free experience", no interrupt keyword).

---

### Theme Analysis Metadata All Undefined
**Status:** Cannot Reproduce — January 3, 2026

**Investigation:** Searched entire codebase for "Signal Count:", "Pain Intensity:", "WTP Confidence:" labels. These exact strings don't exist anywhere in the code.

**Current implementation:**
- Themes use `theme.frequency` → displayed as `{frequency} mentions`
- Themes use `theme.intensity` → displayed as `High/Medium/Low intensity`
- No `wtpConfidence` field exists or is expected on themes

**Files checked:**
- `evidence-tab.tsx`, `community-voice-results.tsx` — display themes correctly
- `report-generator.ts` — PDF uses `theme.intensity` correctly
- `adjacent-opportunities.tsx` — uses `signalCount` mapped from `theme.frequency`
- `summary-tab.tsx`, `action-tab.tsx` — display themes correctly

**Conclusion:** The issue may have referred to an old export format that was removed, or a manual debug output. Current theme displays work correctly. Closing as cannot reproduce.

---

### ✅ CLOSED: WTP Signals Show Purchase Regret, Not Purchase Intent
**Status:** Fixed — January 3, 2026
**Resolution:** Added 13 new exclusion patterns to `WTP_EXCLUSION_PATTERNS` in `pain-detector.ts`:

**New patterns detect:**
1. **Refund requests:** "get my money back", "want a refund", "asking for refund"
2. **Buyer's remorse:** "regret buying", "shouldn't have bought", "wished I hadn't paid"
3. **Questioning past purchase value:** "debating if it was worth", "was it worth the money"
4. **Past tense + negative sentiment:** "paid for this...disappointed", "wasted money"
5. **Explicit dissatisfaction:** "biggest waste of money", "threw money away"

**Tests added:** 4 new test cases in `pain-detector.test.ts`:
- Refund requests → excluded from WTP
- Buyer remorse → excluded from WTP
- Questioning past purchase (exact KNOWN_ISSUES example) → excluded
- Genuine future intent ("I'd pay for...") → still detected

**Verification:** 132 tests pass (38 pain detector tests including new ones)

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