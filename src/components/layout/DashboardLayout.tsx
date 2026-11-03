import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CreditCard, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from '@/hooks/useAuth';

const linkBase =
  'inline-flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap';

function navClass({ isActive }: { isActive: boolean }) {
  return `${linkBase} ${isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-navy-100 hover:bg-white/5 hover:text-white'}`;
}

export function DashboardLayout() {
  const { profile, user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.full_name || user?.email || 'Member';

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-navy-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-navy-800 bg-navy-900/60 p-5 lg:flex">
        <Link to="/dashboard" className="mb-8 px-2">
          <Logo />
        </Link>

        <nav className="flex flex-1 flex-col gap-1.5" aria-label="Dashboard">
          <NavLink to="/dashboard" className={navClass}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Overview
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Membership
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="space-y-3 border-t border-navy-800 pt-5">
          <div className="px-2">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-navy-300">{profile?.email ?? user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-navy-100 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-950/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-xl p-2.5 text-navy-100 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Dashboard mobile">
          <NavLink to="/dashboard" className={navClass}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Overview
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Membership
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Admin
            </NavLink>
          )}
        </nav>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
