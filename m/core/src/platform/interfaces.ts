/**
 * Platform abstraction interfaces.
 *
 * @orbis/wallet-core contains NO platform APIs. The native app (expo-secure-store,
 * expo-sqlite) and the PWA (WebCrypto+IndexedDB) implement these interfaces and
 * inject them. See wallet-specs/00-ARCHITECTURE.md §2.3.
 */

/** Secure key-value store. Native: expo-secure-store. PWA: wrapped-key IndexedDB store. */
export interface SecureKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** A stored vault row. All sensitive content lives in `payload` (ciphertext). */
export interface VaultRow {
  id: string;
  table: string;
  /** Plaintext metadata safe for list rendering (title, category, type…). */
  meta: Record<string, string | number | null>;
  /** AES-256-GCM ciphertext, base64. */
  payload: string;
  /** 12-byte IV, base64. */
  iv: string;
  updatedAt: string;
}

export interface VaultQuery {
  table: string;
  where?: Partial<Record<string, string | number>>;
  orderBy?: string;
  limit?: number;
}

/** Structured encrypted storage. Native: expo-sqlite. PWA: IndexedDB. */
export interface VaultStore {
  put(row: VaultRow): Promise<void>;
  get(table: string, id: string): Promise<VaultRow | null>;
  query(q: VaultQuery): Promise<VaultRow[]>;
  delete(table: string, id: string): Promise<void>;
  /** Destroy everything — used by remote wipe (WALLET_WIPED) and local reset. */
  wipeAll(): Promise<void>;
}

/** Time source — injectable for tests (grant expiry, auto-lock, token refresh). */
export interface Clock {
  now(): Date;
}

export const defaultClock: Clock = { now: () => new Date() };

/** Cryptographically secure randomness. */
export interface RandomSource {
  getRandomBytes(n: number): Uint8Array;
}

/** Default RandomSource backed by globalThis.crypto (Node 20+, browsers, RN with expo-crypto polyfill). */
export const defaultRandom: RandomSource = {
  getRandomBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (!c?.getRandomValues) {
      throw new Error(
        "No secure RNG available. On React Native, install the expo-crypto getRandomValues polyfill before importing @orbis/wallet-core.",
      );
    }
    c.getRandomValues(out);
    return out;
  },
};
