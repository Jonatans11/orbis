/**
 * On-device ZK selective-disclosure proving for ORBIS wallets.
 *
 * SECURITY DECISION (2026-07-10, Mobile Wallet Architect):
 * The holder's Ed25519 secret key NEVER leaves the device. Wallets MUST build
 * ZK presentations here and submit them to the server for verification only:
 *
 *   1. POST /api/vc/zk/challenge            → { challenge }
 *   2. createZKPresentation(...) on-device  → signed ZKPresentation
 *   3. POST /api/wallet/vc/present          → server verifies with the holder's
 *      PUBLIC key from the DID document (or POST /api/vc/zk/verify)
 *
 * The server's POST /api/vc/zk/prove (which takes holderSecretKey) is a
 * backend-to-backend / testing utility and is FORBIDDEN in wallet code.
 *
 * Wire format is byte-compatible with orbis-repo src/vc/zk.ts
 * (OrbisZKSelectiveDisclosure2025 / orbis-zk-sd-2025): the server re-canonicalizes
 * the signature payload with the same deterministic stringify, SHA-256 hashes it,
 * and verifies the Ed25519 signature (multibase base58btc, 'z' prefix).
 */
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { ed25519 } from "@noble/curves/ed25519";
import { base58 } from "@scure/base";

// ─── Types (mirror src/vc/zk.ts) ─────────────────────────────────────────────

export interface HiddenCommitment {
  field: string;
  /** SHA-256 hex of `${valueString}:${nonce}` */
  hash: string;
  nonce?: string;
}

export interface DerivedPredicate {
  /** e.g. "age >= 18" */
  statement: string;
  proof: string;
  field: string;
}

export interface ZKPresentationSignature {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  cryptosuite: string;
  proofValue: string;
  challenge?: string | undefined;
  domain?: string | undefined;
}

export interface ZKPresentation {
  "@context": string[];
  id: string;
  type: string[];
  verifiableCredential: Record<string, unknown> & {
    id?: string;
    credentialSubject: Record<string, unknown>;
  };
  holder: string;
  revealedFields: string[];
  hiddenFields: string[];
  hiddenCommitments: HiddenCommitment[];
  derivedPredicates?: DerivedPredicate[];
  proof: ZKPresentationSignature;
}

export interface CreateZKPresentationOptions {
  /** The original Verifiable Credential (with issuer proof). */
  credential: ZKPresentation["verifiableCredential"];
  /** Holder DID — must equal credentialSubject.id. */
  holderDID: string;
  /** Holder's Ed25519 secret key (32 bytes) — stays on this device. */
  holderSecretKey: Uint8Array;
  /** Fields to reveal in plaintext (default: all). */
  revealFields?: string[];
  /** Fields to hide via hash commitment (overrides revealFields). */
  hideFields?: string[];
  derivedPredicates?: DerivedPredicate[];
  /** Verifier challenge from POST /api/vc/zk/challenge (replay protection). */
  challenge?: string;
  domain?: string;
}

// ─── Constants (must match src/vc/zk.ts) ─────────────────────────────────────

const ZK_CONTEXT = "https://orbis.id/ns/zkp/v1";
const ZK_PROOF_TYPE = "OrbisZKSelectiveDisclosure2025";
const CRYPTOSUITE = "orbis-zk-sd-2025";

// ─── Proving ─────────────────────────────────────────────────────────────────

/**
 * Create a ZK selective-disclosure presentation entirely on-device.
 * Pure TS (@noble) — no WebCrypto/subtle dependency, works in RN Hermes and browsers.
 */
export function createZKPresentation(options: CreateZKPresentationOptions): {
  proof: ZKPresentation;
  proofId: string;
} {
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

  if (credential.credentialSubject.id !== holderDID) {
    throw new Error("Holder DID must match credentialSubject.id");
  }
  if (holderSecretKey.length !== 32) {
    throw new Error("Holder secret key must be 32 bytes");
  }

  const subject = credential.credentialSubject;
  const allSubjectFields = Object.keys(subject).filter((k) => k !== "id");

  let revealedFieldsList: string[];
  let hiddenFieldsList: string[];
  if (hideFields && hideFields.length > 0) {
    hiddenFieldsList = hideFields;
    revealedFieldsList = allSubjectFields.filter((f) => !hideFields.includes(f));
  } else if (revealFields && revealFields.length > 0) {
    revealedFieldsList = revealFields;
    hiddenFieldsList = allSubjectFields.filter((f) => !revealFields.includes(f));
  } else {
    revealedFieldsList = allSubjectFields;
    hiddenFieldsList = [];
  }

  for (const field of [...revealedFieldsList, ...hiddenFieldsList]) {
    if (!(field in subject)) {
      throw new Error(`Field "${field}" not found in credential subject`);
    }
  }

  // Hash commitments for hidden fields: sha256(`${value}:${nonce}`) hex
  const hiddenCommitments: HiddenCommitment[] = hiddenFieldsList.map((field) => {
    const value = subject[field];
    const nonce = bytesToHex(randomBytes(8)); // 16 hex chars
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    return { field, hash: bytesToHex(sha256(utf8ToBytes(`${valueStr}:${nonce}`))), nonce };
  });

  const proofId = `urn:uuid:${uuidv4()}`;
  const created = new Date().toISOString();
  const verificationMethod = `${holderDID}#${holderDID.split(":").pop()}`;

  // Signature payload — field set and ordering must match the server verifier.
  const proofSignatureData = {
    id: proofId,
    holder: holderDID,
    verifiableCredentialId: credential.id,
    revealedFields: revealedFieldsList,
    hiddenFields: hiddenFieldsList,
    hiddenCommitments: hiddenCommitments.map((c) => ({ field: c.field, hash: c.hash })),
    derivedPredicates:
      derivedPredicates?.map((p) => ({ statement: p.statement, field: p.field, proof: p.proof })) ||
      [],
    created,
    challenge,
    domain,
  };

  const digest = sha256(utf8ToBytes(deterministicStringify(proofSignatureData)));
  const signature = ed25519.sign(digest, holderSecretKey);
  const proofValue = `z${base58.encode(signature)}`; // multibase base58btc

  const proof: ZKPresentation = {
    "@context": ["https://www.w3.org/ns/credentials/v2", ZK_CONTEXT],
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

  return { proof, proofId };
}

/**
 * Local pre-flight check of a presentation's holder signature — same payload
 * reconstruction the server performs. Useful in tests and before submitting.
 */
export function verifyZKPresentationSignature(
  proof: ZKPresentation,
  holderPublicKey: Uint8Array,
): boolean {
  const proofSignatureData = {
    id: proof.id,
    holder: proof.holder,
    verifiableCredentialId: proof.verifiableCredential.id,
    revealedFields: proof.revealedFields,
    hiddenFields: proof.hiddenFields,
    hiddenCommitments: proof.hiddenCommitments.map((c) => ({ field: c.field, hash: c.hash })),
    derivedPredicates:
      proof.derivedPredicates?.map((p) => ({
        statement: p.statement,
        field: p.field,
        proof: p.proof,
      })) || [],
    created: proof.proof.created,
    challenge: proof.proof.challenge,
    domain: proof.proof.domain,
  };
  const digest = sha256(utf8ToBytes(deterministicStringify(proofSignatureData)));
  const value = proof.proof.proofValue;
  const signature = base58.decode(value.startsWith("z") ? value.slice(1) : value);
  return ed25519.verify(signature, digest, holderPublicKey);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic JSON stringify with sorted keys — MUST match src/vc/zk.ts. */
export function deterministicStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(deterministicStringify).join(",")}]`;
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (key) =>
        `${JSON.stringify(key)}:${deterministicStringify((obj as Record<string, unknown>)[key])}`,
    );
    return `{${pairs.join(",")}}`;
  }
  return String(obj);
}

/** RFC 4122 v4 UUID from CSPRNG (no uuid package dependency). */
function uuidv4(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
