
-- =========================================================
-- CHAT SYSTEM: support (user<->staff) + credit (mod<->admin)
-- =========================================================

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('support','credit')),
  owner_id uuid NOT NULL,
  title text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, owner_id)
);

CREATE INDEX conversations_tenant_kind_idx ON public.conversations(tenant_id, kind, last_message_at DESC);
CREATE INDEX conversations_owner_idx ON public.conversations(owner_id);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: owner, admins of tenant, moderators of tenant (for support only)
CREATE POLICY "conv_select" ON public.conversations FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (kind = 'support' AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id = conversations.tenant_id AND ur.role = 'moderator'
      ))
    )
  )
);

-- No direct insert/update from client (use RPC) — but allow owner inserts via RPC's SECURITY DEFINER.

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','credit_request','system')),
  credit_amount integer,
  credit_status text CHECK (credit_status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conv_messages_conv_idx ON public.conversation_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone who can see the parent conversation
CREATE POLICY "msg_select" ON public.conversation_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_messages.conversation_id
      AND (
        c.owner_id = auth.uid()
        OR (
          c.tenant_id = public.get_user_tenant(auth.uid())
          AND (
            public.is_tenant_admin(auth.uid(), c.tenant_id)
            OR (c.kind = 'support' AND EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid() AND ur.tenant_id = c.tenant_id AND ur.role = 'moderator'
            ))
          )
        )
      )
  )
);

-- ========================
-- RPC: get/create conv
-- ========================
CREATE OR REPLACE FUNCTION public.chat_get_or_create_my_conversation(_kind text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
  v_is_mod boolean;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _kind NOT IN ('support','credit') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;

  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;

  IF _kind = 'credit' THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = v_tenant AND role = 'moderator') INTO v_is_mod;
    SELECT public.is_tenant_admin(auth.uid(), v_tenant) INTO v_is_admin;
    IF NOT v_is_mod AND NOT v_is_admin THEN RAISE EXCEPTION 'NOT_MODERATOR'; END IF;
  END IF;

  SELECT id INTO v_id FROM public.conversations
   WHERE tenant_id = v_tenant AND kind = _kind AND owner_id = auth.uid();
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.conversations(tenant_id, kind, owner_id, title)
  VALUES (v_tenant, _kind, auth.uid(),
          CASE WHEN _kind = 'support' THEN 'Support' ELSE 'Credit requests' END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ========================
-- RPC: send message
-- ========================
CREATE OR REPLACE FUNCTION public.chat_send_message(
  _conversation_id uuid,
  _body text,
  _kind text DEFAULT 'text',
  _credit_amount integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_tenant uuid;
  v_is_admin boolean;
  v_is_mod boolean;
  v_can boolean;
  v_id uuid;
  v_status text := NULL;
  r RECORD;
  v_actor text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _kind NOT IN ('text','credit_request') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;
  IF COALESCE(btrim(_body),'') = '' AND _kind = 'text' THEN RAISE EXCEPTION 'EMPTY'; END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = _conversation_id;
  IF v_conv IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  v_is_admin := public.is_tenant_admin(auth.uid(), v_conv.tenant_id);
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = v_conv.tenant_id AND role = 'moderator') INTO v_is_mod;

  v_can := (v_conv.owner_id = auth.uid())
        OR (v_tenant = v_conv.tenant_id AND (v_is_admin OR (v_conv.kind = 'support' AND v_is_mod)));
  IF NOT v_can THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _kind = 'credit_request' THEN
    IF v_conv.kind <> 'credit' THEN RAISE EXCEPTION 'WRONG_CONVERSATION'; END IF;
    IF v_conv.owner_id <> auth.uid() THEN RAISE EXCEPTION 'ONLY_OWNER_CAN_REQUEST'; END IF;
    IF COALESCE(_credit_amount,0) <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    v_status := 'pending';
  END IF;

  INSERT INTO public.conversation_messages(conversation_id, sender_id, body, kind, credit_amount, credit_status)
  VALUES (_conversation_id, auth.uid(), NULLIF(_body,''), _kind, _credit_amount, v_status)
  RETURNING id INTO v_id;

  UPDATE public.conversations SET last_message_at = now() WHERE id = _conversation_id;

  -- Notify the other side
  SELECT COALESCE(full_name, email, 'مستخدم') INTO v_actor FROM public.profiles WHERE id = auth.uid();

  IF v_conv.owner_id = auth.uid() THEN
    -- Notify staff (admins + moderators if support)
    FOR r IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE tenant_id = v_conv.tenant_id
        AND (role = 'company_admin' OR (v_conv.kind = 'support' AND role = 'moderator'))
        AND user_id <> auth.uid()
    LOOP
      PERFORM public.push_notification(
        r.user_id,
        CASE WHEN _kind = 'credit_request' THEN 'credit_request' ELSE 'chat_message' END,
        CASE WHEN _kind = 'credit_request'
             THEN 'طلب زيادة كرديت من ' || v_actor
             ELSE 'رسالة جديدة من ' || v_actor END,
        COALESCE(NULLIF(_body,''), 'طلب ' || _credit_amount::text || ' كرديت'),
        CASE WHEN v_conv.kind = 'credit' THEN '/admin/chat/credit' ELSE '/admin/chat/support' END,
        jsonb_build_object('conversation_id', v_conv.id, 'message_id', v_id)
      );
    END LOOP;
  ELSE
    -- Notify the owner
    PERFORM public.push_notification(
      v_conv.owner_id, 'chat_message',
      'رد جديد من ' || v_actor,
      COALESCE(NULLIF(_body,''), ''),
      CASE WHEN v_conv.kind = 'credit' THEN '/chat/credit' ELSE '/chat/support' END,
      jsonb_build_object('conversation_id', v_conv.id, 'message_id', v_id)
    );
  END IF;

  RETURN v_id;
END;
$$;

-- ========================
-- RPC: review credit request (admin only)
-- ========================
CREATE OR REPLACE FUNCTION public.chat_review_credit_request(_message_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg record;
  v_conv record;
  v_actor text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_msg FROM public.conversation_messages WHERE id = _message_id;
  IF v_msg IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_msg.kind <> 'credit_request' THEN RAISE EXCEPTION 'NOT_A_REQUEST'; END IF;
  IF v_msg.credit_status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = v_msg.conversation_id;
  IF NOT public.is_tenant_admin(auth.uid(), v_conv.tenant_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _approve THEN
    -- increase moderator grant_budget by amount
    UPDATE public.profiles
       SET grant_budget = COALESCE(grant_budget,0) + v_msg.credit_amount,
           grant_low_notified = false
     WHERE id = v_conv.owner_id;
    UPDATE public.conversation_messages
       SET credit_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = _message_id;
  ELSE
    UPDATE public.conversation_messages
       SET credit_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = _message_id;
  END IF;

  -- system reply
  INSERT INTO public.conversation_messages(conversation_id, sender_id, body, kind)
  VALUES (v_msg.conversation_id, auth.uid(),
          CASE WHEN _approve
               THEN 'تمت الموافقة على إضافة ' || v_msg.credit_amount::text || ' كرديت للميزانية.'
               ELSE 'تم رفض الطلب' || COALESCE(' — ' || _note, '') END,
          'system');
  UPDATE public.conversations SET last_message_at = now() WHERE id = v_msg.conversation_id;

  SELECT COALESCE(full_name, email, 'الأدمن') INTO v_actor FROM public.profiles WHERE id = auth.uid();
  PERFORM public.push_notification(
    v_conv.owner_id,
    CASE WHEN _approve THEN 'credit_approved' ELSE 'credit_rejected' END,
    CASE WHEN _approve
         THEN 'تمت الموافقة على طلب الكرديت'
         ELSE 'تم رفض طلب الكرديت' END,
    CASE WHEN _approve
         THEN 'تمت إضافة ' || v_msg.credit_amount::text || ' كرديت لميزانية المنح.'
         ELSE COALESCE(_note, 'يرجى التواصل مع الأدمن لمزيد من التفاصيل.') END,
    '/chat/credit',
    jsonb_build_object('conversation_id', v_msg.conversation_id, 'message_id', _message_id)
  );
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
