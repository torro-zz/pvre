# Agent & Token Optimization

## Model Selection for Agents

When spawning Task agents, choose the right model:

| Task Type | Model | Reason |
|-----------|-------|--------|
| Simple file search | `haiku` | Pattern matching only |
| Basic grep/list | `haiku` | No reasoning needed |
| Code exploration | `sonnet` | Understanding context matters |
| Refactoring (scoped) | `sonnet` | Clear boundaries, low risk |
| Refactoring (complex) | `opus` | Multi-file, architectural decisions |
| Architecture decisions | `opus` | Risk assessment, tradeoffs |

**PVRE-specific:** This codebase has dual-mode architecture, calibrated filters, and LOCKED code. Default to `sonnet` minimum for any exploration, `opus` for anything touching filters or mode-specific code.

### Examples

```typescript
// Simple file listing - haiku is fine
Task(subagent_type: "Explore", model: "haiku", prompt: "List all .tsx files in src/components")

// Understanding code - use sonnet minimum
Task(subagent_type: "Explore", model: "sonnet", prompt: "How does the pain detector work?")

// Refactoring plan - use opus for this codebase
Task(subagent_type: "Plan", model: "opus", prompt: "Plan extraction of filter logic")
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
