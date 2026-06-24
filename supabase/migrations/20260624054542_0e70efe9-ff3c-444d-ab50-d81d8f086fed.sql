
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS link text;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_status_check;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_status_check CHECK (status IN ('success','failure','info'));

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_status_idx ON public.audit_logs (status);

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _status text DEFAULT 'success',
  _target text DEFAULT NULL,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs(actor_id, tenant_id, action, target, status, link, metadata)
  VALUES (auth.uid(), v_tenant, _action,
          NULLIF(_target,''), COALESCE(_status,'success'), NULLIF(_link,''),
          COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, text, jsonb) TO authenticated;
