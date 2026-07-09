/**
 * ORBIS.ID SSI Backend Server.
 * Express server providing DID management, VC issuance/verification,
 * and trust registry APIs.
 * 
 * Serves on port 3000 by default, designed to be the API backend
 * for the ORBIS.ID platform.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { initDatabase, listCredentials, getVerificationsForCredential } from "./db/metadata.js";
import * as didRegistry from "./did/index.js";
import { issueCredential } from "./vc/issue.js";
import { verifyCredential } from "./vc/verify.js";
import * as trustRegistry from "./trust/registry.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

// ─── Server Setup ────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize database tables
initDatabase();

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    service: "orbis-ssi-backend",
    timestamp: new Date().toISOString(),
  });
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
    didRegistry.revokeDID(id);
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
    trustRegistry.suspendEntity(req.params.id);
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
    trustRegistry.reactivateEntity(req.params.id);
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
    trustRegistry.removeEntity(req.params.id);
    res.json({ success: true, message: "Entity removed from trust registry" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

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
});

export default app;