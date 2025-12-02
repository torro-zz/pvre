---
description: Run a comprehensive codebase review against CLAUDE.md specifications
---

# PVRE Codebase Review

Review the PVRE codebase and verify implementation against `CLAUDE.md`.

## Steps

1. **Read Source of Truth**
   - Read `CLAUDE.md` for current implementation status and specifications
   - This is the single source of truth for the project

2. **Scan Codebase**
   - Check `src/app/api/` for implemented endpoints
   - Check `src/app/(dashboard)/` for implemented pages
   - Check `src/lib/analysis/` for analysis modules
   - Check `supabase/migrations/` for database schema

3. **Verify Core Modules**
   - Community Voice Mining (pain detection, theme extraction)
   - Market Sizing (TAM/SAM/SOM)
   - Timing Analysis (tailwinds/headwinds)
   - Viability Calculator (4-dimension scoring)
   - Competitor Intelligence

4. **Test Dev Auth**
   - Ensure dev server is running on port 3000
   - POST to `/api/dev/login` to authenticate
   - Verify authentication works

5. **Test Research Flow**
   - Navigate to `/dashboard` and verify it loads
   - Navigate to `/research` and verify form works
   - Verify results display correctly

6. **Database Status**
   - Verify all required tables exist
   - Check recent migrations applied

## Report Format

```markdown
### Implementation Status

| Module | Expected | Found | Status |
|--------|----------|-------|--------|
| Community Voice | Yes | ? | |
| Market Sizing | Yes | ? | |
| Timing Analysis | Yes | ? | |
| Viability Verdict | Yes | ? | |
| Competitor Intelligence | Yes | ? | |
| PDF Export | Yes | ? | |
| Test Suite | Yes | ? | |

### Testing Results
- Dev Auth: PASS/FAIL
- Research Flow: PASS/FAIL
- Results Display: PASS/FAIL

### Issues Found
- [List any errors or inconsistencies]

### CLAUDE.md Updates Needed
- [Any status updates required]
```

## After Review

Update `CLAUDE.md` if any findings require status changes.
