/**
 * API Key Management for ORBIS.ID API Gateway.
 * Keys stored in team-db. Raw keys are prefixed with "orb_" and revealed once.
 * Only SHA-256 hashes are stored in the database.
 */

import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

export const VALID_SCOPES = [
  "did:read",
  "did:write",
  "vc:issue",
  "vc:verify",
  "trust:read",
  "trust:write",
] as const;

export type Scope = (typeof VALID_SCOPES)[number];

export interface ApiKeyRecord {
  id: string;
  name: string;
  key_hash: string;
  scopes: string;
  member_id: string | null;
  plan: "free" | "developer" | "enterprise";
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

function db(query: string): any[] {
  const out = execSync(`team-db "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(out.trim() || "[]") as any[];
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a new API key with the given name, scopes, and subscription plan.
 * Returns the raw key (shown once) and the stored record info.
 */
export function generateApiKey(
  name: string,
  scopes: Scope[],
  memberId?: string,
  plan: "free" | "developer" | "enterprise" = "free"
): { rawKey: string; id: string; name: string; scopes: string; plan: string; created_at: string } {
  if (!name || name.trim().length === 0) {
    throw new Error("API key name is required");
  }
  if (!scopes || scopes.length === 0) {
    throw new Error("At least one scope is required");
  }
  for (const s of scopes) {
    if (!VALID_SCOPES.includes(s)) {
      throw new Error(`Invalid scope: ${s}. Valid scopes: ${VALID_SCOPES.join(", ")}`);
    }
  }

  const rawKey = `orb_${randomBytes(24).toString("base64url")}`;
  const keyHash = hashKey(rawKey);
  const id = generateId();
  const now = new Date().toISOString();
  const scopesStr = scopes.join(",");

  db(
    `INSERT INTO api_keys (id, name, key_hash, scopes, member_id, plan, created_at) VALUES ('${id}', '${name.replace(/'/g, "''")}', '${keyHash}', '${scopesStr}', ${memberId ? `'${memberId}'` : "NULL"}, '${plan}', '${now}')`
  );

  return { rawKey, id, name, scopes: scopesStr, plan, created_at: now };
}

/**
 * Look up an API key by its raw value (hash the key, find matching hash).
 * Returns the record or null if not found / revoked.
 */
export function findApiKey(rawKey: string): ApiKeyRecord | null {
  const keyHash = hashKey(rawKey);
  const rows = db(
    `SELECT id, name, key_hash, scopes, member_id, plan, created_at, revoked_at, last_used_at FROM api_keys WHERE key_hash = '${keyHash}'`
  ) as any[];

  if (rows.length === 0) return null;

  const row = rows[0];
  const record: ApiKeyRecord = {
    id: row.id,
    name: row.name,
    key_hash: row.key_hash,
    scopes: row.scopes,
    member_id: row.member_id,
    plan: row.plan || "free",
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
  };

  // If revoked, return null
  if (record.revoked_at) return null;

  return record;
}

/**
 * Revoke an API key by its database ID.
 */
export function revokeApiKey(id: string): boolean {
  const now = new Date().toISOString();
  db(
    `UPDATE api_keys SET revoked_at = '${now}' WHERE id = '${id}' AND revoked_at IS NULL`
  );
  return true;
}

/**
 * List all API keys (without exposing raw keys).
 */
export function listApiKeys(): Omit<ApiKeyRecord, "key_hash">[] {
  const rows = db(
    "SELECT id, name, scopes, member_id, plan, created_at, revoked_at, last_used_at FROM api_keys ORDER BY created_at DESC"
  ) as any[];

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    scopes: r.scopes,
    member_id: r.member_id,
    plan: r.plan || "free",
    created_at: r.created_at,
    revoked_at: r.revoked_at,
    last_used_at: r.last_used_at,
  }));
}

/**
 * Update the last_used_at timestamp for an API key.
 */
export function touchApiKey(id: string): void {
  const now = new Date().toISOString();
  db(
    `UPDATE api_keys SET last_used_at = '${now}' WHERE id = '${id}'`
  );
}

/**
 * Check if an API key has a specific scope.
 */
export function hasScope(record: ApiKeyRecord, scope: Scope): boolean {
  return record.scopes.split(",").includes(scope);
}