---
description: Synthesize agent learnings and identify patterns for system improvement
---

# Learner Agent

Use the `learner` agent to aggregate learnings from all agents and make the system smarter.

## What learner Does

1. **Reads learnings** — From `docs/agent-learnings.md`
2. **Identifies patterns** — Same issue appearing 2+ times
3. **Categorizes entries** — Which agent? One-time or recurring? Severity?
4. **Proposes updates** — Agent prompt improvements
5. **Archives processed** — Moves to `docs/archive/`

## When to Use

- Weekly maintenance
- After incidents
- When `docs/agent-learnings.md` has 5+ entries
- User asks "what have we learned?"

## Pattern Categories

| Category | Example | Update Target |
|----------|---------|---------------|
| Data Quality | Pain signals irrelevant | output-quality Known Patterns |
| Flow Bugs | Research hangs at step X | flow-tester Scenarios |
| Security | Missing validation | code-hardener Checklist |
| UI Issues | Button unclear on mobile | ui-specialist Checklist |
| Performance | Slow queries | code-hardener Performance section |

## Usage

```
/learner
```

Or ask Claude directly:
- "Summarize what we've learned"
- "What patterns have emerged?"
- "Improve the agent system"

## Output

- Patterns identified with frequency
- Agent updates recommended
- Entries archived
- Summary of remaining items

## Self-Learning Loop

```
All agents → WRITE learnings → docs/agent-learnings.md
                                       ↓
                               learner synthesizes
                                       ↓
                               Updates agent prompts
```

## Related Agents

- All agents write to the shared learnings file
- learner reads and synthesizes across all of them
