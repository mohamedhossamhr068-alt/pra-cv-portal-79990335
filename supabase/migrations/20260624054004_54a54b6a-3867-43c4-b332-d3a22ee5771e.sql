
CREATE OR REPLACE FUNCTION public.admin_review_topup(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_tenant uuid;
  v_bonus integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO r FROM public.topup_requests WHERE id = _request_id;
  IF r IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_tenant IS NULL OR v_tenant <> r.tenant_id OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;

  IF _approve THEN
    -- Bonus is granted ONLY for paid packages (amount > 0)
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
$$;
