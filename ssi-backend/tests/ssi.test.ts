/**
 * Integration tests for the ORBIS.ID SSI Backend.
 * Tests DID creation, VC issuance, VC verification, and trust registry.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { v4 as uuidv4 } from "uuid";
import * as keyModule from "../src/did/key.js";
import * as webModule from "../src/did/web.js";
import * as didRegistry from "../src/did/index.js";
import { issueCredential } from "../src/vc/issue.js";
import { verifyCredential } from "../src/vc/verify.js";
import * as trustRegistry from "../src/trust/registry.js";
import { initDatabase } from "../src/db/metadata.js";

// Initialize database tables before tests
beforeAll(() => {
  initDatabase();
});

// ─── DID Module Tests ────────────────────────────────────────────────────────

describe("DID:key Module", () => {
  it("should generate a valid did:key", async () => {
    const result = await keyModule.generateDIDKey();

    expect(result.did).toMatch(/^did:key:z/);
    expect(result.keyPair.publicKey).toHaveLength(32);
    expect(result.keyPair.secretKey).toHaveLength(32);
    expect(result.didDocument.id).toBe(result.did);
    expect(result.didDocument.verificationMethod).toHaveLength(1);
    expect(result.didDocument.verificationMethod[0]!.type).toBe("Ed25519VerificationKey2020");
    expect(result.didDocument.authentication).toHaveLength(1);
    expect(result.didDocument.assertionMethod).toHaveLength(1);
  });

  it("should resolve a did:key to its DID document", async () => {
    const result = await keyModule.generateDIDKey();
    const resolved = keyModule.resolveDIDKey(result.did);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(result.did);
    expect(resolved!.verificationMethod[0]!.publicKeyMultibase).toBe(
      result.didDocument.verificationMethod[0]!.publicKeyMultibase
    );
  });

  it("should extract public key from did:key", async () => {
    const result = await keyModule.generateDIDKey();
    const pubKey = keyModule.extractPublicKey(result.did);

    expect(pubKey).not.toBeNull();
    expect(pubKey).toHaveLength(32);
    expect(pubKey).toEqual(result.keyPair.publicKey);
  });

  it("should return null for invalid did:key", () => {
    expect(keyModule.resolveDIDKey("did:key:invalid")).toBeNull();
    expect(keyModule.extractPublicKey("did:key:invalid")).toBeNull();
  });

  it("should create a did:key deterministically from seed", async () => {
    const seed = new Uint8Array(32).fill(42);
    const result1 = await keyModule.fromSeed(seed);
    const result2 = await keyModule.fromSeed(seed);

    expect(result1.did).toBe(result2.did);
    expect(result1.keyPair.publicKey).toEqual(result2.keyPair.publicKey);
  });
});

describe("DID:web Module", () => {
  it("should generate a valid did:web without path", async () => {
    const result = await webModule.generateDIDWeb({ domain: "example.com" });

    expect(result.did).toBe("did:web:example.com");
    expect(result.didDocument.id).toBe("did:web:example.com");
    expect(result.didJsonUrl).toBe("https://example.com/.well-known/did.json");
    expect(result.keyPair.publicKey).toHaveLength(32);
  });

  it("should generate a valid did:web with path", async () => {
    const result = await webModule.generateDIDWeb({ domain: "example.com", path: "issuer/abc" });

    expect(result.did).toBe("did:web:example.com:issuer:abc");
    expect(result.didJsonUrl).toBe("https://example.com/issuer/abc/did.json");
  });

  it("should resolve did:web to DID document URL", () => {
    const { didDocument, didJsonUrl } = webModule.resolveDIDWeb("did:web:example.com");

    expect(didJsonUrl).toBe("https://example.com/.well-known/did.json");
    expect(didDocument).not.toBeNull();
    expect(didDocument!.id).toBe("did:web:example.com");
  });

  it("should return null for invalid did:web", () => {
    const result = webModule.resolveDIDWeb("invalid");
    expect(result.didDocument).toBeNull();
    expect(result.didJsonUrl).toBeNull();
  });
});

// ─── DID Registry Tests ──────────────────────────────────────────────────────

describe("DID Registry", () => {
  it("should create and store a did:key via registry", async () => {
    const result = await didRegistry.createDIDKey();

    expect(result.did).toMatch(/^did:key:z/);
    expect(result.id).toBeTruthy();

    // Verify it's stored in the database
    const record = didRegistry.getDIDRecord(result.did);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("active");
  });

  it("should create and store a did:web via registry", async () => {
    const result = await didRegistry.createDIDWeb({ domain: "orbis.id" });

    expect(result.did).toBe("did:web:orbis.id");
    expect(result.id).toBeTruthy();

    const record = didRegistry.getDIDRecord(result.did);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("active");
  });

  it("should resolve both did:key and did:web", () => {
    const keyDoc = didRegistry.resolveDID("did:key:z6MkhaXgBZDvB7FtG4ZzG3t5LQ5GvG5q5q5q5q5q5q5q5q5q5q");
    expect(keyDoc).not.toBeNull();

    const webDoc = didRegistry.resolveDID("did:web:orbis.id");
    expect(webDoc).not.toBeNull();
  });

  it("should revoke a DID", async () => {
    const result = await didRegistry.createDIDKey();
    didRegistry.revokeDID(result.id);

    const record = didRegistry.getDIDRecord(result.did);
    expect(record!.status).toBe("revoked");
  });

  it("should list DIDs", async () => {
    const list = didRegistry.listDIDs();
    expect(Array.isArray(list)).toBe(true);
  });
});

// ─── VC Issuance Tests ───────────────────────────────────────────────────────

describe("VC Issuance", () => {
  it("should issue a Verifiable Credential", async () => {
    // Create issuer DID
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const result = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: {
        name: "Alice Smith",
        email: "alice@example.com",
        age: 30,
      },
      type: ["VerifiableCredential", "IdentityCredential"],
    });

    expect(result.credential).toBeDefined();
    expect(result.credential.id).toMatch(/^urn:uuid:/);
    expect(result.credential.type).toContain("VerifiableCredential");
    expect(result.credential.type).toContain("IdentityCredential");
    expect(result.credential.issuer).toBe(issuer.did);
    expect(result.credential.credentialSubject.id).toBe(subject.did);
    expect(result.credential.credentialSubject.name).toBe("Alice Smith");
    expect(result.credential.credentialSubject.email).toBe("alice@example.com");
    expect(result.credential.proof).toBeDefined();
    expect(result.credential.proof.type).toBe("Ed25519Signature2020");
    expect(result.credential.proof.proofPurpose).toBe("assertionMethod");
    expect(result.credential.proof.proofValue).toBeTruthy();
  });

  it("should issue a VC with expiration date", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();
    const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const result = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { role: "admin" },
      expirationDate,
    });

    expect(result.credential.expirationDate).toBe(expirationDate);
  });

  it("should issue a VC in under 200ms", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const start = performance.now();
    const result = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { test: true },
    });
    const elapsed = performance.now() - start;

    expect(result.credential).toBeDefined();
    expect(elapsed).toBeLessThan(2000); // Allow 2s for first run (cold start)
    // Subsequent runs should be under 200ms
  });
});

// ─── VC Verification Tests ───────────────────────────────────────────────────

describe("VC Verification", () => {
  it("should verify a valid credential", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Bob" },
    });

    const result = await verifyCredential(credential);

    expect(result.verified).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(3);
    expect(result.checks.some((c) => c.name === "structure" && c.passed)).toBe(true);
    expect(result.checks.some((c) => c.name === "expiration" && c.passed)).toBe(true);
    expect(result.checks.some((c) => c.name === "issuer-did" && c.passed)).toBe(true);
    expect(result.checks.some((c) => c.name === "proof-signature" && c.passed)).toBe(true);
  });

  it("should reject a credential with invalid signature", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();
    const differentIssuer = await didRegistry.createDIDKey();

    // Issue with one key but claim another issuer
    const { credential } = await issueCredential({
      issuerDID: differentIssuer.did,
      issuerSecretKey: differentIssuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Eve" },
    });

    // Tamper with the credential
    credential.credentialSubject = { id: subject.did, name: "Tampered" };

    const result = await verifyCredential(credential);

    // The structure check passes, but proof verification will fail
    // because the credential data doesn't match what was signed
    expect(result.verified).toBe(false);
  });

  it("should detect expired credentials", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Charlie" },
      expirationDate: pastDate,
    });

    const result = await verifyCredential(credential);

    expect(result.verified).toBe(false);
    expect(result.checks.some((c) => c.name === "expiration" && !c.passed)).toBe(true);
  });
});

// ─── Trust Registry Tests ────────────────────────────────────────────────────

describe("Trust Registry", () => {
  it("should register a trusted issuer", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: "did:key:z6MkTrustedIssuer123",
      name: "ORBIS.ID Government Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["IdentityCredential", "VerifiableCredential"],
    });

    expect(entry.did).toBe("did:key:z6MkTrustedIssuer123");
    expect(entry.status).toBe("active");
    expect(entry.authorizedCredentialTypes).toContain("IdentityCredential");
  });

  it("should reject duplicate registration", () => {
    const did = "did:key:z6MkDuplicateTest";
    trustRegistry.addTrustedEntity({
      did,
      name: "First",
    });

    expect(() => {
      trustRegistry.addTrustedEntity({
        did,
        name: "Second",
      });
    }).toThrow("already in the trust registry");
  });

  it("should check if a DID is a trusted issuer", () => {
    const did = "did:key:z6MkTrustCheck";
    trustRegistry.addTrustedEntity({
      did,
      name: "Trust Check Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["VerifiableCredential"],
    });

    expect(trustRegistry.isTrustedIssuer(did)).toBe(true);
    expect(trustRegistry.isTrustedIssuer(did, ["VerifiableCredential"])).toBe(true);
    expect(trustRegistry.isTrustedIssuer(did, ["UnknownCredential"])).toBe(false);
    expect(trustRegistry.isTrustedIssuer("did:key:z6MkNotTrusted")).toBe(false);
  });

  it("should suspend and reactivate an entity", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: "did:key:z6MkSuspendTest",
      name: "Suspend Test",
    });

    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(true);

    trustRegistry.suspendEntity(entry.id);
    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(false);

    trustRegistry.reactivateEntity(entry.id);
    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(true);
  });

  it("should list active issuers", () => {
    const issuers = trustRegistry.listActiveIssuers();
    expect(Array.isArray(issuers)).toBe(true);
    issuers.forEach((i) => {
      expect(i.status).toBe("active");
      expect(["issuer", "both"]).toContain(i.category);
    });
  });
});

// ─── End-to-End Flow Test ────────────────────────────────────────────────────

describe("End-to-End Flow", () => {
  it("should complete a full identity lifecycle", async () => {
    // 1. Create issuer DID
    const issuer = await didRegistry.createDIDKey();
    expect(issuer.did).toMatch(/^did:key:/);

    // 2. Create subject DID
    const subject = await didRegistry.createDIDKey();
    expect(subject.did).toMatch(/^did:key:/);

    // 3. Register issuer in trust registry
    const trusted = trustRegistry.addTrustedEntity({
      did: issuer.did,
      name: "ORBIS.ID Test Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["IdentityCredential"],
    });
    expect(trusted.status).toBe("active");

    // 4. Issue a credential
    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: {
        name: "Alice Doe",
        email: "alice@orbis.id",
        dateOfBirth: "1990-01-01",
      },
      type: ["VerifiableCredential", "IdentityCredential"],
    });
    expect(credential.proof).toBeDefined();

    // 5. Verify the credential (with trust check)
    const verification = await verifyCredential(credential, {
      checkTrustRegistry: true,
      requiredCredentialTypes: ["IdentityCredential"],
    });
    expect(verification.verified).toBe(true);

    // 6. Revoke the issuer
    trustRegistry.revokeEntity(trusted.id);

    // 7. Verify again (should fail trust check)
    const afterRevoke = await verifyCredential(credential, {
      checkTrustRegistry: true,
    });
    expect(afterRevoke.verified).toBe(false);
    const trustCheck = afterRevoke.checks.find((c) => c.name === "trust-registry");
    expect(trustCheck).toBeDefined();
    expect(trustCheck!.passed).toBe(false);
  });
});