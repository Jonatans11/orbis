/**
 * ORBIS.ID SSI Backend Server — Security Hardened Edition.
 * Express server providing DID management, VC issuance/verification,
 * trust registry APIs, JWT authentication, audit logging, encryption at rest,
 * input validation, security headers, and GDPR compliance hooks.
 *
 * Serves on port 3000 by default, designed to be the API backend
 * for the ORBIS.ID platform.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { randomBytes, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { initDatabase, listCredentials, getVerificationsForCredential } from "./db/metadata.js";
import * as didRegistry from "./did/index.js";
import { issueCredential } from "./vc/issue.js";
import { verifyCredential } from "./vc/verify.js";
import { createZKProof, verifyZKProof } from "./vc/zk.js";
import * as trustRegistry from "./trust/registry.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import * as didcomm from "./didcomm/index.js";
import * as didcommTypes from "./didcomm/types.js";
import * as didcommCalls from "./didcomm/calls.js";
import { v4 as uuidv4 } from "uuid";
import { extractPublicKey } from "./did/key.js";
import gatewayRoutes from "./gateway/routes.js";
import { usageMiddleware } from "./gateway/middleware.js";

// ─── Security Module Imports ─────────────────────────────────────────────────

// JWT Authentication
import {
  initAuthTables,
  registerHandler,
  loginHandler,
  meHandler,
  changePasswordHandler,
  linkDIDHandler,
  requireJwt,
} from "./security/jwt.js";

// Audit Logging
import {
  logAudit,
  getClientIp,
  getActorInfo,
} from "./security/audit.js";

// Input Validation
import {
  validate,
  createDIDSchema,
  issueCredentialSchema,
  verifyCredentialSchema,
  createZKProofSchema,
  verifyZKProofSchema,
  registerTrustEntitySchema,
  sendDIDCommMessageSchema,
  trustPingSchema,
  createOOBSchema,
  updateMessageStatusSchema,
} from "./security/validation.js";

// Security Headers
import {
  securityHeaders,
  rateLimitHeaders,
} from "./security/headers.js";

// GDPR Compliance
import {
  exportDataHandler,
  deleteDataHandler,
} from "./security/gdpr.js";

// Encryption at Rest
import { verifyEncryptionKey } from "./security/encryption.js";

// ─── Server Setup ────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Global Security Middleware ──────────────────────────────────────────────

// Apply security headers to all responses
app.use(securityHeaders);

// Apply rate limit headers to all responses
app.use(rateLimitHeaders);

// ─── Database Initialization ─────────────────────────────────────────────────

initDatabase();
initAuthTables();

// Verify encryption key on startup
if (!verifyEncryptionKey()) {
  console.warn("[SECURITY] ⚠ Encryption key verification FAILED — encryption at rest may not work correctly");
} else {
  console.log("[SECURITY] ✅ Encryption key verified successfully");
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    service: "orbis-ssi-backend",
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Endpoints (no JWT required) ────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user account.
 * Body: { email, password, displayName }
 */
app.post("/api/auth/register", async (req: Request, res: Response) => {
  await registerHandler(req, res);
});

/**
 * POST /api/auth/login
 * Authenticate and receive a JWT token.
 * Body: { email, password }
 */
app.post("/api/auth/login", async (req: Request, res: Response) => {
  await loginHandler(req, res);
});

// ─── Auth Endpoints (JWT required) ───────────────────────────────────────────

/**
 * GET /api/auth/me
 * Get current user profile from JWT token.
 */
app.get("/api/auth/me", requireJwt, (req: Request, res: Response) => {
  meHandler(req, res);
});

/**
 * PUT /api/auth/password
 * Change password (requires JWT).
 * Body: { currentPassword, newPassword }
 */
app.put("/api/auth/password", requireJwt, async (req: Request, res: Response) => {
  await changePasswordHandler(req, res);
});

/**
 * PUT /api/auth/did
 * Link a DID to the user account (requires JWT).
 * Body: { did }
 */
app.put("/api/auth/did", requireJwt, (req: Request, res: Response) => {
  linkDIDHandler(req, res);
});

// ─── Compliance Endpoints (GDPR — JWT required) ─────────────────────────────

/**
 * GET /api/compliance/data
 * Export all personal data for the authenticated user (GDPR Art. 15).
 */
app.get("/api/compliance/data", requireJwt, (req: Request, res: Response) => {
  exportDataHandler(req, res);
});

/**
 * DELETE /api/compliance/data
 * Right to be forgotten — anonymize/delete all user data (GDPR Art. 17).
 * Body: { confirmation: "DELETE" }
 */
app.delete("/api/compliance/data", requireJwt, (req: Request, res: Response) => {
  deleteDataHandler(req, res);
});

// ─── DID Endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/did/create
 * Create a new DID (did:key or did:web) with input validation and audit logging.
 * Body: { method: "key" | "web", domain?: string, path?: string }
 */
app.post("/api/did/create", validate(createDIDSchema), async (req: Request, res: Response) => {
  try {
    const { method, domain, path } = req.body;

    let result;
    if (method === "key") {
      result = await didRegistry.createDIDKey();
    } else {
      // domain already validated by Zod, but double-check for safety
      if (!domain) {
        res.status(400).json({ error: true, message: "domain is required for did:web" });
        return;
      }
      result = await didRegistry.createDIDWeb({ domain, path });
    }

    // Audit log: DID creation
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "did.create",
      entityType: "did",
      entityId: result.id,
      result: "success",
      message: `Created ${method} DID: ${result.did}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      did: result.did,
      method: result.method,
      verificationMethodId: result.verificationMethodId,
      didDocument: result.didDocument,
      // NEVER expose the secret key in production - this is for development testing
      ...(process.env.NODE_ENV !== "production" && {
        _debug: {
          publicKey: Buffer.from(result.keyPair.publicKey).toString("hex"),
        },
      }),
    });
  } catch (err: any) {
    // Audit log: DID creation failure
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "did.create",
      entityType: "did",
      entityId: undefined,
      result: "failure",
      message: `DID creation failed: ${err.message}`,
      ipAddress: getClientIp(req),
    });

    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/did/resolve/:did
 * Resolve a DID to its DID Document.
 */
app.get("/api/did/resolve/:did", (req: Request, res: Response) => {
  try {
    const did = req.params.did as string;
    if (!did || !did.startsWith("did:")) {
      res.status(400).json({ error: true, message: "Invalid DID format" });
      return;
    }

    const didDocument = didRegistry.resolveDID(did);
    if (!didDocument) {
      res.status(404).json({ error: true, message: `DID not found: ${did}` });
      return;
    }

    // Also get the database record
    const record = didRegistry.getDIDRecord(did);

    res.json({
      success: true,
      did,
      didDocument,
      record: record
        ? {
            id: record.id,
            status: record.status,
            created_at: record.created_at,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/did/list
 * List all DIDs, optionally filtered by method.
 */
app.get("/api/did/list", (req: Request, res: Response) => {
  try {
    const method = req.query.method as string | undefined;
    const methods = method ? [method as didRegistry.DIDMethod] : undefined;
    const records = methods ? didRegistry.listDIDs(methods[0]) : didRegistry.listDIDs();

    res.json({
      success: true,
      count: records.length,
      dids: records.map((r) => ({
        id: r.id,
        did: r.did,
        method: r.method,
        status: r.status,
        created_at: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/did/:id/revoke
 * Revoke a DID with audit logging.
 */
app.put("/api/did/:id/revoke", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    didRegistry.revokeDID(id);

    // Audit log: DID revocation
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "did.revoke",
      entityType: "did",
      entityId: id,
      result: "success",
      message: `DID revoked: ${id}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "DID revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── VC Endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/vc/issue
 * Issue a Verifiable Credential with input validation, audit logging, and encryption.
 * Body: { issuerDID, issuerSecretKey (hex), subjectDID, claims, type?, schemaUrl?, expirationDate? }
 */
app.post("/api/vc/issue", validate(issueCredentialSchema), async (req: Request, res: Response) => {
  try {
    const {
      issuerDID,
      issuerSecretKey,
      subjectDID,
      claims,
      type,
      schemaUrl,
      expirationDate,
    } = req.body;

    // Decode the secret key
    const secretKeyBytes = Buffer.from(issuerSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "issuerSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await issueCredential({
      issuerDID,
      issuerSecretKey: secretKeyBytes,
      subjectDID,
      claims,
      type: type || ["VerifiableCredential"],
      schemaUrl,
      expirationDate,
    });

    const startTime = Date.now();
    const elapsed = Date.now() - startTime;

    // Audit log: VC issuance
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "vc.issue",
      entityType: "credential",
      entityId: result.credentialId,
      result: "success",
      message: `Issued credential for ${subjectDID} by ${issuerDID}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      credentialId: result.credentialId,
      credential: result.credential,
      performance: {
        issuanceTimeMs: elapsed,
      },
    });
  } catch (err: any) {
    // Audit log: VC issuance failure
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "vc.issue",
      entityType: "credential",
      entityId: undefined,
      result: "failure",
      message: `Credential issuance failed: ${err.message}`,
      ipAddress: getClientIp(req),
    });

    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/vc/verify
 * Verify a Verifiable Credential with input validation and audit logging.
 * Body: { credential, verifierDID?, checkTrustRegistry?, requiredCredentialTypes? }
 */
app.post("/api/vc/verify", validate(verifyCredentialSchema), async (req: Request, res: Response) => {
  try {
    const { credential, verifierDID, checkTrustRegistry, requiredCredentialTypes } = req.body;

    const result = await verifyCredential(credential, {
      verifierDID,
      checkTrustRegistry: checkTrustRegistry || false,
      requiredCredentialTypes,
    });

    // Audit log: VC verification
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "vc.verify",
      entityType: "credential",
      entityId: credential.id || "unknown",
      result: result.verified ? "success" : "failure",
      message: result.verified
        ? `Credential verified successfully`
        : `Credential verification failed: ${result.checks.find(c => !c.passed)?.message || "Verification checks failed"}`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: result.verified,
      ...result,
    });
  } catch (err: any) {
    // Audit log: VC verification error
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "vc.verify",
      entityType: "credential",
      entityId: undefined,
      result: "failure",
      message: `Verification error: ${err.message}`,
      ipAddress: getClientIp(req),
    });

    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/vc/credentials
 * List issued credentials, optionally filtered by issuer.
 */
app.get("/api/vc/credentials", (req: Request, res: Response) => {
  try {
    const issuer = req.query.issuer as string | undefined;
    const records = issuer
      ? listCredentials(issuer)
      : listCredentials();

    res.json({
      success: true,
      count: records.length,
      credentials: records.map((r) => ({
        credential_id: r.credential_id,
        issuer_did: r.issuer_did,
        subject_did: r.subject_did,
        type: r.type,
        status: r.status,
        issuance_date: r.issuance_date,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/vc/credentials/:credentialId/verifications
 * Get verification history for a credential.
 */
app.get("/api/vc/credentials/:credentialId/verifications", (req: Request, res: Response) => {
  try {
    const credentialId = req.params.credentialId as string;
    const verifications = getVerificationsForCredential(credentialId);

    res.json({
      success: true,
      count: verifications.length,
      verifications: verifications.map((v) => ({
        verified: v.verified,
        reason: v.reason,
        timestamp: v.timestamp,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── ZK Proof Endpoints ───────────────────────────────────────────────────────

/**
 * POST /api/vc/zk/prove
 * Create a ZK selective disclosure proof from a Verifiable Credential.
 */
app.post("/api/vc/zk/prove", validate(createZKProofSchema), async (req: Request, res: Response) => {
  try {
    const {
      credential,
      holderDID,
      holderSecretKey,
      revealFields,
      hideFields,
      derivedPredicates,
      challenge,
      domain,
    } = req.body;

    const secretKeyBytes = Buffer.from(holderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "holderSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await createZKProof({
      credential,
      holderDID,
      holderSecretKey: secretKeyBytes,
      revealFields,
      hideFields,
      derivedPredicates,
      challenge,
      domain,
    });

    // Audit log: ZK proof creation
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "zk.prove",
      entityType: "zk_proof",
      entityId: result.proofId,
      result: "success",
      message: `ZK proof created by ${holderDID}`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      proofId: result.proofId,
      proof: result.proof,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/vc/zk/verify
 * Verify a ZK selective disclosure proof.
 */
app.post("/api/vc/zk/verify", validate(verifyZKProofSchema), async (req: Request, res: Response) => {
  try {
    const { proof, verifierDID, challenge, checkTrustRegistry, requiredCredentialTypes } = req.body;

    const result = await verifyZKProof(proof, {
      verifierDID,
      challenge,
      checkTrustRegistry: checkTrustRegistry || false,
      requiredCredentialTypes,
    });

    // Audit log: ZK proof verification
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "zk.verify",
      entityType: "zk_proof",
      entityId: proof.id || "unknown",
      result: result.verified ? "success" : "failure",
      message: result.verified
        ? "ZK proof verified successfully"
        : `ZK proof verification failed: ${result.checks.find(c => !c.passed)?.message || "Verification checks failed"}`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: result.verified,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/vc/zk/challenge
 * Generate a challenge for a ZK proof (prevents replay attacks).
 */
app.post("/api/vc/zk/challenge", (_req: Request, res: Response) => {
  const challenge = randomBytes(32).toString("hex");
  res.json({
    success: true,
    challenge,
    expiresIn: 300, // 5 minutes
  });
});

/**
 * POST /api/vc/verify-zk
 * Simplified ZK proof verification endpoint.
 * Accepts a proof + public inputs and performs hash-based commitment verification.
 * Body: { proof, publicInputs?: Record<string,unknown>, verifierDID?, challenge? }
 */
app.post("/api/vc/verify-zk", async (req: Request, res: Response) => {
  try {
    const { proof, publicInputs, verifierDID, challenge } = req.body;

    if (!proof) {
      res.status(400).json({ error: true, message: "proof is required" });
      return;
    }

    const result = await verifyZKProof(proof, {
      verifierDID,
      challenge,
      checkTrustRegistry: false,
    });

    // Audit log: ZK verification
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "zk.verify",
      entityType: "zk_proof",
      entityId: proof.id || "unknown",
      result: result.verified ? "success" : "failure",
      message: result.verified
        ? "ZK proof verified (verify-zk endpoint)"
        : `ZK verification failed: ${result.checks.find(c => !c.passed)?.message || "Unknown"}`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: result.verified,
      verified: result.verified,
      checks: result.checks,
      proofId: result.proofId,
      holderDID: result.holderDID,
      timestamp: result.timestamp,
      // Include proof details for transparency
      proofDetails: {
        hiddenFields: proof.hiddenFields?.length || 0,
        revealedFields: proof.revealedFields?.length || 0,
        hasHolderBinding: true,
        hasOriginalVC: !!proof.verifiableCredential,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Trust Registry Endpoints ────────────────────────────────────────────────

/**
 * POST /api/trust/register
 * Register a trusted entity with input validation and audit logging.
 */
app.post("/api/trust/register", validate(registerTrustEntitySchema), (req: Request, res: Response) => {
  try {
    const { did, name, category, authorizedCredentialTypes, addedBy } = req.body;

    const entry = trustRegistry.addTrustedEntity({
      did,
      name,
      category,
      authorizedCredentialTypes,
      addedBy,
    });

    // Audit log: Trust registry registration
    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "trust.register",
      entityType: "trust_entry",
      entityId: entry.id,
      result: "success",
      message: `Registered trusted entity: ${name} (${did})`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      entry,
    });
  } catch (err: any) {
    if (err.message.includes("already in the trust registry")) {
      res.status(409).json({ error: true, message: err.message });
      return;
    }
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/trust/issuers
 * List all trusted issuers.
 */
app.get("/api/trust/issuers", (_req: Request, res: Response) => {
  try {
    const issuers = trustRegistry.listActiveIssuers();
    res.json({
      success: true,
      count: issuers.length,
      issuers,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/trust/entities
 * List all trust registry entries, optionally filtered by category.
 */
app.get("/api/trust/entities", (req: Request, res: Response) => {
  try {
    const category = req.query.category as "issuer" | "verifier" | "both" | undefined;
    const entities = category
      ? trustRegistry.listTrustedEntities(category)
      : trustRegistry.listTrustedEntities();

    res.json({
      success: true,
      count: entities.length,
      entities,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/trust/check/:did
 * Check if a DID is a trusted issuer.
 */
app.get("/api/trust/check/:did", (req: Request, res: Response) => {
  try {
    const did = req.params.did as string;
    const entry = trustRegistry.getTrustedIssuer(did);

    res.json({
      success: true,
      did,
      trusted: entry !== null && entry.status === "active",
      entry: entry || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/trust/:id/suspend
 * Suspend a trusted entity with audit logging.
 */
app.put("/api/trust/:id/suspend", (req: Request, res: Response) => {
  try {
    trustRegistry.suspendEntity(req.params.id as string);

    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "trust.suspend",
      entityType: "trust_entry",
      entityId: req.params.id as string,
      result: "success",
      message: `Trust entity suspended: ${req.params.id as string}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "Entity suspended" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/trust/:id/reactivate
 * Reactivate a suspended entity with audit logging.
 */
app.put("/api/trust/:id/reactivate", (req: Request, res: Response) => {
  try {
    trustRegistry.reactivateEntity(req.params.id as string);

    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "trust.reactivate",
      entityType: "trust_entry",
      entityId: req.params.id as string,
      result: "success",
      message: `Trust entity reactivated: ${req.params.id as string}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "Entity reactivated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/trust/:id
 * Remove an entity from the trust registry with audit logging.
 */
app.delete("/api/trust/:id", (req: Request, res: Response) => {
  try {
    trustRegistry.removeEntity(req.params.id as string);

    const actor = getActorInfo(req);
    logAudit({
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "trust.remove",
      entityType: "trust_entry",
      entityId: req.params.id as string,
      result: "success",
      message: `Trust entity removed: ${req.params.id as string}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: "Entity removed from trust registry" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Gateway Routes ──────────────────────────────────────────────────────────

// Mount developer gateway routes (these handle their own auth internally)
app.use("/api/gateway", gatewayRoutes);
app.use("/api/developer", gatewayRoutes);

// Apply usage tracking to all protected API routes
app.use("/api", usageMiddleware);

// ─── DIDComm API Endpoints ────────────────────────────────────────────────────

/**
 * POST /api/didcomm/send
 * Send an encrypted DIDComm message with input validation.
 */
app.post("/api/didcomm/send", validate(sendDIDCommMessageSchema), async (req: Request, res: Response) => {
  try {
    const { fromDID, toDID, type, body, threadId, senderSecretKey, encryptionType } = req.body;

    // Decode secret key
    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    // Get recipient's public key
    const recipientPubKey = extractPublicKey(toDID);
    if (!recipientPubKey) {
      res.status(400).json({ error: true, message: `Cannot resolve public key for recipient: ${toDID}` });
      return;
    }

    // Pick message type
    const msgType = type || didcommTypes.BASIC_MESSAGE_TYPE;

    const msg: didcommTypes.DIDCommMessage = {
      from: fromDID,
      to: [toDID],
      type: msgType,
      id: uuidv4(),
      thid: threadId,
      created_time: Math.floor(Date.now() / 1000),
      body,
    };

    const stored = await didcomm.encryptAndStoreMessage(
      msg,
      secretKeyBytes,
      recipientPubKey,
      encryptionType || "authcrypt"
    );

    res.status(201).json({
      success: true,
      messageId: msg.id,
      storedMessage: {
        id: stored.id,
        msg_type: stored.msg_type,
        from_did: stored.from_did,
        to_did: stored.to_did,
        status: stored.status,
        created_at: stored.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/inbox
 * Retrieve inbox messages for a DID.
 */
app.get("/api/didcomm/inbox", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) {
      res.status(400).json({ error: true, message: "did query parameter is required" });
      return;
    }

    let messages = didcomm.getInbox(did);

    // Optional status filter
    const statusFilter = req.query.status as string | undefined;
    if (statusFilter && ["sent", "delivered", "read"].includes(statusFilter)) {
      messages = messages.filter((m) => m.status === statusFilter);
    }

    res.json({
      success: true,
      count: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        msg_type: m.msg_type,
        from_did: m.from_did,
        to_did: m.to_did,
        body: m.body,
        status: m.status,
        thread_id: m.thread_id,
        created_at: m.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/messages/:id
 * Get a specific DIDComm message by its database ID.
 */
app.get("/api/didcomm/messages/:id", (req: Request, res: Response) => {
  try {
    const messageId = req.params.id as string;
    const message = didcomm.getMessageById(messageId);

    if (!message) {
      res.status(404).json({ error: true, message: "Message not found" });
      return;
    }

    // Mark as read when retrieved
    didcomm.markAsRead(messageId);

    res.json({
      success: true,
      message: {
        id: message.id,
        msg_type: message.msg_type,
        from_did: message.from_did,
        to_did: message.to_did,
        body: message.body,
        status: message.status,
        thread_id: message.thread_id,
        created_at: message.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/didcomm/messages/:id/status
 * Update the status of a message with input validation.
 */
app.put("/api/didcomm/messages/:id/status", validate(updateMessageStatusSchema), (req: Request, res: Response) => {
  try {
    const messageId = req.params.id as string;
    const { status } = req.body;

    const message = didcomm.getMessageById(messageId);
    if (!message) {
      res.status(404).json({ error: true, message: "Message not found" });
      return;
    }

    if (status === "delivered") {
      didcomm.markAsDelivered(messageId);
    } else {
      didcomm.markAsRead(messageId);
    }

    res.json({ success: true, message: `Message marked as ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/didcomm/trust-ping
 * Send a DIDComm trust ping with input validation.
 */
app.post("/api/didcomm/trust-ping", validate(trustPingSchema), async (req: Request, res: Response) => {
  try {
    const { fromDID, toDID, senderSecretKey, comment } = req.body;

    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    const recipientPubKey = extractPublicKey(toDID);
    if (!recipientPubKey) {
      res.status(400).json({ error: true, message: `Cannot resolve public key for recipient: ${toDID}` });
      return;
    }

    const stored = await didcomm.sendTrustPing(fromDID, toDID, secretKeyBytes, recipientPubKey, comment);

    res.status(201).json({
      success: true,
      messageId: stored.id,
      status: stored.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/didcomm/oob/create
 * Create an out-of-band invitation with input validation.
 */
app.post("/api/didcomm/oob/create", validate(createOOBSchema), (req: Request, res: Response) => {
  try {
    const { fromDID, label, goal, goalCode, endpoint } = req.body;

    const invitation = didcomm.createOOBInvitation(fromDID, label, { goal, goalCode, endpoint });

    res.status(201).json({
      success: true,
      invitationId: invitation.record.id,
      invitationUrl: invitation.invitationUrl,
      messageId: invitation.message.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/oob/parse
 * Parse an out-of-band invitation URL.
 */
app.get("/api/didcomm/oob/parse", (req: Request, res: Response) => {
  try {
    const invitationUrl = req.query.url as string;
    if (!invitationUrl) {
      res.status(400).json({ error: true, message: "url query parameter is required" });
      return;
    }

    const parsed = didcomm.parseOOBInvitation(invitationUrl);
    if (!parsed) {
      res.status(400).json({ error: true, message: "Invalid or malformed invitation URL" });
      return;
    }

    res.json({
      success: true,
      invitation: parsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/oob/invitations
 * List active OOB invitations for a DID.
 */
app.get("/api/didcomm/oob/invitations", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) {
      res.status(400).json({ error: true, message: "did query parameter is required" });
      return;
    }

    const invitations = didcomm.listActiveInvitations(did);

    res.json({
      success: true,
      count: invitations.length,
      invitations,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/didcomm/oob/:id/consume
 * Consume (mark used) an out-of-band invitation.
 */
app.put("/api/didcomm/oob/:id/consume", (req: Request, res: Response) => {
  try {
    const invitationId = req.params.id as string;
    const invitation = didcomm.getOOBInvitation(invitationId);

    if (!invitation) {
      res.status(404).json({ error: true, message: "Invitation not found" });
      return;
    }

    didcomm.consumeOOBInvitation(invitationId);

    res.json({ success: true, message: "Invitation consumed" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── WebRTC Call Signaling API Endpoints ─────────────────────────────────────

/**
 * POST /api/didcomm/offer
 * Create a WebRTC offer for a peer DID.
 * Body: { callerDID, calleeDID, sdp, senderSecretKey (hex) }
 */
app.post("/api/didcomm/offer", async (req: Request, res: Response) => {
  try {
    const { callerDID, calleeDID, sdp, senderSecretKey } = req.body;

    if (!callerDID) {
      res.status(400).json({ error: true, message: "callerDID is required" });
      return;
    }
    if (!calleeDID) {
      res.status(400).json({ error: true, message: "calleeDID is required" });
      return;
    }
    if (!sdp) {
      res.status(400).json({ error: true, message: "sdp is required" });
      return;
    }
    if (!senderSecretKey) {
      res.status(400).json({ error: true, message: "senderSecretKey is required (hex-encoded)" });
      return;
    }

    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await didcommCalls.createOffer({
      callerDID,
      calleeDID,
      sdp,
      senderSecretKey: secretKeyBytes,
    });

    res.status(201).json({
      success: true,
      callId: result.callId,
      messageId: result.messageId,
      status: result.storedCall.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/didcomm/answer
 * Accept a WebRTC offer with an answer.
 * Body: { callId, answererDID, callerDID, sdp, senderSecretKey (hex) }
 */
app.post("/api/didcomm/answer", async (req: Request, res: Response) => {
  try {
    const { callId, answererDID, callerDID, sdp, senderSecretKey } = req.body;

    if (!callId) {
      res.status(400).json({ error: true, message: "callId is required" });
      return;
    }
    if (!answererDID) {
      res.status(400).json({ error: true, message: "answererDID is required" });
      return;
    }
    if (!callerDID) {
      res.status(400).json({ error: true, message: "callerDID is required" });
      return;
    }
    if (!sdp) {
      res.status(400).json({ error: true, message: "sdp is required" });
      return;
    }
    if (!senderSecretKey) {
      res.status(400).json({ error: true, message: "senderSecretKey is required (hex-encoded)" });
      return;
    }

    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await didcommCalls.createAnswer({
      callId,
      answererDID,
      callerDID,
      sdp,
      senderSecretKey: secretKeyBytes,
    });

    res.status(201).json({
      success: true,
      messageId: result.messageId,
      status: "connecting",
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/didcomm/ice-candidate
 * Exchange an ICE candidate with a peer.
 * Body: { callId, fromDID, toDID, candidate, senderSecretKey (hex) }
 */
app.post("/api/didcomm/ice-candidate", async (req: Request, res: Response) => {
  try {
    const { callId, fromDID, toDID, candidate, senderSecretKey } = req.body;

    if (!callId) {
      res.status(400).json({ error: true, message: "callId is required" });
      return;
    }
    if (!fromDID) {
      res.status(400).json({ error: true, message: "fromDID is required" });
      return;
    }
    if (!toDID) {
      res.status(400).json({ error: true, message: "toDID is required" });
      return;
    }
    if (!candidate) {
      res.status(400).json({ error: true, message: "candidate is required" });
      return;
    }
    if (!senderSecretKey) {
      res.status(400).json({ error: true, message: "senderSecretKey is required (hex-encoded)" });
      return;
    }

    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await didcommCalls.sendICECandidate({
      callId,
      fromDID,
      toDID,
      candidate,
      senderSecretKey: secretKeyBytes,
    });

    res.status(201).json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/didcomm/call/end
 * End an active call.
 * Body: { callId, fromDID, toDID, senderSecretKey (hex), reason? }
 */
app.post("/api/didcomm/call/end", async (req: Request, res: Response) => {
  try {
    const { callId, fromDID, toDID, senderSecretKey, reason } = req.body;

    if (!callId) {
      res.status(400).json({ error: true, message: "callId is required" });
      return;
    }
    if (!fromDID) {
      res.status(400).json({ error: true, message: "fromDID is required" });
      return;
    }
    if (!toDID) {
      res.status(400).json({ error: true, message: "toDID is required" });
      return;
    }
    if (!senderSecretKey) {
      res.status(400).json({ error: true, message: "senderSecretKey is required (hex-encoded)" });
      return;
    }

    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) {
      res.status(400).json({ error: true, message: "senderSecretKey must be a 32-byte hex string" });
      return;
    }

    const result = await didcommCalls.endCall({
      callId,
      fromDID,
      toDID,
      senderSecretKey: secretKeyBytes,
      reason,
    });

    res.json({
      success: true,
      messageId: result.messageId,
      status: "ended",
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/calls
 * List active/recent calls for a DID.
 * Query: did (required), status (optional filter)
 */
app.get("/api/didcomm/calls", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) {
      res.status(400).json({ error: true, message: "did query parameter is required" });
      return;
    }

    let calls = didcommCalls.listCalls(did);

    const statusFilter = req.query.status as string | undefined;
    if (statusFilter) {
      calls = calls.filter((c) => c.status === statusFilter);
    }

    res.json({
      success: true,
      count: calls.length,
      calls: calls.map((c) => ({
        callId: c.call_id,
        caller_did: c.caller_did,
        callee_did: c.callee_did,
        status: c.status,
        started_at: c.started_at,
        ended_at: c.ended_at,
        created_at: c.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/didcomm/calls/:callId
 * Get details for a specific call including signaling messages.
 */
app.get("/api/didcomm/calls/:callId", (req: Request, res: Response) => {
  try {
    const callId = req.params.callId as string;
    const details = didcommCalls.getCallDetails(callId);

    if (!details.call) {
      res.status(404).json({ error: true, message: "Call not found" });
      return;
    }

    res.json({
      success: true,
      call: {
        callId: details.call.call_id,
        caller_did: details.call.caller_did,
        callee_did: details.call.callee_did,
        status: details.call.status,
        started_at: details.call.started_at,
        ended_at: details.call.ended_at,
        created_at: details.call.created_at,
      },
      messages: details.messages.map((m) => ({
        id: m.id,
        msg_type: m.msg_type,
        from_did: m.from_did,
        has_sdp: m.sdp !== null,
        has_ice_candidate: m.ice_candidate !== null,
        created_at: m.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/didcomm/calls/:callId/active
 * Mark a call as active (peer connection established).
 */
app.put("/api/didcomm/calls/:callId/active", (req: Request, res: Response) => {
  try {
    const callId = req.params.callId as string;
    const details = didcommCalls.getCallDetails(callId);

    if (!details.call) {
      res.status(404).json({ error: true, message: "Call not found" });
      return;
    }

    didcommCalls.markCallActive(callId);

    res.json({ success: true, message: "Call marked as active", status: "active" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Gateway Routes ─────────────────────────────────────────────────────────

// Mount gateway management routes (admin API keys, developer stats, webhooks)
app.use("/api", gatewayRoutes);

// Apply usage tracking to all API routes
app.use("/api", usageMiddleware);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ORBIS.SSI] SSI Backend Server running on http://0.0.0.0:${PORT}`);
  console.log(`[ORBIS.SSI] Health: http://localhost:${PORT}/api/health`);
  console.log(`[ORBIS.SSI] DID APIs: POST /api/did/create, GET /api/did/resolve/:did`);
  console.log(`[ORBIS.SSI] VC APIs: POST /api/vc/issue, POST /api/vc/verify`);
  console.log(`[ORBIS.SSI] Trust APIs: POST /api/trust/register, GET /api/trust/issuers`);
  console.log(`[ORBIS.SSI] Auth APIs: POST /api/auth/register, POST /api/auth/login`);
  console.log(`[ORBIS.SSI] Compliance APIs: GET /api/compliance/data, DELETE /api/compliance/data`);
  console.log(`[ORBIS.SSI] Security: JWT auth | Input validation | Audit logging | Encryption at rest | Security headers`);
  console.log(`[ORBIS.SSI] Developer Dashboard: http://localhost:${PORT}/api/developer/dashboard`);
  console.log(`[ORBIS.SSI] Developer API Register: POST /api/developer/register`);
  console.log(`[ORBIS.SSI] Audit log: ${execSync('team-db "SELECT COUNT(*) as cnt FROM ssi_audit_log"', { encoding: "utf-8", timeout: 5_000 }).trim()}`);

  // Seed admin API key if none exists
  try {
    const seedResult = execSync(
      `team-db "SELECT COUNT(*) as cnt FROM ssi_api_keys"`,
      { encoding: "utf-8", timeout: 5_000 }
    );
    const seedRows = JSON.parse(seedResult.trim());
    const keyCount = seedRows[0]?.cnt || 0;

    if (keyCount === 0) {
      console.log("[ORBIS.SSI] No API keys found. Seeding admin key...");
      const adminRawKey = `orb_${randomBytes(24).toString("base64url")}`;
      const adminKeyHash = createHash("sha256").update(adminRawKey).digest("hex");
      const adminId = randomBytes(16).toString("hex");
      const now = new Date().toISOString();
      const fullScopes = "did:read,did:write,vc:issue,vc:verify,trust:read,trust:write";

      execSync(
        `team-db "INSERT INTO ssi_api_keys (id, name, email, key_hash, scopes, created_at) VALUES ('${adminId}', 'Admin (auto-seeded)', 'admin@orbis.id', '${adminKeyHash}', '${fullScopes}', '${now}')"`,
        { encoding: "utf-8", timeout: 10_000 }
      );

      console.log(`[ORBIS.SSI] ╔══════════════════════════════════════════════════╗`);
      console.log(`[ORBIS.SSI] ║         ADMIN API KEY — SAVE THIS                ║`);
      console.log(`[ORBIS.SSI] ╠══════════════════════════════════════════════════╣`);
      console.log(`[ORBIS.SSI] ║  ${adminRawKey}`);
      console.log(`[ORBIS.SSI] ╚══════════════════════════════════════════════════╝`);
      console.log(`[ORBIS.SSI] Scope: ${fullScopes}`);
    } else {
      console.log(`[ORBIS.SSI] ${keyCount} API key(s) already exist — skipping seed.`);
    }
  } catch (seedErr: any) {
    console.log(`[ORBIS.SSI] Seed check skipped: ${seedErr.message}`);
  }
});

export default app;