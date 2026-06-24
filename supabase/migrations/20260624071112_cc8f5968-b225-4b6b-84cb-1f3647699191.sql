
-- 1) Bot control per conversation
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_replied boolean NOT NULL DEFAULT false;

-- 2) Guest (visitor) conversations: separate tables to keep RLS simple.
CREATE TABLE IF NOT EXISTS public.guest_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  guest_token text NOT NULL UNIQUE,
  display_name text,
  email text,
  bot_enabled boolean NOT NULL DEFAULT true,
  human_replied boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.guest_conversations TO authenticated;
GRANT ALL ON public.guest_conversations TO service_role;
ALTER TABLE public.guest_conversations ENABLE ROW LEVEL SECURITY;

-- Authenticated company_admin/moderator can view all guest conversations in their tenant
CREATE POLICY "staff read guest convos" ON public.guest_conversations
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL OR
    public.is_tenant_admin(auth.uid(), tenant_id) OR
    EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND tenant_id = guest_conversations.tenant_id AND role = 'moderator')
  );
CREATE POLICY "staff update guest convos" ON public.guest_conversations
  FOR UPDATE TO authenticated
  USING (
    tenant_id IS NULL OR
    public.is_tenant_admin(auth.uid(), tenant_id) OR
    EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND tenant_id = guest_conversations.tenant_id AND role = 'moderator')
  );

CREATE TABLE IF NOT EXISTS public.guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.guest_conversations(id) ON DELETE CASCADE,
  -- sender: 'guest' | 'bot' | 'staff'
  sender text NOT NULL,
  sender_id uuid, -- staff user id if sender=staff
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.guest_messages TO authenticated;
GRANT ALL ON public.guest_messages TO service_role;
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read guest msgs" ON public.guest_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.guest_conversations gc
    WHERE gc.id = guest_messages.conversation_id AND (
      gc.tenant_id IS NULL OR
      public.is_tenant_admin(auth.uid(), gc.tenant_id) OR
      EXISTS (SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id = gc.tenant_id AND ur.role = 'moderator')
    )
  ));
CREATE POLICY "staff insert guest msgs" ON public.guest_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'staff' AND sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.guest_conversations gc
      WHERE gc.id = guest_messages.conversation_id AND (
        gc.tenant_id IS NULL OR
        public.is_tenant_admin(auth.uid(), gc.tenant_id) OR
        EXISTS (SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.tenant_id = gc.tenant_id AND ur.role = 'moderator')
      )
    )
  );

CREATE INDEX IF NOT EXISTS guest_messages_conv_idx ON public.guest_messages(conversation_id, created_at);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_messages;

-- 3) Bot toggle RPC for staff
CREATE OR REPLACE FUNCTION public.chat_set_bot_enabled(_conversation_id uuid, _enabled boolean, _is_guest boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _is_guest THEN
    SELECT tenant_id INTO v_tenant FROM public.guest_conversations WHERE id = _conversation_id;
    IF v_tenant IS NOT NULL AND NOT (public.is_tenant_admin(auth.uid(), v_tenant)
        OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND tenant_id=v_tenant AND role='moderator'))
    THEN RAISE EXCEPTION 'Forbidden'; END IF;
    UPDATE public.guest_conversations SET bot_enabled = _enabled WHERE id = _conversation_id;
  ELSE
    SELECT tenant_id INTO v_tenant FROM public.conversations WHERE id = _conversation_id;
    IF NOT (public.is_tenant_admin(auth.uid(), v_tenant)
        OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND tenant_id=v_tenant AND role='moderator'))
    THEN RAISE EXCEPTION 'Forbidden'; END IF;
    UPDATE public.conversations SET bot_enabled = _enabled WHERE id = _conversation_id;
  END IF;
END;
$$;
