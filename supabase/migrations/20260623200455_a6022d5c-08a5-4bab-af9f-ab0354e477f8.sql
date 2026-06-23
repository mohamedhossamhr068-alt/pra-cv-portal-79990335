
-- Vodafone Cash wallet & topup requests
CREATE TABLE public.wallet_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  vodafone_number text,
  instructions text,
  credits_per_egp numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_settings TO authenticated;
GRANT ALL ON public.wallet_settings TO service_role;

ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read wallet settings"
ON public.wallet_settings FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "tenant admins manage wallet settings"
ON public.wallet_settings FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TABLE public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_egp numeric NOT NULL CHECK (amount_egp > 0),
  credits_requested integer NOT NULL CHECK (credits_requested > 0),
  reference_number text,
  screenshot_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.topup_requests TO authenticated;
GRANT ALL ON public.topup_requests TO service_role;

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see their own topups"
ON public.topup_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "users create their own topups"
ON public.topup_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "admins update topups"
ON public.topup_requests FOR UPDATE TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_topup_tenant_status ON public.topup_requests(tenant_id, status, created_at DESC);

-- Approve topup: adds credits and marks approved
CREATE OR REPLACE FUNCTION public.admin_review_topup(
  _request_id uuid,
  _approve boolean,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO r FROM public.topup_requests WHERE id = _request_id;
  IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_tenant IS NULL OR v_tenant <> r.tenant_id OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  IF _approve THEN
    UPDATE public.profiles
    SET credits = COALESCE(credits,0) + r.credits_requested
    WHERE id = r.user_id;
    UPDATE public.topup_requests
    SET status = 'approved', admin_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _request_id;
  ELSE
    UPDATE public.topup_requests
    SET status = 'rejected', admin_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _request_id;
  END IF;
END;
$$;
