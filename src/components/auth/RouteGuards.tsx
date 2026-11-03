import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-400" aria-label="Loading" />
    </div>
  );
}

function ProfileErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md space-y-5">
        <Alert tone="error" title="Something went wrong">
          {message}
        </Alert>
        <Button fullWidth variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { session, loading, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (profileError) {
    return <ProfileErrorScreen message={profileError} onRetry={() => void refreshProfile()} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
