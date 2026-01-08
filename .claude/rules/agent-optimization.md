# Agent & Token Optimization

## Model Selection for Agents

When spawning Task agents, choose the right model:

| Task Type | Model | Reason |
|-----------|-------|--------|
| Simple file search | `haiku` | Fast, cheap |
| Code exploration | `haiku` or `sonnet` | Moderate complexity |
| Complex refactoring | `sonnet` | Needs reasoning |
| Architecture decisions | `opus` (default) | Full reasoning |

### Example

```typescript
// Simple search - use haiku
Task(subagent_type: "Explore", model: "haiku", prompt: "Find all .tsx files")

// Complex analysis - use sonnet
Task(subagent_type: "Plan", model: "sonnet", prompt: "Plan the refactoring")
```

## Skill Optimization

Skills can specify model and context in frontmatter:

```yaml
---
description: My skill
model: sonnet       # Don't use opus for simple tasks
context: fork       # Run in isolated context (saves tokens)
---
```

## Token-Saving Practices

1. **Use `context: fork`** for skills that don't need conversation history
2. **Use lighter models** (haiku/sonnet) for simple agent tasks
3. **Consolidate permissions** with wildcards (e.g., `Bash(npm *)`)
4. **Split rules** into `.claude/rules/` for contextual loading
