
-- 1) Promote the owner to superadmin so signup approval notifications have a recipient
INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT 'bc2c839b-a829-4171-a963-3721a0c99e64'::uuid, tenant_id, 'superadmin'
FROM public.profiles
WHERE id = 'bc2c839b-a829-4171-a963-3721a0c99e64'
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

-- 2) Backfill a signup notification for the pending user so it shows up in the bell now
DO $$
DECLARE r RECORD; p RECORD;
BEGIN
  FOR p IN
    SELECT id, email, full_name FROM public.profiles
    WHERE is_approved = false AND COALESCE(is_blocked,false) = false
  LOOP
    FOR r IN SELECT user_id FROM public.user_roles WHERE role='superadmin' LOOP
      PERFORM public.push_notification(
        r.user_id, 'signup_pending',
        'تسجيل جديد بانتظار الموافقة',
        COALESCE(p.full_name, p.email) || ' (' || p.email || ') طلب الانضمام للمنصة.',
        '/admin/approvals',
        jsonb_build_object('user_id', p.id, 'email', p.email)
      );
    END LOOP;
  END LOOP;
END $$;
