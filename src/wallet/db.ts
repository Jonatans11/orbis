/**
 * Wallet Database Module for ORBIS.ID.
 *
 * Manages wallet-specific tables: devices, backup items, vault records,
 * sharing grants, grant access logs, and refresh tokens.
 *
 * All queries use team-db CLI (shared SQLite via Turso). Reads are sync;
 * high-frequency writes (grant access log) use non-blocking async exec.
 */

import { exec, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const TEAM_DB = "team-db";

function query(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execFileSync(TEAM_DB, [normalized], { encoding: "utf-8", timeout: 10_000 });
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

export function initWalletTables(): void {
  query("CREATE TABLE IF NOT EXISTS wallet_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, wallet_id TEXT NOT NULL, device_name TEXT, platform TEXT CHECK(platform IN ('ios','android','web')), push_token TEXT, wiped INTEGER DEFAULT 0, wipe_reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen_at TEXT)");
  query("CREATE TABLE IF NOT EXISTS wallet_backup_items (local_id TEXT, user_id TEXT NOT NULL, category TEXT NOT NULL, ciphertext BLOB NOT NULL, iv TEXT NOT NULL, alg TEXT NOT NULL DEFAULT 'A256GCM', size INTEGER NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, local_id))");
  query("CREATE TABLE IF NOT EXISTS vault_records (record_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL, meta_json TEXT NOT NULL, ciphertext BLOB NOT NULL, iv TEXT NOT NULL, alg TEXT NOT NULL DEFAULT 'A256GCM', size INTEGER NOT NULL, consent TEXT NOT NULL DEFAULT 'private', updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS vault_grants (grant_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, grantee_did TEXT NOT NULL, scope TEXT NOT NULL, encrypted_key TEXT NOT NULL, price_amount INTEGER DEFAULT 0, price_currency TEXT DEFAULT 'USD', expires_at TEXT NOT NULL, revoked INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS grant_access_log (id TEXT PRIMARY KEY, grant_id TEXT NOT NULL, accessed_by_did TEXT NOT NULL, accessed_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS refresh_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT, expires_at TEXT NOT NULL, revoked INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS wallet_push_tokens (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, user_id TEXT NOT NULL, push_token TEXT, last_pushed_at TEXT, message_count INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS wallet_message_queue (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, user_did TEXT NOT NULL, unread_count INTEGER DEFAULT 0, last_message_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  query("CREATE TABLE IF NOT EXISTS oauth_identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (provider, subject))");
}

// ─── Devices ────────────────────────────────────────────────────────────────

export function registerDevice(deviceId: string, userId: string, walletId: string, deviceName: string | null, platform: string | null, pushToken: string | null): void {
  query(`INSERT INTO wallet_devices (id, user_id, wallet_id, device_name, platform, push_token) VALUES (${quote(deviceId)}, ${quote(userId)}, ${quote(walletId)}, ${quote(deviceName)}, ${quote(platform)}, ${quote(pushToken)})`);
}

export function getDevicesByUser(userId: string): any[] {
  return query(`SELECT * FROM wallet_devices WHERE user_id = ${quote(userId)} ORDER BY created_at DESC`);
}

export function unregisterDevice(deviceId: string, userId: string): void {
  query(`DELETE FROM wallet_devices WHERE id = ${quote(deviceId)} AND user_id = ${quote(userId)}`);
  query(`DELETE FROM wallet_push_tokens WHERE device_id = ${quote(deviceId)}`);
}

export function updateDeviceLastSeen(deviceId: string): void {
  query(`UPDATE wallet_devices SET last_seen_at = datetime('now') WHERE id = ${quote(deviceId)}`);
}

export function updatePushToken(deviceId: string, userId: string, pushToken: string): void {
  query(`UPDATE wallet_devices SET push_token = ${quote(pushToken)}, last_seen_at = datetime('now') WHERE id = ${quote(deviceId)} AND user_id = ${quote(userId)}`);
  query(`INSERT OR REPLACE INTO wallet_push_tokens (id, device_id, user_id, push_token) VALUES (${quote(randomBytes(16).toString("hex"))}, ${quote(deviceId)}, ${quote(userId)}, ${quote(pushToken)})`);
}

export function getWipeInfo(userId: string): any {
  const rows = query(`SELECT wipe_reason FROM wallet_devices WHERE user_id = ${quote(userId)} AND wiped = 1 LIMIT 1`);
  return rows.length > 0 ? rows[0] : null;
}

// ─── Credential backup ──────────────────────────────────────────────────────

export function upsertBackupItem(userId: string, localId: string, category: string, ciphertext: string, iv: string, alg: string, size: number): void {
  query(`INSERT OR REPLACE INTO wallet_backup_items (local_id, user_id, category, ciphertext, iv, alg, size, updated_at) VALUES (${quote(localId)}, ${quote(userId)}, ${quote(category)}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg)}, ${size}, datetime('now'))`);
}

export function getBackupItems(userId: string, includeCiphertext: boolean): any[] {
  const cols = includeCiphertext ? "*" : "local_id, category, size, updated_at";
  return query(`SELECT ${cols} FROM wallet_backup_items WHERE user_id = ${quote(userId)} ORDER BY updated_at DESC`);
}

export function deleteBackupItem(userId: string, localId: string): void {
  query(`DELETE FROM wallet_backup_items WHERE user_id = ${quote(userId)} AND local_id = ${quote(localId)}`);
}

// ─── Vault records ──────────────────────────────────────────────────────────

export function upsertVaultRecord(recordId: string, userId: string, category: string, metaJson: string, ciphertext: string, iv: string, alg: string, size: number, consent: string = "private"): void {
  query(`INSERT OR REPLACE INTO vault_records (record_id, user_id, category, meta_json, ciphertext, iv, alg, size, consent, updated_at) VALUES (${quote(recordId)}, ${quote(userId)}, ${quote(category)}, ${quote(metaJson)}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg)}, ${size}, ${quote(consent)}, datetime('now'))`);
}

export function getVaultRecords(userId: string, category: string, cursor?: string, limit: number = 20): { items: any[]; nextCursor: string | null } {
  let sql = `SELECT record_id, meta_json, size, consent, updated_at FROM vault_records WHERE user_id = ${quote(userId)} AND category = ${quote(category)}`;
  if (cursor) sql += ` AND updated_at < ${quote(cursor)}`;
  sql += ` ORDER BY updated_at DESC LIMIT ${limit + 1}`;
  const rows = query(sql);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1] as any).updated_at : null;
  return { items, nextCursor };
}

export function getVaultRecord(recordId: string, userId: string, includeCiphertext: boolean): any {
  const cols = includeCiphertext ? "*" : "record_id, user_id, category, meta_json, size, consent, updated_at";
  const rows = query(`SELECT ${cols} FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
  return rows.length > 0 ? rows[0] : null;
}

/** Fetch a record by id regardless of owner — used ONLY by grant redemption after the grant itself authorizes access. */
export function getVaultRecordForGrant(recordId: string): any {
  const rows = query(`SELECT * FROM vault_records WHERE record_id = ${quote(recordId)}`);
  return rows.length > 0 ? rows[0] : null;
}

export function deleteVaultRecord(recordId: string, userId: string): void {
  query(`DELETE FROM vault_grants WHERE record_id = ${quote(recordId)} AND owner_user_id = ${quote(userId)}`);
  query(`DELETE FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
}

export function updateVaultConsent(recordId: string, userId: string, consent: string): void {
  query(`UPDATE vault_records SET consent = ${quote(consent)}, updated_at = datetime('now') WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
}

export function getVaultQuotaUsed(userId: string): number {
  const rows = query(`SELECT COALESCE(SUM(size), 0) as used FROM vault_records WHERE user_id = ${quote(userId)}`);
  return (rows[0] as any)?.used || 0;
}

/** Active (non-revoked) grant counts per record for one owner: { record_id → count }. */
export function getGrantCountsByRecord(userId: string): Map<string, number> {
  const rows = query(`SELECT record_id, COUNT(*) as c FROM vault_grants WHERE owner_user_id = ${quote(userId)} AND revoked = 0 GROUP BY record_id`);
  const map = new Map<string, number>();
  for (const r of rows as any[]) map.set(r.record_id, r.c);
  return map;
}

// ─── Sharing grants (consent ledger) ────────────────────────────────────────

export function createGrant(grantId: string, recordId: string, ownerUserId: string, granteeDid: string, scope: string, encryptedKey: string, priceAmount: number, priceCurrency: string, expiresAt: string): void {
  query(`INSERT INTO vault_grants (grant_id, record_id, owner_user_id, grantee_did, scope, encrypted_key, price_amount, price_currency, expires_at) VALUES (${quote(grantId)}, ${quote(recordId)}, ${quote(ownerUserId)}, ${quote(granteeDid)}, ${quote(scope)}, ${quote(encryptedKey)}, ${priceAmount}, ${quote(priceCurrency)}, ${quote(expiresAt)})`);
}

export function getGrant(grantId: string): any {
  const rows = query(`SELECT * FROM vault_grants WHERE grant_id = ${quote(grantId)}`);
  return rows.length > 0 ? rows[0] : null;
}

const GRANT_DERIVED_COLS = `(SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count, CASE WHEN g.revoked = 1 THEN 'revoked' WHEN g.expires_at < datetime('now') THEN 'expired' ELSE 'active' END as status, CASE WHEN g.price_amount > 0 AND g.revoked = 0 AND g.expires_at >= datetime('now') THEN 1 ELSE 0 END as is_paid`;

export function getGrantsByRecord(recordId: string, userId: string): any[] {
  return query(`SELECT g.*, ${GRANT_DERIVED_COLS}, 'grantor' as role FROM vault_grants g WHERE g.record_id = ${quote(recordId)} AND g.owner_user_id = ${quote(userId)} ORDER BY g.created_at DESC`);
}

/** Full consent ledger for a user: grants they issued (grantor) plus, when a DID is linked, grants issued to them (grantee). */
export function getGrantsForUser(userId: string, userDid?: string | null): any[] {
  let sql = `SELECT g.*, ${GRANT_DERIVED_COLS}, 'grantor' as role FROM vault_grants g WHERE g.owner_user_id = ${quote(userId)}`;
  if (userDid) {
    sql += ` UNION ALL SELECT g.*, ${GRANT_DERIVED_COLS}, 'grantee' as role FROM vault_grants g WHERE g.grantee_did = ${quote(userDid)} AND g.owner_user_id != ${quote(userId)}`;
  }
  sql += " ORDER BY created_at DESC";
  return query(sql);
}

export function revokeGrant(grantId: string, userId: string): void {
  query(`UPDATE vault_grants SET revoked = 1 WHERE grant_id = ${quote(grantId)} AND owner_user_id = ${quote(userId)}`);
}

/** Access-log rows for a set of grants, newest first. */
export function getAccessLogForGrants(grantIds: string[]): any[] {
  if (grantIds.length === 0) return [];
  const idList = grantIds.map((id) => quote(id)).join(", ");
  return query(`SELECT grant_id, accessed_by_did, accessed_at FROM grant_access_log WHERE grant_id IN (${idList}) ORDER BY accessed_at DESC LIMIT 200`);
}

export function getAccessLogForGrant(grantId: string, limit: number = 50): any[] {
  return query(`SELECT id, accessed_by_did, accessed_at FROM grant_access_log WHERE grant_id = ${quote(grantId)} ORDER BY accessed_at DESC LIMIT ${limit}`);
}

/**
 * Record a grant redemption. High-frequency write — non-blocking async exec
 * so redemption latency never waits on the log (failed writes are logged, not thrown).
 */
export function logGrantAccess(grantId: string, accessedByDid: string): void {
  const sql = `INSERT INTO grant_access_log (id, grant_id, accessed_by_did) VALUES (${quote(randomBytes(16).toString("hex"))}, ${quote(grantId)}, ${quote(accessedByDid)})`;
  exec(`${TEAM_DB} ${JSON.stringify(sql)}`, { timeout: 15000 }, (err) => {
    if (err) console.error(`[WALLET] grant_access_log write failed: ${err.message}`);
  });
}

// ─── Refresh tokens ─────────────────────────────────────────────────────────

export function findRefreshToken(tokenHash: string): any {
  const rows = query(`SELECT * FROM refresh_tokens WHERE token_hash = ${quote(tokenHash)} AND revoked = 0 AND expires_at > datetime('now')`);
  return rows.length > 0 ? rows[0] : null;
}

// ─── DIDComm message queue ──────────────────────────────────────────────────

export function upsertMessageHint(userDid: string, deviceId: string): void {
  query(`INSERT OR REPLACE INTO wallet_message_queue (id, device_id, user_did, unread_count, last_message_at) VALUES (${quote(randomBytes(16).toString("hex"))}, ${quote(deviceId)}, ${quote(userDid)}, 0, datetime('now'))`);
}

export function getMessageQueueSummary(userDid: string): { unreadCount: number; lastMessageAt: string | null } {
  const rows = query(`SELECT COALESCE(SUM(unread_count), 0) as unread, MAX(last_message_at) as last FROM wallet_message_queue WHERE user_did = ${quote(userDid)}`);
  const row = (rows[0] as any) || {};
  return { unreadCount: row.unread || 0, lastMessageAt: row.last || null };
}

export function ackMessageQueue(userDid: string, messageIds?: string[]): void {
  if (messageIds && messageIds.length > 0) {
    const idList = messageIds.map((id) => quote(id)).join(", ");
    query(`UPDATE wallet_message_queue SET unread_count = 0 WHERE user_did = ${quote(userDid)} AND id IN (${idList})`);
  } else {
    query(`UPDATE wallet_message_queue SET unread_count = 0 WHERE user_did = ${quote(userDid)}`);
  }
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export function getAdminWalletUsers(): any[] {
  return query("SELECT w.id, w.user_id, w.wallet_id, w.device_name, w.platform, w.wiped, w.created_at, w.last_seen_at, (SELECT COUNT(*) FROM vault_records WHERE user_id = w.user_id) as vault_count, (SELECT COUNT(*) FROM vault_grants WHERE owner_user_id = w.user_id) as grant_count, (SELECT COALESCE(SUM(size), 0) FROM vault_records WHERE user_id = w.user_id) as quota_used_bytes FROM wallet_devices w ORDER BY w.created_at DESC");
}

export function getAdminWalletCredentials(userId?: string): any[] {
  let sql = "SELECT b.local_id, b.user_id, b.category, b.size, b.updated_at FROM wallet_backup_items b";
  if (userId) sql += ` WHERE b.user_id = ${quote(userId)}`;
  sql += " ORDER BY b.updated_at DESC LIMIT 100";
  return query(sql);
}

export function getAdminGrants(): any[] {
  return query("SELECT g.grant_id, g.record_id, g.owner_user_id, g.grantee_did, g.scope, g.price_amount, g.price_currency, g.expires_at, g.revoked, g.created_at, (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count FROM vault_grants g ORDER BY g.created_at DESC");
}

export function remoteWipeWallet(walletId: string, reason: string): void {
  query(`UPDATE wallet_devices SET wiped = 1, wipe_reason = ${quote(reason)} WHERE wallet_id = ${quote(walletId)}`);
}
