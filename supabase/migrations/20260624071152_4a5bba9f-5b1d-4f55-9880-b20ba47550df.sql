
ALTER TABLE public.conversation_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- Insert a bot reply into a conversation (called server-side after AI call)
CREATE OR REPLACE FUNCTION public.chat_insert_bot_reply(_conversation_id uuid, _body text, _is_guest boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _is_guest THEN
    INSERT INTO public.guest_messages(conversation_id, sender, body)
    VALUES (_conversation_id, 'bot', _body)
    RETURNING id INTO v_id;
    UPDATE public.guest_conversations SET last_message_at = now() WHERE id = _conversation_id;
  ELSE
    INSERT INTO public.conversation_messages(conversation_id, sender_id, body, kind)
    VALUES (_conversation_id, NULL, _body, 'bot')
    RETURNING id INTO v_id;
    UPDATE public.conversations SET last_message_at = now() WHERE id = _conversation_id;
  END IF;
  RETURN v_id;
END;
$$;

-- When a staff member (admin/moderator) sends a message in a guest conversation,
-- mark human_replied=true via trigger; same for normal conversations when sender is staff/admin.
CREATE OR REPLACE FUNCTION public._mark_human_replied()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_tenant uuid; v_is_staff boolean;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.kind = 'system' OR NEW.kind = 'bot' THEN
    RETURN NEW;
  END IF;
  SELECT owner_id, tenant_id INTO v_owner, v_tenant FROM public.conversations WHERE id = NEW.conversation_id;
  IF NEW.sender_id <> v_owner THEN
    UPDATE public.conversations SET human_replied = true WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_human_replied ON public.conversation_messages;
CREATE TRIGGER trg_mark_human_replied
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public._mark_human_replied();

CREATE OR REPLACE FUNCTION public._mark_human_replied_guest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender = 'staff' THEN
    UPDATE public.guest_conversations SET human_replied = true WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_human_replied_guest ON public.guest_messages;
CREATE TRIGGER trg_mark_human_replied_guest
AFTER INSERT ON public.guest_messages
FOR EACH ROW EXECUTE FUNCTION public._mark_human_replied_guest();
