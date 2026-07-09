/**
 * GDPR Compliance Hooks for ORBIS.ID SSI Backend.
 *
 * Provides endpoints for:
 * - GET /api/compliance/data — Export all data associated with the authenticated user
 * - DELETE /api/compliance/data — Right to be forgotten (anonymize/delete user data)
 *
 * These endpoints require JWT authentication and log all actions to the audit log.
 */

import type { Request, Response } from "express";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { findUserById } from "./jwt.js";
import { logAudit, getClientIp } from "./audit.js";

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execSync(`${TEAM_DB} ${JSON.stringify(normalized)}`, {
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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserDataExport {
  user: Record<string, unknown> | null;
  dids: Record<string, unknown>[];
  credentials: Record<string, unknown>[];
  verifications: Record<string, unknown>[];
  trustRegistry: Record<string, unknown>[];
  apiKeys: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  exportGeneratedAt: string;
}

// ─── Data Retrieval by Email ────────────────────────────────────────────────

/**
 * Collect all personal data for a user across all tables.
 * Uses the user's DID (linked to their account) to find related records.
 */
export function collectUserData(userId: string): UserDataExport {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const userDID = user.did;

  // User's DIDs
  const dids = userDID
    ? query(
        `SELECT * FROM ssi_dids WHERE did = ${quote(userDID)}`
      )
    : [];

  // Credentials where user is issuer or subject
  const credentials = userDID
    ? query(
        `SELECT * FROM ssi_credentials WHERE issuer_did = ${quote(userDID)} OR subject_did = ${quote(userDID)}`
      )
    : [];

  // Verification log entries for the user's credentials
  const credentialIds = credentials
    .map((c: any) => c.credential_id)
    .filter(Boolean);
  const verifications = credentialIds.length > 0
    ? query(
        `SELECT * FROM ssi_verifications WHERE credential_id IN (${credentialIds.map((id: string) => quote(id)).join(",")})`
      )
    : [];

  // Trust registry entries
  const trustRegistry = userDID
    ? query(
        `SELECT * FROM ssi_trust_registry WHERE did = ${quote(userDID)}`
      )
    : [];

  // API keys registered with user's email
  const apiKeys = query(
    `SELECT * FROM api_keys WHERE email = ${quote(user.email)}`
  );

  // Audit logs related to the user
  const auditLogs = query(
    `SELECT * FROM ssi_audit_log WHERE actor_type = 'user' AND actor_id = ${quote(userId)} ORDER BY timestamp DESC LIMIT 100`
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      did: user.did,
      verified: user.verified === 1,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    dids,
    credentials,
    verifications,
    trustRegistry,
    apiKeys,
    auditLogs,
    exportGeneratedAt: new Date().toISOString(),
  };
}

// ─── Data Deletion (Right to be Forgotten) ──────────────────────────────────

/**
 * Anonymize or delete all personal data associated with a user.
 * Per GDPR Article 17 — Right to erasure ('right to be forgotten').
 *
 * Strategy:
 * - Anonymize the user record (replace email, password hash, display name)
 * - Keep DIDs and credentials for ledger integrity but remove personal associations
 * - Revoke API keys linked to the user's email
 * - Retain audit logs but anonymize actor references
 */
export function deleteUserData(userId: string): { anonymizedCount: number } {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  let count = 0;

  // 1. Anonymize user record
  const anonymizedId = `anonymized_${randomBytes(8).toString("hex")}`;
  query(
    `UPDATE ssi_users SET email = ${quote(`${anonymizedId}@anonymized.orbis.id`)}, password_hash = 'ANONYMIZED', display_name = 'GDPR Erased User', did = NULL, verified = 0, updated_at = datetime('now') WHERE id = ${quote(userId)}`
  );
  count++;

  // 2. Anonymize API keys registered with user's email
  const apiKeys = query(
    `SELECT id FROM api_keys WHERE email = ${quote(user.email)}`
  );
  for (const key of apiKeys) {
    query(
      `UPDATE api_keys SET email = 'anonymized@orbis.id', name = 'GDPR Erased', revoked_at = datetime('now') WHERE id = ${quote((key as any).id)}`
    );
    count++;
  }

  // 3. Anonymize audit logs referencing this user's actor_id
  query(
    `UPDATE ssi_audit_log SET actor_id = 'GDPR_ERASED', message = '[GDPR: actor anonymized]' WHERE actor_type = 'user' AND actor_id = ${quote(userId)}`
  );
  count += 1; // single batch update

  return { anonymizedCount: count };
}

// ─── Express Route Handlers ─────────────────────────────────────────────────

/**
 * GET /api/compliance/data
 * Export all personal data for the authenticated user (GDPR Art. 15).
 * Requires JWT auth.
 */
export function exportDataHandler(req: Request, res: Response): void {
  try {
    const userId = req.user!.sub;
    const data = collectUserData(userId);

    // Log the export action
    logAudit({
      actorType: "user",
      actorId: userId,
      action: "compliance.export",
      entityType: "compliance_data",
      entityId: userId,
      result: "success",
      message: "GDPR data export requested",
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      exportedAt: data.exportGeneratedAt,
      data,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
}

/**
 * DELETE /api/compliance/data
 * Right to be forgotten — anonymize/delete all user data (GDPR Art. 17).
 * Requires JWT auth.
 * Body: { confirmation: "DELETE" }
 */
export function deleteDataHandler(req: Request, res: Response): void {
  try {
    const userId = req.user!.sub;

    // Require explicit confirmation
    const { confirmation } = req.body;
    if (confirmation !== "DELETE") {
      res.status(400).json({
        error: true,
        message: "Must send { confirmation: 'DELETE' } to confirm data deletion",
      });
      return;
    }

    const result = deleteUserData(userId);

    // Log after successful deletion
    logAudit({
      actorType: "user",
      actorId: userId,
      action: "compliance.delete",
      entityType: "compliance_data",
      entityId: userId,
      result: "success",
      message: `GDPR right to be forgotten exercised. ${result.anonymizedCount} records anonymized.`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      message: "All personal data has been anonymized/deleted (right to be forgotten exercised).",
      anonymizedCount: result.anonymizedCount,
    });
  } catch (err: any) {
    // If deletion fails, log as failure for audit trail
    logAudit({
      actorType: "user",
      actorId: req.user?.sub || "unknown",
      action: "compliance.delete",
      entityType: "compliance_data",
      entityId: req.user?.sub ?? undefined,
      result: "failure",
      message: `GDPR deletion failed: ${err.message}`,
      ipAddress: getClientIp(req),
    });

    res.status(500).json({ error: true, message: err.message });
  }
}