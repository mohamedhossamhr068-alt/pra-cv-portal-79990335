-- Allow company_admin (not only superadmin) to manage GLOBAL payment methods (tenant_id IS NULL)
DROP POLICY IF EXISTS "super admins manage global payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "admins manage global payment methods" ON public.payment_methods;
CREATE POLICY "admins manage global payment methods"
ON public.payment_methods
FOR ALL TO authenticated
USING (
  tenant_id IS NULL
  AND (
    public.is_superadmin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'company_admin')
  )
)
WITH CHECK (
  tenant_id IS NULL
  AND (
    public.is_superadmin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'company_admin')
  )
);