# Code Standards

## TypeScript Patterns

```typescript
// Use typed Supabase clients
import { Database } from '@/types/supabase'

// Use shared save utility
import { saveResearchResult } from '@/lib/research/save-result'

// Serialize before DB saves
const clean = JSON.parse(JSON.stringify(data))
```

## Before Any Code Change

1. **Check `docs/KNOWN_ISSUES.md`** — Is it already fixed?
2. **Read the relevant file** — Don't guess what code does
3. **Test both modes** if touching shared code

## Never Do These

1. **Never bypass filters** — App Name Gate exists for a reason
2. **Never add parallel code paths** — One way to add signals
3. **Never close without testing** — Both modes, build, tests

## Behavior

- Prefer minimal changes over refactors
- Modify existing files before creating new ones
- Read code before modifying it
- Concise output, no over-engineering
