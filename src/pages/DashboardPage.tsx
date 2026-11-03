import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BadgeCheck, CalendarClock, Clock, Loader2, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatDate, formatNaira } from '@/lib/format';
import { daysUntil, findLatestActive } from '@/lib/membership';
import type { MembershipWithPackage } from '@/types/database';

interface PaymentMessage {
  tone: 'success' | 'info' | 'error';
  text: string;
}

interface EarningRow {
  amount_kobo: number;
  status: string;
}

const sumByStatus = (rows: EarningRow[], status: string) =>
  rows.filter((row) => row.status === status).reduce((total, row) => total + row.amount_kobo, 0);

export function DashboardPage() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = user?.id;
  const paymentReference = searchParams.get('reference') ?? searchParams.get('trxref');

  const [memberships, setMemberships] = useState<MembershipWithPackage[]>([]);
  const [balanceKobo, setBalanceKobo] = useState(0);
  const [pendingKobo, setPendingKobo] = useState(0);
  const [approvedKobo, setApprovedKobo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<PaymentMessage | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const [membershipResult, walletResult, earningsResult] = await Promise.all([
      supabase
        .from('memberships')
        .select('id, user_id, package_id, status, starts_at, expires_at, duration_days, created_at, membership_packages(name)')
        .eq('user_id', userId)
        .order('expires_at', { ascending: false }),
      supabase.from('wallets').select('balance_kobo').eq('user_id', userId).maybeSingle(),
      supabase.from('earnings').select('amount_kobo, status').eq('user_id', userId),
    ]);

    if (membershipResult.error || walletResult.error || earningsResult.error) {
      setError('We could not load your dashboard. Please refresh the page.');
      setLoading(false);
      return;
    }

    const earnings = (earningsResult.data ?? []) as EarningRow[];
    setMemberships((membershipResult.data ?? []) as unknown as MembershipWithPackage[]);
    setBalanceKobo(walletResult.data?.balance_kobo ?? 0);
    setPendingKobo(sumByStatus(earnings, 'pending'));
    setApprovedKobo(sumByStatus(earnings, 'approved'));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!paymentReference) return;
    let active = true;

    supabase.functions
      .invoke('paystack-verify', { body: { reference: paymentReference } })
      .then(({ data, error: invokeError }) => {
        if (!active) return;
        if (invokeError || !data) {
          setPaymentMessage({
            tone: 'error',
            text: 'We could not confirm your payment yet. Your membership will activate automatically once Paystack confirms it.',
          });
        } else if (data.activated) {
          setPaymentMessage({ tone: 'success', text: 'Payment confirmed. Your membership is now active.' });
        } else {
          setPaymentMessage({
            tone: 'info',
            text: 'Your payment is still being processed. This page will update once it is confirmed.',
          });
        }
        void loadData();
        navigate('/dashboard', { replace: true });
      });

    return () => {
      active = false;
    };
  }, [paymentReference, navigate, loadData]);

  const activeMembership = findLatestActive(memberships);
  const latestMembership = memberships[0] ?? null;
  const firstName = (profile?.full_name || user?.email || 'Member').split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome, {firstName}</h1>
        <p className="text-navy-200">Your membership, wallet and earnings at a glance.</p>
      </div>

      {paymentMessage && <Alert tone={paymentMessage.tone}>{paymentMessage.text}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading dashboard" />
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-navy-700 bg-navy-900/70 p-6 shadow-card">
            {activeMembership ? (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Active membership
                  </span>
                  <p className="text-2xl font-bold text-white">
                    {activeMembership.membership_packages?.name ?? 'Membership'}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-navy-100">
                    <CalendarClock className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    Expires {formatDate(activeMembership.expires_at)} ({daysUntil(activeMembership.expires_at)} days left)
                  </p>
                </div>
                <Link to="/pricing">
                  <Button variant="secondary">Extend membership</Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                    {latestMembership ? 'Membership expired' : 'No active membership'}
                  </span>
                  <p className="text-navy-100">
                    {latestMembership
                      ? `Your membership expired on ${formatDate(latestMembership.expires_at)}. Renew to keep earning.`
                      : 'Choose a membership to unlock advertiser tasks.'}
                  </p>
                </div>
                <Link to="/pricing">
                  <Button>{latestMembership ? 'Renew membership' : 'View memberships'}</Button>
                </Link>
              </div>
            )}
          </section>

          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard label="Wallet balance" value={formatNaira(balanceKobo)} icon={Wallet} tone="emerald" />
            <StatCard label="Pending earnings" value={formatNaira(pendingKobo)} icon={Clock} tone="amber" />
            <StatCard label="Approved earnings" value={formatNaira(approvedKobo)} icon={BadgeCheck} tone="sky" />
          </div>

          <section className="rounded-2xl border border-navy-700 bg-navy-900/50 p-6">
            <h2 className="text-lg font-bold text-white">Available tasks</h2>
            <p className="mt-2 text-sm text-navy-200">
              {activeMembership
                ? 'No advertiser tasks are live right now. New tasks will appear here as campaigns launch.'
                : 'Advertiser tasks unlock once you have an active membership.'}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
