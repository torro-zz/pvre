---
description: Get the next priority improvement with a plan (asks for approval before implementing)
---

# Find Next Improvement

Analyze the codebase and identify the next best improvement to implement.

## Analysis Sources

1. **`docs/KNOWN_ISSUES.md`** - Active bugs (check first!)
2. **`CLAUDE.md`** - Remaining items and implementation status
3. **Codebase** - TODOs, FIXMEs, patterns to improve
4. **Build/Tests** - Any failures to address

## Priority Levels

| Level | Description | Example |
|-------|-------------|---------|
| P0 | Production broken | Auth failing for all users |
| P1 | User-facing bug | Button doesn't work |
| P2 | UX issue | Confusing workflow |
| P3 | Nice-to-have | Dark mode |

## Process

### Step 1: Quick Health Check
```bash
npm run build 2>&1 | grep -i error
npm run test:run 2>&1 | tail -10
```

### Step 2: Read Known Issues
Read `docs/KNOWN_ISSUES.md` for currently tracked bugs.

### Step 3: Check CLAUDE.md
Read the "Remaining Items" section of `CLAUDE.md`.

### Step 4: Scan for TODOs
```bash
grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.tsx" | head -20
```

### Step 5: Present Recommendation

```markdown
## Next Improvement

**[Name]** (P[X])

### Why This
[Brief rationale]

### Implementation Plan
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Files
- `src/path/file.ts`

### Effort
[Small/Medium/Large]

Shall I proceed?
```

### Step 6: After User Approval
1. Implement the fix
2. Run `npm run build` and `npm run test:run`
3. Update `docs/KNOWN_ISSUES.md` if bug was fixed
4. Update `CLAUDE.md` if status changed

## Quality Gate

Before marking complete:
- [ ] Build passes
- [ ] Tests pass
- [ ] Change tested manually
- [ ] Documentation updated
