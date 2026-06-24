
CREATE TABLE IF NOT EXISTS public.platform_pricing (
  id TEXT NOT NULL DEFAULT 'global' PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'USD',
  plan_price_free NUMERIC NOT NULL DEFAULT 0,
  plan_price_pro NUMERIC NOT NULL DEFAULT 29,
  plan_price_business NUMERIC NOT NULL DEFAULT 99,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_pricing_singleton CHECK (id = 'global')
);

GRANT SELECT ON public.platform_pricing TO anon, authenticated;
GRANT ALL ON public.platform_pricing TO service_role;

ALTER TABLE public.platform_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_pricing_public_read" ON public.platform_pricing FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.platform_pricing (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_update_platform_pricing(
  _currency TEXT DEFAULT NULL,
  _plan_free NUMERIC DEFAULT NULL,
  _plan_pro NUMERIC DEFAULT NULL,
  _plan_business NUMERIC DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.platform_pricing(id, currency, plan_price_free, plan_price_pro, plan_price_business, updated_by, updated_at)
  VALUES ('global', COALESCE(_currency,'USD'), COALESCE(_plan_free,0), COALESCE(_plan_pro,29), COALESCE(_plan_business,99), auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    currency = COALESCE(_currency, public.platform_pricing.currency),
    plan_price_free = COALESCE(_plan_free, public.platform_pricing.plan_price_free),
    plan_price_pro = COALESCE(_plan_pro, public.platform_pricing.plan_price_pro),
    plan_price_business = COALESCE(_plan_business, public.platform_pricing.plan_price_business),
    updated_by = auth.uid(),
    updated_at = now();
END;
$$;
