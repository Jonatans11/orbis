/**
 * Secure keychain storage wrapper (expo-secure-store).
 *
 * Everything sensitive — JWTs, DID private keys, biometric preferences —
 * goes through this module so security policy lives in one place.
 * Values are stored in the iOS Keychain / Android Keystore-backed storage.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const SecureKeys = {
  /** ORBIS backend session token (JWT). */
  sessionToken: 'orbis.session.token',
  /** Serialized user profile for fast unlock rendering. */
  userProfile: 'orbis.session.profile',
  /** Whether the user enabled biometric unlock. */
  biometricsEnabled: 'orbis.security.biometrics',
  /** Primary DID for this wallet. */
  primaryDid: 'orbis.did.primary',
  /** DID private key material (JSON, per-DID). Never leaves the device. */
  didKeys: 'orbis.did.keys',
  /** Expo push token registered with the backend. */
  pushToken: 'orbis.push.token',
} as const;

type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];

// SecureStore is unavailable on web — fall back to in-memory storage there.
// The PWA at /m has its own storage strategy; the native app is the target.
const memoryFallback = new Map<string, string>();
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function secureGet(key: SecureKey): Promise<string | null> {
  if (!isNative) return memoryFallback.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: SecureKey, value: string): Promise<void> {
  if (!isNative) {
    memoryFallback.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secureDelete(key: SecureKey): Promise<void> {
  if (!isNative) {
    memoryFallback.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/** Wipe all wallet secrets (logout / remote wipe). */
export async function secureWipe(): Promise<void> {
  await Promise.all(
    Object.values(SecureKeys).map((key) => secureDelete(key as SecureKey)),
  );
}
