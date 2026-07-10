/**
 * Mock-server integration tests for OrbisApiClient.
 *
 * Spins up a real Node http server that reproduces the live backend's exact
 * envelopes (flat errors `{ error: true, code?, message }`, success `{ success: true, ... }`,
 * snake_case rows) per orbis-repo src/wallet/routes.ts and src/security/jwt.ts,
 * then drives the typed client end-to-end over real HTTP.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError, OrbisApiClient } from "../src/index.js";

interface Captured {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  body: any;
}

let server: Server;
let baseUrl: string;
const captured: Captured[] = [];
const last = () => captured[captured.length - 1]!;

/** Grant state used to simulate revocation. */
let grantRevoked = false;
/** Wipe state used to simulate admin remote wipe. */
let walletWiped = false;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function route(req: IncomingMessage, body: any, res: ServerResponse) {
  const url = new URL(req.url!, "http://localhost");
  const p = url.pathname;
  const m = req.method!;

  // auth guard mirror: everything but /api/health and /api/auth/{register,login}
  const open = p === "/api/health" || p === "/api/auth/register" || p === "/api/auth/login";
  if (!open && !req.headers.authorization?.startsWith("Bearer ")) {
    return json(res, 401, { error: true, message: "Missing Authorization header" });
  }

  if (p === "/api/health") return json(res, 200, { status: "ok" });

  if (p === "/api/auth/register" && m === "POST") {
    if (!body.displayName) return json(res, 400, { error: true, message: "displayName is required" });
    return json(res, 201, {
      success: true,
      token: "jwt-mock",
      user: { id: "u1", email: body.email, displayName: body.displayName, did: null, verified: false, admin: false },
    });
  }
  if (p === "/api/auth/change-password" && m === "POST")
    return json(res, 200, { success: true, message: "Password changed successfully" });
  if (p === "/api/auth/link-did" && m === "POST")
    return json(res, 200, { success: true, message: "DID linked to account" });

  if (p === "/api/wallet/register" && m === "POST") {
    if (body.platform && !["ios", "android", "web"].includes(body.platform))
      return json(res, 400, { error: true, message: "platform must be ios, android, or web" });
    return json(res, 201, { success: true, walletId: "w-1", deviceId: "d-1", createdAt: new Date().toISOString() });
  }
  if (p === "/api/wallet/status" && m === "GET") {
    if (walletWiped)
      return json(res, 410, { error: true, code: "WALLET_WIPED", message: "Wallet has been remotely wiped" });
    return json(res, 200, {
      success: true, walletId: "w-1", wiped: false, deviceCount: 1,
      quotaUsedBytes: 1024, quotaLimitBytes: 50 * 1024 * 1024,
    });
  }
  if (p === "/api/wallet/credentials/backup" && m === "POST") {
    const results = (body.items as any[]).map((it) =>
      it.localId && it.ciphertext && it.iv
        ? { localId: it.localId, status: "created", size: 42 }
        : { localId: it.localId || "unknown", status: "error", message: "Missing required fields" },
    );
    return json(res, 201, { success: true, results });
  }
  if (p === "/api/wallet/credentials/backup" && m === "GET") {
    const withCipher = url.searchParams.get("include") === "ciphertext";
    const item: any = { local_id: "vc-1", category: "identity", size: 42, updated_at: "2026-07-10 20:00:00" };
    if (withCipher) Object.assign(item, { ciphertext: "AAA=", iv: "BBB=", alg: "A256GCM" });
    return json(res, 200, { success: true, count: 1, items: [item] });
  }
  if (p === "/api/wallet/data/store" && m === "POST") {
    if (!body.recordId) return json(res, 400, { error: true, message: "recordId is required" });
    return json(res, 201, { success: true, recordId: body.recordId, size: 128, updatedAt: new Date().toISOString() });
  }
  if (p === "/api/wallet/data/medical" && m === "GET") {
    return json(res, 200, {
      success: true,
      items: [{ record_id: "r-1", meta_json: '{"title":"Blood panel","type":"lab-result"}', size: 128, consent: "private", updated_at: "2026-07-10 20:00:00", grantCount: 1 }],
      nextCursor: null,
    });
  }
  if (p === "/api/wallet/data/record/r-1" && m === "GET") {
    return json(res, 200, {
      success: true,
      record: { record_id: "r-1", user_id: "u1", category: "medical", meta_json: '{"title":"Blood panel","type":"lab-result"}', size: 128, consent: "private", updated_at: "2026-07-10 20:00:00", ciphertext: "AAA=", iv: "BBB=", alg: "A256GCM" },
    });
  }
  if (p === "/api/wallet/data/share" && m === "POST") {
    for (const k of ["recordId", "granteeDid", "scope", "expiresAt", "encryptedKey"])
      if (!body[k]) return json(res, 400, { error: true, message: `${k} is required` });
    return json(res, 201, { success: true, grantId: "g-1", shareUrl: "https://orbis.id/api/wallet/share/g-1" });
  }
  if (p === "/api/wallet/share/g-1" && m === "GET") {
    if (grantRevoked)
      return json(res, 403, { error: true, code: "GRANT_REVOKED", message: "Grant has been revoked" });
    return json(res, 200, {
      success: true, meta: { title: "Blood panel" }, ciphertext: "AAA=", iv: "BBB=",
      encryptedKey: "sealed-key", scope: "full", expiresAt: "2026-08-01T00:00:00Z",
      price: { amount: 500, currency: "USD" },
    });
  }
  if (p === "/api/wallet/data/grants" && m === "GET") {
    return json(res, 200, {
      success: true, count: 1,
      grants: [{ grant_id: "g-1", record_id: "r-1", owner_user_id: "u1", grantee_did: "did:key:zGrantee", scope: "full", price_amount: 500, price_currency: "USD", expires_at: "2026-08-01T00:00:00Z", revoked: 0, access_count: 1, accessLog: [{ accessed_by_did: "did:key:zGrantee", accessed_at: "2026-07-10 21:00:00" }] }],
    });
  }
  if (p === "/api/wallet/data/grants/g-1" && m === "DELETE") {
    grantRevoked = true;
    return json(res, 200, { success: true, message: "Grant revoked" });
  }
  if (p === "/api/wallet/messages/waiting" && m === "GET") {
    return json(res, 200, { success: true, waiting: true, unreadCount: 2, didLinked: true, lastMessageAt: "2026-07-10 21:00:00", pushHint: { type: "didcomm.message-waiting", count: 2 } });
  }
  if (p === "/api/wallet/messages/waiting" && m === "PUT")
    return json(res, 200, { success: true, message: "Messages acknowledged" });
  if (p === "/api/wallet/admin/users" && m === "GET") {
    return json(res, 200, { success: true, count: 1, users: [{ id: "d-1", user_id: "u1", wallet_id: "w-1", device_name: "Pixel", platform: "android", wiped: 0, created_at: "2026-07-10", last_seen_at: null, vault_count: 1, grant_count: 1 }] });
  }
  if (p === "/api/wallet/admin/remote-wipe/w-1" && m === "DELETE") {
    if (!body?.reason) return json(res, 400, { error: true, message: "reason is required" });
    walletWiped = true;
    return json(res, 200, { success: true, message: "Remote wipe initiated" });
  }

  return json(res, 404, { error: true, message: `Not found: ${m} ${p}` });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: any;
      try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
      const url = new URL(req.url!, "http://localhost");
      captured.push({ method: req.method!, path: url.pathname, query: url.searchParams, headers: req.headers, body });
      route(req, body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

function makeClient(opts: { token?: string | null; onWalletWiped?: () => void } = {}) {
  return new OrbisApiClient({
    baseUrl,
    getToken: () => (opts.token === undefined ? "jwt-mock" : opts.token),
    getDeviceId: () => "d-1",
    onWalletWiped: opts.onWalletWiped,
  });
}

describe("OrbisApiClient against mock server (live backend envelopes)", () => {
  it("registers an account (displayName required by live contract)", async () => {
    const c = makeClient({ token: null });
    const session = await c.auth.register("a@b.c", "hunter22", "Ada");
    expect(session.success).toBe(true);
    expect(session.token).toBe("jwt-mock");
    expect(session.user.displayName).toBe("Ada");
    expect(last().body).toEqual({ email: "a@b.c", password: "hunter22", displayName: "Ada" });
  });

  it("uses POST /api/auth/change-password and /api/auth/link-did (live paths)", async () => {
    const c = makeClient();
    await c.auth.changePassword("old-pass1", "new-pass1");
    expect(last().path).toBe("/api/auth/change-password");
    expect(last().method).toBe("POST");
    await c.auth.linkDid("did:key:z6MkTest");
    expect(last().path).toBe("/api/auth/link-did");
    expect(last().method).toBe("POST");
  });

  it("registers a wallet and reads status with device header", async () => {
    const c = makeClient();
    const reg = await c.wallet.register({ deviceName: "Pixel", platform: "android", pushToken: null });
    expect(reg.walletId).toBe("w-1");
    const status = await c.wallet.status();
    expect(status.quotaLimitBytes).toBe(50 * 1024 * 1024);
    expect(last().headers["x-orbis-device-id"]).toBe("d-1");
    expect(last().headers.authorization).toBe("Bearer jwt-mock");
  });

  it("rejects a bad platform with a flat error envelope", async () => {
    const c = makeClient();
    const err = await c.wallet
      .register({ deviceName: "X", platform: "windows" as any, pushToken: null })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).message).toContain("platform must be");
  });

  it("backs up ciphertext items and lists them (snake_case rows)", async () => {
    const c = makeClient();
    const res = await c.wallet.backupCredentials([
      { localId: "vc-1", category: "identity", ciphertext: "AAA=", iv: "BBB=", alg: "A256GCM" },
    ]);
    expect(res.results[0]).toMatchObject({ localId: "vc-1", status: "created" });
    const list = await c.wallet.listBackups(true);
    expect(last().query.get("include")).toBe("ciphertext");
    expect(list.items[0]!.local_id).toBe("vc-1");
    expect(list.items[0]!.ciphertext).toBe("AAA=");
  });

  it("stores and lists vault records, parsing meta_json", async () => {
    const c = makeClient();
    const stored = await c.wallet.storeData({
      recordId: "0e6f1a52-49b8-4c34-9a3e-2f57cf1a9d10",
      category: "medical",
      meta: { title: "Blood panel", type: "lab-result" },
      ciphertext: "AAA=",
      iv: "BBB=",
      alg: "A256GCM",
    });
    expect(stored.success).toBe(true);
    const list = await c.wallet.listData("medical", { limit: 20 });
    expect(last().query.get("limit")).toBe("20");
    const row = list.items[0]!;
    expect(JSON.parse(row.meta_json).title).toBe("Blood panel");
    const rec = await c.wallet.getRecord("r-1");
    expect(rec.record.ciphertext).toBe("AAA=");
  });

  it("runs the consent-grant loop: create → redeem → revoke → GRANT_REVOKED", async () => {
    const c = makeClient();
    const grant = await c.wallet.createGrant({
      recordId: "0e6f1a52-49b8-4c34-9a3e-2f57cf1a9d10",
      granteeDid: "did:key:zGrantee",
      scope: "full",
      expiresAt: "2026-08-01T00:00:00Z",
      price: { amount: 500, currency: "USD" },
      encryptedKey: "sealed-key",
    });
    expect(grant.grantId).toBe("g-1");
    expect(grant.shareUrl).toContain("/api/wallet/share/g-1");

    const redeemed = await c.wallet.redeemGrant("g-1");
    expect(redeemed.encryptedKey).toBe("sealed-key");
    expect(redeemed.price).toEqual({ amount: 500, currency: "USD" });

    const grants = await c.wallet.listGrants();
    expect(grants.grants[0]!.grant_id).toBe("g-1");
    expect(grants.grants[0]!.access_count).toBe(1);

    await c.wallet.revokeGrant("g-1");
    const err = await c.wallet.redeemGrant("g-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("GRANT_REVOKED");
  });

  it("reads and acknowledges waiting DIDComm messages", async () => {
    const c = makeClient();
    const waiting = await c.wallet.messagesWaiting();
    expect(waiting.unreadCount).toBe(2);
    expect(waiting.pushHint?.type).toBe("didcomm.message-waiting");
    await c.wallet.ackMessages(["m1", "m2"]);
    expect(last().method).toBe("PUT");
    expect(last().body).toEqual({ messageIds: ["m1", "m2"] });
  });

  it("admin remote-wipe then 410 WALLET_WIPED fires onWalletWiped", async () => {
    const onWalletWiped = vi.fn();
    const c = makeClient({ onWalletWiped });
    const users = await c.admin.walletUsers();
    expect(users.users[0]!.wallet_id).toBe("w-1");

    await c.admin.remoteWipe("w-1", "device reported stolen");
    expect(last().method).toBe("DELETE");
    expect(last().body).toEqual({ reason: "device reported stolen" });

    const err = await c.wallet.status().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(410);
    expect((err as ApiError).code).toBe("WALLET_WIPED");
    expect((err as ApiError).isWalletWiped).toBe(true);
    expect(onWalletWiped).toHaveBeenCalledOnce();
  });

  it("maps 401 (flat envelope, no code) to ApiError with HTTP_401", async () => {
    const c = makeClient({ token: null });
    const err = await c.wallet.messagesWaiting().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).code).toBe("HTTP_401");
    expect((err as ApiError).isAuthError).toBe(true);
  });
});
