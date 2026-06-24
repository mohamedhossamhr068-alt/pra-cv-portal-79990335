
-- Re-grant SELECT on safe pricing columns to anon and authenticated so the public pricing page can read them.
-- The 'updated_by' column (admin user UUID) intentionally stays hidden from public roles.
GRANT SELECT (id, currency, plan_price_free, plan_price_pro, plan_price_business, plan_credits_free, plan_credits_pro, plan_credits_business, bonus_credits, updated_at)
  ON public.platform_pricing TO anon, authenticated;

GRANT ALL ON public.platform_pricing TO service_role;
