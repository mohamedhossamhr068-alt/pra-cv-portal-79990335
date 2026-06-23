
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cv_credit_cost integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS match_credit_cost integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS scrape_credit_cost integer NOT NULL DEFAULT 3;

CREATE OR REPLACE FUNCTION public.admin_update_pricing(
  _cv_cost integer DEFAULT NULL,
  _match_cost integer DEFAULT NULL,
  _scrape_cost integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tenants SET
    cv_credit_cost = COALESCE(GREATEST(0, _cv_cost), cv_credit_cost),
    match_credit_cost = COALESCE(GREATEST(0, _match_cost), match_credit_cost),
    scrape_credit_cost = COALESCE(GREATEST(0, _scrape_cost), scrape_credit_cost)
  WHERE id = v_tenant;
END;
$$;
