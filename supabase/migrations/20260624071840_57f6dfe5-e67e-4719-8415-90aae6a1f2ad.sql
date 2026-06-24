
-- 1. Add approval columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Existing users: auto-approve so we don't lock anyone out
UPDATE public.profiles SET is_approved = true, approved_at = now() WHERE is_approved = false;

-- 2. Update handle_new_user to keep is_approved false + notify all superadmins
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_company text;
  v_slug text;
  v_full_name text;
  r RECORD;
BEGIN
  v_company := COALESCE(NEW.raw_user_meta_data->>'company_name', split_part(NEW.email,'@',2));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_slug := lower(regexp_replace(v_company || '-' || substr(NEW.id::text,1,8), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug) VALUES (v_company, v_slug) RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name, is_approved)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name, false);

  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, v_tenant_id, 'company_admin');
  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, v_tenant_id, 'user');
  INSERT INTO public.subscriptions (tenant_id, plan, status) VALUES (v_tenant_id, 'free', 'active');

  -- Notify all superadmins of new pending signup
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'superadmin' LOOP
    PERFORM public.push_notification(
      r.user_id, 'signup_pending',
      'تسجيل جديد بانتظار الموافقة',
      v_full_name || ' (' || NEW.email || ') طلب الانضمام للمنصة.',
      '/admin/approvals',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. RPC to approve/reject a pending user (superadmin only)
CREATE OR REPLACE FUNCTION public.admin_approve_signup(_user_id uuid, _approve boolean, _note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _approve THEN
    UPDATE public.profiles
      SET is_approved = true, approved_at = now(), approved_by = auth.uid()
      WHERE id = _user_id;
    PERFORM public.push_notification(
      _user_id, 'signup_approved',
      'تم تفعيل حسابك',
      'تمت الموافقة على حسابك ويمكنك الآن استخدام المنصة بالكامل.',
      '/dashboard', '{}'::jsonb
    );
  ELSE
    -- mark blocked + notify
    UPDATE public.profiles SET is_blocked = true WHERE id = _user_id;
    PERFORM public.push_notification(
      _user_id, 'signup_rejected',
      'تم رفض طلب التسجيل',
      COALESCE(_note, 'يرجى التواصل مع الدعم لمزيد من المعلومات.'),
      '/', '{}'::jsonb
    );
  END IF;
END;
$function$;

-- 4. Allow superadmin to read all profiles (for approvals UI)
DROP POLICY IF EXISTS "superadmin_read_all_profiles" ON public.profiles;
CREATE POLICY "superadmin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));
