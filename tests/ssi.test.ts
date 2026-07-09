/**
 * Integration tests for the ORBIS.ID SSI Backend.
 * Tests DID creation, VC issuance, VC verification, and trust registry.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import * as keyModule from "../src/did/key.js";
import * as webModule from "../src/did/web.js";
import * as didRegistry from "../src/did/index.js";
import { issueCredential } from "../src/vc/issue.js";
import { verifyCredential } from "../src/vc/verify.js";
import * as trustRegistry from "../src/trust/registry.js";
import * as db from "../src/db/metadata.js";
import { initDatabase } from "../src/db/metadata.js";

// Extend default timeout for integration tests (DB calls are slow)
const TEST_TIMEOUT = 15000;

// Initialize database tables before tests
beforeAll(() => {
  initDatabase();
});

// Clean up test data after all tests
afterAll(() => {
  // Remove test-specific trust entries that used test prefix
  const all = trustRegistry.listTrustedEntities();
  for (const entry of all) {
    if (entry.did.includes("test-")) {
      trustRegistry.removeEntity(entry.id);
    }
  }
});

// ─── DID:key Module Tests ────────────────────────────────────────────────────────

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

  it("should return null for non-did:key string", () => {
    expect(keyModule.resolveDIDKey("not-a-did")).toBeNull();
    expect(keyModule.extractPublicKey("not-a-did")).toBeNull();
  });

  it("should create a did:key deterministically from seed", async () => {
    const seed = new Uint8Array(32).fill(42);
    const result1 = await keyModule.fromSeed(seed);
    const result2 = await keyModule.fromSeed(seed);

    expect(result1.did).toBe(result2.did);
    expect(result1.keyPair.publicKey).toEqual(result2.keyPair.publicKey);
  });

  it("should have valid verification method in generated DID", async () => {
    const result = await keyModule.generateDIDKey();
    const vm = result.didDocument.verificationMethod[0]!;
    expect(vm.id).toBe(`${result.did}#${result.did.split(":").pop()}`);
    expect(vm.controller).toBe(result.did);
    expect(vm.publicKeyMultibase).toMatch(/^z/);
  });
});

// ─── DID:web Module Tests ────────────────────────────────────────────────────────

describe("DID:web Module", () => {
  it("should generate a valid did:web without path", async () => {
    const result = await webModule.generateDIDWeb({ domain: "example.com" });

    expect(result.did).toBe("did:web:example.com");
    expect(result.didDocument.id).toBe("did:web:example.com");
    expect(result.didJsonUrl).toBe("https://example.com/.well-known/did.json");
    expect(result.keyPair.publicKey).toHaveLength(32);
    expect(result.didDocument.verificationMethod[0]!.publicKeyMultibase).toMatch(/^z/);
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

  it("should resolve did:web with path to correct URL", () => {
    const { didJsonUrl } = webModule.resolveDIDWeb("did:web:example.com:issuer:abc");
    expect(didJsonUrl).toBe("https://example.com/issuer/abc/did.json");
  });
});

// ─── DID Registry Tests ──────────────────────────────────────────────────────────

describe("DID Registry", () => {
  beforeEach(() => {
    // Clean test DIDs that start with test prefix from previous runs
    const all = db.listDIDs();
    for (const record of all) {
      if (record.did.includes("test-registry-")) {
        db.updateDIDStatus(record.id, "revoked");
      }
    }
  });

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
    const uniqueDomain = `orbis-${uuidv4().slice(0, 8)}.id`;
    const result = await didRegistry.createDIDWeb({ domain: uniqueDomain });

    expect(result.did).toBe(`did:web:${uniqueDomain}`);
    expect(result.id).toBeTruthy();

    const record = didRegistry.getDIDRecord(result.did);
    expect(record).not.toBeNull();
    expect(record!.status).toBe("active");
  });

  it("should resolve a did:key to its DID document", async () => {
    // Use a dynamically generated DID instead of a hardcoded one
    const generated = await didRegistry.createDIDKey();
    const keyDoc = didRegistry.resolveDID(generated.did);
    expect(keyDoc).not.toBeNull();
    expect(keyDoc!.id).toBe(generated.did);
    expect(keyDoc!.verificationMethod).toHaveLength(1);
  });

  it("should resolve a did:web identifier", () => {
    const webDoc = didRegistry.resolveDID("did:web:example.com");
    expect(webDoc).not.toBeNull();
    expect(webDoc!.id).toBe("did:web:example.com");
  });

  it("should return null for invalid DID", () => {
    expect(didRegistry.resolveDID("invalid")).toBeNull();
  });

  it("should revoke a DID", async () => {
    const result = await didRegistry.createDIDKey();
    didRegistry.revokeDID(result.id);

    const record = didRegistry.getDIDRecord(result.did);
    expect(record!.status).toBe("revoked");
  });

  it("should list DIDs", async () => {
    await didRegistry.createDIDKey();
    const list = didRegistry.listDIDs();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("should extract public key from registry DID", async () => {
    const result = await didRegistry.createDIDKey();
    const pubKey = didRegistry.extractPublicKey(result.did);
    expect(pubKey).not.toBeNull();
    expect(pubKey!.length).toBe(32);
  });
});

// ─── VC Issuance Tests ───────────────────────────────────────────────────────────

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

  it("should issue a VC under performance threshold", async () => {
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
    expect(elapsed).toBeLessThan(5000); // Allow 5s for cold start
  });

  it("should issue a VC with additional contexts", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const result = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { score: 95 },
      additionalContexts: ["https://example.com/custom/v1"],
    });

    expect(result.credential["@context"]).toContain("https://example.com/custom/v1");
  });

  it("should issue a VC with schema URL", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const result = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { license: "ABC123" },
      schemaUrl: "https://schemas.example.com/license/v1",
    });

    expect(result.credential.credentialSchema).toBeDefined();
    expect(result.credential.credentialSchema!.id).toBe("https://schemas.example.com/license/v1");
    expect(result.credential.credentialSchema!.type).toBe("JsonSchema");
  });
});

// ─── VC Verification Tests ───────────────────────────────────────────────────────

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

  it("should reject credential with missing @context", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Dave" },
    });

    // Remove @context
    delete (credential as any)["@context"];

    const result = await verifyCredential(credential);
    expect(result.verified).toBe(false);
    expect(result.checks.some((c) => c.name === "structure" && !c.passed)).toBe(true);
  });

  it("should reject credential with missing proof value", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Dave" },
    });

    // Remove proof value
    delete credential.proof.proofValue;

    const result = await verifyCredential(credential);
    expect(result.verified).toBe(false);
  });

  it("should include check results from verification", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Frank" },
    });

    const result = await verifyCredential(credential);

    expect(result.credentialId).toBe(credential.id);
    expect(result.issuerDID).toBe(credential.issuer);
    expect(result.subjectDID).toBe(credential.credentialSubject.id);
    expect(result.timestamp).toBeTruthy();
  });
});

// ─── Trust Registry Tests ────────────────────────────────────────────────────────

describe("Trust Registry", () => {
  const unique = uuidv4().slice(0, 8); // Unique per test run

  afterAll(() => {
    // Clean up all test entries
    const all = trustRegistry.listTrustedEntities();
    for (const entry of all) {
      if (entry.did.includes(`test-${unique}`)) {
        trustRegistry.removeEntity(entry.id);
      }
    }
  });

  it("should register a trusted issuer", () => {
    const did = `did:key:test-issuer-${unique}`;
    const entry = trustRegistry.addTrustedEntity({
      did,
      name: "ORBIS.ID Government Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["IdentityCredential", "VerifiableCredential"],
    });

    expect(entry.did).toBe(did);
    expect(entry.status).toBe("active");
    expect(entry.authorizedCredentialTypes).toContain("IdentityCredential");
  });

  it("should reject duplicate registration", () => {
    const did = `did:key:test-duplicate-${unique}`;
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
    const did = `did:key:test-check-${unique}`;
    trustRegistry.addTrustedEntity({
      did,
      name: "Trust Check Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["VerifiableCredential"],
    });

    expect(trustRegistry.isTrustedIssuer(did)).toBe(true);
    expect(trustRegistry.isTrustedIssuer(did, ["VerifiableCredential"])).toBe(true);
    expect(trustRegistry.isTrustedIssuer(did, ["UnknownCredential"])).toBe(false);
    expect(trustRegistry.isTrustedIssuer(`did:key:test-not-trusted-${unique}`)).toBe(false);
  });

  it("should suspend and reactivate an entity", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: `did:key:test-suspend-${unique}`,
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

  it("should revoke an entity and remove from trust check", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: `did:key:test-revoke-${unique}`,
      name: "Revoke Test",
    });

    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(true);
    trustRegistry.revokeEntity(entry.id);
    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(false);
  });

  it("should remove an entity entirely", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: `did:key:test-remove-${unique}`,
      name: "Remove Test",
    });

    trustRegistry.removeEntity(entry.id);
    expect(trustRegistry.getTrustedIssuer(entry.did)).toBeNull();
  });

  it("should list trusted entities filtered by category", () => {
    const did = `did:key:test-category-${unique}`;
    trustRegistry.addTrustedEntity({
      did,
      name: "Category Test",
      category: "verifier",
    });

    const verifiers = trustRegistry.listTrustedEntities("verifier");
    expect(verifiers.some((v) => v.did === did)).toBe(true);

    const issuers = trustRegistry.listTrustedEntities("issuer");
    // Our verifier should NOT appear in issuers list
    expect(issuers.some((i) => i.did === did)).toBe(false);
  });

  it("should register entity with 'both' category", () => {
    const entry = trustRegistry.addTrustedEntity({
      did: `did:key:test-both-${unique}`,
      name: "Both Role",
      category: "both",
    });

    expect(entry.category).toBe("both");
    expect(trustRegistry.isTrustedIssuer(entry.did)).toBe(true);
  });
});

// ─── Trust Registry + VC Integration Tests ───────────────────────────────────────

describe("Trust Registry + VC Integration", () => {
  const unique = uuidv4().slice(0, 8);

  afterAll(() => {
    // Clean up test entries
    const all = trustRegistry.listTrustedEntities();
    for (const entry of all) {
      if (entry.did.includes(`test-${unique}`)) {
        trustRegistry.removeEntity(entry.id);
      }
    }
  });

  it("should verify a credential with trust registry check", { timeout: TEST_TIMEOUT }, async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    // Register issuer in trust registry
    trustRegistry.addTrustedEntity({
      did: issuer.did,
      name: "Test Issuer",
      category: "issuer",
      authorizedCredentialTypes: ["VerifiableCredential", "IdentityCredential"],
    });

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Trust Check" },
      type: ["VerifiableCredential", "IdentityCredential"],
    });

    const result = await verifyCredential(credential, {
      checkTrustRegistry: true,
      requiredCredentialTypes: ["IdentityCredential"],
    });

    expect(result.verified).toBe(true);
    expect(result.checks.some((c) => c.name === "trust-registry" && c.passed)).toBe(true);
  });

  it("should fail trust registry check for unregistered issuer", async () => {
    // Create a DID but DON'T register it in trust registry
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Unregistered" },
    });

    const result = await verifyCredential(credential, {
      checkTrustRegistry: true,
    });

    expect(result.verified).toBe(false);
    expect(result.checks.some((c) => c.name === "trust-registry" && !c.passed)).toBe(true);
  });

  it("should fail trust check for revoked issuer", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const trusted = trustRegistry.addTrustedEntity({
      did: issuer.did,
      name: `test-revokable-${unique}`,
      category: "issuer",
      authorizedCredentialTypes: ["VerifiableCredential"],
    });

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Revocable Issuer Test" },
    });

    // First verify should pass
    const beforeRevoke = await verifyCredential(credential, { checkTrustRegistry: true });
    expect(beforeRevoke.verified).toBe(true);

    // Revoke the issuer
    trustRegistry.revokeEntity(trusted.id);

    // Now verify should fail
    const afterRevoke = await verifyCredential(credential, { checkTrustRegistry: true });
    expect(afterRevoke.verified).toBe(false);
    const trustCheck = afterRevoke.checks.find((c) => c.name === "trust-registry");
    expect(trustCheck).toBeDefined();
    expect(trustCheck!.passed).toBe(false);
  });
});

// ─── End-to-End Flow Tests ───────────────────────────────────────────────────────

describe("End-to-End Flow", () => {
  const unique = uuidv4().slice(0, 8);

  afterAll(() => {
    // Clean up test entries in trust registry
    const all = trustRegistry.listTrustedEntities();
    for (const entry of all) {
      if (entry.did.includes(`test-${unique}`)) {
        trustRegistry.removeEntity(entry.id);
      }
    }
  });

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
      name: `test-e2e-${unique}`,
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

  it("should support multiple credential types for same issuer", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    trustRegistry.addTrustedEntity({
      did: issuer.did,
      name: `test-multi-type-${unique}`,
      category: "issuer",
      authorizedCredentialTypes: ["IdentityCredential", "DiplomaCredential"],
    });

    // Issue two different types of credentials
    const { credential: vc1 } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { name: "Multi Type User" },
      type: ["VerifiableCredential", "IdentityCredential"],
    });

    const { credential: vc2 } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { degree: "BSc Computer Science" },
      type: ["VerifiableCredential", "DiplomaCredential"],
    });

    const result1 = await verifyCredential(vc1, { checkTrustRegistry: true, requiredCredentialTypes: ["IdentityCredential"] });
    expect(result1.verified).toBe(true);

    const result2 = await verifyCredential(vc2, { checkTrustRegistry: true, requiredCredentialTypes: ["DiplomaCredential"] });
    expect(result2.verified).toBe(true);
  });
});

// ─── Database Metadata Tests ─────────────────────────────────────────────────────

describe("Database Metadata", () => {
  it("should store and retrieve credential metadata", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential, credentialId } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { meta: "data" },
    });

    const record = db.getCredentialByCredentialId(credential.id);
    expect(record).not.toBeNull();
    expect(record!.issuer_did).toBe(issuer.did);
    expect(record!.subject_did).toBe(subject.did);
    expect(record!.credential_id).toBe(credential.id);
    expect(record!.status).toBe("active");
  });

  it("should list credentials by issuer", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { listed: true },
    });

    const list = db.listCredentials(issuer.did);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((r) => r.issuer_did === issuer.did)).toBe(true);
  });

  it("should log verifications to database", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { loggable: true },
    });

    await verifyCredential(credential);

    const logs = db.getVerificationsForCredential(credential.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.credential_id).toBe(credential.id);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("should handle claims with various data types", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: {
        string: "value",
        number: 42,
        boolean: true,
        nullValue: null,
        nested: { key: "value" },
        array: [1, 2, 3],
      },
    });

    expect(credential.credentialSubject.string).toBe("value");
    expect(credential.credentialSubject.number).toBe(42);
    expect(credential.credentialSubject.boolean).toBe(true);
    expect(credential.credentialSubject.nullValue).toBeNull();
    expect(credential.credentialSubject.nested.key).toBe("value");
    expect(credential.credentialSubject.array).toEqual([1, 2, 3]);
  });

  it("should handle empty claims", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: {},
    });

    expect(credential.credentialSubject.id).toBe(subject.did);
    expect(Object.keys(credential.credentialSubject).length).toBe(1); // Only 'id'
  });

  it("should handle very long claim values", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();
    const longString = "x".repeat(10000);

    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { longField: longString },
    });

    expect(credential.credentialSubject.longField).toBe(longString);
  });
});