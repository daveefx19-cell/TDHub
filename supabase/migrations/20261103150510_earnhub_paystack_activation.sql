/*
# Paystack payment activation

Plain-English summary:
Adds the database pieces that let a membership activate only after Paystack has verified a payment.
Each payment stores its unique reference, currency and the membership it produced. A single database
function checks the verified amount and currency, prevents the same payment from activating twice,
and creates the membership with the correct start and expiry dates.

1. Modified Tables
- `payments`: new `currency` column (defaults to NGN) and `membership_id` link to the membership it created.

2. New Functions
- `complete_paystack_payment(reference, amount_kobo, currency, paid_at)`: server-only. Locks the payment,
  rejects amount or currency mismatches, returns the existing membership if the payment was already processed,
  and otherwise creates the membership (stacking after any remaining active time).

3. Security
- The function is callable only by the server role (service_role), never by visitors or members.
- Server role receives the table privileges it needs to create payment records and memberships.

4. Important notes
- Memberships are never activated from the browser; only verified server calls reach this function.
*/

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id);

GRANT SELECT, INSERT, UPDATE ON public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.memberships TO service_role;
GRANT SELECT ON public.membership_packages TO service_role;

CREATE OR REPLACE FUNCTION public.complete_paystack_payment(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_paid_at timestamptz
)
RETURNS public.memberships
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_package public.membership_packages%ROWTYPE;
  v_membership public.memberships%ROWTYPE;
  v_start timestamptz := now();
  v_current_end timestamptz;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_reference = p_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment reference not found';
  END IF;

  IF v_payment.status = 'success' AND v_payment.membership_id IS NOT NULL THEN
    SELECT * INTO v_membership FROM public.memberships WHERE id = v_payment.membership_id;
    RETURN v_membership;
  END IF;

  IF p_currency IS DISTINCT FROM v_payment.currency THEN
    RAISE EXCEPTION 'Currency mismatch';
  END IF;

  IF p_amount_kobo IS DISTINCT FROM v_payment.amount_kobo THEN
    RAISE EXCEPTION 'Amount mismatch';
  END IF;

  SELECT * INTO v_package FROM public.membership_packages WHERE id = v_payment.package_id;

  SELECT max(expires_at) INTO v_current_end
  FROM public.memberships
  WHERE user_id = v_payment.user_id AND status = 'active';

  IF v_current_end IS NOT NULL AND v_current_end > v_start THEN
    v_start := v_current_end;
  END IF;

  INSERT INTO public.memberships (user_id, package_id, status, starts_at, expires_at, duration_days)
  VALUES (
    v_payment.user_id,
    v_package.id,
    'active',
    v_start,
    v_start + make_interval(days => v_package.duration_days),
    v_package.duration_days
  )
  RETURNING * INTO v_membership;

  UPDATE public.payments
  SET status = 'success', paid_at = COALESCE(p_paid_at, now()), membership_id = v_membership.id
  WHERE id = v_payment.id;

  RETURN v_membership;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_paystack_payment(text, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_payment(text, bigint, text, timestamptz) TO service_role;
