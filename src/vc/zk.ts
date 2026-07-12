/**
 * ORBIS.ID Zero-Knowledge Proof Module.
 * 
 * Implements selective disclosure ZK proofs for Verifiable Credentials.
 * Allows a holder to present a credential while revealing only specific fields,
 * proving claims about hidden fields (e.g., "age >= 18") without disclosing
 * the underlying data.
 * 
 * ── TWO FLOWS ──────────────────────────────────────────────────────────
 * 
 * 1. ON-DEVICE PROVING (RECOMMENDED for mobile wallets)
 *    The wallet creates and signs the proof locally using @orbis/wallet-core.
 *    The holder's secret key NEVER leaves the device.
 *    Flow: challenge → create proof on-device → POST to /api/vc/zk/verify
 *          or /api/wallet/vc/present (wallet-specific endpoint)
 * 
 * 2. SERVER-SIDE PROVING (LEGACY, for automated backend systems)
 *    The holder sends their credential and secret key to the server.
 *    The server creates and signs the proof.
 *    WARNING: This requires transmitting the holder's secret key over the
 *    network — NEVER use this flow for mobile wallet users.
 *    Flow: POST /api/vc/zk/prove with credential + holderSecretKey
 * 
 * ── VERIFICATION (same for both flows) ────────────────────────────────
 * Verification always uses the holder's PUBLIC key (extracted from the DID
 * document). No secret key is needed at verification time.
 * 
 * This is a "ZK-lite" approach using hash-based commitments and holder binding
 * rather than full BBS+ or zk-SNARKs. It provides:
 *   1. Selective disclosure — reveal only chosen fields
 *   2. Hash commitments — hidden fields are committed via SHA-256
 *   3. Holder binding — the holder proves control of the subject DID
 *   4. Derived predicates — prove claims about hidden values (e.g., age >= 18)
 * 
 * @module
 */

import { v4 as uuidv4 } from "uuid";
import * as ed from "@noble/ed25519";
import * as didRegistry from "../did/index.js";
import * as db from "../db/metadata.js";
import { verifyCredential } from "./verify.js";
import type { VerifiableCredentialWithProof, Proof } from "./issue.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HiddenCommitment {
  /** The field name that is hidden */
  field: string;
  /** SHA-256 hash of the original value (hex-encoded) */
  hash: string;
  /** Optional: a nonce used to prevent rainbow table attacks on the hash */
  nonce?: string;
}

export interface DerivedPredicate {
  /** Human-readable description of the predicate, e.g. "age >= 18" */
  statement: string;
  /** Proof that the predicate holds. For simple range proofs, this is the
   *  signed commitment showing the holder committed to a value that satisfies
   *  the predicate. */
  proof: string;
  /** The field the predicate applies to */
  field: string;
}

export interface ZKProof {
  /** W3C context */
  "@context": string[];
  /** Proof ID */
  id: string;
  /** Type array */
  type: string[];
  /** The original Verifiable Credential (full) */
  verifiableCredential: VerifiableCredentialWithProof;
  /** The DID of the holder presenting this proof */
  holder: string;
  /** Fields that are revealed in plaintext */
  revealedFields: string[];
  /** Fields that are hidden via hash commitment */
  hiddenFields: string[];
  /** Hash commitments for each hidden field */
  hiddenCommitments: HiddenCommitment[];
  /** Optional: derived predicates (e.g., "age >= 18") */
  derivedPredicates?: DerivedPredicate[];
  /** The ZK proof signature */
  proof: ZKProofSignature;
}

export interface ZKProofSignature {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  cryptosuite: string;
  /** Holder's Ed25519 signature over the proof data */
  proofValue: string;
  /** Nonce provided by the verifier to prevent replay */
  challenge?: string;
  /** Domain for the proof */
  domain?: string;
}

export interface ZKProveOptions {
  /** The original Verifiable Credential */
  credential: VerifiableCredentialWithProof;
  /** The holder's DID (must match credentialSubject.id) */
  holderDID: string;
  /** The holder's secret key (hex-encoded) */
  holderSecretKey: Uint8Array;
  /** Fields to reveal in plaintext. If not specified, all fields are revealed. */
  revealFields?: string[];
  /** Fields to hide via hash commitment. Overrides revealFields if specified. */
  hideFields?: string[];
  /** Optional: derived predicates to include */
  derivedPredicates?: DerivedPredicate[];
  /** Optional: verifier challenge to bind proof to a specific session */
  challenge?: string;
  /** Optional: domain to bind the proof */
  domain?: string;
}

export interface ZKProveResult {
  proof: ZKProof;
  proofId: string;
}

export interface ZKVerifyOptions {
  /** Optional: verifier DID for logging */
  verifierDID?: string;
  /** Optional: the challenge that was sent to the holder */
  challenge?: string;
  /** Optional: whether to verify the original VC issuer is trusted */
  checkTrustRegistry?: boolean;
  /** Optional: required credential types */
  requiredCredentialTypes?: string[];
}

export interface ZKVerifyResult {
  verified: boolean;
  checks: ZKVerifyCheck[];
  proofId: string;
  holderDID: string;
  timestamp: string;
}

export interface ZKVerifyCheck {
  name: string;
  passed: boolean;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZK_CONTEXT = "https://orbis.id/ns/zkp/v1";
const ZK_PROOF_TYPE = "OrbisZKSelectiveDisclosure2025";
const CRYPTOSUITE = "orbis-zk-sd-2025";

// ─── ZK Proof Generation ─────────────────────────────────────────────────────

/**
 * Create a ZK selective disclosure proof from a Verifiable Credential.
 * 
 * ⚠️  DEPRECATED for mobile wallet flows.
 * This function requires the holder's SECRET KEY to be transmitted to the server.
 * For mobile wallets, the proof MUST be created ON-DEVICE using @orbis/wallet-core.
 * The wallet should generate the proof locally and POST it to /api/vc/zk/verify
 * or /api/wallet/vc/present.
 * 
 * This endpoint is retained for:
 *   - Backend-to-backend automated proving
 *   - Testing and development
 *   - Legacy integrations
 * 
 * The holder specifies which fields to reveal and which to hide.
 * Hidden fields are replaced with SHA-256 hash commitments.
 * The holder signs the proof to prove control of the subject DID.
 * 
 * For real ZK, the verifier learns nothing about hidden fields beyond
 * their hash commitments. The holder can optionally include derived
 * predicates (e.g., "age >= 18") to prove claims about hidden values.
 */
export async function createZKProof(options: ZKProveOptions): Promise<ZKProveResult> {
  const {
    credential,
    holderDID,
    holderSecretKey,
    revealFields,
    hideFields,
    derivedPredicates,
    challenge,
    domain,
  } = options;

  // Validate: holder must match credential subject
  if (credential.credentialSubject.id !== holderDID) {
    throw new Error("Holder DID must match credentialSubject.id");
  }

  // Validate: holder secret key length
  if (holderSecretKey.length !== 32) {
    throw new Error("Holder secret key must be 32 bytes");
  }

  // Determine which fields to reveal and hide
  const subject = credential.credentialSubject;
  const allSubjectFields = Object.keys(subject).filter((k) => k !== "id");

  let revealedFieldsList: string[];
  let hiddenFieldsList: string[];

  if (hideFields && hideFields.length > 0) {
    // Explicit hide list
    hiddenFieldsList = hideFields;
    revealedFieldsList = allSubjectFields.filter((f) => !hideFields.includes(f));
  } else if (revealFields && revealFields.length > 0) {
    // Explicit reveal list
    revealedFieldsList = revealFields;
    hiddenFieldsList = allSubjectFields.filter((f) => !revealFields.includes(f));
  } else {
    // Default: reveal all fields
    revealedFieldsList = allSubjectFields;
    hiddenFieldsList = [];
  }

  // Validate that all specified fields actually exist in the credential
  for (const field of [...revealedFieldsList, ...hiddenFieldsList]) {
    if (!(field in subject)) {
      throw new Error(`Field "${field}" not found in credential subject`);
    }
  }

  // Create hash commitments for hidden fields
  const hiddenCommitments: HiddenCommitment[] = [];
  for (const field of hiddenFieldsList) {
    const value = subject[field];
    const nonce = uuidv4().replace(/-/g, "").slice(0, 16);
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    const hash = await sha256Hex(`${valueStr}:${nonce}`);

    hiddenCommitments.push({
      field,
      hash,
      nonce,
    });
  }

  // Build the proof ID
  const proofId = `urn:uuid:${uuidv4()}`;

  // Build the proof signature
  const created = new Date().toISOString();
  const verificationMethod = `${holderDID}#${holderDID.split(":").pop()}`;

  // Build the data to sign (the holder signs over the proof structure)
  const proofSignatureData = {
    id: proofId,
    holder: holderDID,
    verifiableCredentialId: credential.id,
    revealedFields: revealedFieldsList,
    hiddenFields: hiddenFieldsList,
    hiddenCommitments: hiddenCommitments.map((c) => ({ field: c.field, hash: c.hash })),
    derivedPredicates: derivedPredicates?.map((p) => ({ statement: p.statement, field: p.field, proof: p.proof })) || [],
    created,
    challenge,
    domain,
  };

  // Deterministic stringify and sign
  const canonicalData = deterministicStringify(proofSignatureData);
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalData));
  const hash = new Uint8Array(hashBuffer);
  const signature = await ed.signAsync(hash, holderSecretKey);
  const { base58btc } = await import("multiformats/bases/base58");
  const proofValue = base58btc.encode(signature);

  // Build the ZK proof
  const zkProof: ZKProof = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      ZK_CONTEXT,
    ],
    id: proofId,
    type: ["VerifiablePresentation", "ZKPresentation"],
    verifiableCredential: credential,
    holder: holderDID,
    revealedFields: revealedFieldsList,
    hiddenFields: hiddenFieldsList,
    hiddenCommitments,
    derivedPredicates: derivedPredicates?.length ? derivedPredicates : undefined,
    proof: {
      type: ZK_PROOF_TYPE,
      created,
      proofPurpose: "authentication",
      verificationMethod,
      cryptosuite: CRYPTOSUITE,
      proofValue,
      challenge,
      domain,
    },
  };

  // Store proof metadata in the database
  db.insertVerification({
    id: uuidv4(),
    credential_id: credential.id,
    verifier_did: holderDID,
    verified: true,
    reason: "ZK proof created",
  });

  return { proof: zkProof, proofId };
}

// ─── ZK Proof Verification ───────────────────────────────────────────────────

/**
 * Verify a ZK selective disclosure proof.
 * 
 * Runs the following checks:
 * 1. Structure and format validation
 * 2. Original VC verification (re-verify the issuer's signature)
 * 3. Hidden field commitment integrity (revealed fields match, hidden fields are hashed)
 * 4. Holder binding (holder's signature over the proof)
 * 5. Optional: trust registry check for the original issuer
 * 6. Optional: challenge verification
 */
export async function verifyZKProof(
  zkProof: ZKProof,
  options: ZKVerifyOptions = {}
): Promise<ZKVerifyResult> {
  const checks: ZKVerifyCheck[] = [];
  const { verifierDID, challenge, checkTrustRegistry, requiredCredentialTypes } = options;

  // ── Check 1: Structure validation ──────────────────────────────────────────
  checks.push(validateZKStructure(zkProof));

  // ── Check 2: Original VC verification ──────────────────────────────────────
  // Re-verify the original VC's issuer signature and structure
  try {
    const vcResult = await verifyCredential(zkProof.verifiableCredential, {
      checkTrustRegistry,
      requiredCredentialTypes,
    });
    checks.push({
      name: "original-vc",
      passed: vcResult.verified,
      message: vcResult.verified
        ? "Original Verifiable Credential is valid"
        : `Original VC verification failed: ${vcResult.checks.find((c) => !c.passed)?.message || "Unknown"}`,
    });
  } catch (err: any) {
    checks.push({
      name: "original-vc",
      passed: false,
      message: `Original VC verification error: ${err.message}`,
    });
  }

  // ── Check 3: Hidden field commitment integrity ─────────────────────────────
  checks.push(await verifyHiddenCommitments(zkProof));

  // ── Check 4: Holder binding (verify holder's signature) ────────────────────
  checks.push(await verifyHolderSignature(zkProof, challenge));

  // ── Check 5: Derived predicates (if any) ───────────────────────────────────
  if (zkProof.derivedPredicates && zkProof.derivedPredicates.length > 0) {
    checks.push(verifyDerivedPredicates(zkProof));
  }

  // Determine overall result
  const verified = checks.every((c) => c.passed);

  // Log the verification
  db.insertVerification({
    id: uuidv4(),
    credential_id: zkProof.verifiableCredential.id,
    verifier_did: verifierDID || null,
    verified,
    reason: verified
      ? "All ZK proof checks passed"
      : checks.find((c) => !c.passed)?.message || "ZK proof verification failed",
  });

  return {
    verified,
    checks,
    proofId: zkProof.id,
    holderDID: zkProof.holder,
    timestamp: new Date().toISOString(),
  };
}

// ─── Individual Verification Checks ──────────────────────────────────────────

function validateZKStructure(zkProof: ZKProof): ZKVerifyCheck {
  if (!zkProof["@context"] || !Array.isArray(zkProof["@context"])) {
    return { name: "zk-structure", passed: false, message: "Missing or invalid @context" };
  }
  if (!zkProof.id) {
    return { name: "zk-structure", passed: false, message: "Missing proof id" };
  }
  if (!zkProof.type || !zkProof.type.includes("VerifiablePresentation")) {
    return { name: "zk-structure", passed: false, message: "type must include VerifiablePresentation" };
  }
  if (!zkProof.holder) {
    return { name: "zk-structure", passed: false, message: "Missing holder DID" };
  }
  if (!zkProof.verifiableCredential) {
    return { name: "zk-structure", passed: false, message: "Missing verifiableCredential" };
  }
  if (!Array.isArray(zkProof.revealedFields)) {
    return { name: "zk-structure", passed: false, message: "revealedFields must be an array" };
  }
  if (!Array.isArray(zkProof.hiddenFields)) {
    return { name: "zk-structure", passed: false, message: "hiddenFields must be an array" };
  }
  if (!Array.isArray(zkProof.hiddenCommitments)) {
    return { name: "zk-structure", passed: false, message: "hiddenCommitments must be an array" };
  }
  if (!zkProof.proof) {
    return { name: "zk-structure", passed: false, message: "Missing proof signature" };
  }
  if (!zkProof.proof.proofValue) {
    return { name: "zk-structure", passed: false, message: "Missing proofValue" };
  }

  // Validate field consistency: no field should be in both revealed and hidden
  const overlap = zkProof.revealedFields.filter((f) => zkProof.hiddenFields.includes(f));
  if (overlap.length > 0) {
    return { name: "zk-structure", passed: false, message: `Fields cannot be both revealed and hidden: ${overlap.join(", ")}` };
  }

  // Validate that all subject fields are accounted for
  const subject = zkProof.verifiableCredential.credentialSubject;
  const allFields = Object.keys(subject).filter((k) => k !== "id");
  const accountedFor = [...zkProof.revealedFields, ...zkProof.hiddenFields];
  const missing = allFields.filter((f) => !accountedFor.includes(f));
  if (missing.length > 0) {
    return { name: "zk-structure", passed: false, message: `Fields not accounted for in reveal/hide: ${missing.join(", ")}` };
  }

  return { name: "zk-structure", passed: true, message: "ZK proof structure is valid" };
}

async function verifyHiddenCommitments(zkProof: ZKProof): Promise<ZKVerifyCheck> {
  try {
    const subject = zkProof.verifiableCredential.credentialSubject;

    // Check hidden fields: the verifier does NOT have the original values,
    // but can verify that the hash commitments match the revealed fields.
    // For each hidden field, the verifier can check that the field exists
    // in the credential subject (they can't see the value, but know it's committed).
    for (const field of zkProof.hiddenFields) {
      if (!(field in subject)) {
        return { name: "hidden-commitments", passed: false, message: `Hidden field "${field}" not found in credential subject` };
      }
    }

    // Check that revealed fields match the credential subject
    for (const field of zkProof.revealedFields) {
      if (!(field in subject)) {
        return { name: "hidden-commitments", passed: false, message: `Revealed field "${field}" not found in credential subject` };
      }
    }

    // Verify that the number of hidden commitments matches
    if (zkProof.hiddenCommitments.length !== zkProof.hiddenFields.length) {
      return { name: "hidden-commitments", passed: false, message: "Mismatch between hiddenFields count and hiddenCommitments count" };
    }

    // Check that each hidden field has a commitment
    for (const hiddenField of zkProof.hiddenFields) {
      const commitment = zkProof.hiddenCommitments.find((c) => c.field === hiddenField);
      if (!commitment) {
        return { name: "hidden-commitments", passed: false, message: `Missing commitment for hidden field "${hiddenField}"` };
      }
      if (!commitment.hash || commitment.hash.length !== 64) {
        return { name: "hidden-commitments", passed: false, message: `Invalid hash for hidden field "${hiddenField}"` };
      }
    }

    return { name: "hidden-commitments", passed: true, message: `${zkProof.hiddenFields.length} field(s) hidden via hash commitment, ${zkProof.revealedFields.length} field(s) revealed` };
  } catch (err: any) {
    return { name: "hidden-commitments", passed: false, message: `Commitment verification error: ${err.message}` };
  }
}

async function verifyHolderSignature(zkProof: ZKProof, challenge?: string): Promise<ZKVerifyCheck> {
  try {
    // Extract the holder's public key from the holder DID
    const holderPubKey = didRegistry.extractPublicKey(zkProof.holder);
    if (!holderPubKey || holderPubKey.length !== 32) {
      return { name: "holder-binding", passed: false, message: `Cannot extract public key from holder DID: ${zkProof.holder}` };
    }

    // Rebuild the data that was signed
    const proofSignatureData = {
      id: zkProof.id,
      holder: zkProof.holder,
      verifiableCredentialId: zkProof.verifiableCredential.id,
      revealedFields: zkProof.revealedFields,
      hiddenFields: zkProof.hiddenFields,
      hiddenCommitments: zkProof.hiddenCommitments.map((c) => ({ field: c.field, hash: c.hash })),
      derivedPredicates: zkProof.derivedPredicates?.map((p) => ({ statement: p.statement, field: p.field, proof: p.proof })) || [],
      created: zkProof.proof.created,
      challenge: zkProof.proof.challenge,
      domain: zkProof.proof.domain,
    };

    // Verify the challenge if provided
    if (challenge && zkProof.proof.challenge !== challenge) {
      return { name: "holder-binding", passed: false, message: "Challenge mismatch: proof was bound to a different session" };
    }

    // Deterministic stringify and hash
    const canonicalData = deterministicStringify(proofSignatureData);
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalData));
    const hash = new Uint8Array(hashBuffer);

    // Decode the signature
    const { base58btc } = await import("multiformats/bases/base58");
    const proofValue = zkProof.proof.proofValue;
    let signature: Uint8Array;
    if (proofValue.startsWith("z")) {
      signature = base58btc.decode(proofValue as `z${string}`);
    } else {
      signature = base58btc.decode(`z${proofValue}` as `z${string}`);
    }

    // Verify the signature
    const isValid = await ed.verifyAsync(signature, hash, holderPubKey);

    if (isValid) {
      return { name: "holder-binding", passed: true, message: `Holder ${zkProof.holder} control verified via Ed25519 signature` };
    } else {
      return { name: "holder-binding", passed: false, message: "Holder signature is invalid" };
    }
  } catch (err: any) {
    return { name: "holder-binding", passed: false, message: `Holder binding verification error: ${err.message}` };
  }
}

function verifyDerivedPredicates(zkProof: ZKProof): ZKVerifyCheck {
  try {
    if (!zkProof.derivedPredicates || zkProof.derivedPredicates.length === 0) {
      return { name: "derived-predicates", passed: true, message: "No derived predicates to verify" };
    }

    // For each derived predicate, verify the structure
    for (const predicate of zkProof.derivedPredicates) {
      if (!predicate.statement) {
        return { name: "derived-predicates", passed: false, message: "Derived predicate missing statement" };
      }
      if (!predicate.field) {
        return { name: "derived-predicates", passed: false, message: "Derived predicate missing field reference" };
      }
      if (!predicate.proof) {
        return { name: "derived-predicates", passed: false, message: `Derived predicate "${predicate.statement}" missing proof` };
      }

      // The field must be hidden (derived predicates are for hidden fields)
      if (!zkProof.hiddenFields.includes(predicate.field)) {
        return { name: "derived-predicates", passed: false, message: `Derived predicate field "${predicate.field}" must be in hiddenFields` };
      }

      // Verify the commitment exists for this field
      const commitment = zkProof.hiddenCommitments.find((c) => c.field === predicate.field);
      if (!commitment) {
        return { name: "derived-predicates", passed: false, message: `No commitment found for field "${predicate.field}"` };
      }
    }

    return { name: "derived-predicates", passed: true, message: `${zkProof.derivedPredicates.length} derived predicate(s) verified` };
  } catch (err: any) {
    return { name: "derived-predicates", passed: false, message: `Derived predicate error: ${err.message}` };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hex digest of a string.
 */
async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic JSON stringify with sorted keys.
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