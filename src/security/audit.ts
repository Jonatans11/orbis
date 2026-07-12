/**
 * Audit Logging Module for ORBIS.ID SSI Backend.
 *
 * Logs all sensitive operations (DID creation, VC issuance, VC verification)
 * to the ssi_audit_log table.
 *
 * Provides a high-level audit function that records:
 * - who performed the action (user ID, DID, API key ID)
 * - what action was performed
 * - what entity was affected
 * - the result (success/failure with message)
 * - a timestamp
 */

import { execFileSync, exec } from "node:child_process";
import { randomBytes } from "node:crypto";

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execFileSync(TEAM_DB, [normalized], {
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

// ─── Table Init ─────────────────────────────────────────────────────────────

export function initAuditTable(): void {
  query(
    "CREATE TABLE IF NOT EXISTS ssi_audit_log (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL DEFAULT 'unknown' CHECK(actor_type IN ('user', 'api_key', 'system', 'unknown')), actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, result TEXT NOT NULL CHECK(result IN ('success', 'failure')), message TEXT, ip_address TEXT, timestamp TEXT NOT NULL DEFAULT (datetime('now')))"
  );

  // Index for quick lookups by entity and time range
  query(
    "CREATE INDEX IF NOT EXISTS idx_audit_entity ON ssi_audit_log(entity_type, entity_id)"
  );
  query(
    "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON ssi_audit_log(timestamp)"
  );
  query(
    "CREATE INDEX IF NOT EXISTS idx_audit_actor ON ssi_audit_log(actor_type, actor_id)"
  );
}

// ─── Audit Types ────────────────────────────────────────────────────────────

export type ActorType = "user" | "api_key" | "system" | "unknown";
export type AuditResult = "success" | "failure";
export type ActionType =
  | "did.create"
  | "did.revoke"
  | "did.deactivate"
  | "vc.issue"
  | "vc.verify"
  | "vc.revoke"
  | "zk.prove"
  | "zk.verify"
  | "trust.register"
  | "trust.suspend"
  | "trust.reactivate"
  | "trust.remove"
  | "auth.login"
  | "auth.register"
  | "auth.password_change"
  | "compliance.export"
  | "compliance.delete"
  | "encryption.key_rotation"
  | "admin.wallet.wipe"
  | "admin.wallet.grants.view"
  | "vault.consent.update"
  | "admin.users.list"
  | "admin.user.suspend"
  | "admin.user.activate"
  | "admin.audit.view"
  | "admin.stats.view"
  | "admin.credentials.view"
  | "admin.dids.view"
  | "admin.apikeys.create"
  | "admin.apikeys.view"
  | "admin.apikeys.revoke"
  | "admin.apikeys.update"
  | "admin.integrations.docs"
  | "admin.integrations.webhook"
  | "admin.health.view";

export type EntityType =
  | "did"
  | "credential"
  | "zk_proof"
  | "trust_entry"
  | "user"
  | "compliance_data"
  | "wallet_device"
  | "vault_grant"
  | "vault_record";

export interface AuditEntry {
  id: string;
  actor_type: ActorType;
  actor_id: string | null;
  action: ActionType;
  entity_type: EntityType;
  entity_id: string | null;
  result: AuditResult;
  message: string | null;
  ip_address: string | null;
  timestamp: string;
}

// ─── Audit Logging ──────────────────────────────────────────────────────────

export interface AuditOptions {
  actorType?: ActorType;
  actorId?: string;
  action: ActionType;
  entityType: EntityType;
  entityId?: string;
  result: AuditResult;
  message?: string;
  ipAddress?: string;
}

/**
 * Log an audit event asynchronously in the background.
 * Prevents compliance reporting from blocking critical operations.
 */
export function logAudit(options: AuditOptions): void {
  try {
    const id = randomBytes(16).toString("hex");
    const sql = `INSERT INTO ssi_audit_log (id, actor_type, actor_id, action, entity_type, entity_id, result, message, ip_address) VALUES (${quote(id)}, ${quote(options.actorType || "unknown")}, ${quote(options.actorId || null)}, ${quote(options.action)}, ${quote(options.entityType)}, ${quote(options.entityId || null)}, ${quote(options.result)}, ${quote(options.message || null)}, ${quote(options.ipAddress || null)})`;

    const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    exec(`${TEAM_DB} ${JSON.stringify(normalized)}`, { timeout: 15000 }, (err) => {
      if (err) {
        console.error(`[AUDIT] Background audit log write failed: ${err.message}`);
      }
    });
  } catch (err) {
    // Audit logging should never crash the caller
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}

/**
 * Query audit logs for a specific entity.
 */
export function getAuditLogsForEntity(
  entityType: EntityType,
  entityId: string,
  limit = 100
): AuditEntry[] {
  return query(
    `SELECT * FROM ssi_audit_log WHERE entity_type = ${quote(entityType)} AND entity_id = ${quote(entityId)} ORDER BY timestamp DESC LIMIT ${limit}`
  ) as AuditEntry[];
}

/**
 * Query audit logs for a specific actor.
 */
export function getAuditLogsForActor(
  actorType: ActorType,
  actorId: string,
  limit = 100
): AuditEntry[] {
  return query(
    `SELECT * FROM ssi_audit_log WHERE actor_type = ${quote(actorType)} AND actor_id = ${quote(actorId)} ORDER BY timestamp DESC LIMIT ${limit}`
  ) as AuditEntry[];
}

/**
 * Query audit logs within a time range.
 */
export function getAuditLogsByDateRange(
  fromDate: string,
  toDate: string,
  limit = 100
): AuditEntry[] {
  return query(
    `SELECT * FROM ssi_audit_log WHERE timestamp >= ${quote(fromDate)} AND timestamp <= ${quote(toDate)} ORDER BY timestamp DESC LIMIT ${limit}`
  ) as AuditEntry[];
}

/**
 * Get all audit logs (paginated).
 */
export function listAuditLogs(limit = 100, offset = 0): AuditEntry[] {
  return query(
    `SELECT * FROM ssi_audit_log ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`
  ) as AuditEntry[];
}

/**
 * Count total audit log entries.
 */
export function countAuditLogs(): number {
  const rows = query("SELECT COUNT(*) AS cnt FROM ssi_audit_log");
  return (rows[0] as any)?.cnt || 0;
}

/**
 * Helper to extract client IP from Express request.
 */
export function getClientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip || "0.0.0.0";
}

/**
 * Helper to determine actor info from a request.
 */
export function getActorInfo(
  req: { user?: { sub: string; email: string }; apiKey?: { id: string; name: string } }
): { actorType: ActorType; actorId: string | null } {
  if (req.user) {
    return { actorType: "user", actorId: req.user.sub };
  }
  if (req.apiKey) {
    return { actorType: "api_key", actorId: req.apiKey.id };
  }
  return { actorType: "unknown", actorId: null };
}