
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grant_low_notified boolean NOT NULL DEFAULT false;

-- Reset the low-budget flag whenever the admin tops up or resets the moderator
CREATE OR REPLACE FUNCTION public.admin_set_moderator_budget(
  _target_user uuid,
  _budget integer DEFAULT NULL,
  _reset_used boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
    SET grant_budget = CASE WHEN _budget IS NULL THEN NULL ELSE GREATEST(0, _budget) END,
        grant_used = CASE WHEN _reset_used THEN 0 ELSE grant_used END,
        grant_low_notified = false
    WHERE id = _target_user;
END;
$$;

-- After any grant, push low-budget notification when remaining < 10%
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _target_user uuid,
  _credits integer DEFAULT NULL,
  _is_blocked boolean DEFAULT NULL,
  _grant_admin boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF _credits IS NOT NULL THEN
    v_delta := GREATEST(0, _credits) - COALESCE(v_current, 0);

    IF NOT v_is_admin THEN
      IF v_delta < 0 THEN
        RAISE EXCEPTION 'MOD_CANNOT_LOWER_CREDITS';
      END IF;
      IF v_delta > 0 THEN
        SELECT grant_budget, grant_used, grant_low_notified
          INTO v_budget, v_used, v_notified
          FROM public.profiles WHERE id = auth.uid();
        IF v_budget IS NOT NULL AND COALESCE(v_used,0) + v_delta > v_budget THEN
          RAISE EXCEPTION 'MOD_BUDGET_EXCEEDED:%/%', COALESCE(v_used,0), v_budget;
        END IF;
        UPDATE public.profiles
          SET grant_used = COALESCE(grant_used,0) + v_delta
          WHERE id = auth.uid();

        -- Low-budget alert: remaining < 10% of budget, fire once
        IF v_budget IS NOT NULL AND v_budget > 0 AND NOT COALESCE(v_notified,false) THEN
          v_remaining := v_budget - (COALESCE(v_used,0) + v_delta);
          IF v_remaining * 10 < v_budget THEN
            UPDATE public.profiles SET grant_low_notified = true WHERE id = auth.uid();
            SELECT COALESCE(full_name, email, 'مودوريتر') INTO v_actor_name
              FROM public.profiles WHERE id = auth.uid();

            -- Notify the moderator themself
            PERFORM public.push_notification(
              auth.uid(), 'grant_budget_low',
              'اقترب رصيد ميزانية المنح من النفاد',
              'متبقي ' || v_remaining || ' من أصل ' || v_budget || ' كرديت — تواصل مع المالك لإعادة الشحن.',
              '/dashboard',
              jsonb_build_object('remaining', v_remaining, 'budget', v_budget)
            );

            -- Notify every company admin
            FOR r IN
              SELECT DISTINCT user_id FROM public.user_roles
              WHERE tenant_id = v_tenant AND role = 'company_admin' AND user_id <> auth.uid()
            LOOP
              PERFORM public.push_notification(
                r.user_id, 'grant_budget_low',
                'ميزانية المنح لـ ' || v_actor_name || ' أوشكت على النفاد',
                'متبقي ' || v_remaining || ' من ' || v_budget || ' كرديت — يفضّل إعادة الشحن.',
                '/admin/users',
                jsonb_build_object(
                  'moderator_id', auth.uid(),
                  'remaining', v_remaining,
                  'budget', v_budget
                )
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
$$;
