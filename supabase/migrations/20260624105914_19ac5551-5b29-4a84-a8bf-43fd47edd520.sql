ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS credits_granted integer NULL;

DROP POLICY IF EXISTS "users see own topups and reviewers see tenant topups" ON public.topup_requests;
CREATE POLICY "users see own topups and reviewers see tenant topups"
ON public.topup_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_superadmin(auth.uid())
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'review_topups'))
);

DROP POLICY IF EXISTS "reviewers update tenant topups" ON public.topup_requests;
CREATE POLICY "reviewers update tenant topups"
ON public.topup_requests
FOR UPDATE
TO authenticated
USING (
  public.is_superadmin(auth.uid())
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'review_topups'))
)
WITH CHECK (
  public.is_superadmin(auth.uid())
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'review_topups'))
);

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_superadmin(auth.uid())
  OR ((tenant_id = public.get_user_tenant(auth.uid())) AND public.is_tenant_admin(auth.uid(), tenant_id))
  OR ((tenant_id = public.get_user_tenant(auth.uid())) AND public.has_permission(auth.uid(), 'review_topups'))
);