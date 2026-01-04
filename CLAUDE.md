# PVRE - Claude Code Instructions

**This file is read by Claude Code at the start of every session.**
**These rules are MANDATORY for all code changes.**

*Last updated: January 3, 2026*
f
---

## 🔴 BEFORE ANY CODE CHANGE

### Step 1: Read the Architecture
Before modifying ANY file, read these docs:
1. `docs/SYSTEM_DOCUMENTATION.md` — Section 18 (Mode-Specific Code Paths)
2. `docs/KNOWN_ISSUES.md` — Check if issue is already fixed or in progress

### Step 2: Identify Affected Modules
Use the Module Registry in Section 18.1 to identify:
- Which module(s) you're modifying
- What MODE they operate in (Hypothesis / App Gap / Both)
- What other modules DEPEND on them
- What modules they DEPEND on

### Step 3: State Your Intent
Before writing code, state:
```
I am modifying: [MODULE-ID] ([Module Name])
Mode: [Hypothesis / App Gap / Both]
Dependencies affected: [list]
Consumers affected: [list]
```

---

## 🟡 DUAL-MODE ARCHITECTURE

PVRE has TWO modes that share some code but not all:

| Mode | Trigger | Primary Data | Reddit Handling |
|------|---------|--------------|-----------------|
| **Hypothesis** | User types problem statement | Reddit + App Stores | Embedding filter only |
| **App Gap** | User selects app from store | App Store reviews | App Name Gate filter required |

**CRITICAL:** If you're changing a module marked as "Both", your change affects BOTH modes. Test both.

### File Ownership
Each module has ONE primary file. Don't scatter logic across files:

| Module | Primary File | Don't Put Logic In |
|--------|--------------|-------------------|
| Pain Detection | `pain-detector.ts` | route.ts, display components |
| WTP Detection | `pain-detector.ts` | route.ts, display components |
| Theme Extraction | `theme-extractor.ts` | pain-detector.ts |
| Categorization | `opportunities.tsx` | user-feedback.tsx |
| App Name Gate | `community-voice/route.ts` | adapters |

### Module ID Format

| Prefix | Type | Example |
|--------|------|---------|
| ADAPT- | Data Source Adapter | ADAPT-001 (Reddit) |
| FILT- | Filter/Gate | FILT-002 (App Name Gate) |
| ANAL- | Analysis Module | ANAL-001 (Pain Detector) |
| CALC- | Calculator/Scorer | CALC-001 (Viability) |
| DISP- | Display Component | DISP-001 (Opportunities) |
| ROUTE- | API Route | ROUTE-001 (Community Voice) |

---

## 🟢 BEFORE CLOSING ANY ISSUE

### Pre-Commit Checklist

**ALL changes require:**

- [ ] **Build passes:** `npm run build` completes without errors
- [ ] **Tests pass:** `npm run test:run` passes (128+ tests)

- [ ] **Hypothesis Mode Test:**
  - Run search: "Remote workers who need better async communication"
  - Verify: Reddit signals are relevant to the hypothesis
  - Verify: Scores display correctly (no undefined)

- [ ] **App Gap Mode Test:**
  - Run search: Loom App Store URL or similar
  - Verify: App Store reviews are all about the app (100% relevant)
  - Verify: Reddit signals mention app name (or 0 if none found)
  - Verify: Categories make sense (no "Ads" for ad-free apps)

- [ ] **Score Consistency Test:**
  - Verify: Verdict score same in Hero and Verdict tab
  - Verify: No "undefined" values in any display

- [ ] **Architecture Updated:**
  - If you added a module → Added to Module Registry
  - If you changed module behavior → Updated its specification
  - If you fixed a bug → Documented the fix in KNOWN_ISSUES.md

---

## 🚫 NEVER DO THESE THINGS

1. **Never bypass filters** — If a filter exists (like App Name Gate), ALL code paths must go through it
2. **Never add parallel code paths** — If there's one way to add signals, don't create another
3. **Never change shared modules without testing both modes**
4. **Never close an issue without running the checklist**
5. **Never guess what a module does** — Read the spec in Section 18

---

## Behavior Guidelines

### Code Changes
- Prefer minimal, targeted changes over comprehensive refactors
- Modify existing files before creating new ones
- No new abstractions, helper classes, or patterns unless explicitly requested
- When asked to "refactor" without specifics, ask for scope first

### Exploration First
- When fixing bugs, read the relevant module AND its dependencies first
- Understand data flow before proposing changes
- Don't guess at surrounding context - explore it with grep/search

### Tool Usage
- Use tools when genuinely needed, not preemptively
- For research tasks, refine queries based on previous results
- Complete each step before moving to next (avoid parallel speculation)

### Output Style
- After multi-step tasks, summarize what was done
- Prose for explanations, code blocks for code
- Concise but not terse

---

## Code Quality Standards

**Full guide:** `docs/SYSTEM_DOCUMENTATION.md` → "Code Standards" section

### Database Operations
Use typed Supabase clients (`Database` type from `src/types/supabase.ts`).
Use `saveResearchResult()` from `src/lib/research/save-result.ts` for research data.
Serialize complex objects with `JSON.parse(JSON.stringify(data))` before DB saves.

*Why: Untyped operations caused silent failures in production. The shared utilities prevent copy-paste bugs and ensure consistent error handling.*

### Before Committing
Run `npm run build` - catches type errors that `npm run dev` misses.
Run `npm run test:run` - ensures 128+ tests pass.

*Why: Dev mode is permissive. Build mode catches issues before they reach users.*

### Type Safety
Regenerate Supabase types after schema changes:
```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts
```
Avoid `any` - use proper types or `unknown`.
Use `ModuleName` type for research module names.

*Why: Type mismatches between code and DB schema caused the "balance_after" bug that broke all research.*

### Payment Provider
This project uses **LemonSqueezy** (not Stripe). See `docs/KNOWN_ISSUES.md`.

---

## Protected Code

The following files are **LOCKED** and must not be modified without explicit approval:
- `src/lib/filter/universal-filter.ts`
- `src/lib/filter/LOCKED.md`
- `src/lib/adapters/types.ts`

**Before modifying any file**, check if a `LOCKED.md` exists in that directory.
If it does, **READ IT** and follow the process. Do not modify locked code.

The universal filter was calibrated against 14 gold nuggets with a 75% hit rate at threshold 0.34.
Any changes risk breaking this calibration and must go through the approval process in `LOCKED.md`.

---

## Critical Quality Metric: Relevance

**The 64% Problem:** Testing revealed 64% of detected pain signals were completely irrelevant to business hypotheses, with 0% directly relevant.

**Root Causes (Dec 2025 Analysis):**
1. **Quote selection by pain intensity, not relevance** - High-pain quotes may be unrelated to hypothesis
2. **No first-person language filtering** - Generic observations mixed with real experiences
3. **Reddit-only WTP signals** - People don't say "I'd pay $X" on Reddit

**Full Brief:** `docs/data-quality/DATA_QUALITY_BRIEF.md` contains comprehensive analysis and solutions

When working on Community Voice or pain detection:
- The relevance filter in `src/app/api/research/community-voice/route.ts` (lines 64-247) is critical
- Quote selection in `src/lib/analysis/theme-extractor.ts` (lines 517-524) needs relevance weighting
- Consider first-person language as a signal boost
- App reviews are better for WTP than Reddit

When reviewing research output quality:
- Check: "Does this pain signal actually relate to the hypothesis?"
- Check: "Is this a firsthand experience or generic observation?"
- Tally relevant vs irrelevant signals
- Target: >70% relevance rate

---

## 📁 Key File Locations

### Configuration
- Architecture: `docs/SYSTEM_DOCUMENTATION.md` (Section 18)
- Known Issues: `docs/KNOWN_ISSUES.md`
- This file: `CLAUDE.md`

### Data Sources (Adapters)
- Reddit: `src/lib/data-sources/arctic-shift.ts`
- App Store: `src/lib/data-sources/adapters/app-store-adapter.ts`
- Google Play: `src/lib/data-sources/adapters/google-play-adapter.ts`
- Hacker News: `src/lib/data-sources/adapters/hacker-news-adapter.ts`

### Analysis Pipeline
- Pain Detection: `src/lib/analysis/pain-detector.ts`
- Theme Extraction: `src/lib/analysis/theme-extractor.ts`
- Market Sizing: `src/lib/analysis/market-sizing.ts`
- Timing Analysis: `src/lib/analysis/timing-analyzer.ts`
- Viability Calculator: `src/lib/analysis/viability-calculator.ts`

### Filtering
- Relevance Filter: `src/lib/research/relevance-filter.ts`
- Embedding Service: `src/lib/embeddings/embedding-service.ts`
- App Name Gate: `src/app/api/research/community-voice/route.ts` (lines 1109-1154)

### API Routes
- Main Research: `src/app/api/research/community-voice/route.ts`
- Coverage Check: `src/app/api/research/coverage-check/route.ts`
- Competitor Analysis: `src/app/api/research/competitor/route.ts`

### Display Components
- Results Layout: `src/components/research/layouts/tabbed-view.tsx`
- Opportunities/Gaps: `src/components/research/opportunities.tsx`
- User Feedback: `src/components/research/user-feedback.tsx`
- Verdict Display: `src/components/research/viability-verdict.tsx`
- Verdict Hero: `src/components/research/verdict-hero.tsx`

### Database
- Types: `src/types/supabase.ts`
- Save Utility: `src/lib/research/save-result.ts`

---

## 🔧 Common Tasks

### "Fix a bug in App Gap mode"
1. Read Section 18 — find which module is affected
2. Check if the module is App Gap only or Both
3. If Both, test Hypothesis mode too after fix
4. Update KNOWN_ISSUES.md with the fix
5. Run full checklist

### "Add a new data source"
1. Create adapter in `src/lib/data-sources/adapters/`
2. Assign Module ID (ADAPT-XXX)
3. Add to Module Registry
4. Write full specification
5. Document which mode(s) it supports
6. Integrate into `community-voice/route.ts`
7. Ensure filters apply to new source

### "Change how signals are categorized"
1. Read DISP-001 spec in Section 18
2. Modify ONLY `opportunities.tsx`
3. Test with multiple apps (ad-supported AND ad-free)
4. Verify categories make sense in context
5. Update keyword documentation if changed

### "Fix scoring/verdict issues"
1. Read CALC-001 spec
2. Check if issue is in calculation or display
3. If display, check DISP-002 (Verdict Display)
4. Verify score consistency across tabs
5. Test both modes

### "Document a new/updated module"
When adding or significantly changing a module, update its specification in Section 18.

**Template format:**
```markdown
### [MODULE-ID]: [Name]

**Purpose:** [One sentence description]

**Mode:** [Hypothesis / App Gap / Both]

**File:** `[path/to/file.ts]`

**Inputs:**
- `inputName`: Description of input
- `anotherInput`: Description

**Outputs:**
- `outputName`: Description of output

**Dependencies:**
- [MODULE-ID] ([Name]) — what it provides

**Used By:**
- [MODULE-ID] ([Name]) — how it uses this module's output

**Logic:**
1. Step one
2. Step two
3. Step three

**Known Issues:**
- [List any current bugs or limitations, or "None"]
```

**Process:**
1. Read the actual code for the module
2. Trace inputs and outputs
3. Identify dependencies (what it calls)
4. Identify consumers (what calls it)
5. Document the logic steps
6. Note any bugs discovered

**Documented modules (Section 18):**
- ROUTE-001 (18.5) — Main orchestrator flow
- ANAL-001 (18.6) — Pain detection scoring
- ANAL-002 (18.7) — WTP detection (known issues)
- ANAL-003 (18.8) — Theme extraction (known issues)
- FILT-001 (18.9) — Tiered filter thresholds
- FILT-002 (18.3) — App Name Gate
- DISP-001 (18.10) — Categorization keywords
- ADAPT-001 (18.11) — Reddit adapter
- ADAPT-002 (18.12) — App Store adapter

---

## Quick Start Testing

### Dev Authentication
```bash
# Authenticate as test user
curl -X POST http://localhost:3000/api/dev/login -c /tmp/cookies.txt

# Check auth status
curl http://localhost:3000/api/dev/login -b /tmp/cookies.txt
```

Only works when `NODE_ENV !== 'production'`.

### Browser Automation (Playwright ONLY)

**IMPORTANT: Use Playwright MCP, NOT Puppeteer.** The project uses `@playwright/mcp`.

```javascript
// 1. Login
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000' })
await mcp__playwright__browser_evaluate({ script: `fetch('/api/dev/login', { method: 'POST' })` })

// 2. Dashboard - should show "Welcome back, Test User (Dev)!"
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000/dashboard' })

// 3. Research
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000/research' })
await mcp__playwright__browser_fill({ selector: 'textarea', value: 'A tool to help freelancers manage invoicing' })
await mcp__playwright__browser_click({ selector: 'button[type="submit"]' })

// 4. Screenshot
await mcp__playwright__browser_screenshot()
```

**MCP Config:** `.mcp.json` - uses `@playwright/mcp@latest`

---

## Architecture Quick Reference

### Database Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User data + `credits` balance |
| `research_jobs` | Research projects, status, `error_source` |
| `research_results` | Module outputs (JSON) |
| `credit_transactions` | Credit history with `balance_after` |

### Error Source Tracking
When research fails, `error_source` in `research_jobs` shows where:
- `anthropic` → Claude API (check key, rate limits)
- `arctic_shift` → Reddit data API (check if down)
- `database` → Supabase (check connection, RLS)

### Arctic Shift API
- **Rate limit:** ~2000 requests/minute (very generous)
- **DO NOT use `query` or `body` params** - multi-word searches cause 422 timeouts
- Fetch by subreddit + time range only; Claude relevance filter handles filtering
- See `src/lib/data-sources/arctic-shift.ts`

### Filtering Pipeline (CRITICAL for costs)
**Full docs:** `docs/SYSTEM_DOCUMENTATION.md` → "Filtering Pipeline"

The filtering pipeline controls AI costs. Bugs here cause cost overruns.

**Key Files:**
- `src/lib/research/relevance-filter.ts` - All filter functions
- `src/app/api/research/community-voice/route.ts` - Pipeline orchestration

**Two Parallel Pipelines:**
| Pipeline | Pre-Filter Max | Function |
|----------|---------------|----------|
| Posts | 150 | `filterRelevantPosts()` |
| Comments | 200 | `filterRelevantComments()` |

**When modifying filters:**
1. Check BOTH `filterRelevantPosts()` AND `filterRelevantComments()`
2. Run test and verify logs show expected counts at each stage
3. Math check: Input - Filtered - Skipped = SentToAI

**Dec 2025 Bug:** `preFilterAndRank()` was only wired into posts, not comments. Comments sent 400+ to AI instead of 200. Cost increased 30%.

### Data Source Auto-Triggers
When adding auto-trigger logic for data sources (like Trustpilot):
- **DO:** Trigger based on what user wants to research
- **DON'T:** Trigger based on keywords that happen to appear
- **Test:** With hypothesis containing trigger keyword but doesn't need the source

Example: "Freelancers struggle with invoicing" should NOT trigger Trustpilot (no product research), even though it contains "invoice".

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/review` | Review against CLAUDE.md specs |
| `/test-flow` | E2E test via Playwright |
| `/ceo-review` | Full visual walkthrough with screenshots |
| `/improve` | Find and implement next priority |
| `/goodnight` | Save state to `docs/RESUME_HERE.md` |

---

## Agent System

Specialized agents in `.claude/agents/` with **shared learning** capability.

### Agent Roster

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `output-quality` | LeanSpark evaluation: "Does this help founders decide?" | After research, before releases |
| `flow-tester` | Detailed E2E testing with full input/output logging | Testing features, debugging flows |
| `code-hardener` | Security, types, refactoring, performance | Before commits, audits |
| `ui-specialist` | Visual polish, accessibility, responsiveness | UI changes, design reviews |
| `ceo-review` | CEO-level visual product walkthrough | Before releases, product checks |
| `debugger` | Root cause analysis for bugs | Error messages, "why is this broken" |
| `learner` | Meta-agent: synthesizes patterns, improves other agents | Periodically, after incidents |

### Self-Learning System

All agents share knowledge through `docs/agent-learnings.md`:

1. **Every agent reads it first** — Before starting work, agents check for relevant learnings
2. **Agents write discoveries** — When something important is found, it's added to the file
3. **Learner synthesizes** — Periodically identifies patterns and proposes agent updates

### Deploying Agents

CC should proactively use agents when:
- **output-quality** → After any research completes, to verify quality
- **flow-tester** → When testing new features or debugging
- **code-hardener** → Before commits, especially for API/security changes
- **ui-specialist** → After UI changes, before releases
- **ceo-review** → Before any release, for final product check
- **debugger** → When encountering errors or unexpected behavior
- **learner** → Weekly, or after incidents

### IMPORTANT: Frontend Design / UI Work

**ALWAYS use the `ui-specialist` agent when building or modifying anything visual.**

The user may refer to it as:
- "frontend design tool/skill"
- "front-end design"
- "frontend-design"
- "design tool"
- "UI tool"

**How to invoke:**
- Command: `/ui-review`
- Task tool: `subagent_type="ui-specialist"`

**When to use:**
- Any new UI component
- Modifying existing UI/aesthetics
- Icon selection and styling
- Color choices
- Layout decisions
- Before any visual PR

*Do NOT guess at visual design — always consult this agent for professional aesthetics.*

### Agent Quality Focus

All agents check for the **64% relevance issue** — the critical quality metric where pain signals must actually relate to the business hypothesis.

---

## Implementation Status

**MVP: ~99% complete.** See `docs/SYSTEM_DOCUMENTATION.md` for full status.

### Recent (Jan 3, 2026)
- Fixed App Name Gate bypass for posts AND comments
- Added Section 18 to SYSTEM_DOCUMENTATION.md (Mode-Specific Code Paths)
- Module Registry with 14 modules documented
- Added full specifications for 8 HIGH priority modules (18.5-18.12)
- Documented known issues: WTP detecting regret, theme metadata undefined

### Recent (Dec 1-2, 2025)
- Research resilience: browser warning, error tracking, auto-refund
- Code hardening: typed Supabase, shared utilities, 66 tests
- **Migration 007 required** - run in Supabase SQL Editor
- Fixed Arctic Shift 422 timeouts by removing query/body params

### Remaining (Low Priority)
- PVREError class with error codes
- Result polling for disconnected users
- Dark mode

---

## Environment Variables

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

**Optional:**
```
NEXT_PUBLIC_WHATSAPP_SUPPORT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Documentation Updates

**On every significant push**, update `docs/SYSTEM_DOCUMENTATION.md`:

### What to Update
- New features or major changes (add to relevant section)
- Test count if changed (currently 128)
- New API endpoints or behavior changes
- Architecture decisions
- Date in header (format: `*Last updated: YYYY-MM-DD (Brief description)*`)

### When to Update
- After pushing changes that affect:
  - Data models/interfaces
  - API behavior
  - New UI components
  - Filtering pipeline
  - Cost-impacting changes

### Quick Update Checklist
```
1. Update date: `*Last updated: 2025-XX-XX (Your change)*`
2. Add section if new feature
3. Update test count if changed
4. Update Implementation Status table if applicable
```

### Related Docs to Consider
| Doc | Update When |
|-----|-------------|
| `docs/SYSTEM_DOCUMENTATION.md` | Architecture, features, APIs |
| `docs/KNOWN_ISSUES.md` | Bugs, fixes, backlog changes |
| `docs/RESUME_HERE.md` | Session handoffs (use `/goodnight`) |

---

## 📝 Updating This File

If you discover a new rule or common mistake:
1. Add it to the appropriate section
2. Include the date and context
3. Reference the issue that prompted the rule

---

## Known Issues

- Old research jobs show "Results Not Available" (pre-persistence)
- Dev server must be on port 3000 before testing
- Migration 007 required for research to work
