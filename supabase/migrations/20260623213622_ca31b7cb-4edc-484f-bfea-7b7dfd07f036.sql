
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS plan_price_free numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_price_pro numeric(10,2) NOT NULL DEFAULT 29,
  ADD COLUMN IF NOT EXISTS plan_price_business numeric(10,2) NOT NULL DEFAULT 99;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_currency_check
  CHECK (currency IN ('USD','EGP','SAR','AED','EUR','GBP','KWD','QAR'));

ALTER TABLE public.cv_logs
  ADD COLUMN IF NOT EXISTS accent_color text;

CREATE OR REPLACE FUNCTION public.admin_update_pricing(
  _cv_cost integer DEFAULT NULL,
  _match_cost integer DEFAULT NULL,
  _scrape_cost integer DEFAULT NULL,
  _currency text DEFAULT NULL,
  _plan_free numeric DEFAULT NULL,
  _plan_pro numeric DEFAULT NULL,
  _plan_business numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tenants SET
    cv_credit_cost      = COALESCE(GREATEST(0, _cv_cost),    cv_credit_cost),
    match_credit_cost   = COALESCE(GREATEST(0, _match_cost), match_credit_cost),
    scrape_credit_cost  = COALESCE(GREATEST(0, _scrape_cost),scrape_credit_cost),
    currency            = COALESCE(_currency, currency),
    plan_price_free     = COALESCE(GREATEST(0, _plan_free),     plan_price_free),
    plan_price_pro      = COALESCE(GREATEST(0, _plan_pro),      plan_price_pro),
    plan_price_business = COALESCE(GREATEST(0, _plan_business), plan_price_business)
  WHERE id = v_tenant;
END;
$function$;
