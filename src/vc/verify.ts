/**
 * Verifiable Credential verification module.
 * Verifies W3C Verifiable Credentials with Ed25519 Signature 2020 proofs.
 * 
 * Also checks trust registry for issuer authorization and resolves
 * W3C StatusList2021 revocation and suspension lists.
 */

import * as ed from "@noble/ed25519";
import { v4 as uuidv4 } from "uuid";
import { base58btc } from "multiformats/bases/base58";
import * as didRegistry from "../did/index.js";
import * as trustRegistry from "../trust/registry.js";
import * as db from "../db/metadata.js";
import { checkStatusBit } from "./statuslist.js";
import type { VerifiableCredentialWithProof, Proof } from "./issue.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerificationResult {
  verified: boolean;
  checks: VerificationCheck[];
  credentialId: string;
  issuerDID: string;
  subjectDID: string;
  timestamp: string;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface VerifyOptions {
  verifierDID?: string;
  checkTrustRegistry?: boolean;
  requiredCredentialTypes?: string[];
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Verify a Verifiable Credential.
 * Runs multiple checks: proof signature, issuer DID resolution, 
 * expiration, trust registry authorization, and status list revocation.
 */
export async function verifyCredential(
  credential: VerifiableCredentialWithProof,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];
  const { verifierDID, checkTrustRegistry = false, requiredCredentialTypes } = options;

  // 1. Structural validation
  checks.push(validateStructure(credential));

  // 2. Expiration check
  checks.push(checkExpiration(credential));

  // 3. Resolve issuer DID
  const issuerCheck = await resolveIssuerDID(credential);
  checks.push(issuerCheck);

  // 4. Verify proof signature
  if (issuerCheck.passed) {
    const proofCheck = await verifyProof(credential);
    checks.push(proofCheck);
  } else {
    checks.push({
      name: "proof-signature",
      passed: false,
      message: "Skipped: unable to resolve issuer DID",
    });
  }

  // 5. Trust registry check (optional)
  if (checkTrustRegistry) {
    const trustCheck = checkTrustRegistryEntry(credential, requiredCredentialTypes);
    checks.push(trustCheck);
  }

  // 6. Schema check (optional)
  if (requiredCredentialTypes) {
    const typeCheck = checkRequiredTypes(credential, requiredCredentialTypes);
    checks.push(typeCheck);
  }

  // 7. Revocation StatusList2021 check (automatic if credentialStatus is present)
  checks.push(checkRevocationStatusList(credential));

  const verified = checks.every((c) => c.passed);

  // Log the verification
  const credentialRecord = db.getCredentialByCredentialId(credential.id);
  db.insertVerification({
    id: uuidv4(),
    credential_id: credential.id,
    verifier_did: verifierDID || null,
    verified,
    reason: verified ? "All checks passed" : checks.find((c) => !c.passed)?.message || "Verification failed",
  });

  return {
    verified,
    checks,
    credentialId: credential.id,
    issuerDID: credential.issuer,
    subjectDID: credential.credentialSubject.id,
    timestamp: new Date().toISOString(),
  };
}

// ─── Individual Checks ───────────────────────────────────────────────────────

function validateStructure(credential: VerifiableCredentialWithProof): VerificationCheck {
  if (!credential["@context"] || !Array.isArray(credential["@context"])) {
    return { name: "structure", passed: false, message: "Missing or invalid @context" };
  }
  if (!credential.id) {
    return { name: "structure", passed: false, message: "Missing credential id" };
  }
  if (!credential.type || !Array.isArray(credential.type)) {
    return { name: "structure", passed: false, message: "Missing or invalid type" };
  }
  if (!credential.type.includes("VerifiableCredential")) {
    return { name: "structure", passed: false, message: "type must include VerifiableCredential" };
  }
  if (!credential.issuer) {
    return { name: "structure", passed: false, message: "Missing issuer" };
  }
  if (!credential.credentialSubject || !credential.credentialSubject.id) {
    return { name: "structure", passed: false, message: "Missing credentialSubject.id" };
  }
  if (!credential.proof) {
    return { name: "structure", passed: false, message: "Missing proof" };
  }
  if (!credential.proof.proofValue) {
    return { name: "structure", passed: false, message: "Missing proofValue" };
  }
  return { name: "structure", passed: true, message: "Credential structure is valid" };
}

function checkExpiration(credential: VerifiableCredentialWithProof): VerificationCheck {
  if (!credential.expirationDate) {
    return { name: "expiration", passed: true, message: "No expiration date (credential does not expire)" };
  }

  const expiration = new Date(credential.expirationDate);
  const now = new Date();

  if (isNaN(expiration.getTime())) {
    return { name: "expiration", passed: false, message: "Invalid expiration date format" };
  }

  if (expiration < now) {
    return { name: "expiration", passed: false, message: `Credential expired on ${credential.expirationDate}` };
  }

  return { name: "expiration", passed: true, message: `Credential valid until ${credential.expirationDate}` };
}

async function resolveIssuerDID(credential: VerifiableCredentialWithProof): Promise<VerificationCheck> {
  const didDoc = await didRegistry.resolveDID(credential.issuer);

  if (!didDoc) {
    return { name: "issuer-did", passed: false, message: `Unable to resolve issuer DID: ${credential.issuer}` };
  }

  if (!didDoc.verificationMethod || didDoc.verificationMethod.length === 0) {
    return { name: "issuer-did", passed: false, message: "Issuer DID document has no verification methods" };
  }

  return { name: "issuer-did", passed: true, message: `Issuer DID resolved: ${credential.issuer}` };
}

async function verifyProof(credential: VerifiableCredentialWithProof): Promise<VerificationCheck> {
  try {
    const { proof } = credential;

    // Extract the public key from the issuer's DID document
    const didDoc = await didRegistry.resolveDID(credential.issuer);
    if (!didDoc || !didDoc.verificationMethod || didDoc.verificationMethod.length === 0) {
      return { name: "proof-signature", passed: false, message: "Cannot verify proof: no verification method found" };
    }

    // Find the matching verification method
    const vm = didDoc.verificationMethod.find((m) => m.id === proof.verificationMethod);
    if (!vm) {
      return { name: "proof-signature", passed: false, message: `Verification method ${proof.verificationMethod} not found in DID document` };
    }

    // Decode the public key directly from the matching verification method
    const publicKey = didRegistry.getPublicKeyFromVerificationMethod(vm);
    if (!publicKey || publicKey.length !== 32) {
      return { name: "proof-signature", passed: false, message: `Could not extract valid public key from verification method: ${proof.verificationMethod}` };
    }

    // Decode the proof value (already has 'z' multibase prefix from base58btc.encode)
    const proofValue = proof.proofValue;
    let signature: Uint8Array;
    if (proofValue.startsWith("z")) {
      signature = base58btc.decode(proofValue as `z${string}`);
    } else {
      // Some implementations may not include the prefix
      signature = base58btc.decode(`z${proofValue}` as `z${string}`);
    }

    // Rebuild the canonical data to verify
    const proofOptions = {
      "@context": credential["@context"],
      type: proof.type,
      created: proof.created,
      verificationMethod: proof.verificationMethod,
      proofPurpose: proof.proofPurpose,
    };

    // Build the credential data (without proof)
    const { proof: _, ...credentialData } = credential;
    const dataToVerify = {
      ...proofOptions,
      credential: credentialData,
    };

    // Deterministic serialization
    const canonicalData = deterministicStringify(dataToVerify);

    // Hash
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalData)
    );
    const hash = new Uint8Array(hashBuffer);

    // Verify the signature
    const isValid = await ed.verifyAsync(signature, hash, publicKey);

    if (isValid) {
      return { name: "proof-signature", passed: true, message: "Proof signature is valid" };
    } else {
      return { name: "proof-signature", passed: false, message: "Proof signature is invalid" };
    }
  } catch (err: any) {
    return { name: "proof-signature", passed: false, message: `Proof verification error: ${err.message}` };
  }
}

function checkTrustRegistryEntry(
  credential: VerifiableCredentialWithProof,
  requiredTypes?: string[]
): VerificationCheck {
  const entry = trustRegistry.getTrustedIssuer(credential.issuer);

  if (!entry) {
    return { name: "trust-registry", passed: false, message: `Issuer ${credential.issuer} is not in the trust registry` };
  }

  if (entry.status !== "active") {
    return { name: "trust-registry", passed: false, message: `Issuer ${credential.issuer} is ${entry.status} in the trust registry` };
  }

  // Check if the issuer is authorized for the credential types
  if (requiredTypes && requiredTypes.length > 0) {
    const authorizedTypes: string[] = entry.authorizedCredentialTypes || [];
    const hasAllTypes = requiredTypes.every((t) => authorizedTypes.includes(t));
    if (!hasAllTypes) {
      return { name: "trust-registry", passed: false, message: `Issuer not authorized for required credential types: ${requiredTypes.join(", ")}` };
    }
  }

  return { name: "trust-registry", passed: true, message: `Issuer ${credential.issuer} is trusted (${entry.name})` };
}

function checkRequiredTypes(
  credential: VerifiableCredentialWithProof,
  requiredTypes: string[]
): VerificationCheck {
  const hasAll = requiredTypes.every((t) => credential.type.includes(t));
  if (hasAll) {
    return { name: "required-types", passed: true, message: `Credential includes all required types: ${requiredTypes.join(", ")}` };
  }
  return { name: "required-types", passed: false, message: `Credential is missing required types. Has: ${credential.type.join(", ")}. Needs: ${requiredTypes.join(", ")}` };
}

function checkRevocationStatusList(credential: VerifiableCredentialWithProof): VerificationCheck {
  const status = credential.credentialStatus as any;
  if (!status) {
    return { name: "revocation-statuslist", passed: true, message: "No credentialStatus field present (not tracked via StatusList)" };
  }

  if (status.type !== "StatusList2021Entry") {
    return { name: "revocation-statuslist", passed: true, message: `Status tracked via unsupported type: ${status.type}` };
  }

  try {
    const listCredentialUrl = status.statusListCredential;
    const index = parseInt(status.statusListIndex, 10);

    if (isNaN(index)) {
      return { name: "revocation-statuslist", passed: false, message: `Invalid statusListIndex: ${status.statusListIndex}` };
    }

    // Extract listId from statusListCredential URL (the last segment of the path)
    const urlParts = listCredentialUrl.split("/");
    const listId = urlParts[urlParts.length - 1];

    if (!listId) {
      return { name: "revocation-statuslist", passed: false, message: `Could not parse listId from statusListCredential URL: ${listCredentialUrl}` };
    }

    const isRevoked = checkStatusBit(listId, index);
    if (isRevoked) {
      return { name: "revocation-statuslist", passed: false, message: `Credential has been revoked (StatusList index ${index} is 1)` };
    }

    return { name: "revocation-statuslist", passed: true, message: `Credential status is active (StatusList index ${index} is 0)` };
  } catch (err: any) {
    return { name: "revocation-statuslist", passed: false, message: `Failed to verify status list revocation: ${err.message}` };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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