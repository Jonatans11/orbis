/**
 * Database metadata access layer for ORBIS.ID SSI Backend.
 * Stores non-sensitive DID metadata, credential metadata, and trust registry
 * entries in the shared team-db (Turso/SQLite).
 * 
 * Personal data never touches this store — only indexed metadata.
 * 
 * NOTE: team-db CLI requires single-line SQL statements (no newlines).
 */

import { execSync } from "node:child_process";

const TEAM_DB = "team-db";

/**
 * Execute a SQL statement against the shared team-db and parse JSON result.
 * SQL must be single-line (no newlines) as team-db CLI doesn't support multi-line.
 */
function query(sql: string): any[] {
  // Normalize whitespace: collapse newlines and multiple spaces
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execSync(`${TEAM_DB} ${JSON.stringify(normalized)}`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return JSON.parse(output.trim());
  } catch (err: any) {
    if (err.stderr?.includes("no such table")) {
      return [];
    }
    throw new Error(`DB query failed: ${err.message}`);
  }
}

/**
 * Initialize metadata tables. Safe to run multiple times (IF NOT EXISTS).
 * Each CREATE TABLE is a separate call (team-db only accepts one statement at a time).
 */
export function initDatabase(): void {
  // DID metadata table
  query("CREATE TABLE IF NOT EXISTS ssi_dids (id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, method TEXT NOT NULL CHECK(method IN ('key', 'web')), public_key_multibase TEXT NOT NULL, verification_method_id TEXT NOT NULL, document TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'deactivated')), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Verifiable Credential metadata table
  query("CREATE TABLE IF NOT EXISTS ssi_credentials (id TEXT PRIMARY KEY, credential_id TEXT NOT NULL UNIQUE, issuer_did TEXT NOT NULL, subject_did TEXT NOT NULL, type TEXT NOT NULL, schema_url TEXT, issuance_date TEXT NOT NULL, expiration_date TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')), proof_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Trust registry table
  query("CREATE TABLE IF NOT EXISTS ssi_trust_registry (id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'issuer' CHECK(category IN ('issuer', 'verifier', 'both')), authorized_credential_types TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'revoked')), added_by TEXT, added_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Verification log (append-only)
  query("CREATE TABLE IF NOT EXISTS ssi_verifications (id TEXT PRIMARY KEY, credential_id TEXT NOT NULL, verifier_did TEXT, verified INTEGER NOT NULL CHECK(verified IN (0, 1)), reason TEXT, timestamp TEXT NOT NULL DEFAULT (datetime('now')))");
}

// ─── DID Metadata ────────────────────────────────────────────────────────────

export interface DIDRecord {
  id: string;
  did: string;
  method: "key" | "web";
  public_key_multibase: string;
  verification_method_id: string;
  document: string;
  status: "active" | "revoked" | "deactivated";
  created_at: string;
  updated_at: string;
}

export function insertDID(record: Omit<DIDRecord, "created_at" | "updated_at">): void {
  query(`INSERT INTO ssi_dids (id, did, method, public_key_multibase, verification_method_id, document, status) VALUES (${quote(record.id)}, ${quote(record.did)}, ${quote(record.method)}, ${quote(record.public_key_multibase)}, ${quote(record.verification_method_id)}, ${quote(record.document)}, ${quote(record.status)})`);
}

export function getDIDByMethod(method: string, did: string): DIDRecord | null {
  const rows = query(`SELECT * FROM ssi_dids WHERE method = ${quote(method)} AND did = ${quote(did)}`);
  if (rows.length === 0) return null;
  return rows[0] as DIDRecord;
}

export function getDIDById(id: string): DIDRecord | null {
  const rows = query(`SELECT * FROM ssi_dids WHERE id = ${quote(id)}`);
  if (rows.length === 0) return null;
  return rows[0] as DIDRecord;
}

export function listDIDs(method?: string): DIDRecord[] {
  if (method) {
    return query(`SELECT * FROM ssi_dids WHERE method = ${quote(method)} ORDER BY created_at DESC`) as DIDRecord[];
  }
  return query("SELECT * FROM ssi_dids ORDER BY created_at DESC") as DIDRecord[];
}

export function updateDIDStatus(id: string, status: "active" | "revoked" | "deactivated"): void {
  query(`UPDATE ssi_dids SET status = ${quote(status)}, updated_at = datetime('now') WHERE id = ${quote(id)}`);
}

// ─── Credential Metadata ─────────────────────────────────────────────────────

export interface CredentialRecord {
  id: string;
  credential_id: string;
  issuer_did: string;
  subject_did: string;
  type: string;
  schema_url: string | null;
  issuance_date: string;
  expiration_date: string | null;
  status: "active" | "revoked" | "expired";
  proof_type: string;
  created_at: string;
}

export function insertCredential(record: Omit<CredentialRecord, "created_at">): void {
  query(`INSERT INTO ssi_credentials (id, credential_id, issuer_did, subject_did, type, schema_url, issuance_date, expiration_date, status, proof_type) VALUES (${quote(record.id)}, ${quote(record.credential_id)}, ${quote(record.issuer_did)}, ${quote(record.subject_did)}, ${quote(record.type)}, ${quote(record.schema_url || "")}, ${quote(record.issuance_date)}, ${quote(record.expiration_date || "")}, ${quote(record.status)}, ${quote(record.proof_type)})`);
}

export function getCredentialByCredentialId(credentialId: string): CredentialRecord | null {
  const rows = query(`SELECT * FROM ssi_credentials WHERE credential_id = ${quote(credentialId)}`);
  if (rows.length === 0) return null;
  return rows[0] as CredentialRecord;
}

export function listCredentials(issuerDid?: string): CredentialRecord[] {
  if (issuerDid) {
    return query(`SELECT * FROM ssi_credentials WHERE issuer_did = ${quote(issuerDid)} ORDER BY created_at DESC`) as CredentialRecord[];
  }
  return query("SELECT * FROM ssi_credentials ORDER BY created_at DESC") as CredentialRecord[];
}

export function updateCredentialStatus(id: string, status: "active" | "revoked" | "expired"): void {
  query(`UPDATE ssi_credentials SET status = ${quote(status)} WHERE id = ${quote(id)}`);
}

// ─── Trust Registry ──────────────────────────────────────────────────────────

export interface TrustRegistryEntry {
  id: string;
  did: string;
  name: string;
  category: "issuer" | "verifier" | "both";
  authorized_credential_types: string;
  status: "active" | "suspended" | "revoked";
  added_by: string | null;
  added_at: string;
  updated_at: string;
}

export function insertTrustEntry(record: Omit<TrustRegistryEntry, "added_at" | "updated_at">): void {
  query(`INSERT INTO ssi_trust_registry (id, did, name, category, authorized_credential_types, status, added_by) VALUES (${quote(record.id)}, ${quote(record.did)}, ${quote(record.name)}, ${quote(record.category)}, ${quote(record.authorized_credential_types)}, ${quote(record.status)}, ${quote(record.added_by || "")})`);
}

export function getTrustEntryByDID(did: string): TrustRegistryEntry | null {
  const rows = query(`SELECT * FROM ssi_trust_registry WHERE did = ${quote(did)}`);
  if (rows.length === 0) return null;
  return rows[0] as TrustRegistryEntry;
}

export function listTrustEntries(category?: string): TrustRegistryEntry[] {
  if (category) {
    return query(`SELECT * FROM ssi_trust_registry WHERE category = ${quote(category)} ORDER BY added_at DESC`) as TrustRegistryEntry[];
  }
  return query("SELECT * FROM ssi_trust_registry ORDER BY added_at DESC") as TrustRegistryEntry[];
}

export function updateTrustEntryStatus(id: string, status: "active" | "suspended" | "revoked"): void {
  query(`UPDATE ssi_trust_registry SET status = ${quote(status)}, updated_at = datetime('now') WHERE id = ${quote(id)}`);
}

export function removeTrustEntry(id: string): void {
  query(`DELETE FROM ssi_trust_registry WHERE id = ${quote(id)}`);
}

// ─── Verification Log ────────────────────────────────────────────────────────

export interface VerificationLog {
  id: string;
  credential_id: string;
  verifier_did: string | null;
  verified: boolean;
  reason: string | null;
  timestamp: string;
}

export function insertVerification(record: Omit<VerificationLog, "timestamp">): void {
  query(`INSERT INTO ssi_verifications (id, credential_id, verifier_did, verified, reason) VALUES (${quote(record.id)}, ${quote(record.credential_id)}, ${quote(record.verifier_did || "")}, ${record.verified ? 1 : 0}, ${quote(record.reason || "")})`);
}

export function getVerificationsForCredential(credentialId: string): VerificationLog[] {
  return query(`SELECT * FROM ssi_verifications WHERE credential_id = ${quote(credentialId)} ORDER BY timestamp DESC`) as VerificationLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function quote(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  // Escape single quotes by doubling them (SQLite escape)
  return `'${val.replace(/'/g, "''")}'`;
}