ALTER TABLE public.payment_methods ALTER COLUMN tenant_id DROP NOT NULL;

DROP POLICY IF EXISTS "tenant members view active payment methods" ON public.payment_methods;
CREATE POLICY "members view active payment methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (tenant_id IS NULL OR tenant_id = get_user_tenant(auth.uid()))
);

DROP POLICY IF EXISTS "super admins manage global payment methods" ON public.payment_methods;
CREATE POLICY "super admins manage global payment methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (tenant_id IS NULL AND has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (tenant_id IS NULL AND has_role(auth.uid(), 'superadmin'::app_role));

INSERT INTO public.payment_methods (tenant_id, type, label, account_number, account_name, instructions, is_active, sort_order)
VALUES
  (NULL, 'vodafone_cash', 'Vodafone Cash', '01000000000', 'PRA Career Portal', 'حوّل المبلغ على الرقم ثم ارفع صورة التحويل.', true, 1),
  (NULL, 'instapay', 'InstaPay', 'pra@instapay', 'PRA Career Portal', 'استخدم InstaPay للتحويل ثم ارفع صورة الإيصال.', true, 2)
ON CONFLICT DO NOTHING;