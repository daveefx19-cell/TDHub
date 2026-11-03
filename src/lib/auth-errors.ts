import type { AuthError } from '@supabase/supabase-js';

export function describeAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'The email or password you entered is incorrect.';
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (message.includes('password') && message.includes('least')) {
    return 'Your password must be at least 8 characters long.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (error.status === undefined || message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
