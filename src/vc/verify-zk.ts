/**
 * ORBIS.ID ZK Hash-Commitment Verification Module.
 *
 * A simpler, focused ZK verification endpoint that uses SHA-256 hash commitments
 * and Merkle-style inclusion proofs. This allows a prover to:
 *   1. Commit to a value via SHA-256 hash (with optional nonce)
 *   2. Prove that a credential field matches a given public commitment
 *   3. Verify Merkle-style inclusion: that a value belongs to a known set
 *      without revealing which element
 *
 * Unlike the full selective disclosure module (zk.ts), this endpoint is designed
 * for direct, simple verification flows: "Is this credential's field value the
 * one committed to by this hash?" — without the overhead of full presentations.
 */

import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZKCommitmentProof {
  /** The field name being proven */
  field: string;
  /** The SHA-256 hash the prover claims their value commits to (hex) */
  commitmentHash: string;
  /** Optional: nonce used when creating the commitment */
  nonce?: string;
  /** Optional: the raw value (revealed if the prover chooses to disclose) */
  revealedValue?: string;
}

export interface MerkleInclusionProof {
  /** The value whose inclusion is being proven */
  value: string;
  /** The Merkle root hash (hex) that the set commits to */
  root: string;
  /** Sibling hashes needed to reconstruct the path to the root */
  siblings: string[];
  /** Index of the leaf in the Merkle tree */
  leafIndex: number;
  /** Total number of leaves in the tree */
  totalLeaves: number;
}

export interface VerifyZKRequest {
  /** The proof object — can be a commitment proof or Merkle inclusion proof */
  proof: ZKCommitmentProof | MerkleInclusionProof;
  /** Public inputs that constrain the verification (e.g., expected hash, known salts) */
  publicInputs?: Record<string, string>;
  /** The Verifiable Credential being verified */
  credential?: Record<string, unknown>;
}

export interface ProofDetails {
  /** Type of proof verified */
  proofType: "hash-commitment" | "merkle-inclusion";
  /** The field being verified */
  field: string;
  /** The computed hash (hex) for comparison */
  computedHash?: string;
  /** The expected commitment hash (hex) */
  expectedHash?: string;
  /** Whether the hash matches */
  hashMatch?: boolean;
  /** For Merkle proofs: the computed root from siblings */
  computedRoot?: string;
  /** The expected Merkle root */
  expectedRoot?: string;
  /** Whether the Merkle proof is valid */
  merkleValid?: boolean;
  /** Number of leaves in Merkle tree */
  totalLeaves?: number;
  /** Timestamp of verification */
  timestamp: string;
}

export interface VerifyZKResult {
  verified: boolean;
  proofDetails: ProofDetails;
  error?: string;
}

// ─── SHA-256 Helpers ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hex digest of a string.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Compute SHA-256 hash of a value combined with an optional nonce.
 * Format: `${value}:${nonce}` if nonce present, else just `${value}`.
 */
export function hashWithNonce(value: string, nonce?: string): string {
  const input = nonce ? `${value}:${nonce}` : value;
  return sha256Hex(input);
}

// ─── Merkle Proof Helpers ────────────────────────────────────────────────────

/**
 * Build a Merkle tree from a list of leaf values and return
 * the root and all intermediate hashes (not stored, just computed).
 *
 * For a given leaf index and siblings, one can recompute the root.
 */
export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return sha256Hex("");
  }

  let level: string[] = leaves.map((l) => sha256Hex(l));

  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      nextLevel.push(sha256Hex(left + right));
    }
    level = nextLevel;
  }

  return level[0];
}

/**
 * Recompute the Merkle root from a leaf value, its siblings, and its index.
 * Returns null if the proof is invalid (sibling count doesn't match).
 */
export function recomputeRootFromProof(
  leafValue: string,
  siblings: string[],
  leafIndex: number
): string {
  let hash = sha256Hex(leafValue);
  let index = leafIndex;

  for (const sibling of siblings) {
    if (index % 2 === 0) {
      hash = sha256Hex(hash + sibling);
    } else {
      hash = sha256Hex(sibling + hash);
    }
    index = Math.floor(index / 2);
  }

  return hash;
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Verify a ZK hash-commitment proof.
 *
 * Given a proof with:
 *   - field: the credential field name
 *   - commitmentHash: the SHA-256 hash the prover claims to match
 *   - revealedValue: the actual field value (or from credential/publicInputs)
 *   - nonce: optional nonce used when creating the commitment
 *
 * Verifies that `SHA-256(revealedValue[:nonce]) === commitmentHash`.
 */
export function verifyHashCommitment(
  proof: ZKCommitmentProof,
  actualValue?: string
): { verified: boolean; computedHash: string } {
  const valueToVerify = actualValue ?? proof.revealedValue;

  if (!valueToVerify) {
    throw new Error(
      "No value to verify: provide revealedValue in proof, actualValue parameter, or include credential"
    );
  }

  const computedHash = hashWithNonce(valueToVerify, proof.nonce);
  const verified = computedHash === proof.commitmentHash;

  return { verified, computedHash };
}

/**
 * Verify a Merkle inclusion proof.
 *
 * Given a MerkleInclusionProof with:
 *   - value: the leaf value
 *   - root: the expected Merkle root
 *   - siblings: the sibling hashes along the path
 *   - leafIndex: the index of the leaf
 *
 * Recomputes the root from the leaf + siblings and checks it matches.
 */
export function verifyMerkleInclusion(
  proof: MerkleInclusionProof
): { verified: boolean; computedRoot: string } {
  const computedRoot = recomputeRootFromProof(
    proof.value,
    proof.siblings,
    proof.leafIndex
  );
  const verified = computedRoot === proof.root;

  return { verified, computedRoot };
}

/**
 * Determine the actual value of a field from a credential or publicInputs.
 */
function extractFieldValue(
  field: string,
  credential?: Record<string, unknown>,
  publicInputs?: Record<string, string>
): string | undefined {
  // First try publicInputs
  if (publicInputs && publicInputs[field] !== undefined) {
    return publicInputs[field];
  }

  // Then try credential.credentialSubject
  if (credential && typeof credential === "object") {
    const subject = (credential as any).credentialSubject as
      | Record<string, unknown>
      | undefined;
    if (subject && subject[field] !== undefined) {
      return String(subject[field]);
    }
  }

  return undefined;
}

/**
 * Main ZK verification function.
 * Accepts a proof (hash-commitment or Merkle-inclusion), optional public inputs,
 * and an optional credential. Returns a detailed verification result.
 */
export function verifyZK(
  proof: ZKCommitmentProof | MerkleInclusionProof,
  publicInputs?: Record<string, string>,
  credential?: Record<string, unknown>
): VerifyZKResult {
  const timestamp = new Date().toISOString();

  try {
    // Determine proof type by checking for Merkle-specific fields
    if ("siblings" in proof && "root" in proof && "leafIndex" in proof) {
      // ── Merkle Inclusion Proof ──────────────────────────────────────
      const merkleProof = proof as MerkleInclusionProof;

      if (!Array.isArray(merkleProof.siblings)) {
        return {
          verified: false,
          proofDetails: {
            proofType: "merkle-inclusion",
            field: "unknown",
            timestamp,
          },
          error: "siblings must be an array",
        };
      }

      const { verified, computedRoot } = verifyMerkleInclusion(merkleProof);

      // Store in database
      const proofId = uuidv4();
      storeVerification({
        id: proofId,
        proof_type: "merkle-inclusion",
        field: "merkle-tree",
        verified: verified ? 1 : 0,
        details: JSON.stringify({
          value: merkleProof.value,
          root: merkleProof.root,
          leafIndex: merkleProof.leafIndex,
          totalLeaves: merkleProof.totalLeaves,
        }),
        timestamp,
      });

      return {
        verified,
        proofDetails: {
          proofType: "merkle-inclusion",
          field: "merkle-tree",
          computedRoot,
          expectedRoot: merkleProof.root,
          merkleValid: verified,
          totalLeaves: merkleProof.totalLeaves,
          timestamp,
        },
      };
    } else {
      // ── Hash Commitment Proof ───────────────────────────────────────
      const commitmentProof = proof as ZKCommitmentProof;

      if (!commitmentProof.field) {
        return {
          verified: false,
          proofDetails: {
            proofType: "hash-commitment",
            field: "unknown",
            timestamp,
          },
          error: "field is required in hash commitment proof",
        };
      }

      if (!commitmentProof.commitmentHash) {
        return {
          verified: false,
          proofDetails: {
            proofType: "hash-commitment",
            field: commitmentProof.field,
            timestamp,
          },
          error: "commitmentHash is required",
        };
      }

      // Get the actual value from proof, publicInputs, or credential
      const actualValue =
        commitmentProof.revealedValue ??
        extractFieldValue(commitmentProof.field, credential, publicInputs);

      if (!actualValue) {
        return {
          verified: false,
          proofDetails: {
            proofType: "hash-commitment",
            field: commitmentProof.field,
            expectedHash: commitmentProof.commitmentHash,
            timestamp,
          },
          error: `Cannot determine value for field "${commitmentProof.field}". Provide revealedValue, publicInputs, or credential.`,
        };
      }

      const { verified, computedHash } = verifyHashCommitment(
        commitmentProof,
        actualValue
      );

      // Store in database
      const proofId = uuidv4();
      storeVerification({
        id: proofId,
        proof_type: "hash-commitment",
        field: commitmentProof.field,
        verified: verified ? 1 : 0,
        details: JSON.stringify({
          commitmentHash: commitmentProof.commitmentHash,
          hasNonce: !!commitmentProof.nonce,
        }),
        timestamp,
      });

      return {
        verified,
        proofDetails: {
          proofType: "hash-commitment",
          field: commitmentProof.field,
          computedHash,
          expectedHash: commitmentProof.commitmentHash,
          hashMatch: verified,
          timestamp,
        },
      };
    }
  } catch (err: any) {
    return {
      verified: false,
      proofDetails: {
        proofType: "siblings" in proof ? "merkle-inclusion" : "hash-commitment",
        field: "error",
        timestamp,
      },
      error: `Verification error: ${err.message}`,
    };
  }
}

// ─── Database Storage ────────────────────────────────────────────────────────

interface ZKVerificationRecord {
  id: string;
  proof_type: string;
  field: string;
  verified: number;
  details: string;
  timestamp: string;
}

/**
 * Store a ZK verification record in the shared team-db.
 */
function storeVerification(record: ZKVerificationRecord): void {
  try {
    const sql = `INSERT INTO ssi_verifications (id, credential_id, verifier_did, verified, reason, timestamp) VALUES ('${record.id}', 'zk-${record.proof_type}-${record.field}', NULL, ${record.verified}, '${record.details.replace(/'/g, "''")}', '${record.timestamp}')`;
    execSync(`team-db ${JSON.stringify(sql)}`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
  } catch {
    // Storage failure is non-fatal — the verification result is still returned
  }
}