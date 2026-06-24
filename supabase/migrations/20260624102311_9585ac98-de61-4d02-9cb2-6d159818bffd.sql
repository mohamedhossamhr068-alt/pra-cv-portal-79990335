
-- admin_update_user: superadmin can act cross-tenant
CREATE OR REPLACE FUNCTION public.admin_update_user(_target_user uuid, _credits integer DEFAULT NULL::integer, _is_blocked boolean DEFAULT NULL::boolean, _grant_admin boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  v_is_admin boolean;
  v_is_super boolean;
  v_can_manage boolean;
  v_current integer;
  v_delta integer;
  v_budget integer;
  v_used integer;
  v_notified boolean;
  v_remaining integer;
  v_actor_name text;
  v_period text;
  v_period_start timestamptz;
  v_admin_count integer;
  r RECORD;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id, credits INTO v_target_tenant, v_current FROM public.profiles WHERE id = _target_user;
  v_is_super := public.is_superadmin(auth.uid());
  IF NOT v_is_super AND (v_tenant IS NULL OR v_tenant <> v_target_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_is_admin := v_is_super OR public.is_tenant_admin(auth.uid(), v_target_tenant);
  v_can_manage := v_is_admin OR public.has_permission(auth.uid(), 'manage_users');
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _grant_admin IS NOT NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _grant_admin IS FALSE AND _target_user = auth.uid() THEN
    RAISE EXCEPTION 'SELF_DEMOTE_FORBIDDEN';
  END IF;
  IF _grant_admin IS FALSE THEN
    SELECT count(*) INTO v_admin_count
      FROM public.user_roles
     WHERE tenant_id = v_target_tenant AND role = 'company_admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_FORBIDDEN';
    END IF;
  END IF;

  IF _credits IS NOT NULL THEN
    v_delta := GREATEST(0, _credits) - COALESCE(v_current, 0);
    IF NOT v_is_admin THEN
      IF v_delta < 0 THEN RAISE EXCEPTION 'MOD_CANNOT_LOWER_CREDITS'; END IF;
      IF v_delta > 0 THEN
        SELECT grant_budget, grant_used, grant_low_notified, grant_period, grant_period_start
          INTO v_budget, v_used, v_notified, v_period, v_period_start
          FROM public.profiles WHERE id = auth.uid();
        IF COALESCE(v_period,'monthly') = 'monthly'
           AND date_trunc('month', COALESCE(v_period_start, now())) < date_trunc('month', now()) THEN
          UPDATE public.profiles
             SET grant_used = 0,
                 grant_period_start = date_trunc('month', now()),
                 grant_low_notified = false
           WHERE id = auth.uid();
          v_used := 0; v_notified := false;
        END IF;
        IF v_budget IS NOT NULL AND COALESCE(v_used,0) + v_delta > v_budget THEN
          RAISE EXCEPTION 'MOD_BUDGET_EXCEEDED:%/%', COALESCE(v_used,0), v_budget;
        END IF;
        UPDATE public.profiles SET grant_used = COALESCE(grant_used,0) + v_delta WHERE id = auth.uid();
      END IF;
    END IF;
    UPDATE public.profiles SET credits = GREATEST(0, _credits) WHERE id = _target_user;
  END IF;

  IF _is_blocked IS NOT NULL THEN
    UPDATE public.profiles SET is_blocked = _is_blocked WHERE id = _target_user;
  END IF;

  IF _grant_admin IS TRUE THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (_target_user, v_target_tenant, 'company_admin')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  ELSIF _grant_admin IS FALSE THEN
    DELETE FROM public.user_roles
     WHERE user_id = _target_user AND tenant_id = v_target_tenant AND role = 'company_admin';
  END IF;
END;
$function$;

-- admin_set_user_permissions: superadmin cross-tenant
CREATE OR REPLACE FUNCTION public.admin_set_user_permissions(_target_user uuid, _permissions app_permission[], _make_moderator boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  v_is_super boolean;
  p public.app_permission;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  v_is_super := public.is_superadmin(auth.uid());
  IF NOT v_is_super AND (v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF v_is_super AND NOT public.is_tenant_admin(auth.uid(), v_target_tenant) AND v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.user_permissions WHERE user_id = _target_user AND tenant_id = v_target_tenant;
  IF _permissions IS NOT NULL THEN
    FOREACH p IN ARRAY _permissions LOOP
      INSERT INTO public.user_permissions(user_id, tenant_id, permission, granted_by)
      VALUES (_target_user, v_target_tenant, p, auth.uid())
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF _make_moderator IS TRUE THEN
    INSERT INTO public.user_roles(user_id, tenant_id, role)
    VALUES (_target_user, v_target_tenant, 'moderator')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  ELSIF _make_moderator IS FALSE THEN
    DELETE FROM public.user_roles
     WHERE user_id = _target_user AND tenant_id = v_target_tenant AND role = 'moderator';
  END IF;
END;
$function$;

-- admin_set_moderator_budget: superadmin cross-tenant
CREATE OR REPLACE FUNCTION public.admin_set_moderator_budget(_target_user uuid, _budget integer DEFAULT NULL::integer, _reset_used boolean DEFAULT false, _period text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  v_is_super boolean;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  v_is_super := public.is_superadmin(auth.uid());
  IF NOT v_is_super AND (v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _period IS NOT NULL AND _period NOT IN ('monthly','total') THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;
  UPDATE public.profiles
    SET grant_budget = CASE WHEN _budget IS NULL THEN NULL ELSE GREATEST(0, _budget) END,
        grant_used = CASE WHEN _reset_used THEN 0 ELSE grant_used END,
        grant_low_notified = false,
        grant_period = COALESCE(_period, grant_period),
        grant_period_start = CASE
          WHEN _reset_used OR _period IS DISTINCT FROM NULL
            THEN date_trunc('month', now())
          ELSE grant_period_start
        END
   WHERE id = _target_user;
END;
$function$;

-- admin_set_user_feature_flags: superadmin cross-tenant
CREATE OR REPLACE FUNCTION public.admin_set_user_feature_flags(_target_user uuid, _flags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  v_is_super := public.is_superadmin(auth.uid());
  IF NOT v_is_super AND (v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles SET feature_flags = COALESCE(_flags, '{}'::jsonb) WHERE id = _target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_feature_flags(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_feature_flags(uuid, jsonb) TO authenticated;

-- profiles SELECT policy already allows superadmin via is_superadmin(auth.uid())
