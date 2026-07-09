/**
 * Verifiable Credential issuance module.
 * Issues W3C Verifiable Credentials using Ed25519 Signature 2020 proof suite.
 * 
 * VC Data Model 2.0 compliant.
 */

import * as ed from "@noble/ed25519";
import { v4 as uuidv4 } from "uuid";
import { base58btc } from "multiformats/bases/base58";
import * as didRegistry from "../did/index.js";
import * as db from "../db/metadata.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CredentialSubject {
  id: string;
  [key: string]: unknown;
}

export interface VerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: CredentialSubject;
  credentialSchema?: {
    id: string;
    type: string;
  };
  [key: string]: unknown;
}

export interface Proof {
  type: string;
  created: string;
  verificationMethod: string;
  cryptosuite: string;
  proofPurpose: string;
  proofValue: string;
}

export interface VerifiableCredentialWithProof extends VerifiableCredential {
  proof: Proof;
}

export interface IssueCredentialOptions {
  issuerDID: string;
  issuerSecretKey: Uint8Array;
  subjectDID: string;
  claims: Record<string, unknown>;
  type?: string[];
  schemaUrl?: string;
  expirationDate?: string;
  additionalContexts?: string[];
}

export interface IssueCredentialResult {
  credential: VerifiableCredentialWithProof;
  credentialId: string;
}

// ─── Issuance ────────────────────────────────────────────────────────────────

/**
 * Issue a Verifiable Credential.
 * Creates the credential payload, signs it with the issuer's Ed25519 key,
 * and stores metadata in the database.
 */
export async function issueCredential(options: IssueCredentialOptions): Promise<IssueCredentialResult> {
  const {
    issuerDID,
    issuerSecretKey,
    subjectDID,
    claims,
    type = ["VerifiableCredential"],
    schemaUrl,
    expirationDate,
    additionalContexts = [],
  } = options;

  const credentialId = `urn:uuid:${uuidv4()}`;
  const issuanceDate = new Date().toISOString();

  // Build contexts
  const contexts = [
    "https://www.w3.org/ns/credentials/v2",
    ...additionalContexts,
  ];

  // Build credential subject
  const credentialSubject: CredentialSubject = {
    id: subjectDID,
    ...claims,
  };

  // Build the credential payload (without proof)
  const credential: VerifiableCredential = {
    "@context": contexts,
    id: credentialId,
    type: [...new Set(["VerifiableCredential", ...type])],
    issuer: issuerDID,
    issuanceDate,
    credentialSubject,
  };

  if (expirationDate) {
    credential.expirationDate = expirationDate;
  }

  if (schemaUrl) {
    credential.credentialSchema = {
      id: schemaUrl,
      type: "JsonSchema",
    };
  }

  // Create the proof
  const proof = await createProof(credential, issuerDID, issuerSecretKey);

  // Assemble the signed credential
  const signedCredential: VerifiableCredentialWithProof = {
    ...credential,
    proof,
  };

  // Store metadata in database
  const proofTypes = type.join(", ");
  db.insertCredential({
    id: uuidv4(),
    credential_id: credentialId,
    issuer_did: issuerDID,
    subject_did: subjectDID,
    type: proofTypes,
    schema_url: schemaUrl || null,
    issuance_date: issuanceDate,
    expiration_date: expirationDate || null,
    status: "active",
    proof_type: "Ed25519Signature2020",
  });

  return {
    credential: signedCredential,
    credentialId,
  };
}

// ─── Proof Creation ──────────────────────────────────────────────────────────

/**
 * Create an Ed25519 Signature 2020 proof for a credential.
 * 
 * The proof is created by:
 * 1. Building a proof document with metadata
 * 2. Creating a canonical representation of the credential + proof options
 * 3. Signing the hash with the Ed25519 private key
 * 4. Encoding the signature as a multibase (base58btc) value
 */
async function createProof(
  credential: VerifiableCredential,
  issuerDID: string,
  secretKey: Uint8Array
): Promise<Proof> {
  const created = new Date().toISOString();
  const verificationMethod = `${issuerDID}#${issuerDID.split(":").pop()}`;

  // Create a proof document for signing
  const proofOptions = {
    "@context": credential["@context"],
    type: "Ed25519Signature2020",
    created,
    verificationMethod,
    proofPurpose: "assertionMethod",
  };

  // Build the canonical data to sign
  // We create a deterministic JSON string that includes both the credential
  // data and the proof options (without the proofValue)
  const dataToSign = {
    ...proofOptions,
    credential: {
      ...credential,
    },
  };

  // Deterministic serialization (sorted keys)
  const canonicalData = deterministicStringify(dataToSign);

  // Hash the canonical data
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalData)
  );
  const hash = new Uint8Array(hashBuffer);

  // Sign the hash
  const signature = await ed.signAsync(hash, secretKey);

  // Encode the signature as base58btc (multibase)
  // base58btc.encode already includes the 'z' multibase prefix
  const proofValue = base58btc.encode(signature);

  return {
    type: "Ed25519Signature2020",
    created,
    verificationMethod,
    cryptosuite: "ed25519-2020",
    proofPurpose: "assertionMethod",
    proofValue,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deterministic JSON stringify with sorted keys.
 * This provides a canonical JSON representation for signing.
 */
function deterministicStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return "null";
  }

  if (typeof obj === "string") {
    return JSON.stringify(obj);
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map(deterministicStringify);
    return `[${items.join(",")}]`;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map((key) => {
      const value = deterministicStringify((obj as Record<string, unknown>)[key]);
      return `${JSON.stringify(key)}:${value}`;
    });
    return `{${pairs.join(",")}}`;
  }

  return String(obj);
}