
-- 1) Stop exposing updated_by in public pricing reads
REVOKE SELECT ON public.platform_pricing FROM anon, authenticated;
GRANT SELECT (id, currency, plan_price_free, plan_price_pro, plan_price_business,
              plan_credits_free, plan_credits_pro, plan_credits_business, bonus_credits, updated_at)
  ON public.platform_pricing TO anon, authenticated;
GRANT ALL ON public.platform_pricing TO service_role;

-- 2) Explicit deny INSERT on guest_conversations (creation only via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "guest_conversations_no_direct_insert" ON public.guest_conversations;
CREATE POLICY "guest_conversations_no_direct_insert"
  ON public.guest_conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 3) Allow owners and tenant admins to delete/update topup screenshots
DROP POLICY IF EXISTS "topup_screenshots_owner_delete" ON storage.objects;
CREATE POLICY "topup_screenshots_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'topup-screenshots'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_superadmin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'company_admin'
      )
    )
  );

DROP POLICY IF EXISTS "topup_screenshots_owner_update" ON storage.objects;
CREATE POLICY "topup_screenshots_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'topup-screenshots'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_superadmin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'company_admin'
      )
    )
  );
