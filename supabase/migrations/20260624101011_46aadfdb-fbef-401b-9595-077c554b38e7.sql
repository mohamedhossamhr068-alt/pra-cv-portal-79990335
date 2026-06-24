
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.admin_set_user_feature_flags(_target_user uuid, _flags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
     SET feature_flags = COALESCE(_flags, '{}'::jsonb)
   WHERE id = _target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_feature_flags(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_feature_flags(uuid, jsonb) TO authenticated;
