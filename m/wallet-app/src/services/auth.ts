/**
 * Session management: login/register against the ORBIS backend,
 * JWT persistence in the device keychain, and logout/wipe.
 *
 * Social login (Google / Apple / Microsoft via expo-auth-session) plugs in
 * here in Phase 1 follow-up — see signInWithProvider stub below.
 */
import { api, type UserProfile } from '@/services/api';
import { SecureKeys, secureGet, secureSet, secureWipe } from '@/storage/secureStore';

export type SocialProvider = 'google' | 'apple' | 'microsoft';

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  const res = await api.auth.login({ email, password });
  await secureSet(SecureKeys.sessionToken, res.token);
  await secureSet(SecureKeys.userProfile, JSON.stringify(res.user));
  return res.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<UserProfile> {
  const res = await api.auth.register({ email, password, name });
  await secureSet(SecureKeys.sessionToken, res.token);
  await secureSet(SecureKeys.userProfile, JSON.stringify(res.user));
  return res.user;
}

/**
 * OAuth social login via expo-auth-session.
 * Requires provider client IDs (owner action) — wired in a follow-up task.
 */
export async function signInWithProvider(provider: SocialProvider): Promise<never> {
  throw new Error(
    `Social login (${provider}) is not configured yet — OAuth client IDs pending.`,
  );
}

export async function getStoredSession(): Promise<{ token: string; user: UserProfile } | null> {
  const token = await secureGet(SecureKeys.sessionToken);
  if (!token) return null;
  const rawProfile = await secureGet(SecureKeys.userProfile);
  if (!rawProfile) return null;
  try {
    return { token, user: JSON.parse(rawProfile) as UserProfile };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await secureWipe();
}
