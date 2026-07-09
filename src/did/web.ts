/**
 * DID:web method implementation.
 * Generates did:web identifiers from domains and Ed25519 key pairs.
 * 
 * did:web format: did:web:<domain>[:<path>]
 * The DID Document is served at:
 * - https://<domain>/.well-known/did.json (for did:web:<domain>)
 * - https://<domain>/<path>/did.json (for did:web:<domain>:<path>)
 */

import { v4 as uuidv4 } from "uuid";
import * as ed from "@noble/ed25519";
import { base58btc } from "multiformats/bases/base58";
import type { DIDDocument, VerificationMethod, KeyPair } from "./key.js";

const ED25519_PUBLIC_KEY_PREFIX = new Uint8Array([0xed, 0x01]);

export interface DIDWebOptions {
  domain: string;
  path?: string;
  port?: number;
}

export interface DIDWebResult {
  did: string;
  keyPair: KeyPair;
  verificationMethodId: string;
  didDocument: DIDDocument;
  didJsonUrl: string;
}

/**
 * Generate a new Ed25519 key pair and create a did:web identifier.
 */
export async function generateDIDWeb(options: DIDWebOptions): Promise<DIDWebResult> {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  return buildDIDWebResult(secretKey, publicKey, options);
}

/**
 * Create a did:web from an existing key pair.
 */
export async function fromExistingKey(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  options: DIDWebOptions
): Promise<DIDWebResult> {
  return buildDIDWebResult(secretKey, publicKey, options);
}

function buildDIDWebResult(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  options: DIDWebOptions
): DIDWebResult {
  const { domain, path } = options;

  // Build the DID identifier
  let didIdentifier = domain;
  if (path) {
    didIdentifier = `${domain}:${path.replace(/\//g, ":")}`;
  }
  const did = `did:web:${didIdentifier}`;

  // Generate a unique key ID
  const keyId = uuidv4();
  const verificationMethodId = `${did}#${keyId}`;

  // Encode the public key in multibase
  const encoded = new Uint8Array(ED25519_PUBLIC_KEY_PREFIX.length + publicKey.length);
  encoded.set(ED25519_PUBLIC_KEY_PREFIX);
  encoded.set(publicKey, ED25519_PUBLIC_KEY_PREFIX.length);
  const publicKeyMultibase = base58btc.encode(encoded);

  const verificationMethod: VerificationMethod = {
    id: verificationMethodId,
    type: "Ed25519VerificationKey2020",
    controller: did,
    publicKeyMultibase: `z${publicKeyMultibase}`,
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

  // Build the URL where the DID Document would be hosted
  let didJsonUrl: string;
  if (path) {
    didJsonUrl = `https://${domain}/${path}/did.json`;
  } else {
    didJsonUrl = `https://${domain}/.well-known/did.json`;
  }

  return {
    did,
    keyPair: { secretKey, publicKey },
    verificationMethodId,
    didDocument,
    didJsonUrl,
  };
}

/**
 * Resolve a did:web to generate the expected DID Document.
 * Note: This constructs the document from the DID identifier itself.
 * Production use would fetch from the actual URL.
 */
export function resolveDIDWeb(did: string): {
  didDocument: DIDDocument | null;
  didJsonUrl: string | null;
} {
  if (!did.startsWith("did:web:")) {
    return { didDocument: null, didJsonUrl: null };
  }

  const identifier = did.slice("did:web:".length);
  const parts = identifier.split(":");

  // The first part is the domain
  const domain = parts[0]!;
  const path = parts.slice(1).join("/");

  let didJsonUrl: string;
  if (path) {
    didJsonUrl = `https://${domain}/${path}/did.json`;
  } else {
    didJsonUrl = `https://${domain}/.well-known/did.json`;
  }

  // Return a basic document structure (keys would come from the hosted file)
  const doc: DIDDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
    ],
    id: did,
    verificationMethod: [],
    authentication: [],
    assertionMethod: [],
  };

  return { didDocument: doc, didJsonUrl };
}