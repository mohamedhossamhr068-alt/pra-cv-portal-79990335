
CREATE OR REPLACE FUNCTION public.notify_admin_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_actor_name TEXT;
  v_is_privileged BOOLEAN := FALSE;
BEGIN
  IF NEW.actor_id IS NULL OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only notify when actor is moderator or company_admin (privileged action)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.actor_id
      AND tenant_id = NEW.tenant_id
      AND role IN ('moderator','company_admin')
  ) INTO v_is_privileged;

  IF NOT v_is_privileged THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, email, 'مستخدم') INTO v_actor_name
  FROM public.profiles WHERE id = NEW.actor_id;

  -- Notify every company_admin in the tenant (excluding the actor themself)
  FOR r IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.tenant_id = NEW.tenant_id
      AND ur.role = 'company_admin'
      AND ur.user_id <> NEW.actor_id
  LOOP
    PERFORM public.push_notification(
      r.user_id,
      'admin_action',
      'إجراء جديد من ' || COALESCE(v_actor_name,'مشرف'),
      NEW.action ||
        CASE WHEN NEW.target IS NOT NULL AND NEW.target <> '' THEN ' — ' || NEW.target ELSE '' END ||
        ' (' || COALESCE(NEW.status,'success') || ')',
      COALESCE(NEW.link, '/admin/audit'),
      jsonb_build_object(
        'audit_id', NEW.id,
        'actor_id', NEW.actor_id,
        'action', NEW.action,
        'status', NEW.status
      )
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_action ON public.audit_logs;
CREATE TRIGGER trg_notify_admin_action
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_action();
