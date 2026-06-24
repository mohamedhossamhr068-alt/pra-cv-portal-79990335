
-- 1) payment_methods: allow tenant members to view active payment methods (needed for topup transfers)
CREATE POLICY "tenant members view active payment methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND tenant_id = public.get_user_tenant(auth.uid())
);

-- 2) user_roles: add explicit admin-only write policies (defense in depth; default-deny already applies)
CREATE POLICY "admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
);

CREATE POLICY "admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
);

CREATE POLICY "admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
);

-- 3) chat_insert_bot_reply is SECURITY DEFINER with no caller checks — must not be callable by clients.
-- It is only invoked by trusted server code, so revoke EXECUTE from public/anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.chat_insert_bot_reply(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
