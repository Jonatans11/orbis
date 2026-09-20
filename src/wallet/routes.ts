/**
 * ORBIS.ID Wallet API Routes.
 *
 * Full wallet API surface including lifecycle, credential backup,
 * encrypted data vault, data sharing grants (consent ledger), grantee
 * redemption, DIDComm push, and admin.
 *
 * Canonical contract: m/core/src/api/endpoints.ts (the mobile clients).
 * All endpoints require JWT auth (requireJwt below) except POST /refresh.
 * Admin endpoints additionally require the DB-verified admin role.
 * Device binding via X-Orbis-Device-Id header.
 *
 * The server stores ciphertext plus small plaintext meta (title ≤120 + type)
 * only — record keys and sealed grant keys are never openable server-side.
 */

import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import * as walletDb from "./db.js";
import { requireJwt, findUserById, generateToken } from "../security/jwt.js";
import { requireAdmin } from "../admin/auth.js";
import { logAudit, getClientIp } from "../security/audit.js";

const router = Router();

const QUOTA_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB free tier
const MAX_GRANT_DAYS = 90;
const VAULT_CATEGORIES = ["identity", "medical", "financial", "assets", "documents", "education", "membership"];
const GRANT_SCOPES = ["full", "meta-only"];

/** Base for grantee share links; deep-links into the wallet's ShareRedeem screen. */
function shareUrlBase(): string {
  return process.env.ORBIS_PUBLIC_URL || "https://orbis.id";
}

function getDeviceId(req: Request): string | null {
  return (req.headers["x-orbis-device-id"] as string) || null;
}

/** Express 5 types params as string | string[]; wallet routes never use repeatable params. */
function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? String(v[0]) : String(v);
}

function parseMetaJson(metaJson: string): Record<string, unknown> {
  try {
    return JSON.parse(metaJson || "{}");
  } catch {
    return {};
  }
}

// ===========================================================================
// 0. TOKEN REFRESH (the only route that must work WITHOUT a live JWT)
// ===========================================================================
/**
 * POST /api/wallet/refresh
 * Exchange a refresh token for a new JWT (signed with the shared secret).
 * Body: { refreshToken }
 */
router.post("/refresh", (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: true, message: "refreshToken is required" }); return; }
    const hash = createHash("sha256").update(refreshToken).digest("hex");
    const tokenRow = walletDb.findRefreshToken(hash);
    if (!tokenRow) { res.status(401).json({ error: true, message: "Invalid or expired refresh token" }); return; }
    const user = findUserById(tokenRow.user_id);
    if (!user) { res.status(401).json({ error: true, message: "User no longer exists" }); return; }
    res.json({ success: true, token: generateToken(user) });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Everything below requires a valid Bearer JWT (sets req.user).
router.use(requireJwt);

function userId(req: Request): string {
  return req.user!.sub;
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
    walletDb.initWalletTables();
    const { deviceName, platform, pushToken } = req.body;
    if (platform && !["ios", "android", "web"].includes(platform)) {
      res.status(400).json({ error: true, message: "platform must be ios, android, or web" });
      return;
    }
    const walletId = uuidv4();
    const deviceId = uuidv4();
    walletDb.registerDevice(deviceId, userId(req), walletId, deviceName || null, platform || null, pushToken || null);
    if (pushToken) walletDb.updatePushToken(deviceId, userId(req), pushToken);
    res.status(201).json({ success: true, walletId, deviceId, createdAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/status
 * Poll on app foreground. If admin flagged wipe → HTTP 410 WALLET_WIPED.
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const devices = walletDb.getDevicesByUser(userId(req));
    const wipedDevice = devices.find((d: any) => d.wiped === 1);
    if (wipedDevice) {
      res.status(410).json({ error: true, code: "WALLET_WIPED", message: wipedDevice.wipe_reason || "Wallet has been remotely wiped" });
      return;
    }
    const deviceId = getDeviceId(req);
    if (deviceId) walletDb.updateDeviceLastSeen(deviceId);
    res.json({
      success: true,
      walletId: devices[0]?.wallet_id || null,
      wiped: false,
      deviceCount: devices.length,
      quotaUsedBytes: walletDb.getVaultQuotaUsed(userId(req)),
      quotaLimitBytes: QUOTA_LIMIT_BYTES,
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
    walletDb.unregisterDevice(param(req, "deviceId"), userId(req));
    res.json({ success: true, message: "Device unregistered" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/wallet/push-token
 * Update the push token for a device (e.g., after token refresh).
 * Body: { deviceId?, pushToken } — deviceId falls back to X-Orbis-Device-Id.
 */
router.put("/push-token", (req: Request, res: Response) => {
  try {
    const { pushToken } = req.body;
    const deviceId = req.body.deviceId || getDeviceId(req);
    if (!deviceId || !pushToken) { res.status(400).json({ error: true, message: "deviceId (or X-Orbis-Device-Id header) and pushToken are required" }); return; }
    walletDb.updatePushToken(deviceId, userId(req), pushToken);
    res.json({ success: true, message: "Push token updated" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 2. CREDENTIAL BACKUP  (POST/GET/DELETE /api/wallet/credentials/backup)
// ===========================================================================
/**
 * POST /api/wallet/credentials/backup
 * Upsert a batch of encrypted credential backups.
 * Body: { items: [{ localId, category, ciphertext, iv, alg? }] }
 */
router.post("/credentials/backup", (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: true, message: "items array is required" });
      return;
    }
    const results = items.map((item: any) => {
      const { localId, category, ciphertext, iv, alg } = item || {};
      if (!localId || !category || !ciphertext || !iv) {
        return { localId: localId || null, status: "error" as const, message: "localId, category, ciphertext, and iv are required" };
      }
      const size = Buffer.byteLength(ciphertext, "base64");
      if (size > QUOTA_LIMIT_BYTES) {
        return { localId, status: "error" as const, message: "Payload exceeds 50 MB limit" };
      }
      walletDb.upsertBackupItem(userId(req), localId, category, ciphertext, iv, alg || "A256GCM", size);
      return { localId, status: "created" as const, size };
    });
    res.json({ success: results.every((r) => r.status === "created"), results });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/credentials/backup
 * List backup items (metadata only; ?include=ciphertext for payloads).
 */
router.get("/credentials/backup", (req: Request, res: Response) => {
  try {
    const includeCiphertext = req.query.include === "ciphertext" || req.query.includeCiphertext === "true";
    const items = walletDb.getBackupItems(userId(req), includeCiphertext);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/credentials/backup/:localId
 */
router.delete("/credentials/backup/:localId", (req: Request, res: Response) => {
  try {
    walletDb.deleteBackupItem(userId(req), param(req, "localId"));
    res.json({ success: true, message: "Backup item deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 3. ENCRYPTED DATA VAULT  (/api/wallet/data/*)
//    Route order matters: /data/store, /data/grants, /data/share and
//    /data/record/:id are registered before the /data/:category catch-all.
// ===========================================================================
/**
 * POST /api/wallet/data/store
 * Store (upsert) an encrypted vault record. Enforces the 50 MB total quota.
 * Body: { recordId, category, meta: { title ≤120, type ≤60 }, ciphertext, iv, alg }
 * → { success, recordId, size, updatedAt }
 */
router.post("/data/store", (req: Request, res: Response) => {
  try {
    const { recordId, category, meta, ciphertext, iv, alg } = req.body;
    if (!recordId || !category || !meta || !ciphertext || !iv) {
      res.status(400).json({ error: true, message: "recordId, category, meta, ciphertext, and iv are required" });
      return;
    }
    if (!VAULT_CATEGORIES.includes(category)) {
      res.status(400).json({ error: true, message: `category must be one of: ${VAULT_CATEGORIES.join(", ")}` });
      return;
    }
    if (typeof meta.title !== "string" || meta.title.length === 0 || meta.title.length > 120) {
      res.status(400).json({ error: true, message: "meta.title is required (max 120 chars)" });
      return;
    }
    if (typeof meta.type !== "string" || meta.type.length > 60) {
      res.status(400).json({ error: true, message: "meta.type is required (max 60 chars)" });
      return;
    }
    const size = Buffer.byteLength(ciphertext, "base64");
    if (size > QUOTA_LIMIT_BYTES) {
      res.status(413).json({ error: true, message: "Payload exceeds 50 MB limit" });
      return;
    }
    // Quota check: replacing a record frees its old bytes first.
    const existing = walletDb.getVaultRecord(recordId, userId(req), false);
    const used = walletDb.getVaultQuotaUsed(userId(req)) - (existing?.size || 0);
    if (used + size > QUOTA_LIMIT_BYTES) {
      res.status(413).json({ error: true, code: "QUOTA_EXCEEDED", message: "Vault quota (50 MB) exceeded" });
      return;
    }
    // Only title + type are stored in plaintext; consent survives re-upload.
    const metaJson = JSON.stringify({ title: meta.title, type: meta.type });
    walletDb.upsertVaultRecord(recordId, userId(req), category, metaJson, ciphertext, iv, alg || "A256GCM", size, existing?.consent || "private");
    res.json({ success: true, recordId, size, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/grants[?recordId=]
 * The consent ledger. Without recordId: every grant the user issued
 * (grantor) plus grants issued to their linked DID (grantee). With
 * recordId: that record's grants, each with its member-visible accessLog.
 * Rows carry derived role / status / is_paid / access_count.
 */
router.get("/data/grants", (req: Request, res: Response) => {
  try {
    const recordId = req.query.recordId as string | undefined;
    let grants: any[];
    if (recordId) {
      grants = walletDb.getGrantsByRecord(recordId, userId(req));
      const logs = walletDb.getAccessLogForGrants(grants.map((g) => g.grant_id));
      const byGrant = new Map<string, any[]>();
      for (const l of logs) {
        if (!byGrant.has(l.grant_id)) byGrant.set(l.grant_id, []);
        byGrant.get(l.grant_id)!.push({ accessed_by_did: l.accessed_by_did, accessed_at: l.accessed_at });
      }
      for (const g of grants) g.accessLog = byGrant.get(g.grant_id) || [];
    } else {
      grants = walletDb.getGrantsForUser(userId(req), req.user?.did);
      for (const g of grants) g.accessLog = [];
    }
    res.json({ success: true, count: grants.length, grants });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/data/grants/:grantId
 * Revoke a grant (owner only). Audit-logged.
 */
router.delete("/data/grants/:grantId", (req: Request, res: Response) => {
  try {
    const grantId = param(req, "grantId");
    const grant = walletDb.getGrant(grantId);
    if (!grant || grant.owner_user_id !== userId(req)) {
      res.status(404).json({ error: true, message: "Grant not found" });
      return;
    }
    walletDb.revokeGrant(grantId, userId(req));
    logAudit({
      actorType: "user",
      actorId: userId(req),
      action: "vault.grant.revoke",
      entityType: "vault_grant",
      entityId: grantId,
      result: "success",
      message: `Grant to ${grant.grantee_did} revoked`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Grant revoked" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/wallet/data/share
 * Create a time-limited, DID-bound sharing grant for a vault record the
 * caller owns. The record key arrives sealed to the grantee's X25519 key
 * (ECDH-ES) — the server relays it but can never open it.
 * Body: { recordId, granteeDid, scope, expiresAt, price?: {amount,currency}, encryptedKey }
 * → { success, grantId, shareUrl }
 */
router.post("/data/share", (req: Request, res: Response) => {
  try {
    const { recordId, granteeDid, scope, encryptedKey, expiresAt, price } = req.body;
    if (!recordId || !granteeDid || !scope || !encryptedKey || !expiresAt) {
      res.status(400).json({ error: true, message: "recordId, granteeDid, scope, encryptedKey, and expiresAt are required" });
      return;
    }
    if (!GRANT_SCOPES.includes(scope)) {
      res.status(400).json({ error: true, message: "scope must be 'full' or 'meta-only'" });
      return;
    }
    if (typeof granteeDid !== "string" || !granteeDid.startsWith("did:")) {
      res.status(400).json({ error: true, message: "granteeDid must be a DID" });
      return;
    }
    const record = walletDb.getVaultRecord(recordId, userId(req), false);
    if (!record) {
      res.status(404).json({ error: true, message: "Record not found" });
      return;
    }
    const expiresMs = new Date(expiresAt).getTime();
    const nowMs = Date.now();
    if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
      res.status(400).json({ error: true, message: "Grant expiry must be in the future" });
      return;
    }
    if (expiresMs > nowMs + MAX_GRANT_DAYS * 24 * 60 * 60 * 1000) {
      res.status(400).json({ error: true, message: `Grant expiry cannot exceed ${MAX_GRANT_DAYS} days` });
      return;
    }
    const priceAmount = price?.amount ?? req.body.priceAmount ?? 0;
    const priceCurrency = price?.currency ?? req.body.priceCurrency ?? "USD";
    if (!Number.isInteger(priceAmount) || priceAmount < 0) {
      res.status(400).json({ error: true, message: "price.amount must be a non-negative integer" });
      return;
    }
    const grantId = uuidv4();
    walletDb.createGrant(grantId, recordId, userId(req), granteeDid, scope, encryptedKey, priceAmount, priceCurrency, expiresAt);
    logAudit({
      actorType: "user",
      actorId: userId(req),
      action: "vault.grant.create",
      entityType: "vault_grant",
      entityId: grantId,
      result: "success",
      message: `Grant (${scope}) to ${granteeDid}, expires ${expiresAt}`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ success: true, grantId, shareUrl: `${shareUrlBase()}/share/${grantId}` });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/record/:recordId[?include=ciphertext]
 * Get one vault record. Ciphertext only when explicitly requested.
 */
router.get("/data/record/:recordId", (req: Request, res: Response) => {
  try {
    const includeCiphertext = req.query.include === "ciphertext";
    const record = walletDb.getVaultRecord(param(req, "recordId"), userId(req), includeCiphertext);
    if (!record) { res.status(404).json({ error: true, message: "Record not found" }); return; }
    res.json({ success: true, record });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/data/record/:recordId
 * Delete a vault record and its grants.
 */
router.delete("/data/record/:recordId", (req: Request, res: Response) => {
  try {
    walletDb.deleteVaultRecord(param(req, "recordId"), userId(req));
    res.json({ success: true, message: "Vault record and grants deleted" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/data/:category[?cursor=&limit=]
 * List vault records in a category — metadata only, never ciphertext.
 * Each row carries grantCount (active grants on that record).
 */
router.get("/data/:category", (req: Request, res: Response) => {
  try {
    const category = param(req, "category");
    if (!VAULT_CATEGORIES.includes(category)) {
      res.status(400).json({ error: true, message: `Unknown category '${category}'` });
      return;
    }
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { items, nextCursor } = walletDb.getVaultRecords(userId(req), category, cursor, limit);
    const grantCounts = walletDb.getGrantCountsByRecord(userId(req));
    for (const item of items as any[]) item.grantCount = grantCounts.get(item.record_id) || 0;
    res.json({ success: true, count: items.length, items, nextCursor });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PATCH /api/wallet/vault/:recordId/consent
 * Toggle a record between "private" and "monetizable".
 *
 * Per design (07-vault-consent-screens.md §6): toggling to "monetizable"
 * does NOT auto-share anything — explicit consent is still required per
 * grant. Audit-logged.
 */
router.patch("/vault/:recordId/consent", (req: Request, res: Response) => {
  try {
    const recordId = param(req, "recordId");
    const { consent } = req.body;
    if (!consent || !["private", "monetizable"].includes(consent)) {
      res.status(400).json({ error: true, message: "consent must be 'private' or 'monetizable'" });
      return;
    }
    const existing = walletDb.getVaultRecord(recordId, userId(req), false);
    if (!existing) {
      res.status(404).json({ error: true, message: "Record not found" });
      return;
    }
    walletDb.updateVaultConsent(recordId, userId(req), consent);
    logAudit({
      actorType: "user",
      actorId: userId(req),
      action: "vault.consent.update",
      entityType: "vault_record",
      entityId: recordId,
      result: "success",
      message: `Consent changed from '${existing.consent}' to '${consent}'`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Consent flag updated", recordId, consent });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 4. GRANTEE REDEMPTION
// ===========================================================================
/**
 * GET /api/wallet/share/:grantId
 * Redeem a sharing grant. DID-bound: the caller's linked DID must be the
 * grant's grantee — a share link alone is never enough. Every successful
 * redemption is written to the member-visible grant_access_log (async).
 *
 * Errors: 404 GRANT_NOT_FOUND · 410 GRANT_REVOKED / GRANT_EXPIRED ·
 *         403 DEVICE_MISMATCH (caller's DID is not the grantee)
 */
router.get("/share/:grantId", (req: Request, res: Response) => {
  try {
    const grant = walletDb.getGrant(param(req, "grantId"));
    if (!grant) {
      res.status(404).json({ error: true, code: "GRANT_NOT_FOUND", message: "Share not found" });
      return;
    }
    if (grant.revoked === 1) {
      res.status(410).json({ error: true, code: "GRANT_REVOKED", message: "This share has been revoked by its owner" });
      return;
    }
    if (new Date(grant.expires_at).getTime() <= Date.now()) {
      res.status(410).json({ error: true, code: "GRANT_EXPIRED", message: "This share has expired" });
      return;
    }
    const callerDid = req.user?.did;
    if (!callerDid || callerDid !== grant.grantee_did) {
      res.status(403).json({ error: true, code: "DEVICE_MISMATCH", message: "This share was issued to a different identity. Link the grantee DID to your account to redeem it." });
      return;
    }
    const record = walletDb.getVaultRecordForGrant(grant.record_id);
    if (!record) {
      res.status(404).json({ error: true, code: "GRANT_NOT_FOUND", message: "The shared record no longer exists" });
      return;
    }
    // Member-visible access log (async, never blocks redemption) + platform audit.
    walletDb.logGrantAccess(grant.grant_id, callerDid);
    logAudit({
      actorType: "user",
      actorId: userId(req),
      action: "vault.share.redeem",
      entityType: "vault_grant",
      entityId: grant.grant_id,
      result: "success",
      message: `Redeemed by ${callerDid} (scope ${grant.scope})`,
      ipAddress: getClientIp(req),
    });
    const metaOnly = grant.scope === "meta-only";
    res.json({
      success: true,
      meta: parseMetaJson(record.meta_json),
      ciphertext: metaOnly ? "" : record.ciphertext,
      iv: metaOnly ? "" : record.iv,
      encryptedKey: grant.encrypted_key,
      scope: grant.scope,
      expiresAt: grant.expires_at,
      price: { amount: grant.price_amount || 0, currency: grant.price_currency || "USD" },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 5. DIDCOMM PUSH HINTS + MESSAGE QUEUE
// ===========================================================================
/**
 * POST /api/wallet/didcomm/push-hint
 * Register a DID-to-push-token hint for incoming DIDComm messages.
 * Body: { userDID, pushToken }
 */
router.post("/didcomm/push-hint", (req: Request, res: Response) => {
  try {
    const { userDID, pushToken } = req.body;
    if (!userDID || !pushToken) { res.status(400).json({ error: true, message: "userDID and pushToken are required" }); return; }
    const deviceId = getDeviceId(req) || "push-hint";
    walletDb.updatePushToken(deviceId, userId(req), pushToken);
    walletDb.upsertMessageHint(userDID, deviceId);
    res.json({ success: true, message: "Push hint registered" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/messages/waiting
 * Lightweight poll: are DIDComm messages waiting for the caller's linked DID?
 */
router.get("/messages/waiting", (req: Request, res: Response) => {
  try {
    const did = req.user?.did;
    if (!did) {
      res.json({ success: true, waiting: false, unreadCount: 0, didLinked: false, lastMessageAt: null, pushHint: null });
      return;
    }
    const { unreadCount, lastMessageAt } = walletDb.getMessageQueueSummary(did);
    res.json({
      success: true,
      waiting: unreadCount > 0,
      unreadCount,
      didLinked: true,
      lastMessageAt,
      pushHint: unreadCount > 0 ? { type: "didcomm", count: unreadCount } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * PUT /api/wallet/messages/waiting
 * Acknowledge receipt — clears unread counters (optionally by queue ids).
 * Body: { messageIds? }
 */
router.put("/messages/waiting", (req: Request, res: Response) => {
  try {
    const did = req.user?.did;
    if (!did) { res.status(400).json({ error: true, message: "No DID linked to this account" }); return; }
    walletDb.ackMessageQueue(did, Array.isArray(req.body?.messageIds) ? req.body.messageIds : undefined);
    res.json({ success: true, message: "Messages acknowledged" });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ===========================================================================
// 6. ZK PRESENTATION (proof generated ON-DEVICE)
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
 * Body: { proof, challenge?, checkTrustRegistry? }
 * Responses:
 *   200 — { success: true, verified: true, proofId, holderDID, timestamp, checks }
 *   400 — { error: true, message: "..." }
 *   403 — { success: false, error: true, message, checks, proofId }
 */
router.post("/vc/present", async (req: Request, res: Response) => {
  try {
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

    logAudit({
      actorType: "user",
      actorId: userId(req),
      action: "zk.verify",
      entityType: "zk_proof",
      entityId: result.proofId,
      result: "success",
      message: `Wallet ZK presentation verified for ${result.holderDID}`,
      ipAddress: getClientIp(req),
    });

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
// 7. ADMIN ENDPOINTS (DB-verified admin role via requireAdmin)
// ===========================================================================
/**
 * GET /api/wallet/admin/users
 * List all wallet users with vault/grant counts and quota bytes.
 */
router.get("/admin/users", requireAdmin, (_req: Request, res: Response) => {
  try {
    const items = walletDb.getAdminWalletUsers();
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/wallet/admin/credentials[?userId=]
 * List wallet credential backups (metadata only).
 */
router.get("/admin/credentials", requireAdmin, (req: Request, res: Response) => {
  try {
    const filterUserId = req.query.userId as string | undefined;
    const items = walletDb.getAdminWalletCredentials(filterUserId);
    res.json({ success: true, count: items.length, items, filteredByUserId: filterUserId || null });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * DELETE /api/wallet/admin/remote-wipe/:walletId
 * Remote wipe a wallet (sets wiped flag, reason required). Audit-logged.
 * Body: { reason }
 */
router.delete("/admin/remote-wipe/:walletId", requireAdmin, (req: Request, res: Response) => {
  try {
    const walletId = param(req, "walletId");
    const { reason } = req.body;
    if (!reason) { res.status(400).json({ error: true, message: "reason is required" }); return; }
    walletDb.remoteWipeWallet(walletId, reason);
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
 * List all data-sharing grants across users. Metadata only.
 */
router.get("/admin/grants", requireAdmin, (req: Request, res: Response) => {
  try {
    const grants = walletDb.getAdminGrants();
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
 * View access log entries for a specific grant.
 */
router.get("/admin/grants/:grantId/access-log", requireAdmin, (req: Request, res: Response) => {
  try {
    const grantId = param(req, "grantId");
    const logs = walletDb.getAccessLogForGrant(grantId);
    res.json({ success: true, count: logs.length, grantId, logs });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
