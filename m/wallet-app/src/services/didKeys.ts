/**
 * Grantee key resolution for sharing grants (spec 07 §4 step 1).
 *
 * Grants are DID-bound: the record key is sealed for the grantee's X25519
 * key-agreement key. If we can't find (or derive) one, sharing is blocked —
 * "This recipient's ID can't receive encrypted shares."
 */
import { edwardsToMontgomeryPub } from '@noble/curves/ed25519';
import { base58 } from '@scure/base';
import { ed25519PublicKeyFromDidKey, isDidKey } from '@orbis/wallet-core';

import { api } from '@/services/api';

const X25519_MULTICODEC: [number, number] = [0xec, 0x01];

interface VerificationMethod {
  id?: string;
  type?: string;
  publicKeyMultibase?: string;
  publicKeyBase58?: string;
}

interface DidDocumentish {
  keyAgreement?: Array<string | VerificationMethod>;
  verificationMethod?: VerificationMethod[];
}

function decodeX25519Multibase(encoded: string): Uint8Array | null {
  try {
    // base58btc multibase ('z' prefix) or bare base58.
    const raw = base58.decode(encoded.startsWith('z') ? encoded.slice(1) : encoded);
    if (
      raw.length === 34 &&
      raw[0] === X25519_MULTICODEC[0] &&
      raw[1] === X25519_MULTICODEC[1]
    ) {
      return raw.slice(2);
    }
    if (raw.length === 32) return raw;
    return null;
  } catch {
    return null;
  }
}

function extractFromMethod(vm: VerificationMethod): Uint8Array | null {
  if (vm.publicKeyMultibase) return decodeX25519Multibase(vm.publicKeyMultibase);
  if (vm.publicKeyBase58) return decodeX25519Multibase(vm.publicKeyBase58);
  return null;
}

/**
 * Resolve the X25519 key-agreement public key for a DID.
 * Returns null when the DID has no usable key-agreement key.
 */
export async function resolveGranteeX25519(did: string): Promise<Uint8Array | null> {
  // did:key (Ed25519): derive the X25519 key-agreement key per the did:key
  // spec (birationally equivalent Montgomery form) — no network needed.
  if (isDidKey(did)) {
    try {
      return edwardsToMontgomeryPub(ed25519PublicKeyFromDidKey(did));
    } catch {
      return null;
    }
  }

  // Otherwise resolve the DID document and scan keyAgreement.
  try {
    const { didDocument } = await api.did.resolve(did);
    const doc = didDocument as DidDocumentish;
    const methods = doc.verificationMethod ?? [];
    for (const entry of doc.keyAgreement ?? []) {
      const vm =
        typeof entry === 'string' ? methods.find((m) => m.id === entry) : entry;
      if (!vm) continue;
      const key = extractFromMethod(vm);
      if (key) return key;
    }
    // Some resolvers omit keyAgreement but expose an X25519 verification method.
    for (const vm of methods) {
      if (vm.type?.includes('X25519')) {
        const key = extractFromMethod(vm);
        if (key) return key;
      }
    }
    return null;
  } catch {
    return null;
  }
}
