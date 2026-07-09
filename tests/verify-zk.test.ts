/**
 * Tests for the ZK hash-commitment verification module (verify-zk.ts).
 */

import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  hashWithNonce,
  verifyHashCommitment,
  verifyMerkleInclusion,
  verifyZK,
  computeMerkleRoot,
  recomputeRootFromProof,
} from "../src/vc/verify-zk.js";
import type { ZKCommitmentProof, MerkleInclusionProof } from "../src/vc/verify-zk.js";

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

describe("sha256Hex", () => {
  it("should produce a 64-character hex string", () => {
    const hash = sha256Hex("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be deterministic", () => {
    expect(sha256Hex("test")).toBe(sha256Hex("test"));
  });

  it("should produce different hashes for different inputs", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});

// ─── Hash with Nonce ──────────────────────────────────────────────────────────

describe("hashWithNonce", () => {
  it("should hash a value without nonce", () => {
    const hash = hashWithNonce("age-25");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(sha256Hex("age-25"));
  });

  it("should hash a value with nonce", () => {
    const hash1 = hashWithNonce("age-25", "nonce1");
    const hash2 = hashWithNonce("age-25", "nonce2");
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(sha256Hex("age-25"));
  });
});

// ─── Hash Commitment Verification ─────────────────────────────────────────────

describe("verifyHashCommitment", () => {
  it("should verify a correct commitment", () => {
    const value = "my-secret-value";
    const nonce = "random-nonce";
    const commitmentHash = hashWithNonce(value, nonce);

    const proof: ZKCommitmentProof = {
      field: "secret",
      commitmentHash,
      nonce,
      revealedValue: value,
    };

    const result = verifyHashCommitment(proof);
    expect(result.verified).toBe(true);
    expect(result.computedHash).toBe(commitmentHash);
  });

  it("should reject an incorrect commitment", () => {
    const proof: ZKCommitmentProof = {
      field: "secret",
      commitmentHash: "0000000000000000000000000000000000000000000000000000000000000000",
      revealedValue: "wrong-value",
    };

    const result = verifyHashCommitment(proof);
    expect(result.verified).toBe(false);
  });

  it("should accept an external actualValue", () => {
    const value = "age-25";
    const commitmentHash = hashWithNonce(value);

    const proof: ZKCommitmentProof = {
      field: "age",
      commitmentHash,
    };

    const result = verifyHashCommitment(proof, value);
    expect(result.verified).toBe(true);
  });

  it("should throw when no value is provided", () => {
    const proof: ZKCommitmentProof = {
      field: "age",
      commitmentHash: "abc",
    };

    expect(() => verifyHashCommitment(proof)).toThrow("No value to verify");
  });
});

// ─── Merkle Proof Helpers ─────────────────────────────────────────────────────

describe("Merkle tree", () => {
  it("should compute a root for a single leaf", () => {
    const leaves = ["value1"];
    const root = computeMerkleRoot(leaves);
    expect(root).toHaveLength(64);
    expect(root).toBe(sha256Hex("value1"));
  });

  it("should compute a root for two leaves", () => {
    const leaves = ["a", "b"];
    const root = computeMerkleRoot(leaves);
    const expected = sha256Hex(sha256Hex("a") + sha256Hex("b"));
    expect(root).toBe(expected);
  });

  it("should produce correct recomputation from siblings", () => {
    // Build a simple tree: [leaf1, leaf2, leaf3, leaf4]
    const leaves = ["v1", "v2", "v3", "v4"];
    const root = computeMerkleRoot(leaves);

    // Prove inclusion of leaf at index 2 ("v3")
    // Siblings: leaf3's sibling is at index 3 ("v4" hashed), then the pair at the next level
    const h1 = sha256Hex("v3");
    const h2 = sha256Hex("v4");
    const level1Hash = sha256Hex(h1 + h2); // hash of (h(v3) + h(v4))
    const h3 = sha256Hex("v1");
    const h4 = sha256Hex("v2");
    const level1Left = sha256Hex(h3 + h4);
    const level2Hash = sha256Hex(level1Left + level1Hash);

    const computedRoot = recomputeRootFromProof(
      "v3",
      [sha256Hex("v4"), level1Left],
      2
    );
    expect(computedRoot).toBe(level2Hash);
    expect(computedRoot).toBe(root);
  });
});

// ─── Merkle Inclusion Verification ────────────────────────────────────────────

describe("verifyMerkleInclusion", () => {
  it("should verify a valid Merkle proof", () => {
    // Create a simple 4-leaf tree
    const leaves = ["alice", "bob", "carol", "dave"];
    const h1 = sha256Hex("alice");
    const h2 = sha256Hex("bob");
    const h3 = sha256Hex("carol");
    const h4 = sha256Hex("dave");
    const level1Left = sha256Hex(h1 + h2);
    const level1Right = sha256Hex(h3 + h4);
    const root = sha256Hex(level1Left + level1Right);

    // Prove "bob" at index 1
    const proof: MerkleInclusionProof = {
      value: "bob",
      root,
      siblings: [h1, level1Right],
      leafIndex: 1,
      totalLeaves: 4,
    };

    const result = verifyMerkleInclusion(proof);
    expect(result.verified).toBe(true);
    expect(result.computedRoot).toBe(root);
  });

  it("should reject an invalid Merkle proof", () => {
    const leaves = ["alice", "bob", "carol", "dave"];
    const h1 = sha256Hex("alice");
    const h3 = sha256Hex("carol");
    const h4 = sha256Hex("dave");
    const level1Right = sha256Hex(h3 + h4);
    const root = computeMerkleRoot(leaves);

    // Wrong siblings should fail
    const proof: MerkleInclusionProof = {
      value: "bob",
      root,
      siblings: [sha256Hex("evil"), level1Right],
      leafIndex: 1,
      totalLeaves: 4,
    };

    const result = verifyMerkleInclusion(proof);
    expect(result.verified).toBe(false);
    expect(result.computedRoot).not.toBe(root);
  });
});

// ─── Main verifyZK Function ───────────────────────────────────────────────────

describe("verifyZK", () => {
  it("should verify a valid hash commitment proof", () => {
    const value = "age-25";
    const commitmentHash = hashWithNonce(value);

    const result = verifyZK(
      {
        field: "age",
        commitmentHash,
        revealedValue: value,
      },
      {},
      {}
    );

    expect(result.verified).toBe(true);
    expect(result.proofDetails.proofType).toBe("hash-commitment");
    expect(result.proofDetails.hashMatch).toBe(true);
    expect(result.proofDetails.computedHash).toBe(commitmentHash);
  });

  it("should verify a hash commitment with credential subject field", () => {
    const value = "alice@example.com";
    const commitmentHash = hashWithNonce(value);

    const result = verifyZK(
      {
        field: "email",
        commitmentHash,
      },
      {},
      {
        credentialSubject: {
          id: "did:key:abc",
          email: value,
        },
      } as any
    );

    expect(result.verified).toBe(true);
    expect(result.proofDetails.proofType).toBe("hash-commitment");
  });

  it("should verify a hash commitment with publicInputs", () => {
    const value = "passport-12345";
    const commitmentHash = hashWithNonce(value);

    const result = verifyZK(
      {
        field: "documentId",
        commitmentHash,
      },
      { documentId: value }
    );

    expect(result.verified).toBe(true);
  });

  it("should reject an invalid hash commitment proof", () => {
    const result = verifyZK(
      {
        field: "age",
        commitmentHash: "0000000000000000000000000000000000000000000000000000000000000000",
        revealedValue: "age-99",
      }
    );

    expect(result.verified).toBe(false);
    expect(result.proofDetails.hashMatch).toBe(false);
  });

  it("should verify a valid Merkle inclusion proof", () => {
    const leaves = ["id-1", "id-2", "id-3", "id-4"];
    const root = computeMerkleRoot(leaves);
    const h1 = sha256Hex("id-1");
    const h4hash = sha256Hex("id-4");
    const h3hash = sha256Hex("id-3");
    const level1Right = sha256Hex(h3hash + h4hash);

    // Prove "id-1" at index 0
    const proof: MerkleInclusionProof = {
      value: "id-1",
      root,
      siblings: [sha256Hex("id-2"), level1Right],
      leafIndex: 0,
      totalLeaves: 4,
    };

    const result = verifyZK(proof);
    expect(result.verified).toBe(true);
    expect(result.proofDetails.proofType).toBe("merkle-inclusion");
    expect(result.proofDetails.merkleValid).toBe(true);
  });

  it("should reject an invalid Merkle inclusion proof", () => {
    const leaves = ["id-1", "id-2", "id-3", "id-4"];
    const root = computeMerkleRoot(leaves);

    const proof: MerkleInclusionProof = {
      value: "id-5",
      root,
      siblings: [sha256Hex("id-2"), sha256Hex("id-3")],
      leafIndex: 0,
      totalLeaves: 4,
    };

    const result = verifyZK(proof);
    expect(result.verified).toBe(false);
  });

  it("should return error when field is missing in hash commitment", () => {
    const result = verifyZK(
      {
        field: "",
        commitmentHash: "abc",
      } as any
    );

    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should return error when commitmentHash is missing", () => {
    const result = verifyZK(
      {
        field: "age",
      } as any
    );

    expect(result.verified).toBe(false);
    expect(result.error).toContain("commitmentHash");
  });
});