import { ShieldCheck } from 'lucide-react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-navy-950 shadow-glow">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-white">EARNHUB</span>
    </span>
  );
}
