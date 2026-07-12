/**
 * Cryptographically secure randomness for @orbis/wallet-core on React Native.
 * expo-crypto backs this with the OS CSPRNG (SecRandomCopyBytes / SecureRandom).
 */
import * as Crypto from 'expo-crypto';
import type { RandomSource } from '@orbis/wallet-core';

export const rnRandom: RandomSource = {
  getRandomBytes(n: number): Uint8Array {
    return Crypto.getRandomBytes(n);
  },
};

/** RFC-4122 v4 UUID (used for client-generated vault record ids). */
export function randomUUID(): string {
  return Crypto.randomUUID();
}
