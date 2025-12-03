# EXECUTIVE SUMMARY: Research Flow Failure
**Date:** December 2, 2025
**Severity:** CRITICAL - P0
**Status:** BLOCKING ALL USER TESTING

---

## The Problem

Users with 0 credits (including dev test users and free trial users) **cannot start research**. When clicking "Run Full Research (1 credit)", they experience:

1. ✓ Coverage preview works (shows ~500 posts, relevant subreddits)
2. ✓ Button click is registered
3. ✗ **SILENT FAILURE** - Redirects to dashboard
4. ✗ No error message shown
5. ✗ No research starts
6. ✗ User is confused

---

## Root Cause Analysis

### Code Flow
```
User clicks "Run Full Research (1 credit)"
  ↓
Frontend: POST /api/research/jobs (creates job) ✓
  ↓
Frontend: POST /api/research/community-voice/stream (starts research)
  ↓
Backend: deductCredit(userId, jobId)
  ↓
Database: RPC deduct_credit() checks balance
  ↓
Balance = 0 → Returns false
  ↓
Backend: Sends SSE error event: {type: 'error', step: 'credits', message: 'Insufficient credits'}
  ↓
Frontend: Should catch error and display "Insufficient credits"
  ↓
**ACTUAL BEHAVIOR: Redirects to dashboard with no explanation**
```

### Why the Redirect?

The frontend error handling exists (lines 191-211 in `research/page.tsx`), but something is causing a redirect before the error can be displayed. Possible causes:

1. **Navigation middleware** - May be redirecting on certain error conditions
2. **Auth check failure** - Session might be expiring during the flow
3. **Error boundary** - React error boundary catching the error and redirecting
4. **Unhandled promise rejection** - Error thrown outside try-catch

---

## Impact Assessment

### Who is affected?
- **100% of free trial users** (0 credits by default)
- **100% of dev/test users** (test user has 0 credits)
- **Any user after using all credits**

### Business impact
- **Cannot demo product** to investors or beta users
- **Cannot test end-to-end** in development
- **Cannot onboard free trial users**
- **Poor UX** - Silent failures destroy trust

### Technical debt
- Error handling is incomplete
- No dev environment credit override
- No graceful degradation for 0-credit state

---

## The Fix (Priority Order)

### Immediate (Today)

**1. Add dev environment credit override**
```typescript
// In src/lib/credits/index.ts
export async function deductCredit(userId: string, jobId: string): Promise<boolean> {
  // DEV OVERRIDE: Give unlimited credits in local environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEV] Skipping credit deduction in development');
    return true;
  }

  // Existing credit deduction logic...
}
```

**Why:** Unblocks all testing immediately. Developers can test full flow.

**2. Add error handling in frontend**
```typescript
// In src/app/(dashboard)/research/page.tsx
catch (err) {
  if (err instanceof Error && err.message === 'Insufficient credits') {
    setError('You need 1 credit to run research. Please purchase credits to continue.');
    // Show modal with "Buy Credits" CTA
  } else {
    setError(err instanceof Error ? err.message : 'An error occurred');
  }
  setStatus('error');
}
```

**Why:** Provides clear user feedback instead of silent failure.

### Short-term (This Week)

**3. Add pre-flight credit check**
```typescript
// Before creating job, check credits
const { hasCredits } = await checkUserCredits(user.id);
if (!hasCredits) {
  // Show modal: "Insufficient credits. Buy now?"
  return;
}
```

**Why:** Prevents wasted API calls and provides immediate feedback.

**4. Add "Insufficient Credits" modal component**
- Clear message: "You need 1 credit to run this research"
- CTA button: "Buy Credits" → /pricing
- Secondary action: "Learn More" → /how-it-works

**Why:** Converts error into sales opportunity.

### Medium-term (Next Sprint)

**5. Add credit balance warnings**
- Show banner when credits < 3: "Running low on credits"
- Disable "Run Research" button when credits = 0
- Add tooltip: "You need 1 credit. Buy more?"

**Why:** Prevents users from encountering the error state.

**6. Add comprehensive error logging**
```typescript
// Log all research failures to database
await supabase.from('research_errors').insert({
  user_id: userId,
  error_type: 'insufficient_credits',
  hypothesis,
  timestamp: new Date(),
});
```

**Why:** Track conversion blockers and error patterns.

---

## Testing Checklist

Before marking as resolved:

- [ ] Dev user with 0 credits can start research in local env
- [ ] Production user with 0 credits sees clear error message
- [ ] Error message includes "Buy Credits" CTA
- [ ] Clicking CTA redirects to /pricing
- [ ] User with >0 credits can start research successfully
- [ ] Error is logged to console for debugging
- [ ] No silent failures or unexpected redirects

---

## Lessons Learned

1. **Always test error paths** - Happy path testing missed this
2. **Dev environment needs production-like data** - 0-credit state is real user scenario
3. **Silent failures are unacceptable** - Always show user what went wrong
4. **Error states are conversion opportunities** - "Buy Credits" CTA turns error into revenue

---

## Next Actions

**Owner:** Frontend + Backend team
**Timeline:** Fix #1 and #2 today (2 hours), remainder this week
**Blocker removed:** After fix #1, all testing can proceed

**Communication:**
- Notify QA: Dev credits now unlimited in local
- Notify Product: Error UX needs design review
- Notify Sales: Cannot demo to users until fix #2 deployed

---

**Bottom line:** This is a show-stopper bug that prevents anyone from testing the product. Fix #1 unblocks development immediately. Fix #2 unblocks users. Both are required before any beta launch.
