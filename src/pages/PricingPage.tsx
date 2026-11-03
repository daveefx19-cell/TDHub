import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatNaira } from '@/lib/format';
import type { MembershipPackage } from '@/types/database';

export function PricingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [payingPackageId, setPayingPackageId] = useState<string | null>(null);

  const startCheckout = async (pkg: MembershipPackage) => {
    if (!session) {
      navigate('/register');
      return;
    }
    setCheckoutError(null);
    setPayingPackageId(pkg.id);
    const { data, error: invokeError } = await supabase.functions.invoke('paystack-initialize', {
      body: { packageId: pkg.id, callbackUrl: `${window.location.origin}/dashboard` },
    });
    if (invokeError || typeof data?.authorizationUrl !== 'string') {
      setPayingPackageId(null);
      setCheckoutError(data?.error ?? 'We could not start your payment. Please try again.');
      return;
    }
    window.location.assign(data.authorizationUrl);
  };

  useEffect(() => {
    let active = true;
    supabase
      .from('membership_packages')
      .select('id, name, price_kobo, duration_days, description, benefits, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError || !Array.isArray(data)) {
          setError('We could not load the membership packages. Please refresh the page.');
        } else {
          setPackages(data as MembershipPackage[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-32 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4 text-center animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Membership</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">Choose the plan that fits your goals</h1>
      </div>

      {loading && (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading packages" />
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {checkoutError && <Alert tone="error">{checkoutError}</Alert>}

      <div className="grid gap-6 md:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="flex flex-col rounded-3xl border border-navy-700 bg-navy-900/70 p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40"
          >
            <h2 className="text-xl font-bold text-white">{pkg.name}</h2>
            <p className="mt-2 text-sm text-navy-200">{pkg.description}</p>
            <p className="mt-6 text-4xl font-bold text-white">{formatNaira(pkg.price_kobo)}</p>
            <p className="mt-1 text-sm text-navy-300">for {pkg.duration_days} days</p>
            <ul className="mt-6 flex-1 space-y-3">
              {pkg.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-navy-50">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
            <Button
              fullWidth
              className="mt-8"
              loading={payingPackageId === pkg.id}
              disabled={payingPackageId !== null}
              onClick={() => void startCheckout(pkg)}
            >
              {session ? `Pay ${formatNaira(pkg.price_kobo)} with Paystack` : `Get ${pkg.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
