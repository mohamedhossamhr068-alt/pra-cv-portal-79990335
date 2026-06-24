
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _target_user uuid,
  _credits integer DEFAULT NULL,
  _is_blocked boolean DEFAULT NULL,
  _grant_admin boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  v_is_admin boolean;
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
  SELECT tenant_id, credits INTO v_target_tenant, v_current
    FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_is_admin := public.is_tenant_admin(auth.uid(), v_tenant);
  v_can_manage := v_is_admin OR public.has_permission(auth.uid(), 'manage_users');
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _grant_admin IS NOT NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Self-demote protection: a tenant admin cannot remove their OWN admin role.
  -- Another admin in the same tenant must do it.
  IF _grant_admin IS FALSE AND _target_user = auth.uid() THEN
    RAISE EXCEPTION 'SELF_DEMOTE_FORBIDDEN';
  END IF;

  -- Last-admin protection: never allow removing the only remaining admin.
  IF _grant_admin IS FALSE THEN
    SELECT count(*) INTO v_admin_count
      FROM public.user_roles
      WHERE tenant_id = v_tenant AND role = 'company_admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_FORBIDDEN';
    END IF;
  END IF;

  IF _credits IS NOT NULL THEN
    v_delta := GREATEST(0, _credits) - COALESCE(v_current, 0);

    IF NOT v_is_admin THEN
      IF v_delta < 0 THEN
        RAISE EXCEPTION 'MOD_CANNOT_LOWER_CREDITS';
      END IF;
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
          v_used := 0;
          v_notified := false;
        END IF;

        IF v_budget IS NOT NULL AND COALESCE(v_used,0) + v_delta > v_budget THEN
          RAISE EXCEPTION 'MOD_BUDGET_EXCEEDED:%/%', COALESCE(v_used,0), v_budget;
        END IF;
        UPDATE public.profiles
          SET grant_used = COALESCE(grant_used,0) + v_delta
          WHERE id = auth.uid();

        IF v_budget IS NOT NULL AND v_budget > 0 AND NOT COALESCE(v_notified,false) THEN
          v_remaining := v_budget - (COALESCE(v_used,0) + v_delta);
          IF v_remaining * 10 < v_budget THEN
            UPDATE public.profiles SET grant_low_notified = true WHERE id = auth.uid();
            SELECT COALESCE(full_name, email, 'مودوريتر') INTO v_actor_name
              FROM public.profiles WHERE id = auth.uid();

            PERFORM public.push_notification(
              auth.uid(), 'grant_budget_low',
              'اقترب رصيد ميزانية المنح من النفاد',
              'متبقي ' || v_remaining || ' من أصل ' || v_budget || ' كرديت (' ||
                CASE WHEN COALESCE(v_period,'monthly') = 'monthly' THEN 'شهري' ELSE 'إجمالي' END || ').',
              '/dashboard',
              jsonb_build_object('remaining', v_remaining, 'budget', v_budget, 'period', COALESCE(v_period,'monthly'))
            );

            FOR r IN
              SELECT DISTINCT user_id FROM public.user_roles
              WHERE tenant_id = v_tenant AND role = 'company_admin' AND user_id <> auth.uid()
            LOOP
              PERFORM public.push_notification(
                r.user_id, 'grant_budget_low',
                'ميزانية المنح لـ ' || v_actor_name || ' أوشكت على النفاد',
                'متبقي ' || v_remaining || ' من ' || v_budget || ' كرديت — يفضّل إعادة الشحن.',
                '/admin/users',
                jsonb_build_object('moderator_id', auth.uid(), 'remaining', v_remaining, 'budget', v_budget, 'period', COALESCE(v_period,'monthly'))
              );
            END LOOP;
          END IF;
        END IF;
      END IF;
    END IF;

    UPDATE public.profiles SET credits = GREATEST(0, _credits) WHERE id = _target_user;
  END IF;

  IF _is_blocked IS NOT NULL THEN
    UPDATE public.profiles SET is_blocked = _is_blocked WHERE id = _target_user;
  END IF;

  IF _grant_admin IS TRUE THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (_target_user, v_tenant, 'company_admin')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  ELSIF _grant_admin IS FALSE THEN
    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND tenant_id = v_tenant AND role = 'company_admin';
  END IF;
END;
$function$;
