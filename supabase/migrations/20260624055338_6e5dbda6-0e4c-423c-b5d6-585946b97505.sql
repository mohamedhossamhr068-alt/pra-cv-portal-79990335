
-- 1) Add moderator role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- 2) Permission enum
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'manage_users','review_topups','manage_offers','view_audit','view_usage'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS up_select_own_or_admin ON public.user_permissions;
CREATE POLICY up_select_own_or_admin ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS up_admin_write ON public.user_permissions;
CREATE POLICY up_admin_write ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));

CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON public.user_permissions(user_id, tenant_id);

-- 4) Helper: has_permission (admin always passes)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role IN ('company_admin','superadmin')
  ) OR EXISTS (
    SELECT 1 FROM public.user_permissions p
    JOIN public.profiles pr ON pr.id = _user_id
    WHERE p.user_id = _user_id AND p.tenant_id = pr.tenant_id AND p.permission = _permission
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;

-- 5) RPC: set moderator + permissions atomically
CREATE OR REPLACE FUNCTION public.admin_set_user_permissions(
  _target_user uuid,
  _permissions public.app_permission[],
  _make_moderator boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
  p public.app_permission;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Replace permission set
  DELETE FROM public.user_permissions WHERE user_id = _target_user AND tenant_id = v_tenant;
  IF _permissions IS NOT NULL THEN
    FOREACH p IN ARRAY _permissions LOOP
      INSERT INTO public.user_permissions(user_id, tenant_id, permission, granted_by)
      VALUES (_target_user, v_tenant, p, auth.uid())
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Optionally toggle moderator role
  IF _make_moderator IS TRUE THEN
    INSERT INTO public.user_roles(user_id, tenant_id, role)
    VALUES (_target_user, v_tenant, 'moderator')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  ELSIF _make_moderator IS FALSE THEN
    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND tenant_id = v_tenant AND role = 'moderator';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_permissions(uuid, public.app_permission[], boolean) TO authenticated;

-- 6) Loosen admin RPCs to accept moderators with the right permission
CREATE OR REPLACE FUNCTION public.admin_update_user(_target_user uuid, _credits integer DEFAULT NULL::integer, _is_blocked boolean DEFAULT NULL::boolean, _grant_admin boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  -- admin OR moderator with manage_users
  IF NOT (public.is_tenant_admin(auth.uid(), v_tenant) OR public.has_permission(auth.uid(), 'manage_users')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  -- Only true admins can grant/revoke admin role
  IF _grant_admin IS NOT NULL AND NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _credits IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.admin_review_topup(_request_id uuid, _approve boolean, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_tenant uuid;
  v_bonus integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO r FROM public.topup_requests WHERE id = _request_id;
  IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_tenant IS NULL OR v_tenant <> r.tenant_id OR NOT (public.is_tenant_admin(auth.uid(), v_tenant) OR public.has_permission(auth.uid(), 'review_topups')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  IF _approve THEN
    IF COALESCE(r.amount_egp, 0) > 0 THEN
      SELECT COALESCE(bonus_credits,0) INTO v_bonus FROM public.tenants WHERE id = r.tenant_id;
    ELSE
      v_bonus := 0;
    END IF;
    UPDATE public.profiles
      SET credits = COALESCE(credits,0) + r.credits_requested + COALESCE(v_bonus,0)
      WHERE id = r.user_id;
    UPDATE public.topup_requests
      SET status='approved',
          admin_note = COALESCE(_note,'') ||
            CASE WHEN v_bonus > 0 THEN ' (+' || v_bonus || ' bonus)' ELSE '' END,
          credits_granted = r.credits_requested + COALESCE(v_bonus,0),
          reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = _request_id;
  ELSE
    UPDATE public.topup_requests
      SET status='rejected', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
      WHERE id = _request_id;
  END IF;
END;
$function$;

-- 7) audit_logs SELECT: open to view_audit permission holders
DROP POLICY IF EXISTS audit_select_admin ON public.audit_logs;
CREATE POLICY audit_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
    OR public.has_permission(auth.uid(), 'view_audit')
  );
