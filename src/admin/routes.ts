/**
 * Admin API Routes for ORBIS.ID SSI Backend.
 *
 * Provides endpoints for administration of:
 * - User management (list, suspend, activate)
 * - Audit log viewing
 * - System stats aggregation
 * - Credential/DID oversight
 * - API key management (view all)
 * - Detailed health checks
 *
 * All routes require admin authentication via requireAdmin middleware.
 * All actions are audit-logged.
 */

import { Router, type Request, type Response } from "express";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { requireAdmin } from "./auth.js";
import { logAudit, getClientIp } from "../security/audit.js";
import type { ActionType, EntityType } from "../security/audit.js";
import { generateToken, verifyToken } from "../security/jwt.js";

const router = Router();

// ─── Database Helpers ───────────────────────────────────────────────────────

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  // execFileSync (no shell) preserves special chars and whitespace in SQL literals.
  try {
    const output = execFileSync(TEAM_DB, [sql], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return JSON.parse(output.trim());
  } catch (err: any) {
    if (err.stderr?.includes("no such table")) return [];
    throw new Error(`DB query failed: ${err.message}`);
  }
}

function quote(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

// ─── Constants (mirrored from gateway/apikey.ts to avoid circular imports) ──

const VALID_SCOPES = [
  "did:read",
  "did:write",
  "vc:issue",
  "vc:verify",
  "trust:read",
  "trust:write",
  "admin:manage",
] as const;

type Scope = (typeof VALID_SCOPES)[number];

const VALID_RATE_LIMIT_TIERS = ["basic", "pro", "enterprise"] as const;

// ─── Audit Helper ───────────────────────────────────────────────────────────

function adminAudit(
  req: Request,
  action: ActionType,
  entityType: EntityType,
  entityId: string | null,
  result: "success" | "failure",
  message?: string
): void {
  logAudit({
    actorType: "user",
    actorId: req.user?.sub || undefined,
    action,
    entityType,
    entityId: entityId ?? undefined,
    result,
    message: message || `Admin action: ${action}`,
    ipAddress: getClientIp(req),
  });
}

// ─── Users ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * List all registered users with their admin status.
 * Returns: id, email, did, admin, status, created_at
 */
router.get("/users", requireAdmin, (_req: Request, res: Response) => {
  try {
    const users = query(
      "SELECT id, email, did, admin, status, created_at, display_name, verified FROM ssi_users ORDER BY created_at DESC"
    );

    const sanitized = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      did: u.did || null,
      admin: u.admin === 1,
      status: u.status || "active",
      display_name: u.display_name,
      verified: u.verified === 1,
      created_at: u.created_at,
    }));

    adminAudit(_req, "admin.users.list", "user", null, "success");

    res.json({
      success: true,
      count: sanitized.length,
      users: sanitized,
    });
  } catch (err: any) {
    adminAudit(_req, "admin.users.list", "user", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/admin/users/:id/suspend
 * Suspend a user account.
 */
router.put("/users/:id/suspend", requireAdmin, (req: Request, res: Response) => {
  try {
    const userId = String(req.params.id);

    // Check user exists
    const existing = query(`SELECT * FROM ssi_users WHERE id = ${quote(userId)}`);
    if (existing.length === 0) {
      res.status(404).json({ error: true, message: "User not found" });
      return;
    }

    const user = existing[0] as any;

    // Don't allow suspending other admins
    if (user.admin === 1 && user.id !== req.user?.sub) {
      res.status(403).json({ error: true, message: "Cannot suspend another admin user" });
      return;
    }

    // Don't allow suspending yourself
    if (user.id === req.user?.sub) {
      res.status(400).json({ error: true, message: "Cannot suspend your own account" });
      return;
    }

    query(`UPDATE ssi_users SET status = 'suspended', updated_at = datetime('now') WHERE id = ${quote(userId)}`);

    adminAudit(req, "admin.user.suspend", "user", userId, "success", `Suspended user: ${user.email}`);

    res.json({
      success: true,
      message: `User ${user.email} suspended`,
    });
  } catch (err: any) {
    adminAudit(req, "admin.user.suspend", "user", String(req.params.id), "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/admin/users/:id/activate
 * Reactivate a suspended user account.
 */
router.put("/users/:id/activate", requireAdmin, (req: Request, res: Response) => {
  try {
    const userId = String(req.params.id);

    // Check user exists
    const existing = query(`SELECT * FROM ssi_users WHERE id = ${quote(userId)}`);
    if (existing.length === 0) {
      res.status(404).json({ error: true, message: "User not found" });
      return;
    }

    const user = existing[0] as any;

    query(`UPDATE ssi_users SET status = 'active', updated_at = datetime('now') WHERE id = ${quote(userId)}`);

    adminAudit(req, "admin.user.activate", "user", userId, "success", `Activated user: ${user.email}`);

    res.json({
      success: true,
      message: `User ${user.email} activated`,
    });
  } catch (err: any) {
    adminAudit(req, "admin.user.activate", "user", String(req.params.id), "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Audit Log ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-log
 * View all audit logs with filtering and pagination.
 * Query params: limit (default 100), offset (default 0), actor_id (optional)
 */
router.get("/audit-log", requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const actorId = req.query.actor_id as string | undefined;

    let rows: any[];
    let total: number;

    if (actorId) {
      rows = query(
        `SELECT * FROM ssi_audit_log WHERE actor_id = ${quote(actorId)} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const countResult = query(
        `SELECT COUNT(*) AS cnt FROM ssi_audit_log WHERE actor_id = ${quote(actorId)}`
      );
      total = (countResult[0] as any)?.cnt || 0;
    } else {
      rows = query(
        `SELECT * FROM ssi_audit_log ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const countResult = query("SELECT COUNT(*) AS cnt FROM ssi_audit_log");
      total = (countResult[0] as any)?.cnt || 0;
    }

    adminAudit(req, "admin.audit.view", "compliance_data", null, "success");

    res.json({
      success: true,
      count: rows.length,
      total,
      limit,
      offset,
      entries: rows.map((e: any) => ({
        id: e.id,
        actor_type: e.actor_type,
        actor_id: e.actor_id,
        action: e.action,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        result: e.result,
        message: e.message,
        ip_address: e.ip_address,
        timestamp: e.timestamp,
      })),
    });
  } catch (err: any) {
    adminAudit(req, "admin.audit.view", "compliance_data", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── System Stats ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/system/stats
 * Aggregated system statistics.
 * Returns total counts for all major entities.
 */
router.get("/system/stats", requireAdmin, (_req: Request, res: Response) => {
  try {
    const totalDIDs = ((query("SELECT COUNT(*) AS cnt FROM ssi_dids")[0] as any)?.cnt || 0) as number;
    const totalVCs = ((query("SELECT COUNT(*) AS cnt FROM ssi_credentials")[0] as any)?.cnt || 0) as number;
    const totalUsers = ((query("SELECT COUNT(*) AS cnt FROM ssi_users")[0] as any)?.cnt || 0) as number;
    const totalTrustEntries = ((query("SELECT COUNT(*) AS cnt FROM ssi_trust_registry")[0] as any)?.cnt || 0) as number;
    const totalAuditEntries = ((query("SELECT COUNT(*) AS cnt FROM ssi_audit_log")[0] as any)?.cnt || 0) as number;
    const totalMessages = ((query("SELECT COUNT(*) AS cnt FROM didcomm_messages")[0] as any)?.cnt || 0) as number;
    const totalApiKeys = ((query("SELECT COUNT(*) AS cnt FROM ssi_api_keys")[0] as any)?.cnt || 0) as number;

    // Active vs suspended users
    const activeUsers = ((query("SELECT COUNT(*) AS cnt FROM ssi_users WHERE status = 'active' OR status IS NULL")[0] as any)?.cnt || 0) as number;
    const suspendedUsers = ((query("SELECT COUNT(*) AS cnt FROM ssi_users WHERE status = 'suspended'")[0] as any)?.cnt || 0) as number;
    const adminUsers = ((query("SELECT COUNT(*) AS cnt FROM ssi_users WHERE admin = 1")[0] as any)?.cnt || 0) as number;

    // DID stats by method
    const keyDIDs = ((query("SELECT COUNT(*) AS cnt FROM ssi_dids WHERE method = 'key'")[0] as any)?.cnt || 0) as number;
    const webDIDs = ((query("SELECT COUNT(*) AS cnt FROM ssi_dids WHERE method = 'web'")[0] as any)?.cnt || 0) as number;

    // Credential stats by status
    const activeCredentials = ((query("SELECT COUNT(*) AS cnt FROM ssi_credentials WHERE status = 'active'")[0] as any)?.cnt || 0) as number;
    const revokedCredentials = ((query("SELECT COUNT(*) AS cnt FROM ssi_credentials WHERE status = 'revoked'")[0] as any)?.cnt || 0) as number;

    adminAudit(_req, "admin.stats.view", "compliance_data", null, "success");

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          admins: adminUsers,
        },
        dids: {
          total: totalDIDs,
          did_key: keyDIDs,
          did_web: webDIDs,
        },
        credentials: {
          total: totalVCs,
          active: activeCredentials,
          revoked: revokedCredentials,
        },
        trust_registry: {
          total_entries: totalTrustEntries,
        },
        audit_log: {
          total_entries: totalAuditEntries,
        },
        messages: {
          total: totalMessages,
        },
        api_keys: {
          total: totalApiKeys,
        },
      },
    });
  } catch (err: any) {
    adminAudit(_req, "admin.stats.view", "compliance_data", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Credentials ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/credentials
 * View all credentials with pagination.
 * Query params: limit (default 50), offset (default 0)
 */
router.get("/credentials", requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const rows = query(
      `SELECT * FROM ssi_credentials ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const countResult = query("SELECT COUNT(*) AS cnt FROM ssi_credentials");
    const total = (countResult[0] as any)?.cnt || 0;

    adminAudit(req, "admin.credentials.view", "credential", null, "success");

    res.json({
      success: true,
      count: rows.length,
      total,
      limit,
      offset,
      credentials: rows.map((r: any) => ({
        id: r.id,
        credential_id: r.credential_id,
        issuer_did: r.issuer_did,
        subject_did: r.subject_did,
        type: r.type,
        status: r.status,
        schema_url: r.schema_url,
        issuance_date: r.issuance_date,
        expiration_date: r.expiration_date,
        proof_type: r.proof_type,
        created_at: r.created_at,
      })),
    });
  } catch (err: any) {
    adminAudit(req, "admin.credentials.view", "credential", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── DIDs ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dids
 * View all DIDs with pagination.
 * Query params: limit (default 50), offset (default 0)
 */
router.get("/dids", requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const rows = query(
      `SELECT * FROM ssi_dids ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const countResult = query("SELECT COUNT(*) AS cnt FROM ssi_dids");
    const total = (countResult[0] as any)?.cnt || 0;

    adminAudit(req, "admin.dids.view", "did", null, "success");

    res.json({
      success: true,
      count: rows.length,
      total,
      limit,
      offset,
      dids: rows.map((r: any) => ({
        id: r.id,
        did: r.did,
        method: r.method,
        status: r.status,
        verification_method_id: r.verification_method_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (err: any) {
    adminAudit(req, "admin.dids.view", "did", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── API Keys (3rd Party Management) ────────────────────────────────────────

/**
 * POST /api/admin/api-keys
 * Create a 3rd party API key with company metadata.
 * Body: { company_name, contact_email, allowed_scopes, rate_limit_tier, expires_at? }
 * Returns the raw key once (cannot be retrieved again).
 */
router.post("/api-keys", requireAdmin, (req: Request, res: Response) => {
  try {
    const { company_name, contact_email, allowed_scopes, rate_limit_tier, expires_at } = req.body;

    // Validate required fields
    if (!company_name || typeof company_name !== "string") {
      res.status(400).json({ error: true, message: "company_name is required (string)" });
      return;
    }
    if (!contact_email || typeof contact_email !== "string") {
      res.status(400).json({ error: true, message: "contact_email is required (string)" });
      return;
    }
    if (!allowed_scopes || !Array.isArray(allowed_scopes) || allowed_scopes.length === 0) {
      res.status(400).json({ error: true, message: "allowed_scopes must be a non-empty array" });
      return;
    }

    // Validate scopes
    for (const s of allowed_scopes) {
      if (!(VALID_SCOPES as readonly string[]).includes(s)) {
        res.status(400).json({ error: true, message: `Invalid scope: ${s}. Valid: ${VALID_SCOPES.join(", ")}` });
        return;
      }
    }

    // Validate rate limit tier
    const tier = rate_limit_tier || "basic";
    if (!(VALID_RATE_LIMIT_TIERS as readonly string[]).includes(tier)) {
      res.status(400).json({ error: true, message: `Invalid rate_limit_tier: ${tier}. Must be one of: ${VALID_RATE_LIMIT_TIERS.join(", ")}` });
      return;
    }

    // Validate optional expiry
    if (expires_at && isNaN(Date.parse(expires_at))) {
      res.status(400).json({ error: true, message: "expires_at must be a valid ISO 8601 date string" });
      return;
    }

    // Generate key
    const rawKey = `orb_${randomBytes(24).toString("base64url")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const id = randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    const scopesStr = allowed_scopes.join(",");
    const normalizedEmail = contact_email.toLowerCase().trim();

    query(
      `INSERT INTO ssi_api_keys (id, name, email, key_hash, scopes, status, company_name, contact_email, rate_limit_tier, expires_at, created_at) VALUES (${quote(id)}, ${quote(company_name)}, ${quote(normalizedEmail)}, ${quote(keyHash)}, ${quote(scopesStr)}, 'active', ${quote(company_name)}, ${quote(normalizedEmail)}, ${quote(tier)}, ${quote(expires_at || null)}, ${quote(now)})`
    );

    adminAudit(req, "admin.apikeys.create", "user", id, "success", `Created API key for: ${company_name} (${contact_email})`);

    res.status(201).json({
      success: true,
      key: {
        id,
        company_name,
        contact_email: normalizedEmail,
        scopes: allowed_scopes,
        rate_limit_tier: tier,
        expires_at: expires_at || null,
        created_at: now,
        status: "active",
      },
      raw_key: rawKey,
      message: "Save this raw key — it will not be shown again.",
    });
  } catch (err: any) {
    adminAudit(req, "admin.apikeys.create", "user", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/admin/api-keys
 * List all API keys with company info, usage stats, and status.
 */
router.get("/api-keys", requireAdmin, (_req: Request, res: Response) => {
  try {
    const keys = query(
      "SELECT id, name, email, scopes, status, company_name, contact_email, rate_limit_tier, expires_at, member_id, created_at, revoked_at, last_used_at FROM ssi_api_keys ORDER BY created_at DESC"
    );

    // Get usage counts and compute active/expired status
    const keysWithUsage = keys.map((k: any) => {
      const usageResult = query(
        `SELECT COUNT(*) AS cnt FROM ssi_usage_logs WHERE api_key_id = ${quote(k.id)}`
      );
      const usageCount = (usageResult[0] as any)?.cnt || 0;

      // Determine effective status
      let effectiveStatus = k.status || "active";
      if (effectiveStatus === "active" && k.expires_at) {
        const expiresAt = new Date(k.expires_at).getTime();
        if (expiresAt < Date.now()) {
          effectiveStatus = "expired";
        }
      }

      return {
        id: k.id,
        company_name: k.company_name || k.name,
        contact_email: k.contact_email || k.email,
        scopes: (k.scopes || "").split(",").filter(Boolean),
        rate_limit_tier: k.rate_limit_tier || "basic",
        status: effectiveStatus,
        expires_at: k.expires_at || null,
        total_requests: usageCount,
        created_at: k.created_at,
        revoked_at: k.revoked_at,
        last_used_at: k.last_used_at,
      };
    });

    adminAudit(_req, "admin.apikeys.view", "user", null, "success");

    res.json({
      success: true,
      count: keysWithUsage.length,
      keys: keysWithUsage,
    });
  } catch (err: any) {
    adminAudit(_req, "admin.apikeys.view", "user", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/admin/api-keys/:id/revoke
 * Revoke a 3rd party API key.
 */
router.put("/api-keys/:id/revoke", requireAdmin, (req: Request, res: Response) => {
  try {
    const keyId = String(req.params.id);

    // Check key exists
    const existing = query(`SELECT * FROM ssi_api_keys WHERE id = ${quote(keyId)}`);
    if (existing.length === 0) {
      res.status(404).json({ error: true, message: "API key not found" });
      return;
    }

    const key = existing[0] as any;
    if (key.status === "revoked") {
      res.status(400).json({ error: true, message: "API key is already revoked" });
      return;
    }

    query(`UPDATE ssi_api_keys SET status = 'revoked', revoked_at = datetime('now') WHERE id = ${quote(keyId)}`);

    adminAudit(req, "admin.apikeys.revoke", "user", keyId, "success", `Revoked API key for: ${key.company_name || key.name}`);

    res.json({
      success: true,
      message: `API key for ${key.company_name || key.name} revoked`,
    });
  } catch (err: any) {
    adminAudit(req, "admin.apikeys.revoke", "user", String(req.params.id), "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/admin/api-keys/:id/update
 * Update API key metadata (scopes, rate limit tier, expiry).
 * Body: { allowed_scopes?, rate_limit_tier?, expires_at? }
 */
router.put("/api-keys/:id/update", requireAdmin, (req: Request, res: Response) => {
  try {
    const keyId = String(req.params.id);
    const { allowed_scopes, rate_limit_tier, expires_at } = req.body;

    // Check key exists
    const existing = query(`SELECT * FROM ssi_api_keys WHERE id = ${quote(keyId)}`);
    if (existing.length === 0) {
      res.status(404).json({ error: true, message: "API key not found" });
      return;
    }

    const key = existing[0] as any;
    if (key.status === "revoked") {
      res.status(400).json({ error: true, message: "Cannot update a revoked API key" });
      return;
    }

    // Build SET clause dynamically
    const updates: string[] = [];

    if (allowed_scopes !== undefined) {
      if (!Array.isArray(allowed_scopes) || allowed_scopes.length === 0) {
        res.status(400).json({ error: true, message: "allowed_scopes must be a non-empty array" });
        return;
      }
      for (const s of allowed_scopes) {
        if (!(VALID_SCOPES as readonly string[]).includes(s)) {
          res.status(400).json({ error: true, message: `Invalid scope: ${s}` });
          return;
        }
      }
      updates.push(`scopes = ${quote(allowed_scopes.join(","))}`);
    }

    if (rate_limit_tier !== undefined) {
      if (!(VALID_RATE_LIMIT_TIERS as readonly string[]).includes(rate_limit_tier)) {
        res.status(400).json({ error: true, message: `Invalid rate_limit_tier: ${rate_limit_tier}` });
        return;
      }
      updates.push(`rate_limit_tier = ${quote(rate_limit_tier)}`);
    }

    if (expires_at !== undefined) {
      if (expires_at !== null && isNaN(Date.parse(expires_at))) {
        res.status(400).json({ error: true, message: "expires_at must be a valid ISO 8601 date string or null" });
        return;
      }
      updates.push(`expires_at = ${quote(expires_at)}`);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: true, message: "No fields to update. Provide at least one of: allowed_scopes, rate_limit_tier, expires_at" });
      return;
    }

    updates.push("updated_at = datetime('now')");
    query(`UPDATE ssi_api_keys SET ${updates.join(", ")} WHERE id = ${quote(keyId)}`);

    adminAudit(req, "admin.apikeys.update", "user", keyId, "success", `Updated API key: ${key.company_name || key.name} — fields: ${updates.map((u) => u.split("=")[0].trim()).join(", ")}`);

    // Return updated key
    const updated = query(`SELECT id, name, email, scopes, status, company_name, contact_email, rate_limit_tier, expires_at, created_at FROM ssi_api_keys WHERE id = ${quote(keyId)}`)[0] as any;

    res.json({
      success: true,
      message: "API key updated",
      key: {
        id: updated.id,
        company_name: updated.company_name || updated.name,
        contact_email: updated.contact_email || updated.email,
        scopes: (updated.scopes || "").split(",").filter(Boolean),
        rate_limit_tier: updated.rate_limit_tier || "basic",
        status: updated.status,
        expires_at: updated.expires_at || null,
        created_at: updated.created_at,
      },
    });
  } catch (err: any) {
    adminAudit(req, "admin.apikeys.update", "user", String(req.params.id), "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Integrations ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/integrations/docs
 * Return list of available documentation and resource paths
 * for 3rd party integration partners.
 */
router.get("/integrations/docs", requireAdmin, (_req: Request, res: Response) => {
  try {
    const docs = [
      {
        id: "getting-started",
        title: "Getting Started Guide",
        description: "Quickstart guide for integrating with ORBIS.ID SSI platform",
        url: "/docs/getting-started",
        type: "guide",
      },
      {
        id: "api-reference",
        title: "API Reference",
        description: "Complete OpenAPI 3.1 specification for all SSI endpoints",
        url: "/api/openapi.json",
        type: "api-spec",
      },
      {
        id: "did-methods",
        title: "DID Methods",
        description: "How to create and resolve did:key and did:web identifiers",
        url: "/docs/did-methods",
        type: "guide",
      },
      {
        id: "vc-issuance",
        title: "Verifiable Credential Issuance",
        description: "Issue W3C Verifiable Credentials with Ed25519 Signature 2020",
        url: "/docs/vc-issuance",
        type: "guide",
      },
      {
        id: "vc-verification",
        title: "Credential Verification",
        description: "Verify credentials using the verification API",
        url: "/docs/vc-verification",
        type: "guide",
      },
      {
        id: "zk-proofs",
        title: "Zero-Knowledge Proofs",
        description: "Selective disclosure and ZK verification for privacy-preserving claims",
        url: "/docs/zk-proofs",
        type: "guide",
      },
      {
        id: "didcomm-messaging",
        title: "DIDComm v2 Messaging",
        description: "Secure peer-to-peer encrypted messaging between DIDs",
        url: "/docs/didcomm",
        type: "guide",
      },
      {
        id: "trust-registry",
        title: "Trust Registry",
        description: "Manage authorized issuers and verifiers in the trust ecosystem",
        url: "/docs/trust-registry",
        type: "guide",
      },
      {
        id: "api-key-management",
        title: "API Key Management",
        description: "Create, manage, and rotate API keys for platform access",
        url: "/docs/api-keys",
        type: "guide",
      },
      {
        id: "webhooks",
        title: "Webhook Integration",
        description: "Configure webhooks for real-time credential event notifications",
        url: "/docs/webhooks",
        type: "guide",
      },
      {
        id: "security-audit",
        title: "Security Audit Report",
        description: "Security architecture overview and audit findings",
        url: "/docs/security",
        type: "reference",
      },
      {
        id: "rate-limits",
        title: "Rate Limits & Tiers",
        description: "Rate limiting policies by tier: Basic, Pro, Enterprise",
        url: "/docs/rate-limits",
        type: "reference",
      },
    ];

    adminAudit(_req, "admin.integrations.docs", "compliance_data", null, "success");

    res.json({
      success: true,
      count: docs.length,
      docs,
    });
  } catch (err: any) {
    adminAudit(_req, "admin.integrations.docs", "compliance_data", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/admin/integrations/webhook-config
 * Configure a system-level webhook endpoint for 3rd party integrations.
 * Body: { name, url, events: string[], headers?: Record<string,string>, active?: boolean }
 */
router.post("/integrations/webhook-config", requireAdmin, (req: Request, res: Response) => {
  try {
    const { name, url, events, headers, active } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: true, message: "name is required (string)" });
      return;
    }
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: true, message: "url is required (string)" });
      return;
    }
    if (!url.startsWith("https://")) {
      res.status(400).json({ error: true, message: "url must start with https://" });
      return;
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: true, message: "events must be a non-empty array" });
      return;
    }

    // Validate events
    const validEvents = ["credential.issued", "credential.verified", "did.created", "trust.updated", "all"];
    for (const e of events) {
      if (!validEvents.includes(e)) {
        res.status(400).json({ error: true, message: `Invalid event: ${e}. Valid events: ${validEvents.join(", ")}` });
        return;
      }
    }

    const id = randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    const eventsStr = events.join(",");
    const headersStr = headers && typeof headers === "object" ? JSON.stringify(headers) : null;
    const isActive = active !== false ? 1 : 0;

    query(
      `INSERT INTO ssi_system_webhooks (id, name, url, events, headers, active, created_by, created_at, updated_at) VALUES (${quote(id)}, ${quote(name)}, ${quote(url)}, ${quote(eventsStr)}, ${quote(headersStr)}, ${isActive}, ${quote(req.user?.sub || null)}, ${quote(now)}, ${quote(now)})`
    );

    adminAudit(req, "admin.integrations.webhook", "credential", id, "success", `Created system webhook: ${name} → ${url} [events: ${eventsStr}]`);

    res.status(201).json({
      success: true,
      webhook: {
        id,
        name,
        url,
        events,
        headers: headers || null,
        active: isActive === 1,
        created_at: now,
      },
    });
  } catch (err: any) {
    adminAudit(req, "admin.integrations.webhook", "credential", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Detailed Health ────────────────────────────────────────────────────────

/**
 * GET /api/admin/health/detailed
 * Detailed health check of all subsystems.
 * Checks DB, encryption, auth, and storage subsystems.
 */
router.get("/health/detailed", requireAdmin, (_req: Request, res: Response) => {
  try {
    const checks: Record<string, any> = {};

    // DB check
    try {
      const dbResult = query("SELECT 1 AS ok");
      checks.database = {
        status: dbResult.length > 0 ? "healthy" : "unhealthy",
        message: dbResult.length > 0 ? "Database connection OK" : "Empty response",
      };
    } catch (err: any) {
      checks.database = {
        status: "unhealthy",
        message: `Database error: ${err.message}`,
      };
    }

    // Encryption check (JWT secret)
    checks.encryption = {
      status: process.env.JWT_SECRET ? "healthy" : "degraded",
      message: process.env.JWT_SECRET
        ? "JWT_SECRET configured with production key"
        : "JWT_SECRET not set — using auto-generated dev key",
    };

    // Auth check (verify JWT works)
    try {
      const testUser = { id: "test", email: "test@test.com", password_hash: "", display_name: "Test", did: null, created_at: "", updated_at: "", verified: 1, admin: 0, status: "active" };
      const testToken = generateToken(testUser as any);
      const decoded = verifyToken(testToken);
      checks.auth = {
        status: decoded ? "healthy" : "unhealthy",
        message: decoded ? "JWT sign/verify OK" : "JWT verification failed",
      };
    } catch (err: any) {
      checks.auth = {
        status: "unhealthy",
        message: `Auth error: ${err.message}`,
      };
    }

    // Storage check (verify tables exist and have data)
    try {
      const tables = ["ssi_dids", "ssi_credentials", "ssi_users", "ssi_audit_log", "ssi_trust_registry", "ssi_api_keys"];
      const tableStatus: Record<string, { exists: boolean; row_count: number }> = {};

      for (const table of tables) {
        try {
          const countResult = query(`SELECT COUNT(*) AS cnt FROM ${table}`);
          tableStatus[table] = {
            exists: true,
            row_count: (countResult[0] as any)?.cnt || 0,
          };
        } catch {
          tableStatus[table] = {
            exists: false,
            row_count: 0,
          };
        }
      }

      checks.storage = {
        status: "healthy",
        tables: tableStatus,
      };

      // Overall storage is healthy if all required tables exist
      const allTablesExist = tables.every((t) => tableStatus[t]?.exists);
      if (!allTablesExist) {
        checks.storage.status = "degraded";
        checks.storage.message = "Some tables are missing";
      }
    } catch (err: any) {
      checks.storage = {
        status: "unhealthy",
        message: `Storage check error: ${err.message}`,
      };
    }

    // Compute overall status
    const subsystemStatuses = [checks.database?.status, checks.encryption?.status, checks.auth?.status, checks.storage?.status];
    const allHealthy = subsystemStatuses.every((s) => s === "healthy");
    const anyUnhealthy = subsystemStatuses.some((s) => s === "unhealthy");

    adminAudit(_req, "admin.health.detailed", "compliance_data", null, "success");

    res.json({
      success: true,
      status: anyUnhealthy ? "unhealthy" : allHealthy ? "healthy" : "degraded",
      version: "1.0.0",
      service: "orbis-ssi-backend",
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (err: any) {
    adminAudit(_req, "admin.health.detailed", "compliance_data", null, "failure", err.message);
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;