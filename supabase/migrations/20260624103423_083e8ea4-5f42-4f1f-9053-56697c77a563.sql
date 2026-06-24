
-- 1) Stop using email domain (e.g. "gmail.com") as the workspace name for new signups
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
  v_meta_company text;
  r RECORD;
BEGIN
  v_full_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''), split_part(NEW.email,'@',1));
  v_meta_company := NULLIF(btrim(NEW.raw_user_meta_data->>'company_name'),'');

  -- Use explicit company name if provided; otherwise fall back to the user's full name (never the email domain)
  v_company := COALESCE(v_meta_company, v_full_name, 'حسابي');

  v_slug := lower(regexp_replace(v_company || '-' || substr(NEW.id::text,1,8), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug) VALUES (v_company, v_slug) RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name, is_approved)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name, false);

  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, v_tenant_id, 'user');
  INSERT INTO public.subscriptions (tenant_id, plan, status) VALUES (v_tenant_id, 'free', 'active');

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

-- 2) Backfill: rename existing tenants whose name looks like an email domain (e.g. "gmail.com")
UPDATE public.tenants t
   SET name = COALESCE(NULLIF(btrim(p.full_name),''), split_part(p.email,'@',1), 'حسابي')
  FROM public.profiles p
 WHERE p.tenant_id = t.id
   AND (t.name ~* '\.(com|net|org|io|co|me)$' OR t.name ILIKE '%gmail%' OR t.name ILIKE '%@%');

-- 3) Add a counter so job searches cost half a credit (1 credit per 2 searches)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_search_count integer NOT NULL DEFAULT 0;
