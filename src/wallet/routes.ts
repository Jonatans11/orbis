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

// ─── Middleware: Extract device ID from header ───────────────────────────────

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

/**
 * PUT /api/wallet/push-token
 * Rotate Expo push token.
 * Body: { pushToken }
 */
router.put("/push-token", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const deviceId = getDeviceId(req);
    const { pushToken } = req.body;
    if (!pushToken) { res.status(400).json({ error: true, message: "pushToken is required" }); return; }

    if (deviceId) {
      query(`UPDATE wallet_devices SET push_token = ${quote(pushToken)}, last_seen_at = datetime('now') WHERE id = ${quote(deviceId)} AND user_id = ${quote(userId)}`);
      query(`INSERT OR REPLACE INTO wallet_push_tokens (id, device_id, user_id, push_token) VALUES (${quote(uuidv4())}, ${quote(deviceId)}, ${quote(userId)}, ${quote(pushToken)})`);
    } else {
      query(`UPDATE wallet_devices SET push_token = ${quote(pushToken)}, last_seen_at = datetime('now') WHERE user_id = ${quote(userId)}`);
    }

    res.json({ success: true, message: "Push token updated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 2. CREDENTIAL BACKUP (opt-in, ciphertext only)
// ===========================================================================

/**
 * POST /api/wallet/credentials/backup
 * Store encrypted credential backups.
 * Body: { items: [{ localId, category, ciphertext, iv, alg }] }
 */
router.post("/credentials/backup", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    initWalletTables();

    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: true, message: "items array is required" });
      return;
    }

    const results: any[] = [];
    for (const item of items) {
      const { localId, category, ciphertext, iv, alg } = item;
      if (!localId || !ciphertext || !iv) {
        results.push({ localId: localId || "unknown", status: "error", message: "Missing required fields" });
        continue;
      }
      const size = Buffer.from(ciphertext, "base64").length;
      if (size > 512 * 1024) {
        results.push({ localId, status: "error", message: "Item exceeds 512KB max blob size" });
        continue;
      }
      query(`INSERT OR REPLACE INTO wallet_backup_items (local_id, user_id, category, ciphertext, iv, alg, size, updated_at) VALUES (${quote(localId)}, ${quote(userId)}, ${quote(category || "identity")}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg || "A256GCM")}, ${size}, datetime('now'))`);
      results.push({ localId, status: "created", size });
    }

    res.status(201).json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/credentials/backup
 * List backup items. Query: ?include=ciphertext for restore.
 */
router.get("/credentials/backup", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const includeCiphertext = req.query.include === "ciphertext";
    const cols = includeCiphertext ? "*" : "local_id, category, size, updated_at";
    const items = query(`SELECT ${cols} FROM wallet_backup_items WHERE user_id = ${quote(userId)} ORDER BY updated_at DESC`);

    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/credentials/backup/:localId
 * Delete a backup item.
 */
router.delete("/credentials/backup/:localId", (req: Request, res: Response) => {
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
// 3. ENCRYPTED DATA VAULT
// ===========================================================================

/**
 * POST /api/wallet/data/store
 * Store a vault record (upsert on recordId).
 * Body: { recordId, category, meta, ciphertext, iv, alg }
 */
router.post("/data/store", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    initWalletTables();

    const { recordId, category, meta, ciphertext, iv, alg } = req.body;
    if (!recordId) { res.status(400).json({ error: true, message: "recordId is required" }); return; }
    if (!ciphertext || !iv) { res.status(400).json({ error: true, message: "ciphertext and iv are required" }); return; }

    const size = Buffer.from(ciphertext, "base64").length;
    if (size > 512 * 1024) {
      res.status(400).json({ error: true, code: "QUOTA_EXCEEDED", message: "Record exceeds 512KB max blob size" });
      return;
    }

    // Check per-user quota
    const quotaRows = query(`SELECT COALESCE(SUM(size), 0) as used FROM vault_records WHERE user_id = ${quote(userId)}`);
    const usedBytes = (quotaRows[0] as any)?.used || 0;
    if (usedBytes + size > 50 * 1024 * 1024) {
      res.status(400).json({ error: true, code: "QUOTA_EXCEEDED", message: "Vault quota exceeded (50 MB free tier)" });
      return;
    }

    const metaJson = JSON.stringify(meta || {});
    query(`INSERT OR REPLACE INTO vault_records (record_id, user_id, category, meta_json, ciphertext, iv, alg, size, updated_at) VALUES (${quote(recordId)}, ${quote(userId)}, ${quote(category || "documents")}, ${quote(metaJson)}, ${quote(ciphertext)}, ${quote(iv)}, ${quote(alg || "A256GCM")}, ${size}, datetime('now'))`);

    res.status(201).json({ success: true, recordId, size, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/:category
 * Paginated list of vault records.
 * Query: ?cursor=<updatedAt>&limit=20
 */
router.get("/data/:category", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { category } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    let sql = `SELECT record_id, meta_json, size, consent, updated_at FROM vault_records WHERE user_id = ${quote(userId)} AND category = ${quote(category)}`;
    if (cursor) sql += ` AND updated_at < ${quote(cursor)}`;
    sql += ` ORDER BY updated_at DESC LIMIT ${limit + 1}`;
    const rows = query(sql);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1] as any).updated_at : null;

    // Add grant count per record
    for (const item of items) {
      const grantCount = query(`SELECT COUNT(*) as cnt FROM vault_grants WHERE record_id = ${quote((item as any).record_id)}`);
      (item as any).grantCount = (grantCount[0] as any)?.cnt || 0;
    }

    res.json({ success: true, items, nextCursor });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/record/:recordId
 * Get a single vault record. Query: ?include=ciphertext
 */
router.get("/data/record/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { recordId } = req.params;
    const includeCiphertext = req.query.include === "ciphertext";
    const cols = includeCiphertext ? "*" : "record_id, user_id, category, meta_json, size, consent, updated_at";
    const rows = query(`SELECT ${cols} FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);

    if (rows.length === 0) {
      res.status(404).json({ error: true, message: "Record not found" });
      return;
    }

    res.json({ success: true, record: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/data/record/:recordId
 * Hard delete a vault record + cascade grants.
 */
router.delete("/data/record/:recordId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { recordId } = req.params;
    query(`DELETE FROM vault_grants WHERE record_id = ${quote(recordId)} AND owner_user_id = ${quote(userId)}`);
    query(`DELETE FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);

    res.json({ success: true, message: "Record and associated grants deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 4. DATA SHARING GRANTS (CONSENT LEDGER)
// ===========================================================================

/**
 * POST /api/wallet/data/share
 * Create a sharing grant for a vault record.
 * Body: { recordId, granteeDid, scope, expiresAt, price?, encryptedKey }
 */
router.post("/data/share", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    initWalletTables();

    const { recordId, granteeDid, scope, expiresAt, price, encryptedKey } = req.body;
    if (!recordId) { res.status(400).json({ error: true, message: "recordId is required" }); return; }
    if (!granteeDid) { res.status(400).json({ error: true, message: "granteeDid is required" }); return; }
    if (!scope || !["full", "meta-only"].includes(scope)) { res.status(400).json({ error: true, message: "scope must be 'full' or 'meta-only'" }); return; }
    if (!expiresAt) { res.status(400).json({ error: true, message: "expiresAt is required" }); return; }
    if (!encryptedKey) { res.status(400).json({ error: true, message: "encryptedKey is required" }); return; }

    // Verify record ownership
    const record = query(`SELECT record_id FROM vault_records WHERE record_id = ${quote(recordId)} AND user_id = ${quote(userId)}`);
    if (record.length === 0) {
      res.status(404).json({ error: true, message: "Record not found" });
      return;
    }

    // Check expiry max 90 days
    const expiresMs = new Date(expiresAt).getTime();
    const maxExpiry = Date.now() + 90 * 24 * 60 * 60 * 1000;
    if (expiresMs > maxExpiry) {
      res.status(400).json({ error: true, message: "expiresAt must be within 90 days" });
      return;
    }

    const grantId = uuidv4();
    const priceAmount = price?.amount || 0;
    const priceCurrency = price?.currency || "USD";

    query(`INSERT INTO vault_grants (grant_id, record_id, owner_user_id, grantee_did, scope, encrypted_key, price_amount, price_currency, expires_at) VALUES (${quote(grantId)}, ${quote(recordId)}, ${quote(userId)}, ${quote(granteeDid)}, ${quote(scope)}, ${quote(encryptedKey)}, ${priceAmount}, ${quote(priceCurrency)}, ${quote(expiresAt)})`);

    res.status(201).json({
      success: true,
      grantId,
      shareUrl: `https://orbis.id/api/wallet/share/${grantId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/share/:grantId
 * Grantee redemption endpoint.
 * Returns record data if grant is valid and not revoked/expired.
 */
router.get("/share/:grantId", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { grantId } = req.params;
    const grants = query(`SELECT * FROM vault_grants WHERE grant_id = ${quote(grantId)}`);
    if (grants.length === 0) {
      res.status(404).json({ error: true, message: "Grant not found" });
      return;
    }

    const grant = grants[0] as any;

    // Check revoked
    if (grant.revoked === 1) {
      res.status(403).json({ error: true, code: "GRANT_REVOKED", message: "Grant has been revoked" });
      return;
    }

    // Check expired
    if (new Date(grant.expires_at) < new Date()) {
      res.status(403).json({ error: true, code: "GRANT_EXPIRED", message: "Grant has expired" });
      return;
    }

    // Get user's DID from auth
    const users = query(`SELECT did FROM ssi_users WHERE id = ${quote(userId)}`);
    if (users.length === 0 || !users[0].did) {
      res.status(400).json({ error: true, message: "No DID linked to your account" });
      return;
    }
    const userDid = (users[0] as any).did;

    // Verify grantee DID matches
    if (grant.grantee_did !== userDid) {
      res.status(403).json({ error: true, code: "DEVICE_MISMATCH", message: "This grant is not for your DID" });
      return;
    }

    // Get the record
    const records = query(`SELECT meta_json, ciphertext, iv FROM vault_records WHERE record_id = ${quote(grant.record_id)}`);
    if (records.length === 0) {
      res.status(404).json({ error: true, message: "Referenced record not found" });
      return;
    }

    const record = records[0] as any;

    // Log access
    query(`INSERT INTO grant_access_log (id, grant_id, accessed_by_did) VALUES (${quote(randomBytes(16).toString("hex"))}, ${quote(grantId)}, ${quote(userDid)})`);

    res.json({
      success: true,
      meta: JSON.parse(record.meta_json || "{}"),
      ciphertext: record.ciphertext,
      iv: record.iv,
      encryptedKey: grant.encrypted_key,
      scope: grant.scope,
      expiresAt: grant.expires_at,
      price: { amount: grant.price_amount, currency: grant.price_currency },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/grants
 * List grants for a record. Query: ?recordId=...
 */
router.get("/data/grants", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const recordId = req.query.recordId as string;
    let grants;
    if (recordId) {
      grants = query(`SELECT g.*, (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count FROM vault_grants g WHERE g.record_id = ${quote(recordId)} AND g.owner_user_id = ${quote(userId)} ORDER BY g.created_at DESC`);
    } else {
      grants = query(`SELECT g.*, (SELECT COUNT(*) FROM grant_access_log WHERE grant_id = g.grant_id) as access_count FROM vault_grants g WHERE g.owner_user_id = ${quote(userId)} ORDER BY g.created_at DESC`);
    }

    // Add access log summaries
    for (const grant of grants) {
      const logs = query(`SELECT accessed_by_did, accessed_at FROM grant_access_log WHERE grant_id = ${quote((grant as any).grant_id)} ORDER BY accessed_at DESC LIMIT 10`);
      (grant as any).accessLog = logs;
    }

    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/data/grants/:grantId
 * Revoke a sharing grant (immediate).
 */
router.delete("/data/grants/:grantId", (req: Request, res: Response) => {
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
// 5. DIDCOMM PUSH
// ===========================================================================

/**
 * GET /api/wallet/messages/waiting
 * Check if there are waiting DIDComm messages.
 */
router.get("/messages/waiting", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const users = query(`SELECT did FROM ssi_users WHERE id = ${quote(userId)}`);
    if (users.length === 0 || !users[0].did) {
      res.json({ success: true, waiting: false, unreadCount: 0, didLinked: false });
      return;
    }

    const userDid = (users[0] as any).did as string;
    const inboxMessages = query(`SELECT COUNT(*) AS cnt FROM didcomm_messages WHERE to_did = ${quote(userDid)} AND status = 'sent'`);
    const unreadCount = (inboxMessages[0] as any)?.cnt || 0;
    const lastMsg = query(`SELECT created_at FROM didcomm_messages WHERE to_did = ${quote(userDid)} AND status = 'sent' ORDER BY created_at DESC LIMIT 1`);
    const lastMessageAt = lastMsg.length > 0 ? (lastMsg[0] as any).created_at : null;

    res.json({
      success: true,
      waiting: unreadCount > 0,
      unreadCount,
      didLinked: true,
      lastMessageAt,
      pushHint: unreadCount > 0 ? { type: "didcomm.message-waiting", count: unreadCount } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/wallet/messages/waiting
 * Mark messages as delivered (wallet acknowledges receipt).
 * Body: { messageIds?: string[] }
 */
router.put("/messages/waiting", (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) { res.status(401).json({ error: true, message: "Authentication required" }); return; }

    const { messageIds } = req.body;
    if (messageIds && Array.isArray(messageIds)) {
      for (const msgId of messageIds) {
        query(`UPDATE didcomm_messages SET status = 'delivered' WHERE id = ${quote(msgId)}`);
      }
    }

    res.json({ success: true, message: "Messages acknowledged" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 6. ADMIN ENDPOINTS
// ===========================================================================

/**
 * GET /api/wallet/admin/users
 * List all wallet users with vault/grant counts.
 */
router.get("/admin/users", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }

    const users = query(`SELECT w.id, w.user_id, w.wallet_id, w.device_name, w.platform, w.wiped, w.created_at, w.last_seen_at, (SELECT COUNT(*) FROM vault_records WHERE user_id = w.user_id) as vault_count, (SELECT COUNT(*) FROM vault_grants WHERE owner_user_id = w.user_id) as grant_count FROM wallet_devices w ORDER BY w.created_at DESC`);

    res.json({ success: true, count: users.length, users });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/admin/credentials
 * List all backed-up credentials (metadata only).
 */
router.get("/admin/credentials", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }

    const items = query("SELECT b.local_id, b.user_id, b.category, b.size, b.updated_at FROM wallet_backup_items b ORDER BY b.updated_at DESC LIMIT 100");

    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/admin/remote-wipe/:walletId
 * Remote wipe a wallet (sets wiped flag, reason required).
 * Body: { reason }
 */
router.delete("/admin/remote-wipe/:walletId", (req: Request, res: Response) => {
  try {
    if (!req.user?.admin) { res.status(403).json({ error: true, message: "Admin access required" }); return; }

    const { walletId } = req.params;
    const { reason } = req.body;
    if (!reason) { res.status(400).json({ error: true, message: "reason is required" }); return; }

    query(`UPDATE wallet_devices SET wiped = 1, wipe_reason = ${quote(reason)} WHERE wallet_id = ${quote(walletId)}`);

    res.json({ success: true, message: "Remote wipe initiated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;