/**
 * Client-side vault encryption (spec 07 §0/§2, wallet-specs/03).
 *
 * Every vault record is encrypted ON DEVICE with a fresh per-record
 * AES-256-GCM key (AAD-bound to the record id) before anything reaches the
 * server — ORBIS stores ciphertext only. Per-record keys are wrapped under a
 * device-local vault master key held in the keychain, which is what makes
 * selective sharing possible: to share one record we seal just that record's
 * key for the grantee (ECDH-ES), never the master key, never other records.
 */
import {
  decryptJson,
  encryptJson,
  generateRecordKey,
  makeAad,
  sealKeyForRecipient,
  unwrapKey,
  wrapKey,
  type Encrypted,
} from '@orbis/wallet-core';
import { base64 } from '@scure/base';

import { rnRandom } from '@/services/random';
import {
  SecureKeys,
  VAULT_RECORD_KEY_PREFIX,
  secureDeleteRaw,
  secureGet,
  secureGetRaw,
  secureSet,
  secureSetRaw,
} from '@/storage/secureStore';

/** AAD context — binds ciphertext to "vault record <id>", blocking transplantation. */
const AAD_CONTEXT = 'vault-record';

/** Structured plaintext payload stored inside every vault record. */
export interface VaultRecordPayload {
  kind: 'note' | 'fields' | 'image' | 'file';
  /** Freeform body for `note` records. */
  note?: string;
  /** Key/value pairs for `fields` records (and optional extras on others). */
  fields?: Array<{ key: string; value: string }>;
  /** base64 content for `image` / `file` records. */
  dataBase64?: string;
  mime?: string;
  fileName?: string;
}

async function getMasterKey(): Promise<Uint8Array> {
  const existing = await secureGet(SecureKeys.vaultMasterKey);
  if (existing) return base64.decode(existing);
  const key = rnRandom.getRandomBytes(32);
  await secureSet(SecureKeys.vaultMasterKey, base64.encode(key));
  return key;
}

async function getRecordKey(recordId: string): Promise<Uint8Array | null> {
  const wrapped = await secureGetRaw(`${VAULT_RECORD_KEY_PREFIX}${recordId}`);
  if (!wrapped) return null;
  const master = await getMasterKey();
  return unwrapKey(master, wrapped, `record/${recordId}`);
}

async function getOrCreateRecordKey(recordId: string): Promise<Uint8Array> {
  const existing = await getRecordKey(recordId);
  if (existing) return existing;
  const key = generateRecordKey(rnRandom);
  const master = await getMasterKey();
  await secureSetRaw(
    `${VAULT_RECORD_KEY_PREFIX}${recordId}`,
    wrapKey(master, key, rnRandom, `record/${recordId}`),
  );
  return key;
}

/** Encrypt a record payload for upload. Returns `{ciphertext, iv, alg}` (all base64). */
export async function encryptRecordPayload(
  recordId: string,
  payload: VaultRecordPayload,
): Promise<Encrypted> {
  const key = await getOrCreateRecordKey(recordId);
  return encryptJson(key, payload, rnRandom, makeAad(recordId, AAD_CONTEXT));
}

/**
 * Decrypt a record fetched from the server.
 * Throws when the per-record key is missing on this device or the ciphertext
 * fails authentication — callers render the spec's decrypt-failure state.
 */
export async function decryptRecordPayload(
  recordId: string,
  enc: Encrypted,
): Promise<VaultRecordPayload> {
  const key = await getRecordKey(recordId);
  if (!key) throw new Error('RECORD_KEY_MISSING');
  return decryptJson<VaultRecordPayload>(key, enc, makeAad(recordId, AAD_CONTEXT));
}

/**
 * Seal this record's key for a grantee's X25519 public key (ECDH-ES).
 * The server relays the sealed key inside the grant but can never open it.
 */
export async function sealRecordKeyForRecipient(
  recordId: string,
  granteeX25519PublicKey: Uint8Array,
): Promise<string> {
  const key = await getRecordKey(recordId);
  if (!key) throw new Error('RECORD_KEY_MISSING');
  return sealKeyForRecipient(granteeX25519PublicKey, key, rnRandom);
}

/** Remove the local per-record key (after deleting the record server-side). */
export async function deleteRecordKey(recordId: string): Promise<void> {
  await secureDeleteRaw(`${VAULT_RECORD_KEY_PREFIX}${recordId}`);
}

/** Approximate ciphertext size (bytes) that a payload will produce once encrypted. */
export function estimateCiphertextBytes(payload: VaultRecordPayload): number {
  // GCM adds a 16-byte tag; JSON overhead is what it is — measure the JSON.
  return new TextEncoder().encode(JSON.stringify(payload)).length + 16;
}
