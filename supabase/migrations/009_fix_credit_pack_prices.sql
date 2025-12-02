-- ============================================================================
-- Migration 009: Fix credit pack prices to match LemonSqueezy
-- ============================================================================
-- Current DB prices are wrong. This updates them to match LemonSqueezy dashboard.
-- ============================================================================

-- Update Starter Pack: £14.00 (1400 pence)
UPDATE public.credit_packs
SET price_cents = 1400
WHERE name = 'Starter Pack';

-- Update Builder Pack: £39.00 (3900 pence)
UPDATE public.credit_packs
SET price_cents = 3900
WHERE name = 'Builder Pack';

-- Update Founder Pack: £79.00 (7900 pence)
UPDATE public.credit_packs
SET price_cents = 7900
WHERE name = 'Founder Pack';

-- Verify the updates
SELECT name, price_cents, credits,
       (price_cents / 100.0) as price_pounds,
       ROUND((price_cents / 100.0) / credits, 2) as price_per_run
FROM public.credit_packs
ORDER BY display_order;
