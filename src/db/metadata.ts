/**
 * Database metadata access layer for ORBIS.ID SSI Backend.
 * Stores non-sensitive DID metadata, credential metadata, and trust registry
 * entries in the shared team-db (Turso/SQLite).
 * 
 * Personal data never touches this store — only indexed metadata.
 * 
 * NOTE: team-db CLI requires single-line SQL statements (no newlines).
 */

import { execFileSync } from "node:child_process";

const TEAM_DB = "team-db";

/**
 * Execute a SQL statement against the shared team-db and parse JSON result.
 * SQL must be single-line (no newlines) as team-db CLI doesn't support multi-line.
 */
function query(sql: string): any[] {
  // Normalize whitespace: collapse newlines and multiple spaces
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execFileSync(TEAM_DB, [normalized], {
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
  query("CREATE TABLE IF NOT EXISTS ssi_dids (id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, method TEXT NOT NULL CHECK(method IN ('key', 'web')), public_key_multibase TEXT NOT NULL, verification_method_id TEXT NOT NULL, document TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'deactivated')), owner_user_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Verifiable Credential metadata table
  query("CREATE TABLE IF NOT EXISTS ssi_credentials (id TEXT PRIMARY KEY, credential_id TEXT NOT NULL UNIQUE, issuer_did TEXT NOT NULL, subject_did TEXT NOT NULL, type TEXT NOT NULL, schema_url TEXT, issuance_date TEXT NOT NULL, expiration_date TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')), proof_type TEXT NOT NULL, owner_user_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Trust registry table
  query("CREATE TABLE IF NOT EXISTS ssi_trust_registry (id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'issuer' CHECK(category IN ('issuer', 'verifier', 'both')), authorized_credential_types TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'revoked')), added_by TEXT, added_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Verification log (append-only)
  query("CREATE TABLE IF NOT EXISTS ssi_verifications (id TEXT PRIMARY KEY, credential_id TEXT NOT NULL, verifier_did TEXT, verified INTEGER NOT NULL CHECK(verified IN (0, 1)), reason TEXT, timestamp TEXT NOT NULL DEFAULT (datetime('now')))");

  // DIDComm messages table
  query("CREATE TABLE IF NOT EXISTS didcomm_messages (id TEXT PRIMARY KEY, msg_type TEXT NOT NULL, from_did TEXT NOT NULL, to_did TEXT NOT NULL, body TEXT NOT NULL, encrypted_payload TEXT, status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read')), created_at TEXT NOT NULL DEFAULT (datetime('now')), thread_id TEXT)");

  // DIDComm out-of-band invitations table
  query("CREATE TABLE IF NOT EXISTS didcomm_oob_invitations (id TEXT PRIMARY KEY, invitation_url TEXT NOT NULL, from_did TEXT NOT NULL, label TEXT, goal TEXT, goal_code TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'consumed', 'expired')), created_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // DIDComm key agreement metadata (stores X25519 public keys derived from Ed25519)
  query("CREATE TABLE IF NOT EXISTS didcomm_key_agreement (id TEXT PRIMARY KEY, did TEXT NOT NULL UNIQUE, x25519_public_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Gateway API keys table
  query("CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, key_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, member_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked_at TEXT, last_used_at TEXT)");

  // Gateway usage logs table
  query("CREATE TABLE IF NOT EXISTS usage_logs (id TEXT PRIMARY KEY, api_key_id TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, status_code INTEGER NOT NULL, response_time_ms INTEGER NOT NULL DEFAULT 0, timestamp TEXT NOT NULL DEFAULT (datetime('now')))");

  // Rate limiter state table
  query("CREATE TABLE IF NOT EXISTS rate_limits (api_key_id TEXT NOT NULL PRIMARY KEY, tokens REAL NOT NULL DEFAULT 100, last_refill TEXT NOT NULL DEFAULT (datetime('now')))");

  // Webhook registrations table
  query("CREATE TABLE IF NOT EXISTS webhooks (id TEXT PRIMARY KEY, api_key_id TEXT NOT NULL, url TEXT NOT NULL, events TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // Webhook delivery log table
  query("CREATE TABLE IF NOT EXISTS webhook_deliveries (id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL, event TEXT NOT NULL, payload TEXT NOT NULL, status_code INTEGER, response_body TEXT, success INTEGER NOT NULL DEFAULT 0, delivered_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // DIDComm contacts table (per-user contact list for mobile wallet)
  query("CREATE TABLE IF NOT EXISTS didcomm_contacts (id TEXT PRIMARY KEY, user_did TEXT NOT NULL, contact_did TEXT NOT NULL, label TEXT NOT NULL, avatar_url TEXT, last_interaction_at TEXT, unread_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");

  // DIDComm push registration table (maps DIDs to device push tokens)
  query("CREATE TABLE IF NOT EXISTS didcomm_push_registrations (id TEXT PRIMARY KEY, did TEXT NOT NULL, push_token TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('ios', 'android', 'web')), device_id TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
}

/**
 * Safe migration: add owner_user_id column to existing tables.
 * Catches errors silently if column already exists (Turso throws Parse error).
 */
export function migrateOwnerColumns(): void {
  try {
    query("ALTER TABLE ssi_dids ADD COLUMN owner_user_id TEXT");
  } catch (_) { /* column likely exists */ }
  try {
    query("ALTER TABLE ssi_credentials ADD COLUMN owner_user_id TEXT");
  } catch (_) { /* column likely exists */ }
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
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function insertDID(record: Omit<DIDRecord, "created_at" | "updated_at">): void {
  query(`INSERT INTO ssi_dids (id, did, method, public_key_multibase, verification_method_id, document, status, owner_user_id) VALUES (${quote(record.id)}, ${quote(record.did)}, ${quote(record.method)}, ${quote(record.public_key_multibase)}, ${quote(record.verification_method_id)}, ${quote(record.document)}, ${quote(record.status)}, ${quote(record.owner_user_id)})`);
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

export function listDIDs(method?: string, ownerUserId?: string): DIDRecord[] {
  let sql = "SELECT * FROM ssi_dids";
  const clauses: string[] = [];
  if (method) clauses.push(`method = ${quote(method)}`);
  if (ownerUserId) clauses.push(`owner_user_id = ${quote(ownerUserId)}`);
  if (clauses.length > 0) sql += " WHERE " + clauses.join(" AND ");
  sql += " ORDER BY created_at DESC";
  return query(sql) as DIDRecord[];
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
  owner_user_id: string | null;
  created_at: string;
}

export function insertCredential(record: Omit<CredentialRecord, "created_at">): void {
  query(`INSERT INTO ssi_credentials (id, credential_id, issuer_did, subject_did, type, schema_url, issuance_date, expiration_date, status, proof_type, owner_user_id) VALUES (${quote(record.id)}, ${quote(record.credential_id)}, ${quote(record.issuer_did)}, ${quote(record.subject_did)}, ${quote(record.type)}, ${quote(record.schema_url || "")}, ${quote(record.issuance_date)}, ${quote(record.expiration_date || "")}, ${quote(record.status)}, ${quote(record.proof_type)}, ${quote(record.owner_user_id)})`);
}

export function getCredentialByCredentialId(credentialId: string): CredentialRecord | null {
  const rows = query(`SELECT * FROM ssi_credentials WHERE credential_id = ${quote(credentialId)}`);
  if (rows.length === 0) return null;
  return rows[0] as CredentialRecord;
}

export function listCredentials(issuerDid?: string, ownerUserId?: string): CredentialRecord[] {
  let sql = "SELECT * FROM ssi_credentials";
  const clauses: string[] = [];
  if (issuerDid) clauses.push(`issuer_did = ${quote(issuerDid)}`);
  if (ownerUserId) clauses.push(`owner_user_id = ${quote(ownerUserId)}`);
  if (clauses.length > 0) sql += " WHERE " + clauses.join(" AND ");
  sql += " ORDER BY created_at DESC";
  return query(sql) as CredentialRecord[];
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

export function quote(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  // Escape single quotes by doubling them (SQLite escape)
  return `'${val.replace(/'/g, "''")}'`;
}

// ─── DIDComm Message Storage ──────────────────────────────────────────────────

export interface DIDCommMessage {
  id: string;
  msg_type: string;
  from_did: string;
  to_did: string;
  body: string;
  encrypted_payload: string | null;
  status: "sent" | "delivered" | "read";
  created_at: string;
  thread_id: string | null;
}

export function insertDIDCommMessage(record: Omit<DIDCommMessage, "created_at">): void {
  query(`INSERT INTO didcomm_messages (id, msg_type, from_did, to_did, body, encrypted_payload, status, thread_id) VALUES (${quote(record.id)}, ${quote(record.msg_type)}, ${quote(record.from_did)}, ${quote(record.to_did)}, ${quote(record.body)}, ${quote(record.encrypted_payload)}, ${quote(record.status)}, ${quote(record.thread_id)})`);
}

export function getDIDCommMessage(id: string): DIDCommMessage | null {
  const rows = query(`SELECT * FROM didcomm_messages WHERE id = ${quote(id)}`);
  if (rows.length === 0) return null;
  return rows[0] as DIDCommMessage;
}

export function listDIDCommMessages(did: string): DIDCommMessage[] {
  return query(`SELECT * FROM didcomm_messages WHERE to_did = ${quote(did)} OR from_did = ${quote(did)} ORDER BY created_at DESC`) as DIDCommMessage[];
}

export function getDIDCommInbox(did: string): DIDCommMessage[] {
  return query(`SELECT * FROM didcomm_messages WHERE to_did = ${quote(did)} ORDER BY created_at DESC`) as DIDCommMessage[];
}

export function updateDIDCommMessageStatus(id: string, status: "sent" | "delivered" | "read"): void {
  query(`UPDATE didcomm_messages SET status = ${quote(status)} WHERE id = ${quote(id)}`);
}

// ─── DIDComm Out-of-Band Invitation Storage ───────────────────────────────────

export interface OOBInvitation {
  id: string;
  invitation_url: string;
  from_did: string;
  label: string | null;
  goal: string | null;
  goal_code: string | null;
  status: "active" | "consumed" | "expired";
  created_at: string;
}

export function insertOOBInvitation(record: Omit<OOBInvitation, "created_at">): void {
  query(`INSERT INTO didcomm_oob_invitations (id, invitation_url, from_did, label, goal, goal_code, status) VALUES (${quote(record.id)}, ${quote(record.invitation_url)}, ${quote(record.from_did)}, ${quote(record.label)}, ${quote(record.goal)}, ${quote(record.goal_code)}, ${quote(record.status)})`);
}

export function getOOBInvitation(id: string): OOBInvitation | null {
  const rows = query(`SELECT * FROM didcomm_oob_invitations WHERE id = ${quote(id)}`);
  if (rows.length === 0) return null;
  return rows[0] as OOBInvitation;
}

export function listActiveOOBInvitations(did: string): OOBInvitation[] {
  return query(`SELECT * FROM didcomm_oob_invitations WHERE from_did = ${quote(did)} AND status = 'active' ORDER BY created_at DESC`) as OOBInvitation[];
}

export function consumeOOBInvitation(id: string): void {
  query(`UPDATE didcomm_oob_invitations SET status = 'consumed' WHERE id = ${quote(id)}`);
}

// ─── DIDComm Key Agreement Storage ────────────────────────────────────────────

export interface KeyAgreementRecord {
  id: string;
  did: string;
  x25519_public_key: string;
  created_at: string;
}

export function insertKeyAgreement(record: Omit<KeyAgreementRecord, "created_at">): void {
  query(`INSERT INTO didcomm_key_agreement (id, did, x25519_public_key) VALUES (${quote(record.id)}, ${quote(record.did)}, ${quote(record.x25519_public_key)})`);
}

export function getKeyAgreement(did: string): KeyAgreementRecord | null {
  const rows = query(`SELECT * FROM didcomm_key_agreement WHERE did = ${quote(did)}`);
  if (rows.length === 0) return null;
  return rows[0] as KeyAgreementRecord;
}

// ─── DIDComm Paginated Message Queries ──────────────────────────────────────

export function getDIDCommInboxPaginated(did: string, limit: number, offset: number): DIDCommMessage[] {
  const l = Math.min(Math.max(1, limit), 100);
  const o = Math.max(0, offset);
  return query(`SELECT * FROM didcomm_messages WHERE to_did = ${quote(did)} ORDER BY created_at DESC LIMIT ${l} OFFSET ${o}`) as DIDCommMessage[];
}

export function getDIDCommConversation(did: string, peerDID: string, limit: number, offset: number): DIDCommMessage[] {
  const l = Math.min(Math.max(1, limit), 100);
  const o = Math.max(0, offset);
  return query(`SELECT * FROM didcomm_messages WHERE (from_did = ${quote(did)} AND to_did = ${quote(peerDID)}) OR (from_did = ${quote(peerDID)} AND to_did = ${quote(did)}) ORDER BY created_at DESC LIMIT ${l} OFFSET ${o}`) as DIDCommMessage[];
}

export function getDIDCommThreadMessages(threadId: string, limit: number, offset: number): DIDCommMessage[] {
  const l = Math.min(Math.max(1, limit), 100);
  const o = Math.max(0, offset);
  return query(`SELECT * FROM didcomm_messages WHERE thread_id = ${quote(threadId)} ORDER BY created_at ASC LIMIT ${l} OFFSET ${o}`) as DIDCommMessage[];
}

export function getUnreadMessageCount(did: string): number {
  const rows = query(`SELECT COUNT(*) as cnt FROM didcomm_messages WHERE to_did = ${quote(did)} AND status = 'sent'`);
  return (rows[0] as any)?.cnt || 0;
}

export function getUnreadMessageCountFrom(fromDID: string, toDID: string): number {
  const rows = query(`SELECT COUNT(*) as cnt FROM didcomm_messages WHERE from_did = ${quote(fromDID)} AND to_did = ${quote(toDID)} AND status = 'sent'`);
  return (rows[0] as any)?.cnt || 0;
}

// ─── DIDComm E2E Encryption Purge Migration ─────────────────────────────────

/**
 * Purge plaintext bodies from didcomm_messages.
 * SECURITY: Existing messages may have stored plaintext in the `body` column.
 * This migration clears those bodies so the server can no longer read them.
 * Messages without encrypted_payload are deleted entirely.
 */
export function purgePlaintextBodies(): { cleared: number; deleted: number } {
  // Clear body field on all messages that have an encrypted_payload
  query("UPDATE didcomm_messages SET body = '.' WHERE encrypted_payload IS NOT NULL AND body != '.' AND body != ''");
  const cleared: any = query("SELECT changes() as cnt")[0];
  // Delete messages that have no encrypted_payload (incomplete/old format messages)
  query("DELETE FROM didcomm_messages WHERE encrypted_payload IS NULL OR encrypted_payload = ''");
  const deleted: any = query("SELECT changes() as cnt")[0];
  return { cleared: cleared?.cnt || 0, deleted: deleted?.cnt || 0 };
}

// ─── DIDComm Contact Storage ────────────────────────────────────────────────

export interface ContactRecord {
  id: string;
  user_did: string;
  contact_did: string;
  label: string;
  avatar_url: string | null;
  last_interaction_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export function insertContact(record: Omit<ContactRecord, "created_at" | "updated_at"> & { created_at: string; updated_at: string }): void {
  query(`INSERT INTO didcomm_contacts (id, user_did, contact_did, label, avatar_url, last_interaction_at, unread_count, created_at, updated_at) VALUES (${quote(record.id)}, ${quote(record.user_did)}, ${quote(record.contact_did)}, ${quote(record.label)}, ${quote(record.avatar_url)}, ${quote(record.last_interaction_at)}, ${record.unread_count}, ${quote(record.created_at)}, ${quote(record.updated_at)})`);
}

export function getContactById(id: string): ContactRecord | null {
  const rows = query(`SELECT * FROM didcomm_contacts WHERE id = ${quote(id)}`);
  if (rows.length === 0) return null;
  return rows[0] as ContactRecord;
}

export function findContactByDIDs(userDID: string, contactDID: string): ContactRecord | null {
  const rows = query(`SELECT * FROM didcomm_contacts WHERE user_did = ${quote(userDID)} AND contact_did = ${quote(contactDID)}`);
  if (rows.length === 0) return null;
  return rows[0] as ContactRecord;
}

export function listContacts(userDID: string): ContactRecord[] {
  return query(`SELECT * FROM didcomm_contacts WHERE user_did = ${quote(userDID)} ORDER BY last_interaction_at DESC NULLS LAST, label ASC`) as ContactRecord[];
}

export function updateContactFields(id: string, setClause: string): void {
  query(`UPDATE didcomm_contacts SET ${setClause} WHERE id = ${quote(id)}`);
}

export function incrementContactUnread(id: string): void {
  query(`UPDATE didcomm_contacts SET unread_count = unread_count + 1, updated_at = datetime('now') WHERE id = ${quote(id)}`);
}

export function deleteContact(id: string): void {
  query(`DELETE FROM didcomm_contacts WHERE id = ${quote(id)}`);
}

export function searchContacts(userDID: string, queryStr: string): ContactRecord[] {
  const like = `%${queryStr.replace(/'/g, "''")}%`;
  return query(`SELECT * FROM didcomm_contacts WHERE user_did = ${quote(userDID)} AND (label LIKE '${like}' OR contact_did LIKE '${like}') ORDER BY last_interaction_at DESC NULLS LAST, label ASC`) as ContactRecord[];
}

// ─── DIDComm Push Registration Storage ──────────────────────────────────────

export interface PushRegistrationRecord {
  id: string;
  did: string;
  push_token: string;
  platform: string;
  device_id: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export function insertPushRegistration(record: Omit<PushRegistrationRecord, "created_at" | "updated_at"> & { created_at: string; updated_at: string }): void {
  query(`INSERT INTO didcomm_push_registrations (id, did, push_token, platform, device_id, active, created_at, updated_at) VALUES (${quote(record.id)}, ${quote(record.did)}, ${quote(record.push_token)}, ${quote(record.platform)}, ${quote(record.device_id)}, ${record.active}, ${quote(record.created_at)}, ${quote(record.updated_at)})`);
}

export function getPushRegistration(id: string): PushRegistrationRecord | null {
  const rows = query(`SELECT * FROM didcomm_push_registrations WHERE id = ${quote(id)}`);
  if (rows.length === 0) return null;
  return rows[0] as PushRegistrationRecord;
}

export function findPushRegistration(deviceId: string): PushRegistrationRecord | null {
  const rows = query(`SELECT * FROM didcomm_push_registrations WHERE device_id = ${quote(deviceId)}`);
  if (rows.length === 0) return null;
  return rows[0] as PushRegistrationRecord;
}

export function getPushRegistrations(did: string): PushRegistrationRecord[] {
  return query(`SELECT * FROM didcomm_push_registrations WHERE did = ${quote(did)} AND active = 1 ORDER BY created_at DESC`) as PushRegistrationRecord[];
}

export function updatePushRegistration(id: string, pushToken: string, did: string, now: string): void {
  query(`UPDATE didcomm_push_registrations SET push_token = ${quote(pushToken)}, did = ${quote(did)}, updated_at = ${quote(now)} WHERE id = ${quote(id)}`);
}

export function deactivatePushRegistration(id: string): void {
  query(`UPDATE didcomm_push_registrations SET active = 0, updated_at = datetime('now') WHERE id = ${quote(id)}`);
}