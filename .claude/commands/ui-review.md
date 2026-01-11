---
description: Run UI review for visual polish, accessibility, and responsiveness
---

# UI Review

Use the `ui-specialist` agent for visual polish, accessibility (WCAG), and responsiveness checks.

## What ui-specialist Does

1. **Visual consistency** — Colors, typography, spacing
2. **Accessibility audit** — WCAG 2.1 AA compliance
3. **Responsiveness** — Desktop, tablet, mobile breakpoints
4. **Loading states** — Feedback for async actions
5. **Error states** — User-friendly messages
6. **Records learnings** — To shared learnings file

## Breakpoints Tested

| Type | Width |
|------|-------|
| Desktop | 1920px, 1440px, 1280px |
| Tablet | 768px |
| Mobile | 375px |

## Accessibility Checks

- Color contrast (WCAG 1.4.3)
- Image alt text (WCAG 1.1.1)
- Form labels
- Keyboard navigation
- Focus states

## Pages Reviewed

1. Landing page (hero, CTA, pricing, footer)
2. Dashboard (welcome, recent research, credits)
3. Research form (input, submit, progress)
4. Results (all tabs, data visualization)
5. Account (profile, credits, history)

## Usage

```
/ui-review
```

Or ask Claude directly:
- "Review the UI"
- "Check accessibility"
- "Test mobile responsiveness"
- "Make it look better"

## Output

- Grade (A/B/C/D/F)
- Visual consistency issues
- Accessibility violations
- Responsiveness status per breakpoint
- Loading/error state audit
- Priority fixes list
- Screenshots at multiple sizes

## Related Agents

- `ceo-review` → For full product walkthrough
- `output-quality` → For research data quality
