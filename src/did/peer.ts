/**
 * W3C did:peer Method 2 & Method 3 Implementation.
 *
 * Peer DIDs are completely offline, self-certifying, private identifiers used to establish
 * secure DIDComm peer channels without resolving on any public registry.
 *
 * Specification:
 * - https://identity.foundation/peer-did-method-spec/
 */

import { v4 as uuidv4 } from "uuid";
import { base58btc } from "multiformats/bases/base58";
import type { DIDDocument, VerificationMethod } from "./key.js";

const ED25519_PUBLIC_KEY_PREFIX = new Uint8Array([0xed, 0x01]);
const X25519_PUBLIC_KEY_PREFIX = new Uint8Array([0xec, 0x01]);

// ─── did:peer Method 2 (Multiple Elements) ───────────────────────────────────

export interface GeneratePeerDIDOptions {
  signingPublicKey: Uint8Array;
  encryptionPublicKey: Uint8Array;
  serviceEndpoint: string;
}

/**
 * Generate a peer DID using Method 2 (multiple elements - keys and services).
 * Formatted as: did:peer:2.E<encKey>.V<signKey>.S<serviceEndpoint>
 */
export function generatePeerDIDMethod2(options: GeneratePeerDIDOptions): string {
  const { signingPublicKey, encryptionPublicKey, serviceEndpoint } = options;

  // Encode signing key (prefix .V)
  const signEncoded = new Uint8Array(ED25519_PUBLIC_KEY_PREFIX.length + signingPublicKey.length);
  signEncoded.set(ED25519_PUBLIC_KEY_PREFIX);
  signEncoded.set(signingPublicKey, ED25519_PUBLIC_KEY_PREFIX.length);
  const signMultibase = base58btc.encode(signEncoded);

  // Encode encryption key (prefix .E)
  const encEncoded = new Uint8Array(X25519_PUBLIC_KEY_PREFIX.length + encryptionPublicKey.length);
  encEncoded.set(X25519_PUBLIC_KEY_PREFIX);
  encEncoded.set(encryptionPublicKey, X25519_PUBLIC_KEY_PREFIX.length);
  const encMultibase = base58btc.encode(encEncoded);

  // Encode service endpoint (prefix .S)
  const serviceObj = {
    t: "dm", // DIDCommMessaging service type abbreviation
    s: serviceEndpoint,
    a: ["didcomm/v2"]
  };
  const serviceBase64 = btoa(JSON.stringify(serviceObj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `did:peer:2.E${encMultibase}.V${signMultibase}.S${serviceBase64}`;
}

/**
 * Resolve a did:peer Method 2 identifier back to its DID Document.
 */
export function resolvePeerDIDMethod2(did: string): DIDDocument | null {
  if (!did.startsWith("did:peer:2.")) {
    return null;
  }

  const parts = did.slice("did:peer:2.".length).split(".");
  const verificationMethods: VerificationMethod[] = [];
  const authentication: string[] = [];
  const assertionMethod: string[] = [];
  const keyAgreement: string[] = [];
  const service: any[] = [];

  for (const part of parts) {
    const prefix = part[0];
    const value = part.slice(1);

    if (prefix === "V") {
      // Signing key
      const keyId = `${did}#key-1`;
      verificationMethods.push({
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        publicKeyMultibase: value
      });
      authentication.push(keyId);
      assertionMethod.push(keyId);
    } else if (prefix === "E") {
      // Encryption key
      const keyId = `${did}#key-agreement-1`;
      verificationMethods.push({
        id: keyId,
        type: "X25519KeyAgreementKey2020",
        controller: did,
        publicKeyMultibase: value
      });
      keyAgreement.push(keyId);
    } else if (prefix === "S") {
      // Service endpoint
      try {
        const decodedString = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
        const parsed = JSON.parse(decodedString);
        service.push({
          id: `${did}#didcomm-1`,
          type: parsed.t === "dm" ? "DIDCommMessaging" : parsed.t,
          serviceEndpoint: parsed.s,
          accept: parsed.a || ["didcomm/v2"]
        });
      } catch {
        // Parse error
      }
    }
  }

  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    id: did,
    verificationMethod: verificationMethods,
    authentication,
    assertionMethod,
    ...(keyAgreement.length ? { keyAgreement } : {}),
    ...(service.length ? { service } : {}) as any
  };
}
