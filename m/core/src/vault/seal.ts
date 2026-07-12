/**
 * ECDH-ES key sealing for sharing grants (wallet-specs/02-API-SPEC.md §4).
 *
 * To share a vault record: wrap its Record Key for the grantee's X25519 key.
 * The server relays the sealed key but can never open it.
 *
 *   seal:  ephemeral X25519 pair → ECDH(eph.sk, recipient.pk) → HKDF → AES-256-GCM wrap
 *   open:  ECDH(recipient.sk, eph.pk) → HKDF → AES-256-GCM unwrap
 */
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { base64 } from "@scure/base";
import { generateX25519, sharedSecret } from "../keys/keygen.js";
import { encryptBytes, decryptBytes } from "./crypto.js";
import type { RandomSource } from "../platform/interfaces.js";

const SEAL_INFO = new TextEncoder().encode("orbis/grant-seal/v1");
const SEAL_AAD = new TextEncoder().encode("orbis/grant/v1");

/** Compact sealed-key format: base64(epk).base64(iv).base64(ct) */
export function sealKeyForRecipient(
  recipientX25519PublicKey: Uint8Array,
  keyToSeal: Uint8Array,
  random: RandomSource,
): string {
  const eph = generateX25519(random);
  const ss = sharedSecret(eph.secretKey, recipientX25519PublicKey);
  const kek = hkdf(sha256, ss, eph.publicKey, SEAL_INFO, 32);
  const enc = encryptBytes(kek, keyToSeal, random, SEAL_AAD);
  eph.secretKey.fill(0);
  return `${base64.encode(eph.publicKey)}.${enc.iv}.${enc.ciphertext}`;
}

export function openSealedKey(recipientX25519SecretKey: Uint8Array, sealed: string): Uint8Array {
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("Malformed sealed key");
  const [epkB64, iv, ciphertext] = parts as [string, string, string];
  const epk = base64.decode(epkB64);
  const ss = sharedSecret(recipientX25519SecretKey, epk);
  const kek = hkdf(sha256, ss, epk, SEAL_INFO, 32);
  return decryptBytes(kek, { iv, ciphertext, alg: "A256GCM" }, SEAL_AAD);
}
