-- Make sure platform-wide payment methods exist and are active for every user
INSERT INTO public.payment_methods (tenant_id, type, label, account_number, account_name, instructions, is_active, sort_order)
SELECT NULL, 'vodafone_cash', 'Vodafone Cash', '01000000000', 'PRA', 'حوّل المبلغ ثم ارفع صورة إيصال التحويل.', true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods WHERE tenant_id IS NULL AND type = 'vodafone_cash'
);

INSERT INTO public.payment_methods (tenant_id, type, label, account_number, account_name, instructions, is_active, sort_order)
SELECT NULL, 'instapay', 'InstaPay', 'pra@instapay', 'PRA', 'حوّل المبلغ ثم ارفع صورة إيصال التحويل.', true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods WHERE tenant_id IS NULL AND type = 'instapay'
);

UPDATE public.payment_methods
SET is_active = true
WHERE tenant_id IS NULL AND type IN ('vodafone_cash', 'instapay');

-- Attach selected plan to manual top-up requests
ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS requested_plan public.plan_tier NULL;

-- Allow all tenant members to open a credit request conversation
CREATE OR REPLACE FUNCTION public.chat_get_or_create_my_conversation(_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _kind NOT IN ('support','credit') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;

  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'NO_TENANT'; END IF;

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

-- Notify admins/moderators when any user sends a credit request
CREATE OR REPLACE FUNCTION public.chat_send_message(_conversation_id uuid, _body text, _kind text DEFAULT 'text'::text, _credit_amount integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_is_admin := public.is_tenant_admin(auth.uid(), v_conv.tenant_id) OR public.is_superadmin(auth.uid());
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

  SELECT COALESCE(full_name, email, 'مستخدم') INTO v_actor FROM public.profiles WHERE id = auth.uid();

  IF v_conv.owner_id = auth.uid() THEN
    FOR r IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE tenant_id = v_conv.tenant_id
        AND (role = 'company_admin' OR (v_conv.kind = 'support' AND role = 'moderator'))
        AND user_id <> auth.uid()
      UNION
      SELECT DISTINCT user_id FROM public.user_permissions
      WHERE tenant_id = v_conv.tenant_id
        AND permission = 'review_topups'
        AND user_id <> auth.uid()
    LOOP
      PERFORM public.push_notification(
        r.user_id,
        CASE WHEN _kind = 'credit_request' THEN 'credit_request' ELSE 'chat_message' END,
        CASE WHEN _kind = 'credit_request'
             THEN 'طلب كرديت جديد من ' || v_actor
             ELSE 'رسالة جديدة من ' || v_actor END,
        COALESCE(NULLIF(_body,''), 'طلب ' || _credit_amount::text || ' كرديت'),
        CASE WHEN v_conv.kind = 'credit' THEN '/admin/chat/credit' ELSE '/admin/chat/support' END,
        jsonb_build_object('conversation_id', v_conv.id, 'message_id', v_id)
      );
    END LOOP;
  ELSE
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

-- Approving a credit request adds credits to the user's balance
CREATE OR REPLACE FUNCTION public.chat_review_credit_request(_message_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg record;
  v_conv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_msg FROM public.conversation_messages WHERE id = _message_id;
  IF v_msg IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_msg.kind <> 'credit_request' THEN RAISE EXCEPTION 'NOT_A_REQUEST'; END IF;
  IF v_msg.credit_status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = v_msg.conversation_id;
  IF NOT (public.is_tenant_admin(auth.uid(), v_conv.tenant_id) OR public.has_permission(auth.uid(), 'review_topups') OR public.is_superadmin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _approve THEN
    UPDATE public.profiles
       SET credits = COALESCE(credits,0) + v_msg.credit_amount
     WHERE id = v_conv.owner_id;
    UPDATE public.conversation_messages
       SET credit_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = _message_id;
  ELSE
    UPDATE public.conversation_messages
       SET credit_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = _message_id;
  END IF;

  INSERT INTO public.conversation_messages(conversation_id, sender_id, body, kind)
  VALUES (v_msg.conversation_id, auth.uid(),
          CASE WHEN _approve
               THEN 'تمت الموافقة وإضافة ' || v_msg.credit_amount::text || ' كرديت إلى الرصيد.'
               ELSE 'تم رفض الطلب' || COALESCE(' — ' || _note, '') END,
          'system');
  UPDATE public.conversations SET last_message_at = now() WHERE id = v_msg.conversation_id;

  PERFORM public.push_notification(
    v_conv.owner_id,
    CASE WHEN _approve THEN 'credit_approved' ELSE 'credit_rejected' END,
    CASE WHEN _approve THEN 'تمت الموافقة على طلب الكرديت' ELSE 'تم رفض طلب الكرديت' END,
    CASE WHEN _approve
         THEN 'تمت إضافة ' || v_msg.credit_amount::text || ' كرديت إلى رصيدك.'
         ELSE COALESCE(_note, 'يرجى التواصل مع الأدمن لمزيد من التفاصيل.') END,
    '/chat/credit',
    jsonb_build_object('conversation_id', v_conv.id, 'message_id', _message_id)
  );
END;
$$;

-- Approving a package top-up activates the selected plan and grants credits
CREATE OR REPLACE FUNCTION public.admin_review_topup(_request_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_tenant uuid;
  v_bonus integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO r FROM public.topup_requests WHERE id = _request_id;
  IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (
    public.is_superadmin(auth.uid())
    OR (v_tenant = r.tenant_id AND (public.is_tenant_admin(auth.uid(), v_tenant) OR public.has_permission(auth.uid(), 'review_topups')))
  ) THEN
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

    IF r.requested_plan IS NOT NULL THEN
      INSERT INTO public.subscriptions (tenant_id, plan, status, current_period_start, current_period_end, updated_at)
      VALUES (r.tenant_id, r.requested_plan, 'active', now(), now() + interval '1 month', now())
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();
    END IF;

    UPDATE public.topup_requests
      SET status='approved',
          admin_note = COALESCE(_note,'') ||
            CASE WHEN r.requested_plan IS NOT NULL THEN ' (plan: ' || r.requested_plan::text || ')' ELSE '' END ||
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
$$;