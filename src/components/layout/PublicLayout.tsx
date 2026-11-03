import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

const navItems = [{ label: 'Membership', to: '/pricing' }];

export function PublicLayout() {
  const { session } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${
          scrolled || menuOpen
            ? 'border-navy-700 bg-navy-950/90 shadow-card backdrop-blur-md'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="EARNHUB home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'text-emerald-300' : 'text-navy-100 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <Link to="/dashboard">
                <Button size="sm">Go to dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-navy-700 bg-navy-950 px-4 pb-6 pt-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-4 py-3 text-base font-semibold text-navy-50 hover:bg-white/5"
                >
                  {item.label}
                </Link>
              ))}
              {session ? (
                <Link to="/dashboard" className="rounded-lg px-4 py-3 text-base font-semibold text-emerald-300">
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="rounded-lg px-4 py-3 text-base font-semibold text-navy-50 hover:bg-white/5">
                    Sign in
                  </Link>
                  <Link to="/register" className="mt-2">
                    <Button fullWidth>Get started</Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-navy-800 bg-navy-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-navy-200 sm:flex-row sm:px-6">
          <Logo className="scale-90" />
          <p>&copy; {new Date().getFullYear()} EARNHUB. Advertiser-funded rewards for Nigerian members.</p>
          <div className="flex gap-5">
            <Link to="/pricing" className="transition-colors hover:text-white">
              Membership
            </Link>
            <Link to="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
