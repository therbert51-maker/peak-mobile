import type { AuthError, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    next: string;
  }) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  sendPasswordReset: (
    email: string,
    next: string,
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    next: string;
  }) => {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const displayName = `${firstName} ${lastName}`.trim();
    const emailRedirectTo = Linking.createURL('auth/callback', {
      queryParams: { next: input.next },
    });
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
        },
      },
    });

    return {
      error,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const sendPasswordReset = useCallback(async (email: string, next: string) => {
    const redirectTo = Linking.createURL('auth/callback', {
      queryParams: {
        next: '/reset-password',
        returnTo: next,
      },
    });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
    }
    return { error };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      sendPasswordReset,
      signOut,
    }),
    [session, loading, signIn, signUp, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function formatAuthError(error: AuthError | null): string {
  if (!error) return 'Something went wrong. Please try again.';
  return error.message;
}
