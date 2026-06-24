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
    UNION
    SELECT DISTINCT up.user_id FROM public.user_permissions up
     WHERE up.tenant_id = NEW.tenant_id AND up.permission = 'review_topups'
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