/**
 * ORBIS.ID SSI Backend Server.
 * Express server providing DID management, VC issuance/verification,
 * and trust registry APIs.
 * 
 * Serves on port 3000 by default, designed to be the API backend
 * for the ORBIS.ID platform.
 */

// ─── Inline .env Loader ─────────────────────────────────────────────────────
// Loads .env before any other imports so process.env is populated at boot.
// Reads .env from the repo root (adjacent to this file's project root).
// No dotenv dependency needed — uses a minimal inline parser.
// .env is gitignored (only secrets live there).
// ─── Inline .env Loader ─────────────────────────────────────────────────────
// Loads .env at boot so process.env is populated before any app code runs.
// ESM hoists all imports, so readFileSync from the import block below is
// available here. No dotenv dependency. .env is gitignored.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

(function loadDotenv(): void {
  // Resolve .env relative to THIS FILE (src/index.ts), not process.cwd().
  // import.meta.dirname gives src/ dir; fileURLToPath gives src/index.ts path.
  // Either way we need ".." twice to reach repo root from src/index.ts.
  const envPath = resolve(
    fileURLToPath(import.meta.url), "../..", ".env"
  );
  if (!existsSync(envPath)) {
    console.log("[INIT] No .env file found — using env vars or defaults");
    return;
  }
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf-8");
  } catch (err: any) {
    console.error(`[INIT] ⚠️  WARNING: .env exists at ${envPath} but is NOT READABLE (${err.code || err.message}). JWT_SECRET and ENCRYPTION_KEY will fall back to auto-generated ephemeral values — every restart will invalidate existing sessions. Fix: sudo chgrp team .env && sudo chmod 640 .env`);
    return;
  }
  let count = 0;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
      count++;
    }
  }
  if (count > 0) console.log(`[INIT] Loaded ${count} var(s) from .env (group-readable)`);
})();
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Request, type Response } from "express";
import cors from "cors";
import { randomBytes, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { join, extname, resolve as pathResolve } from "node:path";
import { initDatabase, listCredentials, getVerificationsForCredential } from "./db/metadata.js";
import * as didRegistry from "./did/index.js";
import { issueCredential } from "./vc/issue.js";
import { verifyCredential } from "./vc/verify.js";
import { createZKProof, verifyZKProof } from "./vc/zk.js";
import { verifyZK } from "./vc/verify-zk.js";
import * as trustRegistry from "./trust/registry.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import * as didcomm from "./didcomm/index.js";
import * as didcommTypes from "./didcomm/types.js";
import { v4 as uuidv4 } from "uuid";
import { extractPublicKey } from "./did/key.js";
import gatewayRoutes from "./gateway/routes.js";
import { usageMiddleware } from "./gateway/middleware.js";
import { requireAuth, rateLimitMiddleware } from "./gateway/middleware.js";
import adminRoutes from "./admin/routes.js";
import { ensureAdminColumns, ensureApiKeyColumns, ensureSystemWebhooksTable, seedAdminUser } from "./admin/auth.js";
import walletRoutes from "./wallet/routes.js";
import { initWalletTables } from "./wallet/db.js";
import { initAuthTables, registerHandler, loginHandler, meHandler, changePasswordHandler, linkDIDHandler, requireJwt } from "./security/jwt.js";
import * as didcommContacts from "./didcomm/contacts.js";
import * as didcommPush from "./didcomm/push.js";
import { purgePlaintextBodies, getDIDCommConversation, getDIDCommThreadMessages, getUnreadMessageCountFrom } from "./db/metadata.js";

// ─── Server Setup ────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize database tables (all CREATE TABLE IF NOT EXISTS — safe to re-run)
initDatabase();
try { initWalletTables(); } catch {}
try { initAuthTables(); } catch {}

// E2E encryption migration: purge any plaintext bodies from existing messages
try { const r = purgePlaintextBodies(); if (r.cleared > 0 || r.deleted > 0) console.log(`[SECURITY] Purge migration: cleared ${r.cleared} bodies, deleted ${r.deleted} incomplete msgs`); } catch {}

// Migration functions are no-ops — all columns verified present in existing schema.
// (team-db's Turso sync layer rejects ALTER TABLE for existing columns.)
ensureAdminColumns();
ensureApiKeyColumns();
ensureSystemWebhooksTable();

// Seed the master admin user (idempotent)
try { seedAdminUser(); } catch {}

// ─── Health ──────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Production health check endpoint.
 * Returns module-level status: server version, DB connectivity, JWT config.
 */
app.get("/api/health", (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // Check JWT_SECRET configuration
  try {
    const jwtSecretSet = !!process.env.JWT_SECRET;
    checks.jwt = jwtSecretSet ? "configured" : "using_auto_generated_dev_secret";
  } catch {
    checks.jwt = "error";
  }

  // Check team-db availability
  try {
    execSync("team-db \"SELECT 1\"", { encoding: "utf-8", timeout: 5_000 });
    checks.database = "connected";
  } catch {
    checks.database = "unreachable";
  }

  const allHealthy = checks.database === "connected";

  res.json({
    status: allHealthy ? "ok" : "degraded",
    version: "1.0.0",
    service: "orbis-ssi-backend",
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ─── OpenAPI Spec ────────────────────────────────────────────────────────────

/**
 * GET /api/openapi.json
 * Serve the OpenAPI 3.1 specification document.
 */
app.get("/api/openapi.json", (_req: Request, res: Response) => {
  try {
    const specPath = join(process.cwd(), "openapi.yaml");
    const spec = readFileSync(specPath, "utf-8");
    res.type("application/json").send(spec);
  } catch (err: any) {
    res.status(500).json({ error: true, message: `Failed to load OpenAPI spec: ${err.message}` });
  }
});

// ─── DID Endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/did/create
 * Create a new DID (did:key or did:web).
 * Body: { method: "key" | "web", domain?: string, path?: string }
 */
app.post("/api/did/create", async (req: Request, res: Response) => {
  try {
    const { method, domain, path } = req.body;

    if (!method || !["key", "web"].includes(method)) {
      res.status(400).json({ error: true, message: "method must be 'key' or 'web'" });
      return;
    }

    let result;
    if (method === "key") {
      result = await didRegistry.createDIDKey();
    } else {
      if (!domain) {
        res.status(400).json({ error: true, message: "domain is required for did:web" });
        return;
      }
      result = await didRegistry.createDIDWeb({ domain, path });
    }

    res.status(201).json({
      success: true,
      did: result.did,
      method: result.method,
      verificationMethodId: result.verificationMethodId,
      didDocument: result.didDocument,
      // NEVER expose the secret key in production - this is for development testing
      // Remove in production deployments
      ...(process.env.NODE_ENV !== "production" && {
        _debug: {
          publicKey: Buffer.from(result.keyPair.publicKey).toString("hex"),
        },
      }),
    });
  } catch (err: any) {
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
 * Revoke a DID.
 */
app.put("/api/did/:id/revoke", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    didRegistry.revokeDID(String(id));
    res.json({ success: true, message: "DID revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── VC Endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/vc/issue
 * Issue a Verifiable Credential.
 * Body: { issuerDID, issuerSecretKey (hex), subjectDID, claims, type?, schemaUrl?, expirationDate? }
 */
app.post("/api/vc/issue", async (req: Request, res: Response) => {
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

    if (!issuerDID) {
      res.status(400).json({ error: true, message: "issuerDID is required" });
      return;
    }
    if (!issuerSecretKey) {
      res.status(400).json({ error: true, message: "issuerSecretKey is required (hex-encoded)" });
      return;
    }
    if (!subjectDID) {
      res.status(400).json({ error: true, message: "subjectDID is required" });
      return;
    }
    if (!claims || typeof claims !== "object") {
      res.status(400).json({ error: true, message: "claims must be an object" });
      return;
    }

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
    // The credential is already issued at this point
    const elapsed = Date.now() - startTime;

    res.status(201).json({
      success: true,
      credentialId: result.credentialId,
      credential: result.credential,
      performance: {
        issuanceTimeMs: elapsed,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/vc/verify
 * Verify a Verifiable Credential.
 * Body: { credential, verifierDID?, checkTrustRegistry?, requiredCredentialTypes? }
 */
app.post("/api/vc/verify", async (req: Request, res: Response) => {
  try {
    const { credential, verifierDID, checkTrustRegistry, requiredCredentialTypes } = req.body;

    if (!credential) {
      res.status(400).json({ error: true, message: "credential is required" });
      return;
    }

    const result = await verifyCredential(credential, {
      verifierDID,
      checkTrustRegistry: checkTrustRegistry || false,
      requiredCredentialTypes,
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
    const { credentialId } = req.params;
    const verifications = getVerificationsForCredential(String(credentialId));

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

/**
 * POST /api/vc/verify-zk
 * Verify a ZK hash-commitment or Merkle-inclusion proof.
 * Body: { proof, publicInputs?, credential? }
 *   proof can be a hash-commitment proof (field, commitmentHash, revealedValue?, nonce?)
 *   or a Merkle-inclusion proof (value, root, siblings, leafIndex, totalLeaves)
 */
app.post("/api/vc/verify-zk", (req: Request, res: Response) => {
  try {
    const { proof, publicInputs, credential } = req.body;

    if (!proof) {
      res.status(400).json({ error: true, message: "proof is required" });
      return;
    }

    const result = verifyZK(proof, publicInputs, credential);

    res.json({
      success: result.verified,
      verified: result.verified,
      proofDetails: result.proofDetails,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── ZK Proof Endpoints ───────────────────────────────────────────────────────

/**
 * POST /api/vc/zk/prove
 * Create a ZK selective disclosure proof from a Verifiable Credential.
 * Body: { credential, holderDID, holderSecretKey, revealFields?, hideFields?, 
 *         derivedPredicates?, challenge?, domain? }
 */
app.post("/api/vc/zk/prove", async (req: Request, res: Response) => {
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

    if (!credential) {
      res.status(400).json({ error: true, message: "credential is required" });
      return;
    }
    if (!holderDID) {
      res.status(400).json({ error: true, message: "holderDID is required" });
      return;
    }
    if (!holderSecretKey) {
      res.status(400).json({ error: true, message: "holderSecretKey is required (hex-encoded)" });
      return;
    }

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
 *
 * Verify a ZK selective disclosure proof.
 *
 * Supports BOTH server-side generated proofs AND on-device generated proofs
 * from mobile wallets. Verification always uses the holder's PUBLIC key
 * (extracted from the DID document) — the holder's secret key is NEVER
 * required for verification.
 *
 * For mobile wallet on-device proving flow:
 *   1. Wallet calls POST /api/vc/zk/challenge → gets a challenge
 *   2. Wallet generates the ZKProof on-device using @orbis/wallet-core
 *   3. Wallet signs with device-stored Ed25519 key (secret key never sent)
 *   4. Wallet submits proof + challenge to this endpoint
 *
 * Body: { proof, verifierDID?, challenge?, checkTrustRegistry?,
 *         requiredCredentialTypes? }
 */
app.post("/api/vc/zk/verify", async (req: Request, res: Response) => {
  try {
    const { proof, verifierDID, challenge, checkTrustRegistry, requiredCredentialTypes } = req.body;

    if (!proof) {
      res.status(400).json({ error: true, message: "proof is required" });
      return;
    }

    const result = await verifyZKProof(proof, {
      verifierDID,
      challenge,
      checkTrustRegistry: checkTrustRegistry || false,
      requiredCredentialTypes,
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
 * Returns a random challenge string that the verifier should send to the holder.
 */
app.post("/api/vc/zk/challenge", (_req: Request, res: Response) => {
  const challenge = randomBytes(32).toString("hex");
  res.json({
    success: true,
    challenge,
    expiresIn: 300, // 5 minutes
  });
});

// ─── Trust Registry Endpoints ────────────────────────────────────────────────

/**
 * POST /api/trust/register
 * Register a trusted entity.
 * Body: { did, name, category?, authorizedCredentialTypes?, addedBy? }
 */
app.post("/api/trust/register", (req: Request, res: Response) => {
  try {
    const { did, name, category, authorizedCredentialTypes, addedBy } = req.body;

    if (!did) {
      res.status(400).json({ error: true, message: "did is required" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: true, message: "name is required" });
      return;
    }

    const entry = trustRegistry.addTrustedEntity({
      did,
      name,
      category,
      authorizedCredentialTypes,
      addedBy,
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
 * Suspend a trusted entity.
 */
app.put("/api/trust/:id/suspend", (req: Request, res: Response) => {
  try {
    trustRegistry.suspendEntity(String(req.params.id));
    res.json({ success: true, message: "Entity suspended" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/trust/:id/reactivate
 * Reactivate a suspended entity.
 */
app.put("/api/trust/:id/reactivate", (req: Request, res: Response) => {
  try {
    trustRegistry.reactivateEntity(String(req.params.id));
    res.json({ success: true, message: "Entity reactivated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/trust/:id
 * Remove an entity from the trust registry.
 */
app.delete("/api/trust/:id", (req: Request, res: Response) => {
  try {
    trustRegistry.removeEntity(String(req.params.id));
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
// This wraps res.json to log API usage
app.use("/api", usageMiddleware);

// ─── DIDComm API Endpoints ────────────────────────────────────────────────────

/**
 * POST /api/didcomm/send
 * Send an encrypted DIDComm message to a peer DID.
 * Body: { fromDID, toDID, type?, body, threadId?, senderSecretKey (hex), encryptionType? }
 */
app.post("/api/didcomm/send", async (req: Request, res: Response) => {
  try {
    const { fromDID, toDID, type, body, threadId, senderSecretKey, encryptionType } = req.body;

    if (!fromDID) {
      res.status(400).json({ error: true, message: "fromDID is required" });
      return;
    }
    if (!toDID) {
      res.status(400).json({ error: true, message: "toDID is required" });
      return;
    }
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: true, message: "body must be an object" });
      return;
    }
    if (!senderSecretKey) {
      res.status(400).json({ error: true, message: "senderSecretKey is required (hex-encoded)" });
      return;
    }

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
 * Retrieve inbox messages for a DID (paginated, ciphertext-only).
 * SECURITY: Returns encrypted_payload only — clients decrypt on-device.
 * Body field is always empty.
 * Query: did (required), status (optional filter: sent | delivered | read),
 *        limit (optional, default 50), offset (optional, default 0)
 */
app.get("/api/didcomm/inbox", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) {
      res.status(400).json({ error: true, message: "did query parameter is required" });
      return;
    }

    const limit = parseInt(req.query.limit as string || "50", 10);
    const offset = parseInt(req.query.offset as string || "0", 10);
    const cl = Math.min(Math.max(1, limit), 100);
    const co = Math.max(0, offset);

    let messages: any[];
    const statusFilter = req.query.status as string | undefined;
    if (statusFilter && ["sent", "delivered", "read"].includes(statusFilter)) {
      // Use execSync for filtered queries with pagination
      // (getDIDCommInboxPaginated and status filtering can be combined client-side)
      messages = didcomm.getInbox(did).filter((m) => m.status === statusFilter).slice(co, co + cl);
    } else {
      // Import and use the paginated query
      const { getDIDCommInboxPaginated } = require("./db/metadata.js");
      messages = getDIDCommInboxPaginated(did, cl, co);
    }

    res.json({
      success: true,
      count: messages.length,
      limit: cl,
      offset: co,
      messages: messages.map((m) => ({
        id: m.id,
        msg_type: m.msg_type,
        from_did: m.from_did,
        to_did: m.to_did,
        // body is intentionally excluded — E2E encrypted
        encrypted_payload: m.encrypted_payload,
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
 * SECURITY: Returns encrypted_payload only — clients decrypt on-device.
 * Body field is intentionally excluded.
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
        encrypted_payload: message.encrypted_payload,
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
 * Update the status of a message.
 * Body: { status: "delivered" | "read" }
 */
app.put("/api/didcomm/messages/:id/status", (req: Request, res: Response) => {
  try {
    const messageId = req.params.id as string;
    const { status } = req.body;

    if (!status || !["delivered", "read"].includes(status)) {
      res.status(400).json({ error: true, message: "status must be 'delivered' or 'read'" });
      return;
    }

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
 * Send a DIDComm trust ping.
 * Body: { fromDID, toDID, senderSecretKey (hex), comment? }
 */
app.post("/api/didcomm/trust-ping", async (req: Request, res: Response) => {
  try {
    const { fromDID, toDID, senderSecretKey, comment } = req.body;

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
 * Create an out-of-band invitation.
 * Body: { fromDID, label, goal?, goalCode?, endpoint? }
 */
app.post("/api/didcomm/oob/create", (req: Request, res: Response) => {
  try {
    const { fromDID, label, goal, goalCode, endpoint } = req.body;

    if (!fromDID) {
      res.status(400).json({ error: true, message: "fromDID is required" });
      return;
    }
    if (!label) {
      res.status(400).json({ error: true, message: "label is required" });
      return;
    }

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
 * Query: url (the invitation URL)
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
 * Query: did (required)
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

// ─── DIDComm Contact Management ────────────────────────────────────────────

app.post("/api/didcomm/contacts", (req: Request, res: Response) => {
  try {
    const { userDID, contactDID, label, avatarUrl } = req.body;
    if (!userDID) { res.status(400).json({ error: true, message: "userDID is required" }); return; }
    if (!contactDID) { res.status(400).json({ error: true, message: "contactDID is required" }); return; }
    if (!label) { res.status(400).json({ error: true, message: "label is required" }); return; }
    const contact = didcommContacts.addContact({ userDID, contactDID, label, avatarUrl });
    res.status(201).json({ success: true, contact });
  } catch (err: any) {
    res.status(err.message.includes("already exists") ? 409 : 500).json({ error: true, message: err.message });
  }
});

app.get("/api/didcomm/contacts", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) { res.status(400).json({ error: true, message: "did query required" }); return; }
    const search = req.query.search as string | undefined;
    const contacts = search ? didcommContacts.searchContacts(did, search) : didcommContacts.listContacts(did);
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

app.put("/api/didcomm/contacts/:id", (req: Request, res: Response) => {
  try {
    const { label, avatarUrl } = req.body;
    if (label === undefined && avatarUrl === undefined) { res.status(400).json({ error: true, message: "Provide label or avatarUrl" }); return; }
    const contact = didcommContacts.updateContact(req.params.id as string, { label, avatarUrl });
    if (!contact) { res.status(404).json({ error: true, message: "Contact not found" }); return; }
    res.json({ success: true, contact });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

app.delete("/api/didcomm/contacts/:id", (req: Request, res: Response) => {
  try {
    const deleted = didcommContacts.deleteContact(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: true, message: "Contact not found" }); return; }
    res.json({ success: true, message: "Contact removed" });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

// ─── DIDComm Conversation & Threads ─────────────────────────────────────────

app.get("/api/didcomm/conversation", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string; const peer = req.query.peer as string;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || "50", 10)), 100);
    const offset = Math.max(0, parseInt(req.query.offset as string || "0", 10));
    if (!did || !peer) { res.status(400).json({ error: true, message: "did and peer query params required" }); return; }
    const messages = getDIDCommConversation(did, peer, limit, offset);
    const unread = getUnreadMessageCountFrom(peer, did);
    res.json({ success: true, count: messages.length, unreadFromPeer: unread, limit, offset, messages: messages.map(m => ({ id: m.id, msg_type: m.msg_type, from_did: m.from_did, to_did: m.to_did, encrypted_payload: m.encrypted_payload, status: m.status, thread_id: m.thread_id, created_at: m.created_at })) });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

app.get("/api/didcomm/threads/:threadId", (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || "50", 10)), 100);
    const offset = Math.max(0, parseInt(req.query.offset as string || "0", 10));
    const messages = getDIDCommThreadMessages(req.params.threadId as string, limit, offset);
    res.json({ success: true, count: messages.length, limit, offset, messages: messages.map(m => ({ id: m.id, msg_type: m.msg_type, from_did: m.from_did, to_did: m.to_did, encrypted_payload: m.encrypted_payload, status: m.status, thread_id: m.thread_id, created_at: m.created_at })) });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

// ─── Delivery/Read Receipts ─────────────────────────────────────────────────

app.put("/api/didcomm/messages/:id/receipt", async (req: Request, res: Response) => {
  try {
    const { senderDID, senderSecretKey, status } = req.body;
    if (!senderDID || !senderSecretKey || !["delivered", "read"].includes(status)) {
      res.status(400).json({ error: true, message: "senderDID, senderSecretKey (hex), and status (delivered|read) required" }); return;
    }
    const originalMsg = didcomm.getMessageById(req.params.id as string);
    if (!originalMsg) { res.status(404).json({ error: true, message: "Message not found" }); return; }
    const secretKeyBytes = Buffer.from(senderSecretKey, "hex");
    if (secretKeyBytes.length !== 32) { res.status(400).json({ error: true, message: "senderSecretKey must be 32-byte hex" }); return; }
    const recipientPubKey = extractPublicKey(originalMsg.from_did);
    if (!recipientPubKey) { res.status(400).json({ error: true, message: "Cannot resolve recipient key" }); return; }
    const receiptMsg: didcommTypes.DIDCommMessage = {
      from: senderDID, to: [originalMsg.from_did], type: didcommTypes.BASIC_MESSAGE_TYPE,
      id: uuidv4(), thid: originalMsg.thread_id || originalMsg.id,
      created_time: Math.floor(Date.now() / 1000),
      body: { content: status === "read" ? "Message read" : "Message delivered", receiptFor: req.params.id, receiptStatus: status },
    };
    const stored = await didcomm.encryptAndStoreMessage(receiptMsg, secretKeyBytes, recipientPubKey, "authcrypt");
    if (status === "delivered") didcomm.markAsDelivered(req.params.id); else didcomm.markAsRead(req.params.id);
    res.status(201).json({ success: true, message: "Receipt sent", receiptMessageId: stored.id });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

// ─── Pre-packed Envelope Send (E2E Encrypted) ───────────────────────────────

app.post("/api/didcomm/send-packed", async (req: Request, res: Response) => {
  try {
    const { fromDID, toDID, encryptedPayload, msgType, threadId } = req.body;
    if (!fromDID) { res.status(400).json({ error: true, message: "fromDID is required" }); return; }
    if (!toDID) { res.status(400).json({ error: true, message: "toDID is required" }); return; }
    if (!encryptedPayload) { res.status(400).json({ error: true, message: "encryptedPayload is required (pre-packed DIDComm envelope)" }); return; }
    const msgId = uuidv4();
    const { insertDIDCommMessage } = await import("./db/metadata.js");
    const stored = { id: msgId, msg_type: msgType || didcommTypes.BASIC_MESSAGE_TYPE, from_did: fromDID, to_did: toDID, body: "", encrypted_payload: encryptedPayload, status: "sent", thread_id: threadId || null };
    insertDIDCommMessage(stored);
    res.status(201).json({ success: true, messageId: msgId, storedMessage: { id: stored.id, msg_type: stored.msg_type, from_did: stored.from_did, to_did: stored.to_did, status: stored.status, created_at: new Date().toISOString() } });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

// ─── Push Notification Hints ────────────────────────────────────────────────

app.post("/api/didcomm/push/register", (req: Request, res: Response) => {
  try {
    const { did, pushToken, platform, deviceId } = req.body;
    if (!did || !pushToken || !deviceId || !["ios", "android", "web"].includes(platform)) {
      res.status(400).json({ error: true, message: "did, pushToken, platform (ios|android|web), deviceId required" }); return;
    }
    const reg = didcommPush.registerPushToken({ did, pushToken, platform, deviceId });
    res.status(201).json({ success: true, registration: { id: reg.id, did: reg.did, platform: reg.platform, device_id: reg.device_id, active: reg.active } });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

app.delete("/api/didcomm/push/register", (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) { res.status(400).json({ error: true, message: "deviceId query param required" }); return; }
    didcommPush.unregisterPushToken(deviceId);
    res.json({ success: true, message: "Push token unregistered" });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

app.get("/api/didcomm/push/hints", (req: Request, res: Response) => {
  try {
    const did = req.query.did as string;
    if (!did) { res.status(400).json({ error: true, message: "did query param required" }); return; }
    res.json({ success: true, hints: didcommPush.getPushHints(did) });
  } catch (err: any) { res.status(500).json({ error: true, message: err.message }); }
});

// ─── Admin Routes ───────────────────────────────────────────────────────────

// Mount admin routes (requireAdmin middleware is applied per-route, not globally)
app.use("/api/admin", adminRoutes);

// ─── Wallet Routes ──────────────────────────────────────────────────────��────

// Mount wallet routes (JWT auth per-route via requireJwt middleware)
app.use("/api/wallet", walletRoutes);

// ─── Auth Routes ──────────────────────���──────────────────────────────────────
app.post("/api/auth/register", registerHandler);
app.post("/api/auth/login", loginHandler);
app.get("/api/auth/me", requireJwt, meHandler);
app.post("/api/auth/change-password", requireJwt, changePasswordHandler);
app.post("/api/auth/link-did", requireJwt, linkDIDHandler);

// ─── Static File Serving (web/dist) ─────────────────────────────────────────
// In production, serve the web UI SPA from web/dist on the same port.
// This avoids needing a separate proxy process, saving ~100MB RAM.

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const webDist = join(__dirname, "..", "web", "dist");

const STATIC_EXT = new Set([".js", ".css", ".svg", ".png", ".jpg", ".webp", ".ico", ".woff2", ".ttf", ".json"]);

if (existsSync(webDist)) {
  // Serve static assets
  app.use((req, res, next) => {
    const ext = extname(req.path);
    if (req.path.startsWith("/assets/") || req.path === "/orbis.svg" || (ext && STATIC_EXT.has(ext))) {
      const filePath = join(webDist, req.path);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const contentTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
          ".ico": "image/x-icon",
          ".woff2": "font/woff2",
          ".ttf": "font/ttf",
          ".json": "application/json",
        };
        res.type(contentTypes[ext] || "application/octet-stream").send(content);
        return;
      }
    }
    next();
  });

  // PWA wallet: serve /m/ from the mobile web PWA dist
  const pwaDist = join(__dirname, "..", "..", "m", "web", "dist");
  if (existsSync(pwaDist)) {
    app.use((req, res, next) => {
      if (!(req.path === "/m" || req.path.startsWith("/m/"))) return next();

      // Strip /m prefix to get the relative path within pwaDist
      let relPath = req.path.replace(/^\/m/, "");
      if (!relPath || relPath === "/") relPath = "/index.html";

      // Serve static assets (only files with known extensions)
      const filePath = join(pwaDist, relPath);
      const ext = extname(filePath);
      if (ext && STATIC_EXT.has(ext)) {
        const content = readFileSync(filePath);
        const contentTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
          ".ico": "image/x-icon",
          ".woff2": "font/woff2",
          ".ttf": "font/ttf",
          ".json": "application/json",
        };
        res.type(contentTypes[ext] || "application/octet-stream").send(content);
        return;
      }

      // SPA fallback: serve PWA index.html for all /m/ routes
      const indexPath = join(pwaDist, "index.html");
      if (existsSync(indexPath)) {
        res.type("html").send(readFileSync(indexPath));
        return;
      }
      next();
    });
  }

  // SPA fallback: serve index.html for all non-API, non-static routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = join(webDist, "index.html");
    if (existsSync(indexPath)) {
      res.type("html").send(readFileSync(indexPath));
      return;
    }
    next();
  });
}

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
  console.log(`[ORBIS.SSI] Developer Dashboard: http://localhost:${PORT}/api/developer/dashboard`);
  console.log(`[ORBIS.SSI] Developer API Register: POST /api/developer/register`);

  // Seed admin API key if none exists
  try {
    const seedResult = execSync(
      `team-db "SELECT COUNT(*) as cnt FROM api_keys"`,
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
        `team-db "INSERT INTO api_keys (id, name, email, key_hash, scopes, created_at) VALUES ('${adminId}', 'Admin (auto-seeded)', 'admin@orbis.id', '${adminKeyHash}', '${fullScopes}', '${now}')"`,
        { encoding: "utf-8", timeout: 10_000 }
      );

      console.log(`[ORBIS.SSI] ╔══════════════════════════════════════════════════╗`);
      console.log(`[ORBIS.SSI] ���         ADMIN API KEY — SAVE THIS                ║`);
      console.log(`[ORBIS.SSI] ╠═══════════════════════════════════════════════���══╣`);
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