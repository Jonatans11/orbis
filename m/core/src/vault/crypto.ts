/**
 * Authenticated encryption for all wallet data at rest, and key wrapping.
 * AES-256-GCM (12-byte random IV, never reused; AAD binds context).
 * See wallet-specs/03-STORAGE-SCHEMA.md.
 */
import { gcm } from "@noble/ciphers/aes";
import { base64 } from "@scure/base";
import type { RandomSource } from "../platform/interfaces.js";

export interface Encrypted {
  /** base64 ciphertext (includes GCM tag). */
  ciphertext: string;
  /** base64 12-byte IV. */
  iv: string;
  alg: "A256GCM";
}

const utf8 = new TextEncoder();

/** AAD binding: recordId|context|version — prevents ciphertext transplantation. */
export function makeAad(recordId: string, context: string, version = 1): Uint8Array {
  return utf8.encode(`${recordId}|${context}|v${version}`);
}

export function encryptBytes(
  key: Uint8Array,
  plaintext: Uint8Array,
  random: RandomSource,
  aad?: Uint8Array,
): Encrypted {
  if (key.length !== 32) throw new Error("AES-256-GCM key must be 32 bytes");
  const iv = random.getRandomBytes(12);
  const ct = gcm(key, iv, aad).encrypt(plaintext);
  return { ciphertext: base64.encode(ct), iv: base64.encode(iv), alg: "A256GCM" };
}

export function decryptBytes(key: Uint8Array, enc: Encrypted, aad?: Uint8Array): Uint8Array {
  const iv = base64.decode(enc.iv);
  const ct = base64.decode(enc.ciphertext);
  return gcm(key, iv, aad).decrypt(ct); // throws on tamper / wrong key / wrong AAD
}

export function encryptJson(
  key: Uint8Array,
  value: unknown,
  random: RandomSource,
  aad?: Uint8Array,
): Encrypted {
  return encryptBytes(key, utf8.encode(JSON.stringify(value)), random, aad);
}

export function decryptJson<T = unknown>(key: Uint8Array, enc: Encrypted, aad?: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(decryptBytes(key, enc, aad))) as T;
}

/** Fresh per-record key. Per-record keys are what make selective sharing possible. */
export function generateRecordKey(random: RandomSource): Uint8Array {
  return random.getRandomBytes(32);
}

/** Wrap (encrypt) a key under a wrapping key. Compact string form for storage columns. */
export function wrapKey(
  wrappingKey: Uint8Array,
  keyToWrap: Uint8Array,
  random: RandomSource,
  context: string,
): string {
  const enc = encryptBytes(wrappingKey, keyToWrap, random, utf8.encode(`orbis/wrap/${context}`));
  return `${enc.iv}.${enc.ciphertext}`;
}

export function unwrapKey(wrappingKey: Uint8Array, wrapped: string, context: string): Uint8Array {
  const [iv, ciphertext] = wrapped.split(".");
  if (!iv || !ciphertext) throw new Error("Malformed wrapped key");
  return decryptBytes(
    wrappingKey,
    { iv, ciphertext, alg: "A256GCM" },
    utf8.encode(`orbis/wrap/${context}`),
  );
}
