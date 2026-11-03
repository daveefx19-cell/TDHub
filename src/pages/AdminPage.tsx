import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { PackagesPanel } from '@/components/admin/PackagesPanel';
import { supabase } from '@/lib/supabase';
import { formatDate, formatNaira } from '@/lib/format';
import { daysUntil, indexLatestActiveByUser } from '@/lib/membership';
import type { MembershipPackage, MembershipWithPackage, Profile } from '@/types/database';

interface PaymentRow {
  id: string;
  user_id: string;
  package_id: string;
  amount_kobo: number;
  currency: string;
  provider_reference: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
}

type Notice = { tone: 'success' | 'error'; text: string };

const cellClass = 'whitespace-nowrap px-4 py-3 text-sm text-navy-50';
const headClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-navy-300';

export function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<MembershipWithPackage[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPackageByUser, setSelectedPackageByUser] = useState<Record<string, string>>({});
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profileResult, membershipResult, paymentResult, packageResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, phone, role, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('memberships')
        .select('id, user_id, package_id, status, starts_at, expires_at, duration_days, created_at, membership_packages(name)')
        .order('expires_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, user_id, package_id, amount_kobo, currency, provider_reference, status, created_at, paid_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('membership_packages')
        .select('id, name, price_kobo, duration_days, description, benefits, is_active, sort_order')
        .order('sort_order'),
    ]);

    if (profileResult.error || membershipResult.error || paymentResult.error || packageResult.error) {
      setError('We could not load the admin data. Please refresh the page.');
      setLoading(false);
      return;
    }

    setProfiles((profileResult.data ?? []) as Profile[]);
    setMemberships((membershipResult.data ?? []) as unknown as MembershipWithPackage[]);
    setPayments((paymentResult.data ?? []) as PaymentRow[]);
    setPackages((packageResult.data ?? []) as MembershipPackage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeByUser = useMemo(() => indexLatestActiveByUser(memberships), [memberships]);
  const emailById = useMemo(() => new Map(profiles.map((p) => [p.id, p.email])), [profiles]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter(
      (p) => p.email.toLowerCase().includes(query) || p.full_name.toLowerCase().includes(query)
    );
  }, [profiles, search]);

  const succeededPayments = payments.filter((p) => p.status === 'success');
  const revenueKobo = succeededPayments.reduce((total, p) => total + p.amount_kobo, 0);

  const grantMembership = async (userId: string) => {
    const packageId = selectedPackageByUser[userId] ?? packages.find((pkg) => pkg.is_active)?.id;
    if (!packageId) {
      setNotice({ tone: 'error', text: 'No active membership package is available to grant.' });
      return;
    }
    setNotice(null);
    setGrantingUserId(userId);
    const { error: rpcError } = await supabase.rpc('admin_grant_membership', {
      p_user_id: userId,
      p_package_id: packageId,
    });
    setGrantingUserId(null);

    if (rpcError) {
      setNotice({ tone: 'error', text: `The membership could not be granted: ${rpcError.message}` });
      return;
    }
    setNotice({ tone: 'success', text: 'Membership granted.' });
    void loadAll();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading admin dashboard" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Admin dashboard</h1>
        <p className="text-navy-200">Manage members, memberships, packages and payments.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone={notice.tone === 'success' ? 'success' : 'error'}>{notice.text}</Alert>}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Members" value={String(profiles.filter((p) => p.role === 'member').length)} icon={Users} />
        <StatCard label="Active memberships" value={String(activeByUser.size)} icon={ShieldCheck} tone="sky" />
        <StatCard
          label="Successful payment revenue"
          value={formatNaira(revenueKobo)}
          hint={`${succeededPayments.length} verified payments`}
          icon={Wallet}
          tone="amber"
        />
      </div>

      <PackagesPanel packages={packages} onSaved={() => void loadAll()} />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-white">Members</h2>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="h-11 w-full rounded-xl border border-navy-600 bg-navy-900 pl-10 pr-4 text-white placeholder:text-navy-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-navy-700 bg-navy-900/70">
          <table className="min-w-full divide-y divide-navy-700">
            <thead>
              <tr>
                <th className={headClass}>Name</th>
                <th className={headClass}>Email</th>
                <th className={headClass}>Phone</th>
                <th className={headClass}>Membership</th>
                <th className={headClass}>Grant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {filteredProfiles.map((profile) => {
                const active = activeByUser.get(profile.id);
                return (
                  <tr key={profile.id} className="hover:bg-white/[0.02]">
                    <td className={cellClass}>
                      {profile.full_name || '-'}
                      {profile.role === 'admin' && (
                        <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Admin</span>
                      )}
                    </td>
                    <td className={cellClass}>{profile.email}</td>
                    <td className={cellClass}>{profile.phone || '-'}</td>
                    <td className={cellClass}>
                      {active ? (
                        <span>
                          {active.membership_packages?.name ?? 'Membership'}, {daysUntil(active.expires_at)} days left
                        </span>
                      ) : (
                        <span className="text-navy-300">None</span>
                      )}
                    </td>
                    <td className={cellClass}>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Package for ${profile.email}`}
                          value={selectedPackageByUser[profile.id] ?? packages.find((pkg) => pkg.is_active)?.id ?? ''}
                          onChange={(e) =>
                            setSelectedPackageByUser((current) => ({ ...current, [profile.id]: e.target.value }))
                          }
                          className="h-9 rounded-lg border border-navy-600 bg-navy-950 px-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                        >
                          {packages
                            .filter((pkg) => pkg.is_active)
                            .map((pkg) => (
                              <option key={pkg.id} value={pkg.id}>
                                {pkg.name}
                              </option>
                            ))}
                        </select>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={grantingUserId === profile.id}
                          disabled={grantingUserId !== null}
                          onClick={() => void grantMembership(profile.id)}
                        >
                          Grant
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-navy-300">
                    No members match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-bold text-white">Payment history</h2>
        <div className="overflow-x-auto rounded-2xl border border-navy-700 bg-navy-900/70">
          <table className="min-w-full divide-y divide-navy-700">
            <thead>
              <tr>
                <th className={headClass}>Date</th>
                <th className={headClass}>Member</th>
                <th className={headClass}>Package</th>
                <th className={headClass}>Amount</th>
                <th className={headClass}>Reference</th>
                <th className={headClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-white/[0.02]">
                  <td className={cellClass}>{formatDate(payment.created_at)}</td>
                  <td className={cellClass}>{emailById.get(payment.user_id) ?? 'Unknown member'}</td>
                  <td className={cellClass}>{packages.find((pkg) => pkg.id === payment.package_id)?.name ?? payment.package_id}</td>
                  <td className={cellClass}>{formatNaira(payment.amount_kobo)}</td>
                  <td className={`${cellClass} font-mono text-xs text-navy-200`}>{payment.provider_reference ?? '-'}</td>
                  <td className={cellClass}>{payment.status}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-navy-300">
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
