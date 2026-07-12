/**
 * Auth state machine for the wallet:
 *
 *   loading → onboarding (no session)
 *           → locked     (session exists, biometric unlock pending)
 *           → unlocked   (session + unlock complete)
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { UserProfile } from '@/services/api';
import {
  getStoredSession,
  loginWithEmail,
  logout as clearSession,
  registerWithEmail,
} from '@/services/auth';
import {
  authenticateWithBiometrics,
  isBiometricUnlockEnabled,
} from '@/services/biometrics';

export type AuthStatus = 'loading' | 'onboarding' | 'locked' | 'unlocked';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  unlock: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getStoredSession();
      if (cancelled) return;
      if (!session) {
        setStatus('onboarding');
        return;
      }
      setUser(session.user);
      const biometrics = await isBiometricUnlockEnabled();
      if (cancelled) return;
      setStatus(biometrics ? 'locked' : 'unlocked');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const profile = await loginWithEmail(email, password);
    setUser(profile);
    setStatus('unlocked');
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const profile = await registerWithEmail(email, password, name);
    setUser(profile);
    setStatus('unlocked');
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticateWithBiometrics();
    if (ok) setStatus('unlocked');
    return ok;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('onboarding');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, unlock, signOut }),
    [status, user, signIn, signUp, unlock, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
