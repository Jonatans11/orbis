/**
 * Key generation, signing, and key agreement.
 * Ed25519 for signing (DIDs, VCs, presentations); X25519 for key agreement (sharing grants).
 * Pure TS via @noble/curves — identical behavior on RN, browser, and Node.
 * See wallet-specs/03-STORAGE-SCHEMA.md §1.
 */
import { ed25519, x25519 } from "@noble/curves/ed25519";
import type { RandomSource } from "../platform/interfaces.js";

export type KeyType = "ed25519" | "x25519";

export interface KeyPair {
  type: KeyType;
  /** 32-byte secret seed/scalar. NEVER serialized except MWK-wrapped (see wrap.ts). */
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateEd25519(random: RandomSource): KeyPair {
  const secretKey = random.getRandomBytes(32);
  return { type: "ed25519", secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

export function generateX25519(random: RandomSource): KeyPair {
  const secretKey = random.getRandomBytes(32);
  return { type: "x25519", secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

export function ed25519PublicKeyFromSeed(seed: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(seed);
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, secretKey);
}

export function verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** X25519 ECDH shared secret (32 bytes). Feed through HKDF before use as a key. */
export function sharedSecret(mySecretKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(mySecretKey, theirPublicKey);
}
