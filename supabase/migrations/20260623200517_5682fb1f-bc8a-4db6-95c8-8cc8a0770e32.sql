
CREATE POLICY "users upload own topup screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'topup-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "users read own topup screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'topup-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_tenant_admin(auth.uid(), public.get_user_tenant(auth.uid()))
  )
);
