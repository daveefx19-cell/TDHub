import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { formatNaira } from '@/lib/format';
import type { MembershipPackage } from '@/types/database';

interface PackageDraft {
  priceNaira: string;
  durationDays: string;
  benefits: string;
  isActive: boolean;
}

interface PackagesPanelProps {
  packages: MembershipPackage[];
  onSaved: () => void;
}

const draftFor = (pkg: MembershipPackage): PackageDraft => ({
  priceNaira: String(pkg.price_kobo / 100),
  durationDays: String(pkg.duration_days),
  benefits: pkg.benefits.join('\n'),
  isActive: pkg.is_active,
});

export function PackagesPanel({ packages, onSaved }: PackagesPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const updateDraft = (pkg: MembershipPackage, changes: Partial<PackageDraft>) => {
    setDrafts((current) => ({ ...current, [pkg.id]: { ...(current[pkg.id] ?? draftFor(pkg)), ...changes } }));
  };

  const savePackage = async (event: FormEvent<HTMLFormElement>, pkg: MembershipPackage) => {
    event.preventDefault();
    setMessage(null);
    const draft = drafts[pkg.id] ?? draftFor(pkg);

    const priceNaira = Number(draft.priceNaira);
    const durationDays = Number(draft.durationDays);
    const benefits = draft.benefits
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!Number.isFinite(priceNaira) || priceNaira < 0) {
      setMessage({ tone: 'error', text: `${pkg.name}: enter a valid price in naira.` });
      return;
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      setMessage({ tone: 'error', text: `${pkg.name}: duration must be a whole number of days, at least 1.` });
      return;
    }
    if (benefits.length === 0) {
      setMessage({ tone: 'error', text: `${pkg.name}: add at least one benefit.` });
      return;
    }

    setSavingId(pkg.id);
    const { data, error } = await supabase
      .from('membership_packages')
      .update({
        price_kobo: Math.round(priceNaira * 100),
        duration_days: durationDays,
        benefits,
        is_active: draft.isActive,
      })
      .eq('id', pkg.id)
      .select('id');
    setSavingId(null);

    if (error || !data || data.length === 0) {
      setMessage({ tone: 'error', text: `${pkg.name} could not be saved. Please try again.` });
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[pkg.id];
      return next;
    });
    setMessage({ tone: 'success', text: `${pkg.name} saved.` });
    onSaved();
  };

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Membership packages</h2>
        <p className="text-sm text-navy-200">
          Changes apply to new purchases and grants. Existing memberships keep their original expiry dates.
        </p>
      </div>

      {message && <Alert tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        {packages.map((pkg) => {
          const draft = drafts[pkg.id] ?? draftFor(pkg);
          const isSaving = savingId === pkg.id;
          return (
            <form
              key={pkg.id}
              onSubmit={(event) => void savePackage(event, pkg)}
              className="space-y-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-6 shadow-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                <span className="text-sm text-navy-200">{formatNaira(pkg.price_kobo)}</span>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-navy-50">Price (naira)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.priceNaira}
                  onChange={(e) => updateDraft(pkg, { priceNaira: e.target.value })}
                  className="h-11 w-full rounded-xl border border-navy-600 bg-navy-950 px-4 text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-navy-50">Duration (days)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.durationDays}
                  onChange={(e) => updateDraft(pkg, { durationDays: e.target.value })}
                  className="h-11 w-full rounded-xl border border-navy-600 bg-navy-950 px-4 text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-navy-50">Benefits (one per line)</span>
                <textarea
                  rows={4}
                  value={draft.benefits}
                  onChange={(e) => updateDraft(pkg, { benefits: e.target.value })}
                  className="w-full rounded-xl border border-navy-600 bg-navy-950 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-navy-50">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => updateDraft(pkg, { isActive: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
                Available to members
              </label>

              <Button type="submit" fullWidth loading={isSaving} disabled={savingId !== null}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                Save {pkg.name}
              </Button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
