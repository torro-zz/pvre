# Competitor Data Reliability

*Created: January 15, 2026*

---

## The Problem

Our competitor analysis has two reliability issues:

### 1. Broken Website URLs
- Claude AI generates URLs that are often **hallucinated** (domains that don't exist)
- Even "correct" URLs may be **outdated** (companies rebrand, shut down, change domains)
- ~5 out of 6 URLs tested returned 404 or wrong sites

### 2. Unverified Competitor Names
- Claude generates competitor names based on its training data
- Some competitors may be **out of business**
- Some may be **misidentified** (wrong company with similar name)
- The comparison matrix scores are **AI estimates**, not real data

---

## Solutions We Considered (URLs)

| Option | Approach | Pros | Cons | Verdict |
|--------|----------|------|------|---------|
| **Google Search Links** | Link to Google search for competitor name | Always "works" | Results vary by region, may show wrong company | ❌ Rejected - misleading |
| **Validate URLs** | HEAD request before saving | Only shows working URLs | Adds latency, doesn't catch "wrong company" | ⚠️ Partial solution |
| **LinkedIn Links** | Link to `linkedin.com/company/[slug]` | Predictable, most companies exist | Need correct slug, some companies not on LinkedIn | ✅ Possible fallback |
| **Wikidata API** | Query for official website URL | Accurate, free, structured | Adds complexity, not all companies in Wikidata | ✅ Good but complex |
| **Improve Prompt** | Ask Claude for high-confidence URLs only | Simple change | May still hallucinate | ⚠️ Partial solution |
| **No Links** | Remove link icons entirely | Zero broken links, honest | Users must search manually | ✅ **Recommended for now** |

---

## Solutions for Verifying Competitors Exist

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **Wikidata Validation** | Check if company exists in Wikidata | Structured, accurate | Not all companies listed, adds API calls |
| **Crunchbase API** | Verify against Crunchbase database | Comprehensive startup data | Paid API, terms compliance |
| **LinkedIn Validation** | Check if LinkedIn company page exists | Most companies have pages | Anti-scraping, API limitations |
| **App Store Lookup** | For apps, verify in App Store/Play Store | Definitive for apps | Only works for app competitors |
| **Domain Validation** | Check if company domain resolves | Proves something exists | Doesn't prove it's the right company |
| **User Feedback Loop** | Let users flag incorrect competitors | Gets better over time | Requires infrastructure |

---

## The Comparison Matrix Problem

The comparison matrix shows scores like:

| Competitor | Feature Set | Pricing | UX | Brand | Support |
|------------|-------------|---------|-----|-------|---------|
| Notion | 9 | 7 | 8 | 9 | 7 |
| Coda | 8 | 8 | 7 | 6 | 6 |

**These are AI estimates, not real data.**

### Options to Improve Matrix Reliability

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **Label as Estimates** | Add "AI Estimate" badge to matrix | Honest, simple | Doesn't fix accuracy |
| **Use Real Reviews** | Pull from G2, Capterra, TrustRadius | Real user data | Requires API access, cost |
| **App Store Ratings** | Use actual app store ratings | Verified data | Only works for apps |
| **Remove Matrix** | Don't show comparison scores | No misleading data | Loses feature |
| **Crowdsource** | Let users correct scores | Improves over time | Needs infrastructure |

---

## Recommendations

### Short-Term (Now)

1. **Remove URL links from UI**
   - Just show competitor names, no link icons
   - Avoids all broken link issues
   - Simple change (~10 lines)

2. **Add "AI Estimate" disclaimer to matrix**
   - Be transparent that scores are not verified
   - Add tooltip: "Scores are AI estimates based on public information"

3. **Keep competitor names as-is**
   - Claude's competitor identification is generally good
   - Names are more reliable than URLs

### Medium-Term (Next Sprint)

4. **Validate competitors against known databases**
   - For App Gap mode: Verify competitors exist in app stores
   - For Hypothesis mode: Cross-reference with Wikidata or Crunchbase

5. **Add LinkedIn fallback links**
   - Generate `linkedin.com/company/[slug]` URLs
   - More reliable than AI-generated domains
   - Show with LinkedIn icon to set expectations

### Long-Term (Future)

6. **Integrate real review data**
   - G2, Capterra, or TrustRadius APIs for B2B
   - App Store/Play Store ratings for apps
   - Replace AI estimates with real scores

7. **Build validation pipeline**
   - Verify company exists (Wikidata/Crunchbase)
   - Verify URL works (HTTP check)
   - Verify content matches company (name/logo check)

---

## Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Remove URL links from UI | 10 min | Eliminates broken links |
| 🔴 P0 | Add "AI Estimate" badge to matrix | 30 min | Sets user expectations |
| 🟡 P1 | LinkedIn fallback links | 2 hrs | Reliable secondary links |
| 🟡 P1 | App store validation (App Gap) | 4 hrs | Verified competitors |
| 🟢 P2 | Wikidata integration | 1 day | Accurate company data |
| 🟢 P2 | Real review data integration | 2-3 days | Verified matrix scores |

---

## Files Affected

| File | Current State | Changes Needed |
|------|---------------|----------------|
| `src/components/research/competitor-results.tsx` | Shows link icons | Remove link rendering |
| `src/lib/research/competitor-analyzer.ts` | Asks Claude for URLs | Could remove from prompt |
| `src/app/api/research/competitor-intelligence/route.ts` | Asks Claude for URLs | Could remove from prompt |

---

## Related Issues

- See `docs/KNOWN_ISSUES.md` → "Direct Competitor Links Mostly Broken"
- Previous fix attempts: commits `13bf56a`, `88e7aa3`, `7600f64` (reverted)
