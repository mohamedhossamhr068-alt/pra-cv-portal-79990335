
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id UUID,
  _type TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _tenant UUID;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.notifications(user_id, tenant_id, type, title, body, link, metadata)
  VALUES (_user_id, _tenant, _type, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_topup_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.push_notification(
        NEW.user_id, 'topup_approved',
        'تم اعتماد طلب الشحن',
        'تمت إضافة ' || COALESCE(NEW.credits_granted::text, '0') || ' كريديت إلى رصيدك.',
        '/billing/topup',
        jsonb_build_object('request_id', NEW.id, 'amount_egp', NEW.amount_egp, 'credits', NEW.credits_granted)
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.push_notification(
        NEW.user_id, 'topup_rejected',
        'تم رفض طلب الشحن',
        COALESCE(NEW.admin_note, 'يرجى مراجعة بيانات التحويل والمحاولة مرة أخرى.'),
        '/billing/topup',
        jsonb_build_object('request_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_topup_status ON public.topup_requests;
CREATE TRIGGER trg_notify_topup_status
  AFTER UPDATE ON public.topup_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_topup_status();

CREATE OR REPLACE FUNCTION public.notify_cv_generated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.push_notification(
    NEW.user_id, 'cv_generated',
    'تم إنشاء سيرة ذاتية جديدة',
    NEW.title,
    '/cv/' || NEW.id::text,
    jsonb_build_object('cv_id', NEW.id, 'template', NEW.template)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cv_generated ON public.cv_logs;
CREATE TRIGGER trg_notify_cv_generated
  AFTER INSERT ON public.cv_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_cv_generated();
