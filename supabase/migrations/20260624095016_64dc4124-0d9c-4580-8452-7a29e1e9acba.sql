
-- 1) Stop auto-granting company_admin on new signups
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

  -- Only regular user role by default. Admin promotion happens via superadmin/admin tools.
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

-- 2) Downgrade the existing approved user (keep the owner/superadmin's company_admin)
DELETE FROM public.user_roles
WHERE role = 'company_admin'
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'superadmin');

-- 3) Notify tenant admins + superadmins when a topup is submitted
CREATE OR REPLACE FUNCTION public.notify_topup_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_user_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'مستخدم') INTO v_user_name
    FROM public.profiles WHERE id = NEW.user_id;

  FOR r IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE (tenant_id = NEW.tenant_id AND role = 'company_admin')
       OR role = 'superadmin'
  LOOP
    PERFORM public.push_notification(
      r.user_id, 'topup_pending',
      'طلب شحن جديد بانتظار المراجعة',
      v_user_name || ' حوّل ' || COALESCE(NEW.amount_egp::text,'0') || ' ج.م مقابل ' ||
        COALESCE(NEW.credits_requested::text,'0') || ' كريديت — يرجى التحقق من الإيصال.',
      '/admin/wallet',
      jsonb_build_object('request_id', NEW.id, 'user_id', NEW.user_id,
                         'amount_egp', NEW.amount_egp, 'credits', NEW.credits_requested)
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_topup_submitted ON public.topup_requests;
CREATE TRIGGER trg_notify_topup_submitted
AFTER INSERT ON public.topup_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_topup_submitted();
