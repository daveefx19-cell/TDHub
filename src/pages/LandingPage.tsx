import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function LandingPage() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_55%)]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-36 text-center sm:px-6 animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-sm font-semibold text-emerald-300">
          Advertiser-funded rewards for Nigerians
        </span>
        <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-6xl">
          Get rewarded for the attention advertisers pay for.
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-navy-100">
          EARNHUB connects you with advertiser-funded tasks. Join a membership, complete approved tasks, and track every
          naira you earn in one secure dashboard.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/register">
            <Button size="lg" fullWidth className="sm:w-auto">
              Create free account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button variant="secondary" size="lg" fullWidth className="sm:w-auto">
              View memberships
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
