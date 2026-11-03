import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(\+?234|0)[7-9][01]\d{8}$/;

export function AuthPage({ mode }: AuthPageProps) {
  const { session, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === 'register';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setFormError('Your password must be at least 8 characters long.');
      return;
    }
    if (isRegister) {
      if (fullName.trim().length < 2) {
        setFormError('Enter your full name.');
        return;
      }
      if (!PHONE_PATTERN.test(phone.replace(/[\s-]/g, ''))) {
        setFormError('Enter a valid Nigerian phone number, for example 08012345678.');
        return;
      }
    }

    setSubmitting(true);
    const result = isRegister
      ? await signUp({ fullName: fullName.trim(), email: email.trim(), phone: phone.replace(/[\s-]/g, ''), password })
      : await signIn(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }
    const from = (location.state as { from?: unknown } | null)?.from;
    navigate(typeof from === 'string' && from.startsWith('/') ? from : '/dashboard', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 pb-16 pt-28 sm:px-6">
      <div className="w-full rounded-3xl border border-navy-700 bg-navy-900/80 p-6 shadow-card animate-fade-up sm:p-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-bold text-white">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-sm text-navy-200">
            {isRegister ? 'Already a member?' : 'New to EARNHUB?'}{' '}
            <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-emerald-300 hover:text-emerald-200">
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}

          {isRegister && (
            <>
              <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              <TextField
                label="Phone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="08012345678"
              />
            </>
          )}
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            hint={isRegister ? 'At least 8 characters.' : undefined}
          />

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            {isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
