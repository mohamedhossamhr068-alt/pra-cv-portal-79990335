
-- 1) Scope topup screenshot delete/update to the file owner's tenant
DROP POLICY IF EXISTS "topup_screenshots_owner_delete" ON storage.objects;
CREATE POLICY "topup_screenshots_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'topup-screenshots'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_superadmin(auth.uid())
      OR public.is_tenant_admin(
        auth.uid(),
        public.get_user_tenant(((storage.foldername(name))[1])::uuid)
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
      OR public.is_tenant_admin(
        auth.uid(),
        public.get_user_tenant(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- 2) Prevent company_admins from inserting/modifying a 'superadmin' role row.
--    Only an existing superadmin can write rows where role = 'superadmin'.
DROP POLICY IF EXISTS "admins insert roles" ON public.user_roles;
CREATE POLICY "admins insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (role <> 'superadmin'::public.app_role
       AND (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid())))
    OR (role = 'superadmin'::public.app_role AND public.is_superadmin(auth.uid()))
  );

DROP POLICY IF EXISTS "admins update roles" ON public.user_roles;
CREATE POLICY "admins update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    (role <> 'superadmin'::public.app_role
       AND (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid())))
    OR (role = 'superadmin'::public.app_role AND public.is_superadmin(auth.uid()))
  )
  WITH CHECK (
    (role <> 'superadmin'::public.app_role
       AND (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid())))
    OR (role = 'superadmin'::public.app_role AND public.is_superadmin(auth.uid()))
  );

DROP POLICY IF EXISTS "admins delete roles" ON public.user_roles;
CREATE POLICY "admins delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    (role <> 'superadmin'::public.app_role
       AND (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid())))
    OR (role = 'superadmin'::public.app_role AND public.is_superadmin(auth.uid()))
  );
