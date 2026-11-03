/*
# Membership packages and admin membership grants

Plain-English summary:
Adds the three EARNHUB membership packages (Normal, Pro, VIP) with their prices, and a
secure administrator function that activates a membership for a member. The duration of
each package is stored in days so it can be changed later without touching code.

1. Seeded Data
- `normal`: 15,000 naira, 30 days.
- `pro`: 25,000 naira, 30 days.
- `vip`: 32,000 naira, 30 days.
Prices are stored in kobo (1 naira = 100 kobo).

2. New Functions
- `admin_grant_membership(member_id, package_id)`: administrators only. Creates an active
  membership. If the member already has time remaining, the new period starts when the
  current one ends, so time is never lost.

3. Security
- Only administrators can call the grant function. It is not callable by anonymous visitors.
- Members cannot create memberships on their own.

4. Important notes
- Duration can be changed per package by administrators; new grants use the current value.
- Payment confirmations from Paystack will reuse this same membership logic later.
*/

INSERT INTO public.membership_packages (id, name, price_kobo, duration_days, description, benefits, is_active, sort_order)
VALUES
  ('normal', 'Normal', 1500000, 30,
   'Start earning with access to everyday advertiser tasks.',
   ARRAY['Access to standard advertiser tasks', 'Wallet and earnings dashboard', 'Standard withdrawal processing'],
   true, 1),
  ('pro', 'Pro', 2500000, 30,
   'More tasks and higher-value campaigns for serious earners.',
   ARRAY['Everything in Normal', 'Priority access to new campaigns', 'Higher-value advertiser tasks'],
   true, 2),
  ('vip', 'VIP', 3200000, 30,
   'Our most rewarding tier with first access to premium campaigns.',
   ARRAY['Everything in Pro', 'First access to premium campaigns', 'Dedicated support priority'],
   true, 3)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_grant_membership(p_user_id uuid, p_package_id text)
RETURNS public.memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_package public.membership_packages%ROWTYPE;
  v_start timestamptz := now();
  v_current_end timestamptz;
  v_row public.memberships%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can grant memberships' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_package
  FROM public.membership_packages
  WHERE id = p_package_id AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership package not found or inactive';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT max(expires_at) INTO v_current_end
  FROM public.memberships
  WHERE user_id = p_user_id AND status = 'active';

  IF v_current_end IS NOT NULL AND v_current_end > v_start THEN
    v_start := v_current_end;
  END IF;

  INSERT INTO public.memberships (user_id, package_id, status, starts_at, expires_at, duration_days, granted_by)
  VALUES (
    p_user_id,
    v_package.id,
    'active',
    v_start,
    v_start + make_interval(days => v_package.duration_days),
    v_package.duration_days,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_membership(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_membership(uuid, text) TO authenticated;
