import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type AlertTone = 'error' | 'success' | 'info';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}

const toneStyles: Record<AlertTone, { wrapper: string; icon: typeof Info }> = {
  error: { wrapper: 'border-rose-400/40 bg-rose-500/10 text-rose-100', icon: AlertTriangle },
  success: { wrapper: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100', icon: CheckCircle2 },
  info: { wrapper: 'border-sky-400/40 bg-sky-500/10 text-sky-100', icon: Info },
};

export function Alert({ tone = 'info', title, children }: AlertProps) {
  const { wrapper, icon: Icon } = toneStyles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border p-4 ${wrapper}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
