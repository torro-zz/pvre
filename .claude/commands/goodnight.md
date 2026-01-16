---
description: Save session state to RESUME_HERE.md before ending work (asks for notes)
---

# Goodnight Command

Use the `goodnight` skill to save session state.

This skill will:
1. Gather git status, recent commits, build/test status
2. Ask you for session context (focus, decisions, what didn't work)
3. Save to `docs/RESUME_HERE.md` (<100 lines)
4. Optionally update `docs/DECISIONS.md` with significant decisions

Run: `/goodnight`
