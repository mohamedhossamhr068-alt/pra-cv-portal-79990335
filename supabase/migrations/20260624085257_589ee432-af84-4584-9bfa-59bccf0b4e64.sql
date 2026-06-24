
-- 1. tenants_insert_any_auth -> superadmin only (also fixes SUPA_rls_policy_always_true)
DROP POLICY IF EXISTS "tenants_insert_any_auth" ON public.tenants;
CREATE POLICY "tenants_insert_superadmin" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));

-- 2. profiles cross-tenant exposure
DROP POLICY IF EXISTS "profiles_select_self_or_tenant_or_super" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_tenant_admin(auth.uid(), tenant_id))
  );

-- 3. payment_methods account number exposure -> admins only
DROP POLICY IF EXISTS "tenant members read payment methods" ON public.payment_methods;
-- (tenant admins manage payment methods ALL policy already grants admin SELECT)

-- 4. guest_conversations tenant null exposure
DROP POLICY IF EXISTS "staff read guest convos" ON public.guest_conversations;
CREATE POLICY "staff read guest convos" ON public.guest_conversations
  FOR SELECT TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_superadmin(auth.uid()))
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = guest_conversations.tenant_id AND ur.role = 'moderator'
    )
  );

DROP POLICY IF EXISTS "staff update guest convos" ON public.guest_conversations;
CREATE POLICY "staff update guest convos" ON public.guest_conversations
  FOR UPDATE TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_superadmin(auth.uid()))
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = guest_conversations.tenant_id AND ur.role = 'moderator'
    )
  );

-- 5. guest_messages tenant null exposure
DROP POLICY IF EXISTS "staff read guest msgs" ON public.guest_messages;
CREATE POLICY "staff read guest msgs" ON public.guest_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guest_conversations gc
    WHERE gc.id = guest_messages.conversation_id
      AND (
        (gc.tenant_id IS NULL AND public.is_superadmin(auth.uid()))
        OR public.is_tenant_admin(auth.uid(), gc.tenant_id)
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.tenant_id = gc.tenant_id AND ur.role = 'moderator'
        )
      )
  ));

DROP POLICY IF EXISTS "staff insert guest msgs" ON public.guest_messages;
CREATE POLICY "staff insert guest msgs" ON public.guest_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'staff'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.guest_conversations gc
      WHERE gc.id = guest_messages.conversation_id
        AND (
          (gc.tenant_id IS NULL AND public.is_superadmin(auth.uid()))
          OR public.is_tenant_admin(auth.uid(), gc.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.tenant_id = gc.tenant_id AND ur.role = 'moderator'
          )
        )
    )
  );

-- 6. cv-pdfs storage bucket policies (path prefix = user_id)
DROP POLICY IF EXISTS "cv pdfs owner read" ON storage.objects;
CREATE POLICY "cv pdfs owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cv-pdfs'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "cv pdfs owner insert" ON storage.objects;
CREATE POLICY "cv pdfs owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cv-pdfs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "cv pdfs owner update" ON storage.objects;
CREATE POLICY "cv pdfs owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cv-pdfs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "cv pdfs owner delete" ON storage.objects;
CREATE POLICY "cv pdfs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cv-pdfs'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
    )
  );

-- 7. Remove public read on topup screenshots
DROP POLICY IF EXISTS "public read topup screenshots" ON storage.objects;

-- 8. Revoke EXECUTE on SECURITY DEFINER functions from anon (and from authenticated for triggers/internals)
-- Trigger / internal functions: revoke from PUBLIC, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_cv_generated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_topup_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_offer_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_action() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mark_human_replied() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mark_human_replied_guest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- RLS helpers and user-callable RPCs: keep authenticated, revoke anon
REVOKE EXECUTE ON FUNCTION public.get_user_tenant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, text, text, jsonb) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.admin_update_pricing(integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_pricing(integer, integer, integer, text, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_pricing(integer, integer, integer, text, numeric, numeric, numeric, integer, integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_topup(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_moderator_budget(uuid, integer, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_moderator_budget(uuid, integer, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, integer, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_signup(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_permissions(uuid, app_permission[], boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_platform_pricing(text, numeric, numeric, numeric) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.chat_insert_bot_reply(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chat_get_or_create_my_conversation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chat_set_bot_enabled(uuid, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chat_send_message(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chat_review_credit_request(uuid, boolean, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public._touch_payment_methods() FROM PUBLIC, anon, authenticated;
