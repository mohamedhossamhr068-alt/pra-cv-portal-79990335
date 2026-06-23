-- Multi-method payments table
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vodafone_cash','orange_cash','etisalat_cash','we_pay','instapay','bank_transfer','fawry','meeza','other')),
  label text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  bank_name text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read payment methods"
ON public.payment_methods FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "tenant admins manage payment methods"
ON public.payment_methods FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public._touch_payment_methods()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER payment_methods_touch BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public._touch_payment_methods();

-- Link topup requests to selected payment method (optional, backward-compatible)
ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;

-- Make topup-screenshots bucket public-readable (signed URLs still work, simpler thumbs)
-- Keep policies in place; just allow public read for the bucket via a public select policy
CREATE POLICY "public read topup screenshots"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'topup-screenshots');
