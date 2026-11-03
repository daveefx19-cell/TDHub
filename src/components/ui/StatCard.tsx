import type { LucideIcon } from 'lucide-react';

type StatTone = 'emerald' | 'sky' | 'amber';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
}

const toneClasses: Record<StatTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300',
  sky: 'bg-sky-500/15 text-sky-300',
  amber: 'bg-amber-500/15 text-amber-300',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'emerald' }: StatCardProps) {
  return (
    <div className="group rounded-2xl border border-navy-700 bg-navy-900/70 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-navy-200">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</p>
          {hint && <p className="text-xs text-navy-300">{hint}</p>}
        </div>
        <span className={`rounded-xl p-2.5 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
