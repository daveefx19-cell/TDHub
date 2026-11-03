/*
# EARNHUB core schema

Plain-English summary:
Creates the database tables that power EARNHUB: member profiles, membership packages,
memberships (with start and expiry dates), payments (ready for Paystack), wallets,
advertiser tasks and earnings. Members can only read their own records. Only
administrators can read everything. Members cannot change their own role, wallet,
memberships or earnings.

1. New Tables
- `profiles`: one row per member (name, email, phone, role member or admin).
- `membership_packages`: Normal, Pro and VIP plans, with price and configurable duration in days.
- `memberships`: each purchased or granted subscription with start, expiry and status.
- `payments`: payment attempts, ready to be filled by the Paystack integration.
- `wallets`: one wallet per member with approved balance in kobo.
- `tasks`: advertiser tasks available to members with an active membership.
- `earnings`: earnings per member, with pending, approved or rejected status.

2. Functions
- `is_admin()`: returns true when the signed-in user has the admin role.
- `handle_new_user()`: when a sign-up happens, creates the profile and wallet automatically.

3. Security
- Row level security enabled on every table.
- Members see only their own profile, memberships, payments, wallet and earnings.
- Column-level permissions stop members from editing their role.
- Members cannot write memberships, wallets, payments or earnings directly.

4. Important notes
- Amounts are stored in kobo (1 naira = 100 kobo) to avoid rounding errors.
- Memberships are written only through secure administrator functions or future payment confirmations.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.membership_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_kobo bigint NOT NULL CHECK (price_kobo >= 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  description text NOT NULL DEFAULT '',
  benefits text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.membership_packages(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS memberships_user_expires_idx ON public.memberships (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL REFERENCES public.membership_packages(id),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  provider text NOT NULL DEFAULT 'paystack',
  provider_reference text UNIQUE,
  status text NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized', 'success', 'failed', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments (user_id);

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_kobo bigint NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward_kobo bigint NOT NULL CHECK (reward_kobo >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS earnings_user_status_idx ON public.earnings (user_id, status);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "select_all_profiles_admin" ON public.profiles;
CREATE POLICY "select_all_profiles_admin" ON public.profiles FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

GRANT SELECT ON public.membership_packages TO anon, authenticated;
GRANT UPDATE (name, price_kobo, duration_days, description, benefits, is_active, sort_order) ON public.membership_packages TO authenticated;
DROP POLICY IF EXISTS "select_active_packages" ON public.membership_packages;
CREATE POLICY "select_active_packages" ON public.membership_packages FOR SELECT
  TO anon, authenticated USING (is_active);
DROP POLICY IF EXISTS "select_all_packages_admin" ON public.membership_packages;
CREATE POLICY "select_all_packages_admin" ON public.membership_packages FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "update_packages_admin" ON public.membership_packages;
CREATE POLICY "update_packages_admin" ON public.membership_packages FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.memberships TO authenticated;
DROP POLICY IF EXISTS "select_own_memberships" ON public.memberships;
CREATE POLICY "select_own_memberships" ON public.memberships FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "select_all_memberships_admin" ON public.memberships;
CREATE POLICY "select_all_memberships_admin" ON public.memberships FOR SELECT
  TO authenticated USING (public.is_admin());

GRANT SELECT ON public.payments TO authenticated;
DROP POLICY IF EXISTS "select_own_payments" ON public.payments;
CREATE POLICY "select_own_payments" ON public.payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "select_all_payments_admin" ON public.payments;
CREATE POLICY "select_all_payments_admin" ON public.payments FOR SELECT
  TO authenticated USING (public.is_admin());

GRANT SELECT ON public.wallets TO authenticated;
DROP POLICY IF EXISTS "select_own_wallet" ON public.wallets;
CREATE POLICY "select_own_wallet" ON public.wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "select_all_wallets_admin" ON public.wallets;
CREATE POLICY "select_all_wallets_admin" ON public.wallets FOR SELECT
  TO authenticated USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
DROP POLICY IF EXISTS "select_active_tasks_members" ON public.tasks;
CREATE POLICY "select_active_tasks_members" ON public.tasks FOR SELECT
  TO authenticated USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.expires_at > now()
    )
  );
DROP POLICY IF EXISTS "select_all_tasks_admin" ON public.tasks;
CREATE POLICY "select_all_tasks_admin" ON public.tasks FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "insert_tasks_admin" ON public.tasks;
CREATE POLICY "insert_tasks_admin" ON public.tasks FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "update_tasks_admin" ON public.tasks;
CREATE POLICY "update_tasks_admin" ON public.tasks FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.earnings TO authenticated;
DROP POLICY IF EXISTS "select_own_earnings" ON public.earnings;
CREATE POLICY "select_own_earnings" ON public.earnings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "select_all_earnings_admin" ON public.earnings;
CREATE POLICY "select_all_earnings_admin" ON public.earnings FOR SELECT
  TO authenticated USING (public.is_admin());
