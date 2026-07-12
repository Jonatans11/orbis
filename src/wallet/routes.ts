/**
 * ORBIS.ID Wallet API Routes.
 *
 * Full wallet API surface including lifecycle, credential backup,
 * encrypted data vault, data sharing grants, DIDComm push, and admin.
 *
 * All endpoints require JWT auth (existing middleware).
 * Device binding via X-Orbis-Device-Id header.
 */

import { Router, type Request, type Response } from "express";
import { execSync } from "node:child_process";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "node:crypto";
import { initWalletTables } from "./db.js";
import { logAudit, getClientIp } from "../security/audit.js";

const router = Router();
const TEAM_DB = "team-db";

function query(sql: string): any[] {
  const normalized = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  try {
    const output = execSync(`${TEAM_DB} ${JSON.stringify(normalized)}`, { encoding: "utf-8", timeout: 10_000 });
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletDevice {
  id: string;
  user_id: string;
  wallet_id: string;
  device_name: string | null;
  platform: string | null;
  push_token: string | null;
  wiped: number;
  wipe_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
}

function getDeviceId(req: Request): string | null {
  return (req.headers["x-orbis-device-id"] as string) || null;
}

// ===========================================================================
// 1. WALLET LIFECYCLE
// ===========================================================================
/**
 * POST /api/wallet/register
 * Bind a wallet installation to the authenticated user.
 * Body: { deviceName, platform, pushToken }
 */
router.post("/register", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    initWalletTables();
    const { deviceName, platform, pushToken } = req.body;
    const walletId = uuidv4();
    const deviceId = uuidv4();
    if (platform && !["ios", "android", "web"].includes(platform)) {
      res.status(400).json({ error: true, message: "platform must be ios, android, or web" });
      return;
    }
    query(`INSERT INTO wallet_devices (id, user_id, wallet_id, device_name, platform, push_token) VALUES (${quote(deviceId)}, ${quote(userId)}, ${quote(walletId)}, ${quote(deviceName || null)}, ${quote(platform || null)}, ${quote(pushToken || null)})`);
    if (pushToken) {
      query(`INSERT INTO wallet_push_tokens (id, device_id, user_id, push_token) VALUES (${quote(uuidv4())}, ${quote(deviceId)}, ${quote(userId)}, ${quote(pushToken)})`);
    }
    res.status(201).json({
      success: true,
      walletId,
      deviceId,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/status
 * Poll on app foreground. Returns wallet status.
 * If admin flagged wipe → HTTP 410 WALLET_WIPED.
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const deviceId = getDeviceId(req);
    const devices = query(`SELECT * FROM wallet_devices WHERE user_id = ${quote(userId)} ORDER BY created_at DESC`) as WalletDevice[];
    const wipedDevice = devices.find((d) => d.wiped === 1);
    if (wipedDevice) {
      res.status(410).json({ error: true, code: "WALLET_WIPED", message: wipedDevice.wipe_reason || "Wallet has been remotely wiped" });
      return;
    }
    if (deviceId) {
      query(`UPDATE wallet_devices SET last_seen_at = datetime('now') WHERE id = ${quote(deviceId)}`);
    }
    // Compute quota: sum of vault record sizes
    const quotaRows = query(`SELECT COALESCE(SUM(size), 0) as used FROM vault_records WHERE user_id = ${quote(userId)}`);
    const quotaUsedBytes = (quotaRows[0] as any)?.used || 0;
    res.json({
      success: true,
      walletId: devices[0]?.wallet_id || null,
      wiped: false,
      deviceCount: devices.length,
      quotaUsedBytes,
      quotaLimitBytes: 50 * 1024 * 1024, // 50 MB free tier
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * DELETE /api/wallet/device/:deviceId
 * Unregister a device (user-initiated).
 */
router.delete("/device/:deviceId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { deviceId } = req.params;
    query(`DELETE FROM wallet_devices WHERE id = ${quote(deviceId)} AND user_id = ${quote(userId)}`);
    query(`DELETE FROM wallet_push_tokens WHERE device_id = ${quote(deviceId)}`);
    res.json({ success: true, message: "Device unregistered" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 2. PUSH TOKENS
// ===========================================================================
/**
 * PUT /api/wallet/push-token
 * Update the push token for a device (e.g., after token refresh).
 * Body: { deviceId, pushToken }
 */
router.put("/push-token", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { deviceId, pushToken } = req.body;
    if (!deviceId || !pushToken) { res.status(400).json({ error: true, message: "deviceId and pushToken are required" }); return; }
    query(`UPDATE wallet_devices SET push_token = ${quote(pushToken)}, last_seen_at = datetime('now') WHERE id = ${quote(deviceId)} AND user_id = ${quote(userId)}`);
    query(`INSERT OR REPLACE INTO wallet_push_tokens (id, device_id, user_id, push_token) VALUES (${quote(uuidv4())}, ${quote(deviceId)}, ${quote(userId)}, ${quote(pushToken)})`);
    res.json({ success: true, message: "Push token updated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 3. CREDENTIAL BACKUP
// ===========================================================================
/**
 * PUT /api/wallet/backup/:localId
 * Upsert a credential backup item.
 * Body: { category, ciphertext, iv, alg?, size }
 */
router.put("/backup/:localId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { localId } = req.params;
    const { category, ciphertext, iv, alg, size } = req.body;
    if (!category || !ciphertext || !iv) { res.status(400).json({ error: true, message: "category, ciphertext, and iv are required" }); return; }
    if (Buffer.byteLength(ciphertext, "base64") > 50 * 1024 * 1024) { res.status(413).json({ error: true, message: "Payload exceeds 50 MB limit" }); return; }
    query(`INSERT OR REPLACE INTO wallet_backup_items (local_id, user_id, category, ciphertext, iv, alg, size, updated_at) VALUES (${quote(localId)}, ${quote(userId)}, ${quote(category)}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg || "A256GCM")}, ${size || 0}, datetime('now'))`);
    res.json({ success: true, message: "Backup item saved" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/backup
 * List backup items (metadata only, no ciphertext by default).
 * Query: ?includeCiphertext=true to get encrypted payloads.
 */
router.get("/backup", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const includeCiphertext = req.query.includeCiphertext === "true";
    const cols = includeCiphertext ? "*" : "local_id, category, size, updated_at";
    const items = query(`SELECT ${cols} FROM wallet_backup_items WHERE user_id = ${quote(userId)} ORDER BY updated_at DESC`);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * DELETE /api/wallet/backup/:localId
 * Delete a single backup item.
 */
router.delete("/backup/:localId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { localId } = req.params;
    query(`DELETE FROM wallet_backup_items WHERE user_id = ${quote(userId)} AND local_id = ${quote(localId)}`);
    res.json({ success: true, message: "Backup item deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 4. ENCRYPTED DATA VAULT
// ===========================================================================
/**
 * PUT /api/wallet/vault/:recordId
 * Upsert a vault record.
 * Body: { category, metaJson, ciphertext, iv, alg?, size, consent? }
 */
router.put("/vault/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId } = req.params;
    const { category, metaJson, ciphertext, iv, alg, size, consent } = req.body;
    if (!category || !metaJson || !ciphertext || !iv) { res.status(400).json({ error: true, message: "category, metaJson, ciphertext, and iv are required" }); return; }
    if (Buffer.byteLength(ciphertext, "base64") > 50 * 1024 * 1024) { res.status(413).json({ error: true, message: "Payload exceeds 50 MB limit" }); return; }
    query(`INSERT OR REPLACE INTO vault_records (record_id, user_id, category, meta_json, ciphertext, iv, alg, size, consent, updated_at) VALUES (${quote(recordId)}, ${quote(userId)}, ${quote(category)}, ${quote(metaJson)}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg || "A256GCM")}, ${size || 0}, ${quote(consent || "private")}, datetime('now'))`);
    res.json({ success: true, message: "Vault record saved" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/vault
 * List vault records (metadata only, no ciphertext).
 * Query: ?category=&cursor=&limit=
 */
router.get("/vault", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { category, cursor } = req.query as Record<string, string>;
    const limit = parseInt(req.query.limit as string) || 20;
    let sql = `SELECT record_id, meta_json, size, consent, updated_at FROM vault_records WHERE user_id = ${quote(userId)}`;
    if (category) sql += ` AND category = ${quote(category)}`;
    if (cursor) sql += ` AND updated_at < ${quote(cursor)}`;
    sql += ` ORDER BY updated_at DESC LIMIT ${limit + 1}`;
    const rows = query(sql);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1] as any).updated_at : null;
    res.json({ success: true, count: items.length, items, nextCursor });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/vault/:recordId
 * Get a single vault record (with ciphertext).
 */
router.get("/vault/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId } = req.params;
    const rows = query(`SELECT * FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
    if (rows.length === 0) { res.status(404).json({ error: true, message: "Record not found" }); return; }
    res.json({ success: true, record: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * DELETE /api/wallet/vault/:recordId
 * Delete a vault record and its grants.
 */
router.delete("/vault/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId } = req.params;
    query(`DELETE FROM vault_grants WHERE record_id = ${quote(recordId)} AND owner_user_id = ${quote(userId)}`);
    query(`DELETE FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
    res.json({ success: true, message: "Vault record and grants deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * PATCH /api/wallet/vault/:recordId/consent
 * Update the consent/monetization flag on a vault record.
 *
 * Allows toggling a record between "private" (no monetization) and
 * "monetizable" (user has opted in to receive access-compensation requests).
 *
 * Per design (07-vault-consent-screens.md §6): monetization toggle per record
 * lets the user opt in to request compensation when sharing. Toggling to
 * "monetizable" does NOT auto-share anything — explicit consent is still
 * required per grant. The "private" default means no compensation is requested.
 *
 * Body: { consent: "private" | "monetizable" }
 * Responses:
 *   200 — { success: true, message, recordId, consent }
 *   400 — Invalid consent value / missing
 *   401 — Authentication required
 *   404 — Record not found
 */
router.patch("/vault/:recordId/consent", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId } = req.params;
    const { consent } = req.body;
    if (!consent || !["private", "monetizable"].includes(consent)) {
      res.status(400).json({ error: true, message: "consent must be 'private' or 'monetizable'" });
      return;
    }
    // Verify the record exists and belongs to this user
    const existing = query(`SELECT record_id, consent FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
    if (existing.length === 0) {
      res.status(404).json({ error: true, message: "Record not found" });
      return;
    }
    const oldConsent = (existing[0] as any).consent;
    query(`UPDATE vault_records SET consent = ${quote(consent)}, updated_at = datetime('now') WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
    // Audit-log the consent change
    logAudit({
      actorType: "user",
      actorId: userId,
      action: "vault.consent.update",
      entityType: "vault_record",
      entityId: recordId,
      result: "success",
      message: `Consent changed from '${oldConsent}' to '${consent}'`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Consent flag updated", recordId, consent });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 5. DATA-SHARING GRANTS
// ===========================================================================
/**
 * POST /api/wallet/grants
 * Create a time-limited data-sharing grant for a vault record.
 * Body: { recordId, granteeDid, scope, encryptedKey, priceAmount?, priceCurrency?, expiresAt }
 */
router.post("/grants", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId, granteeDid, scope, encryptedKey, priceAmount, priceCurrency, expiresAt } = req.body;
    if (!recordId || !granteeDid || !scope || !encryptedKey || !expiresAt) {
      res.status(400).json({ error: true, message: "recordId, granteeDid, scope, encryptedKey, and expiresAt are required" }); return;
    }
    // Validate expiry: max 90 days
    const expiresMs = new Date(expiresAt).getTime();
    const nowMs = Date.now();
    const maxExpiry = nowMs + 90 * 24 * 60 * 60 * 1000;
    if (expiresMs > maxExpiry) { res.status(400).json({ error: true, message: "Grant expiry cannot exceed 90 days" }); return; }
    if (expiresMs <= nowMs) { res.status(400).json({ error: true, message: "Grant expiry must be in the future" }); return; }
    const grantId = uuidv4();
    query(`INSERT INTO vault_grants (grant_id, record_id, owner_user_id, grantee_did, scope, encrypted_key, price_amount, price_currency, expires_at) VALUES (${quote(grantId)}, ${quote(recordId)}, ${quote(userId)}, ${quote(granteeDid)}, ${quote(scope)}, ${quote(encryptedKey)}, ${priceAmount || 0}, ${quote(priceCurrency || "USD")}, ${quote(expiresAt)})`);
    res.status(201).json({ success: true, grantId, message: "Data-sharing grant created" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/grants/:recordId
 * List grants for a vault record.
 */
router.get("/grants/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { recordId } = req.params;
    const grants = query(`SELECT g.*, (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count FROM vault_grants g WHERE g.record_id = ${quote(recordId)} AND g.owner_user_id = ${quote(userId)} ORDER BY g.created_at DESC`);
    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/grants
 *
 * List ALL data-sharing grants for the authenticated user, in two roles:
 *   - grantor — grants the user created (owner_user_id matches JWT sub)
 *   - grantee — grants received from others (grantee_did matches user's linked DID,
 *               from req.user.did set via PUT /api/auth/link-did)
 *
 * Each grant carries:
 *   role          — "grantor" | "grantee"
 *   status        — derived: "active" | "expired" | "revoked"
 *   is_paid       — true when price_amount > 0 and status is "active"
 *   access_count  — number of times the grantee accessed the shared data
 *
 * Used by AllSharesScreen (design 07-vault-consent-screens.md §5) with
 * filter chips: Active / Expired / Revoked / Paid.
 *
 * Responses:
 *   200 — { success: true, count, grants: [{ role, status, is_paid, ... }] }
 *   401 — Authentication required
 */
router.get("/grants", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const userDID = req.user?.did;
    // Build grantor + grantee queries with UNION, add role, status derivation
    let sql = `
      SELECT g.*,
        (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count,
        'grantor' as role,
        CASE
          WHEN g.revoked = 1 THEN 'revoked'
          WHEN g.expires_at < datetime('now') THEN 'expired'
          ELSE 'active'
        END as status,
        CASE
          WHEN g.price_amount > 0 AND g.revoked = 0 AND g.expires_at >= datetime('now') THEN 1
          ELSE 0
        END as is_paid
      FROM vault_grants g
      WHERE g.owner_user_id = ${quote(userId)}
    `;
    if (userDID) {
      sql += `
      UNION ALL
      SELECT g.*,
        (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count,
        'grantee' as role,
        CASE
          WHEN g.revoked = 1 THEN 'revoked'
          WHEN g.expires_at < datetime('now') THEN 'expired'
          ELSE 'active'
        END as status,
        CASE
          WHEN g.price_amount > 0 AND g.revoked = 0 AND g.expires_at >= datetime('now') THEN 1
          ELSE 0
        END as is_paid
      FROM vault_grants g
      WHERE g.grantee_did = ${quote(userDID)}
      `;
    }
    sql += " ORDER BY created_at DESC";
    const grants = query(sql);
    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * DELETE /api/wallet/grants/:grantId/revoke
 * Revoke a specific grant.
 */
router.delete("/grants/:grantId/revoke", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { grantId } = req.params;
    query(`UPDATE vault_grants SET revoked = 1 WHERE grant_id = ${quote(grantId)} AND owner_user_id = ${quote(userId)}`);
    res.json({ success: true, message: "Grant revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 6. DIDCOMM PUSH HINTS
// ===========================================================================
/**
 * POST /api/wallet/didcomm/push-hint
 * Register a DID-to-push-token hint for incoming DIDComm messages.
 * Body: { userDID, pushToken }
 */
router.post("/didcomm/push-hint", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }
    const { userDID, pushToken } = req.body;
    if (!userDID || !pushToken) { res.status(400).json({ error: true, message: "userDID and pushToken are required" }); return; }
    query(`UPDATE wallet_push_tokens SET push_token = ${quote(pushToken)} WHERE user_id = ${quote(userId)}`);
    query(`INSERT OR REPLACE INTO wallet_message_queue (id, device_id, user_did, unread_count, last_message_at) VALUES (${quote(uuidv4())}, 'push-hint', ${quote(userDID)}, 0, datetime('now'))`);
    res.json({ success: true, message: "Push hint registered" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 7. REFRESH TOKENS
// ===========================================================================
/**
 * POST /api/wallet/refresh
 * Refresh the JWT using a refresh token.
 * Body: { refreshToken }
 */
router.post("/refresh", (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: true, message: "refreshToken is required" }); return; }
    const hash = require("crypto").createHash("sha256").update(refreshToken).digest("hex");
    const rows = query(`SELECT * FROM refresh_tokens WHERE token_hash = ${quote(hash)} AND revoked = 0 AND expires_at > datetime('now')`);
    if (rows.length === 0) { res.status(401).json({ error: true, message: "Invalid or expired refresh token" }); return; }
    const tokenRow = rows[0] as any;
    // Issue a new JWT
    const jwt = require("jsonwebtoken");
    const secret = process.env.JWT_SECRET || require("crypto").randomBytes(32).toString("hex");
    const newToken = jwt.sign({ sub: tokenRow.user_id, email: "" }, secret, { expiresIn: "24h" });
    res.json({ success: true, token: newToken });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
// ===========================================================================
// 8. WALLET VERIFICATION STATUS
// ===========================================================================
/**
 * POST /api/wallet/vc/present
 *
 * Verify a ZK selective disclosure proof generated ON-DEVICE by the wallet.
 * The wallet creates and signs the proof using @orbis/wallet-core Ed25519 keys;
 * the holder's secret key NEVER leaves the device.
 *
 * Flow:
 *   1. Wallet calls POST /api/vc/zk/challenge to obtain replay-proof challenge
 *   2. Wallet generates the ZKProof on-device (select fields to reveal/hide)
 *   3. Wallet signs the proof with the device-stored Ed25519 key
 *   4. Wallet POSTs the signed proof + challenge to this endpoint
 *   5. Server verifies: structure, hidden commitments, holder binding (via
 *      public key from DID document), challenge integrity, and optionally
 *      the trust registry status of the original VC issuer
 *
 * Body:
 * {
 *   "proof": {
 *     "@context": ["https://www.w3.org/ns/credentials/v2", "https://orbis.id/ns/zkp/v1"],
 *     "id": "urn:uuid:...",
 *     "type": ["VerifiablePresentation", "ZKPresentation"],
 *     "verifiableCredential": { ... },
 *     "holder": "did:key:z6Mk...",
 *     "revealedFields": ["name", "email"],
 *     "hiddenFields": ["ssn"],
 *     "hiddenCommitments": [{"field": "ssn", "hash": "abc...", "nonce": "123..."}],
 *     "proof": {
 *       "type": "OrbisZKSelectiveDisclosure2025",
 *       "created": "2025-01-01T00:00:00.000Z",
 *       "proofPurpose": "authentication",
 *       "verificationMethod": "did:key:z6Mk...#z6Mk...",
 *       "cryptosuite": "orbis-zk-sd-2025",
 *       "proofValue": "z...",
 *       "challenge": "abc123..."
 *     }
 *   },
 *   "challenge": "abc123...",
 *   "checkTrustRegistry": false
 * }
 *
 * Responses:
 *   200 — { success: true, verified: true, proofId, holderDID, timestamp, checks }
 *   400 — { error: true, message: "..." }
 *   401 — { error: true, message: "Authentication required" }
 *   403 — { success: false, error: true, message: "ZK presentation verification failed: ...", checks, proofId }
 */
router.post("/vc/present", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { proof, challenge, checkTrustRegistry } = req.body;

    if (!proof) {
      res.status(400).json({ error: true, message: "proof is required" });
      return;
    }
    if (!proof.holder) {
      res.status(400).json({ error: true, message: "proof.holder (holder DID) is required" });
      return;
    }
    if (!proof.proof?.proofValue) {
      res.status(400).json({ error: true, message: "proof.proof.proofValue (Ed25519 signature) is required" });
      return;
    }
    if (!proof.verifiableCredential) {
      res.status(400).json({ error: true, message: "proof.verifiableCredential is required" });
      return;
    }

    // Dynamic import to avoid circular deps at module level
    const { verifyZKProof } = await import("../vc/zk.js");

    const result = await verifyZKProof(proof, {
      verifierDID: `did:key:wallet-system`,
      challenge: challenge || undefined,
      checkTrustRegistry: checkTrustRegistry || false,
    });

    if (!result.verified) {
      const failedChecks = result.checks.filter((c: any) => !c.passed);
      const messages = failedChecks.map((c: any) => c.message).join("; ");
      res.status(403).json({
        success: false,
        error: true,
        message: `ZK presentation verification failed: ${messages}`,
        checks: result.checks,
        proofId: result.proofId,
      });
      return;
    }

    // Log the successful wallet presentation for audit
    query(`INSERT INTO wallet_message_queue (id, device_id, user_did, unread_count, last_message_at)
           VALUES (${quote(uuidv4())}, 'zk-presentation', ${quote(proof.holder)}, 0, datetime('now'))`);

    res.json({
      success: true,
      verified: true,
      proofId: result.proofId,
      holderDID: result.holderDID,
      timestamp: result.timestamp,
      checks: result.checks,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: `ZK verification error: ${err.message}` });
  }
});

// ===========================================================================
// 9. ADMIN ENDPOINTS (wallet management)
// ===========================================================================
/**
 * GET /api/wallet/admin/users
 * List all wallet users with vault/grant counts and quota bytes. Admin only.
 */
router.get("/admin/users", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }
    const items = query(`SELECT w.id, w.user_id, w.wallet_id, w.device_name, w.platform, w.wiped, w.created_at, w.last_seen_at,
       (SELECT COUNT(*) FROM vault_records WHERE user_id = w.user_id) as vault_count,
       (SELECT COUNT(*) FROM vault_grants WHERE owner_user_id = w.user_id) as grant_count,
       (SELECT COALESCE(SUM(size), 0) FROM vault_records WHERE user_id = w.user_id) as quota_used_bytes
       FROM wallet_devices w ORDER BY w.created_at DESC`);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/admin/credentials
 * List wallet credentials (backup items). Admin only.
 * Query: ?userId= — filter by user (optional)
 */
router.get("/admin/credentials", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }
    const userId = req.query.userId as string | undefined;
    let sql = "SELECT b.local_id, b.user_id, b.category, b.size, b.updated_at FROM wallet_backup_items b";
    const params: string[] = [];
    if (userId) {
      sql += ` WHERE b.user_id = ${quote(userId)}`;
    }
    sql += " ORDER BY b.updated_at DESC LIMIT 100";
    const items = query(sql);
    res.json({ success: true, count: items.length, items, filteredByUserId: userId || null });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * DELETE /api/wallet/admin/remote-wipe/:walletId
 * Remote wipe a wallet (sets wiped flag, reason required). Audit-logged.
 * Body: { reason }
 */
router.delete("/admin/remote-wipe/:walletId", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }
    const { walletId } = req.params;
    const { reason } = req.body;
    if (!reason) { res.status(400).json({ error: true, message: "reason is required" }); return; }
    query(`UPDATE wallet_devices SET wiped = 1, wipe_reason = ${quote(reason)} WHERE wallet_id = ${quote(walletId)}`);
    // Audit-log the wipe action
    logAudit({
      actorType: "user",
      actorId: req.user?.sub || undefined,
      action: "admin.wallet.wipe",
      entityType: "wallet_device",
      entityId: walletId,
      result: "success",
      message: `Remote wipe: ${reason}`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Remote wipe initiated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/admin/grants
 * List all data-sharing grants across users. Admin only. Metadata only.
 * Returns grantor, grantee, scope, expiry, revoked state, price, and access count.
 */
router.get("/admin/grants", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }
    const grants = query(`SELECT g.grant_id, g.record_id, g.owner_user_id, g.grantee_did, g.scope, g.price_amount, g.price_currency, g.expires_at, g.revoked, g.created_at,
       (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count
       FROM vault_grants g ORDER BY g.created_at DESC`);
    // Audit-log the view
    logAudit({
      actorType: "user",
      actorId: req.user?.sub || undefined,
      action: "admin.wallet.grants.view",
      entityType: "vault_grant",
      entityId: "list",
      result: "success",
      message: `Listed ${grants.length} grants`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
/**
 * GET /api/wallet/admin/grants/:grantId/access-log
 * View access log entries for a specific grant. Admin only.
 */
router.get("/admin/grants/:grantId/access-log", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }
    const { grantId } = req.params;
    const logs = query(`SELECT l.id, l.accessed_by_did, l.accessed_at FROM grant_access_log l WHERE l.grant_id = ${quote(grantId)} ORDER BY l.accessed_at DESC LIMIT 50`);
    res.json({ success: true, count: logs.length, grantId, logs });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;