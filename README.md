# PVRE - Pre-Validation Research Engine

AI-powered market research that helps founders validate business ideas in minutes, not weeks.

## What It Does

Enter a business hypothesis → Get real customer pain signals from Reddit, competitive analysis, market sizing, and a go/no-go viability verdict.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md) | Architecture, APIs, user flows, code standards |
| [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Active bugs and recent fixes |
| [CLAUDE.md](CLAUDE.md) | AI agent instructions |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API
- **Data:** Arctic Shift API (Reddit)

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```
