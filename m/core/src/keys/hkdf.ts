/**
 * Key derivation for the wallet key hierarchy (wallet-specs/03-STORAGE-SCHEMA.md §1).
 *
 *   MWK (32B, SecureStore)
 *     ├─ HKDF "orbis/vault/<category>" → per-category Vault Data Key
 *     ├─ HKDF "orbis/messages"         → Message History Key
 *     └─ HKDF "orbis/backup"           → Backup Key
 */
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { mnemonicToSeedSync, entropyToMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import type { RandomSource } from "../platform/interfaces.js";

const HKDF_SALT = new TextEncoder().encode("orbis.id/wallet/v1");

/** Derive a 32-byte subkey from the MWK for a given purpose label. */
export function deriveKey(mwk: Uint8Array, info: string): Uint8Array {
  if (mwk.length !== 32) throw new Error("MWK must be 32 bytes");
  return hkdf(sha256, mwk, HKDF_SALT, new TextEncoder().encode(info), 32);
}

export const KeyInfo = {
  vault: (category: string) => `orbis/vault/${category}`,
  messages: "orbis/messages",
  backup: "orbis/backup",
  keyring: "orbis/keyring",
} as const;

/** Generate a fresh Master Wallet Key. */
export function generateMwk(random: RandomSource): Uint8Array {
  return random.getRandomBytes(32);
}

/** 12-word BIP-39 recovery phrase (128-bit entropy). */
export function generateRecoveryPhrase(random: RandomSource): string {
  return entropyToMnemonic(random.getRandomBytes(16), wordlist);
}

export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase(), wordlist);
}

/**
 * Deterministically derive the MWK from the recovery phrase.
 * Restore path: phrase → MWK → decrypt server-side ciphertext backups locally.
 */
export function mwkFromRecoveryPhrase(phrase: string): Uint8Array {
  if (!isValidRecoveryPhrase(phrase)) throw new Error("Invalid recovery phrase");
  const seed = mnemonicToSeedSync(phrase.trim().toLowerCase()); // 64 bytes
  return hkdf(sha256, seed, HKDF_SALT, new TextEncoder().encode("orbis/mwk"), 32);
}
