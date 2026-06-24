-- Ensure new tenants/platform pricing default to EGP instead of legacy USD defaults
ALTER TABLE public.tenants
  ALTER COLUMN currency SET DEFAULT 'EGP',
  ALTER COLUMN plan_price_free SET DEFAULT 0,
  ALTER COLUMN plan_price_pro SET DEFAULT 250,
  ALTER COLUMN plan_price_business SET DEFAULT 500;

ALTER TABLE public.platform_pricing
  ALTER COLUMN currency SET DEFAULT 'EGP',
  ALTER COLUMN plan_price_free SET DEFAULT 0,
  ALTER COLUMN plan_price_pro SET DEFAULT 250,
  ALTER COLUMN plan_price_business SET DEFAULT 500;

-- Migrate only tenants that are still on the old untouched USD defaults
UPDATE public.tenants t
SET
  currency = pp.currency,
  plan_price_free = pp.plan_price_free,
  plan_price_pro = pp.plan_price_pro,
  plan_price_business = pp.plan_price_business,
  plan_credits_free = pp.plan_credits_free,
  plan_credits_pro = pp.plan_credits_pro,
  plan_credits_business = pp.plan_credits_business,
  bonus_credits = pp.bonus_credits
FROM public.platform_pricing pp
WHERE pp.id = 'global'
  AND t.currency = 'USD'
  AND t.plan_price_free = 0
  AND t.plan_price_pro = 29
  AND t.plan_price_business = 99;

-- Keep the public/global row aligned if it was ever recreated with old defaults
UPDATE public.platform_pricing
SET
  currency = 'EGP',
  plan_price_free = 0,
  plan_price_pro = 250,
  plan_price_business = 500
WHERE id = 'global'
  AND currency = 'USD'
  AND plan_price_free = 0
  AND plan_price_pro = 29
  AND plan_price_business = 99;