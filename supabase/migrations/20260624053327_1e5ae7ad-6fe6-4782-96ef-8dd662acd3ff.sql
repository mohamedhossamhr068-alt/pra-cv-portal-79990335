
-- Add plan credit allocations + signup bonus to tenants and platform_pricing
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_credits_free integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS plan_credits_pro integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS plan_credits_business integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 3;

ALTER TABLE public.platform_pricing
  ADD COLUMN IF NOT EXISTS plan_credits_free integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS plan_credits_pro integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS plan_credits_business integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 3;

-- Replace admin_update_pricing to also accept credit allocations & bonus, and mirror to platform_pricing
CREATE OR REPLACE FUNCTION public.admin_update_pricing(
  _cv_cost integer DEFAULT NULL,
  _match_cost integer DEFAULT NULL,
  _scrape_cost integer DEFAULT NULL,
  _currency text DEFAULT NULL,
  _plan_free numeric DEFAULT NULL,
  _plan_pro numeric DEFAULT NULL,
  _plan_business numeric DEFAULT NULL,
  _credits_free integer DEFAULT NULL,
  _credits_pro integer DEFAULT NULL,
  _credits_business integer DEFAULT NULL,
  _bonus_credits integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  v_currency text; v_pf numeric; v_pp numeric; v_pb numeric;
  v_cf integer; v_cp integer; v_cb integer; v_bonus integer;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.tenants SET
    cv_credit_cost        = COALESCE(GREATEST(0,_cv_cost),    cv_credit_cost),
    match_credit_cost     = COALESCE(GREATEST(0,_match_cost), match_credit_cost),
    scrape_credit_cost    = COALESCE(GREATEST(0,_scrape_cost),scrape_credit_cost),
    currency              = COALESCE(_currency, currency),
    plan_price_free       = COALESCE(GREATEST(0,_plan_free),     plan_price_free),
    plan_price_pro        = COALESCE(GREATEST(0,_plan_pro),      plan_price_pro),
    plan_price_business   = COALESCE(GREATEST(0,_plan_business), plan_price_business),
    plan_credits_free     = COALESCE(GREATEST(0,_credits_free),     plan_credits_free),
    plan_credits_pro      = COALESCE(GREATEST(0,_credits_pro),      plan_credits_pro),
    plan_credits_business = COALESCE(GREATEST(0,_credits_business), plan_credits_business),
    bonus_credits         = COALESCE(GREATEST(0,_bonus_credits),    bonus_credits)
  WHERE id = v_tenant
  RETURNING currency, plan_price_free, plan_price_pro, plan_price_business,
            plan_credits_free, plan_credits_pro, plan_credits_business, bonus_credits
  INTO v_currency, v_pf, v_pp, v_pb, v_cf, v_cp, v_cb, v_bonus;

  INSERT INTO public.platform_pricing(
    id, currency, plan_price_free, plan_price_pro, plan_price_business,
    plan_credits_free, plan_credits_pro, plan_credits_business, bonus_credits,
    updated_by, updated_at
  )
  VALUES ('global', v_currency, v_pf, v_pp, v_pb, v_cf, v_cp, v_cb, v_bonus, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    currency = EXCLUDED.currency,
    plan_price_free = EXCLUDED.plan_price_free,
    plan_price_pro = EXCLUDED.plan_price_pro,
    plan_price_business = EXCLUDED.plan_price_business,
    plan_credits_free = EXCLUDED.plan_credits_free,
    plan_credits_pro = EXCLUDED.plan_credits_pro,
    plan_credits_business = EXCLUDED.plan_credits_business,
    bonus_credits = EXCLUDED.bonus_credits,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

-- Update topup review to add bonus credits on approval
CREATE OR REPLACE FUNCTION public.admin_review_topup(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_tenant uuid;
  v_bonus integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO r FROM public.topup_requests WHERE id = _request_id;
  IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_tenant IS NULL OR v_tenant <> r.tenant_id OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  IF _approve THEN
    SELECT COALESCE(bonus_credits,0) INTO v_bonus FROM public.tenants WHERE id = r.tenant_id;
    UPDATE public.profiles
      SET credits = COALESCE(credits,0) + r.credits_requested + COALESCE(v_bonus,0)
      WHERE id = r.user_id;
    UPDATE public.topup_requests
      SET status='approved',
          admin_note = COALESCE(_note,'') ||
            CASE WHEN v_bonus > 0 THEN ' (+' || v_bonus || ' bonus)' ELSE '' END,
          credits_granted = r.credits_requested + COALESCE(v_bonus,0),
          reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = _request_id;
  ELSE
    UPDATE public.topup_requests
      SET status='rejected', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
      WHERE id = _request_id;
  END IF;
END;
$$;
