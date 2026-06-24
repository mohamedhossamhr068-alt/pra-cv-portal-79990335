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
  v_currency text;
  v_plan_free numeric;
  v_plan_pro numeric;
  v_plan_business numeric;
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
  WHERE id = v_tenant
  RETURNING currency, plan_price_free, plan_price_pro, plan_price_business
  INTO v_currency, v_plan_free, v_plan_pro, v_plan_business;

  INSERT INTO public.platform_pricing(id, currency, plan_price_free, plan_price_pro, plan_price_business, updated_by, updated_at)
  VALUES ('global', v_currency, v_plan_free, v_plan_pro, v_plan_business, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    currency = EXCLUDED.currency,
    plan_price_free = EXCLUDED.plan_price_free,
    plan_price_pro = EXCLUDED.plan_price_pro,
    plan_price_business = EXCLUDED.plan_price_business,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$function$;