---
description: Synthesize learnings and find next improvement using learner agent
---

# Find Next Improvement

Use the `learner` agent to synthesize learnings and identify patterns.

## What learner Does

1. **Reads agent learnings** — From `docs/agent-learnings.md`
2. **Identifies patterns** — Same issue appearing multiple times
3. **Proposes updates** — To agent prompts if patterns warrant
4. **Archives processed** — Moves completed learnings to archive

## When to Run

- **Weekly** — Regular synthesis
- **After incidents** — When bugs are fixed
- **After releases** — To capture what was learned

## Priority Sources

| Source | What to Check |
|--------|---------------|
| `docs/agent-learnings.md` | Recent findings from all agents |
| `docs/KNOWN_ISSUES.md` | Active bugs |
| `CLAUDE.md` | Remaining items |
| Codebase TODOs | Technical debt |

## Output

The learner produces:
- Pattern analysis across learnings
- Recommended agent updates
- Archived processed learnings
- Remaining items needing more data

## After Running

- Review proposed agent updates
- Apply updates if appropriate
- Clear processed learnings

## Related Agents

- `output-quality` → For checking research quality
- `code-hardener` → For code audit
- `flow-tester` → For testing flows
