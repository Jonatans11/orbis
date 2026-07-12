/**
 * DID:key method implementation.
 * Generates Ed25519 key pairs and encodes them according to the did:key spec.
 * 
 * did:key format: did:key:z<multibase-b58btc(multicodec-ed25519-pub + raw-pubkey)>
 * - Multicodec prefix for Ed25519 public key: 0xed (1 byte)
 * - Encoded in base58btc (multibase prefix 'z')
 */

import * as ed from "@noble/ed25519";
import { base58btc } from "multiformats/bases/base58";
import crypto from "node:crypto";

// Multicodec prefix for Ed25519 public key (varint encoding of 0xed)
const ED25519_PUBLIC_KEY_PREFIX = new Uint8Array([0xed, 0x01]);

export interface KeyPair {
  secretKey: Uint8Array;  // 32-byte seed
  publicKey: Uint8Array;  // 32-byte public key
}

export interface DIDKeyResult {
  did: string;
  keyPair: KeyPair;
  verificationMethodId: string;
  didDocument: DIDDocument;
}

export interface DIDDocument {
  "@context": string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

/**
 * Generate a new Ed25519 key pair and derive the did:key.
 */
export async function generateDIDKey(): Promise<DIDKeyResult> {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);

  return buildDIDKeyResult(secretKey, publicKey);
}

/**
 * Create a did:key from an existing Ed25519 key pair (e.g., imported seed).
 */
export async function fromSeed(seed: Uint8Array): Promise<DIDKeyResult> {
  const secretKey = seed.slice(0, 32);
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  return buildDIDKeyResult(secretKey, publicKey);
}

function buildDIDKeyResult(secretKey: Uint8Array, publicKey: Uint8Array): DIDKeyResult {
  // Encode: multicodec prefix + raw public key → base58btc
  const encoded = new Uint8Array(ED25519_PUBLIC_KEY_PREFIX.length + publicKey.length);
  encoded.set(ED25519_PUBLIC_KEY_PREFIX);
  encoded.set(publicKey, ED25519_PUBLIC_KEY_PREFIX.length);

  const publicKeyMultibase = base58btc.encode(encoded);
  const did = `did:key:${publicKeyMultibase}`;
  const verificationMethodId = `${did}#${publicKeyMultibase}`;

  const verificationMethod: VerificationMethod = {
    id: verificationMethodId,
    type: "Ed25519VerificationKey2020",
    controller: did,
    publicKeyMultibase,
  };

  const didDocument: DIDDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId],
  };

  return {
    did,
    keyPair: { secretKey, publicKey },
    verificationMethodId,
    didDocument,
  };
}

/**
 * Resolve a did:key to its DID Document.
 * Decodes the public key from the DID identifier and reconstructs the document.
 */
export function resolveDIDKey(did: string): DIDDocument | null {
  if (!did.startsWith("did:key:z")) {
    return null;
  }

  const multibaseKey = did.slice("did:key:".length); // e.g., "z6Mk..."
  const prefix = multibaseKey[0];
  if (prefix !== "z") return null;

  try {
    const decoded = base58btc.decode(multibaseKey as `z${string}`);

    // Verify it's an Ed25519 key (multicodec prefix 0xed01)
    if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
      return null;
    }

    const publicKey = decoded.slice(2); // Skip multicodec prefix
    if (publicKey.length !== 32) return null;

    const verificationMethodId = `${did}#${multibaseKey}`;

    const verificationMethod: VerificationMethod = {
      id: verificationMethodId,
      type: "Ed25519VerificationKey2020",
      controller: did,
      publicKeyMultibase: multibaseKey,
    };

    return {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1",
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [verificationMethodId],
      assertionMethod: [verificationMethodId],
      capabilityInvocation: [verificationMethodId],
      capabilityDelegation: [verificationMethodId],
    };
  } catch {
    return null;
  }
}

/**
 * Extract the raw public key bytes from a did:key identifier.
 */
export function extractPublicKey(did: string): Uint8Array | null {
  if (!did.startsWith("did:key:z")) return null;
  const multibaseKey = did.slice("did:key:".length);
  try {
    const decoded = base58btc.decode(multibaseKey as `z${string}`);
    if (decoded[0] !== 0xed || decoded[1] !== 0x01) return null;
    return decoded.slice(2);
  } catch {
    return null;
  }
}

/**
 * Get the public key bytes from a DID Document's verification method.
 */
export function getPublicKeyFromDocument(doc: DIDDocument): Uint8Array | null {
  const vm = doc.verificationMethod[0];
  if (!vm) return null;
  const mb = vm.publicKeyMultibase;
  if (!mb.startsWith("z")) return null;
  try {
    const decoded = base58btc.decode(mb as `z${string}`);
    // Skip multicodec prefix if present
    if (decoded[0] === 0xed && decoded[1] === 0x01) {
      return decoded.slice(2);
    }
    return decoded;
  } catch {
    return null;
  }
}

// ─── KMS Envelope Encryption ─────────────────────────────────────────────────

/**
 * Encapsulate a raw private key using envelope encryption (AES-256-GCM) with a master key.
 */
export function envelopeEncryptKey(
  rawKey: Uint8Array,
  masterKeyHex: string
): { ciphertext: string; iv: string; tag: string } {
  const masterKey = Buffer.from(masterKeyHex, "hex");
  if (masterKey.length !== 32) {
    throw new Error("Master key must be a 32-byte hex string (64 characters)");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(rawKey)),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex")
  };
}

/**
 * Decrypt an envelope-encrypted private key (AES-256-GCM) using a master key.
 */
export function envelopeDecryptKey(
  ciphertextHex: string,
  ivHex: string,
  tagHex: string,
  masterKeyHex: string
): Uint8Array {
  const masterKey = Buffer.from(masterKeyHex, "hex");
  if (masterKey.length !== 32) {
    throw new Error("Master key must be a 32-byte hex string (64 characters)");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return new Uint8Array(decrypted);
}