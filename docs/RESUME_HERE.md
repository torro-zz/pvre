# Resume Point - December 30, 2025

## What Was Just Completed

### Security Incident Response - Leaked Supabase Service Key
GitHub detected a Supabase service_role key committed to the repository. Full remediation completed:

1. **JWT Secret Rotated** — Old leaked key now returns 401 (invalid)
2. **New Key Verified** — API calls succeed with new service_role key
3. **Pre-commit Hook Installed** — `.githooks/pre-commit` now blocks:
   - Long JWT tokens (Supabase keys)
   - AWS access keys (`AKIA...`)
   - Anthropic API keys (`sk-ant-...`)
   - OpenAI API keys (`sk-...`)
   - Private key blocks
   - Hardcoded `SERVICE_KEY=` assignments
4. **Git History Purged** — BFG replaced secret with `***REMOVED***` in all commits
5. **Force Pushed** — GitHub now has clean history
6. **Agent Files Fixed** — `pvre-documenter.md` updated to use env vars

## Files Modified This Session

| File | Status | Purpose |
|------|--------|---------|
| `.githooks/pre-commit` | New | Pre-commit hook to block secrets |
| `.githooks/setup.sh` | New | Setup script for hooks |
| `docs/RESUME_HERE.md` | Modified | Removed hardcoded key |
| `.claude/agents/pvre-documenter.md` | Modified | Replaced `***REMOVED***` with env vars |

## Uncommitted Changes

✅ All changes committed

## Build & Test Status

- **Build:** ✅ Passing
- **Tests:** 128 passing, 6 skipped
- **Dev Server:** Running on :3000

## What Needs To Be Done Next

### Priority: Embedding Pre-Filter Implementation
**Previous session planned this** — see `~/Downloads/Haiku and Embeddings Review.md`

| Step | Description |
|------|-------------|
| 1 | Revert comment filter from Sonnet → Haiku |
| 2 | Supabase pgvector setup |
| 3 | Create embedding service (OpenAI `text-embedding-3-large`) |
| 4 | Pipeline integration |
| 5 | WTP verification |
| 6 | Testing & calibration |

**Requires:** `OPENAI_API_KEY` environment variable (already in .env.local)
**Target:** 64% irrelevance → <10%

### From Known Issues (Remaining)

| Issue | Priority | Status |
|-------|----------|--------|
| Connect Help Button to Canny | P2 | Deferred |
| Clarify API Keys Purpose | P2 | Open |
| Investigate Two-Panel Section | P2 | Open |
| Redesign Research Page Layout (bento grid) | P1 | Incomplete |

### P3 Backlog
- AI vs Code Audit (determinism)
- App Analysis Results Parity
- PDF Exports Professional Redesign
- TAM/SAM/SOM External Data Sources
- TikTok Data Source Wrapper
- Google Trends API Expansion

## Security Note

**Pre-commit hooks are now active.** Future commits will be scanned for secrets.

For new clones, run:
```bash
./.githooks/setup.sh
```

## User Notes

**At startup:** Go over what was done this session as a summary, then review what else needs to be done.

## Key Files Reference

| Purpose | File |
|---------|------|
| Project instructions | `CLAUDE.md` |
| Known bugs & UX backlog | `docs/KNOWN_ISSUES.md` |
| Technical overview | `docs/TECHNICAL_OVERVIEW.md` |
| Pre-commit hook | `.githooks/pre-commit` |
| Embedding plan | `~/Downloads/Haiku and Embeddings Review.md` |
| Data quality brief | `docs/data-quality/DATA_QUALITY_BRIEF.md` |

## Quick Start Commands

```bash
# Start dev server
cd "/Users/julientorriani/Documents/Development/Pre-Validation Research Engine PVRE"
npm run dev

# Run tests
npm run test:run

# Build
npm run build

# Setup git hooks (for new clones)
./.githooks/setup.sh

# Add credits if needed (source .env.local first)
source .env.local && curl -s -X PATCH "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?id=eq.c2a74685-a31d-4675-b6a3-4992444e345d" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"credits_balance": 10}'
```

---

*Last updated: December 30, 2025 (Security remediation - leaked key rotated, pre-commit hooks added)*
