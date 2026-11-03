import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { describeAuthError } from '@/lib/auth-errors';
import { AuthContext, type AuthContextValue, type SignUpInput } from '@/contexts/auth-context';
import type { Profile } from '@/types/database';

const PROFILE_ERROR_MESSAGE = 'We could not load your profile. Please refresh the page.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const loadedUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileError(PROFILE_ERROR_MESSAGE);
      return;
    }
    setProfile((data as Profile | null) ?? null);
    setProfileError(data ? null : PROFILE_ERROR_MESSAGE);
  }, []);

  const applySession = useCallback(
    async (next: Session | null) => {
      setSession(next);
      const nextUserId = next?.user.id ?? null;

      if (nextUserId === loadedUserId.current) {
        setLoading(false);
        return;
      }

      loadedUserId.current = nextUserId;
      if (!nextUserId) {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadProfile(nextUserId);
      setLoading(false);
    },
    [loadProfile]
  );

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      (async () => {
        await applySession(next);
      })();
    });

    return () => subscription.subscription.unsubscribe();
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? describeAuthError(error) : null };
  }, []);

  const signUp = useCallback(async ({ fullName, email, phone, password }: SignUpInput) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    return { error: error ? describeAuthError(error) : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = loadedUserId.current;
    if (userId) await loadProfile(userId);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, profileError, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
