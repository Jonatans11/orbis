/**
 * Data Vault + wallet API integration tests.
 *
 * Boots the wallet router on an ephemeral port and exercises the full
 * consent-ledger flow over HTTP: auth gating, vault CRUD + quota shapes,
 * grant lifecycle, DID-bound redemption, access logging, admin gating,
 * message polling, and token refresh.
 *
 * Also contract-tests the m/core endpoint catalogue against the live
 * router so the mobile clients and backend can never drift apart again.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

import { initDatabase } from "../src/db/metadata.js";
import { initAuthTables, createUser, findUserById, generateToken, verifyToken, type UserRecord } from "../src/security/jwt.js";
import { ensureAdminColumns } from "../src/admin/auth.js";
import { initWalletTables } from "../src/wallet/db.js";
import walletRoutes from "../src/wallet/routes.js";
import { ENDPOINTS } from "../m/core/src/api/endpoints";

function sql(statement: string): any[] {
  const out = execFileSync("team-db", [statement.replace(/\s+/g, " ").trim()], { encoding: "utf-8", timeout: 10_000 });
  return JSON.parse(out.trim());
}

const GRANTEE_DID = "did:key:z6MkwalletTestGrantee0000000000000000000001";

let server: Server;
let baseUrl: string;
let owner: UserRecord;
let grantee: UserRecord;
let ownerToken: string;
let granteeToken: string;

async function api(method: string, path: string, token?: string | null, body?: unknown): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* express default 404s are HTML */ }
  return { status: res.status, json, text };
}

beforeAll(async () => {
  initDatabase();
  initAuthTables();
  ensureAdminColumns();
  initWalletTables();

  owner = await createUser(`vault-owner-${Date.now()}@test.orbis`, "test-password-1", "Vault Owner");
  grantee = await createUser(`vault-grantee-${Date.now()}@test.orbis`, "test-password-2", "Vault Grantee");
  sql(`UPDATE ssi_users SET did = '${GRANTEE_DID}' WHERE id = '${grantee.id}'`);
  grantee = findUserById(grantee.id)!;
  ownerToken = generateToken(owner);
  granteeToken = generateToken(grantee);

  const app = express();
  app.use(express.json({ limit: "60mb" }));
  app.use("/api/wallet", walletRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => {
  server?.close();
});

// ─── Auth gating ─────────────────────────────────────────────────────────────

describe("wallet auth gating", () => {
  it("rejects requests without a token", async () => {
    const res = await api("GET", "/api/wallet/status");
    expect(res.status).toBe(401);
  });

  it("rejects malformed and invalid bearer tokens", async () => {
    expect((await api("GET", "/api/wallet/status", "not-a-jwt")).status).toBe(401);
    const res = await fetch(`${baseUrl}/api/wallet/status`, { headers: { Authorization: "Token abc" } });
    expect(res.status).toBe(401);
  });

  it("accepts a valid JWT", async () => {
    const res = await api("GET", "/api/wallet/status", ownerToken);
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.quotaLimitBytes).toBe(50 * 1024 * 1024);
  });
});

// ─── Contract: m/core endpoint catalogue ↔ live router ──────────────────────

describe("m/core endpoint contract", () => {
  const params: Record<string, string> = {
    ":deviceId": randomUUID(),
    ":localId": "contract-local",
    ":category": "documents",
    ":recordId": randomUUID(),
    ":grantId": randomUUID(),
    ":walletId": randomUUID(),
  };

  const walletPaths = [
    ...Object.values(ENDPOINTS.wallet),
    ...Object.values(ENDPOINTS.admin),
  ].filter((e) => e.path.startsWith("/api/wallet"));

  it.each(walletPaths.map((e) => [`${e.method} ${e.path}`, e] as const))(
    "%s is routed",
    async (_label, endpoint) => {
      let path = endpoint.path;
      for (const [param, value] of Object.entries(params)) path = path.replace(param, value);
      const res = await api(endpoint.method, path, ownerToken, endpoint.method === "GET" ? undefined : {});
      // A routing miss is express's HTML "Cannot GET/POST ..." 404 — any JSON
      // response (even a validation 400 or handler 404) proves the route exists.
      const routed = !(res.status === 404 && res.json === null);
      expect(routed, `${endpoint.method} ${path} fell through the router`).toBe(true);
    },
  );
});

// ─── Vault CRUD ──────────────────────────────────────────────────────────────

const recordId = randomUUID();
const CIPHERTEXT = Buffer.from("encrypted-vault-payload").toString("base64");

describe("vault records", () => {
  it("stores a record and returns the client contract shape", async () => {
    const res = await api("POST", "/api/wallet/data/store", ownerToken, {
      recordId,
      category: "medical",
      meta: { title: "Blood panel 2026", type: "note" },
      ciphertext: CIPHERTEXT,
      iv: "AAAAAAAAAAAAAAAA",
      alg: "A256GCM",
    });
    expect(res.status).toBe(200);
    expect(res.json.recordId).toBe(recordId);
    expect(res.json.size).toBe(Buffer.byteLength(CIPHERTEXT, "base64"));
    expect(typeof res.json.updatedAt).toBe("string");
  });

  it("rejects unknown categories and oversized titles", async () => {
    const bad = await api("POST", "/api/wallet/data/store", ownerToken, {
      recordId: randomUUID(), category: "diary", meta: { title: "x", type: "note" }, ciphertext: CIPHERTEXT, iv: "iv",
    });
    expect(bad.status).toBe(400);
    const longTitle = await api("POST", "/api/wallet/data/store", ownerToken, {
      recordId: randomUUID(), category: "medical", meta: { title: "x".repeat(121), type: "note" }, ciphertext: CIPHERTEXT, iv: "iv",
    });
    expect(longTitle.status).toBe(400);
  });

  it("lists category records with grantCount and without ciphertext", async () => {
    const res = await api("GET", "/api/wallet/data/medical", ownerToken);
    expect(res.status).toBe(200);
    const item = res.json.items.find((i: any) => i.record_id === recordId);
    expect(item).toBeTruthy();
    expect(item.grantCount).toBe(0);
    expect(item.ciphertext).toBeUndefined();
    expect(JSON.parse(item.meta_json).title).toBe("Blood panel 2026");
  });

  it("returns ciphertext only when explicitly requested", async () => {
    const bare = await api("GET", `/api/wallet/data/record/${recordId}`, ownerToken);
    expect(bare.status).toBe(200);
    expect(bare.json.record.ciphertext).toBeUndefined();
    const full = await api("GET", `/api/wallet/data/record/${recordId}?include=ciphertext`, ownerToken);
    expect(full.json.record.ciphertext).toBe(CIPHERTEXT);
  });

  it("isolates records between users", async () => {
    const res = await api("GET", `/api/wallet/data/record/${recordId}`, granteeToken);
    expect(res.status).toBe(404);
  });

  it("updates the consent flag (server-authoritative)", async () => {
    const res = await api("PATCH", `/api/wallet/vault/${recordId}/consent`, ownerToken, { consent: "monetizable" });
    expect(res.status).toBe(200);
    const list = await api("GET", "/api/wallet/data/medical", ownerToken);
    expect(list.json.items.find((i: any) => i.record_id === recordId).consent).toBe("monetizable");
    const bad = await api("PATCH", `/api/wallet/vault/${recordId}/consent`, ownerToken, { consent: "public" });
    expect(bad.status).toBe(400);
  });

  it("consent survives re-upload of the record", async () => {
    await api("POST", "/api/wallet/data/store", ownerToken, {
      recordId, category: "medical", meta: { title: "Blood panel 2026 v2", type: "note" }, ciphertext: CIPHERTEXT, iv: "iv2", alg: "A256GCM",
    });
    const list = await api("GET", "/api/wallet/data/medical", ownerToken);
    expect(list.json.items.find((i: any) => i.record_id === recordId).consent).toBe("monetizable");
  });
});

// ─── Grant lifecycle + DID-bound redemption ──────────────────────────────────

describe("sharing grants and redemption", () => {
  let grantId: string;
  const SEALED_KEY = "epk.aBase64SealedRecordKey";
  const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

  it("creates a grant and returns a share URL", async () => {
    const res = await api("POST", "/api/wallet/data/share", ownerToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "full", expiresAt: inDays(7),
      price: { amount: 500, currency: "USD" }, encryptedKey: SEALED_KEY,
    });
    expect(res.status).toBe(201);
    grantId = res.json.grantId;
    expect(res.json.shareUrl).toContain(`/share/${grantId}`);
  });

  it("enforces the 90-day cap, future expiry, and record ownership", async () => {
    const tooLong = await api("POST", "/api/wallet/data/share", ownerToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "full", expiresAt: inDays(91), encryptedKey: SEALED_KEY,
    });
    expect(tooLong.status).toBe(400);
    const past = await api("POST", "/api/wallet/data/share", ownerToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "full", expiresAt: inDays(-1), encryptedKey: SEALED_KEY,
    });
    expect(past.status).toBe(400);
    const notMine = await api("POST", "/api/wallet/data/share", granteeToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "full", expiresAt: inDays(7), encryptedKey: SEALED_KEY,
    });
    expect(notMine.status).toBe(404);
  });

  it("lists the consent ledger with derived role/status and grantCount", async () => {
    const ledger = await api("GET", "/api/wallet/data/grants", ownerToken);
    const grant = ledger.json.grants.find((g: any) => g.grant_id === grantId);
    expect(grant.role).toBe("grantor");
    expect(grant.status).toBe("active");
    expect(grant.is_paid).toBe(1);
    const granteeLedger = await api("GET", "/api/wallet/data/grants", granteeToken);
    expect(granteeLedger.json.grants.find((g: any) => g.grant_id === grantId).role).toBe("grantee");
    const list = await api("GET", "/api/wallet/data/medical", ownerToken);
    expect(list.json.items.find((i: any) => i.record_id === recordId).grantCount).toBe(1);
  });

  it("redeems only for the grantee DID (shares are DID-bound, not link-bound)", async () => {
    const asOwner = await api("GET", `/api/wallet/share/${grantId}`, ownerToken);
    expect(asOwner.status).toBe(403);
    expect(asOwner.json.code).toBe("DEVICE_MISMATCH");

    const res = await api("GET", `/api/wallet/share/${grantId}`, granteeToken);
    expect(res.status).toBe(200);
    expect(res.json.encryptedKey).toBe(SEALED_KEY);
    expect(res.json.ciphertext).toBe(CIPHERTEXT);
    expect(res.json.meta.title).toBe("Blood panel 2026 v2");
    expect(res.json.price).toEqual({ amount: 500, currency: "USD" });
  });

  it("writes the member-visible access log (async)", async () => {
    let entries: any[] = [];
    for (let i = 0; i < 20 && entries.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 150));
      const res = await api("GET", `/api/wallet/data/grants?recordId=${recordId}`, ownerToken);
      entries = res.json.grants.find((g: any) => g.grant_id === grantId)?.accessLog ?? [];
    }
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].accessed_by_did).toBe(GRANTEE_DID);
  });

  it("meta-only scope withholds ciphertext on redemption", async () => {
    const res = await api("POST", "/api/wallet/data/share", ownerToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "meta-only", expiresAt: inDays(3), encryptedKey: SEALED_KEY,
    });
    const redeemed = await api("GET", `/api/wallet/share/${res.json.grantId}`, granteeToken);
    expect(redeemed.status).toBe(200);
    expect(redeemed.json.ciphertext).toBe("");
    expect(redeemed.json.meta.title).toBe("Blood panel 2026 v2");
  });

  it("blocks expired and revoked grants with typed codes", async () => {
    const exp = await api("POST", "/api/wallet/data/share", ownerToken, {
      recordId, granteeDid: GRANTEE_DID, scope: "full", expiresAt: inDays(1), encryptedKey: SEALED_KEY,
    });
    sql(`UPDATE vault_grants SET expires_at = '2020-01-01T00:00:00.000Z' WHERE grant_id = '${exp.json.grantId}'`);
    const expired = await api("GET", `/api/wallet/share/${exp.json.grantId}`, granteeToken);
    expect(expired.status).toBe(410);
    expect(expired.json.code).toBe("GRANT_EXPIRED");

    const revoke = await api("DELETE", `/api/wallet/data/grants/${grantId}`, granteeToken);
    expect(revoke.status).toBe(404); // only the owner can revoke
    const ownerRevoke = await api("DELETE", `/api/wallet/data/grants/${grantId}`, ownerToken);
    expect(ownerRevoke.status).toBe(200);
    const revoked = await api("GET", `/api/wallet/share/${grantId}`, granteeToken);
    expect(revoked.status).toBe(410);
    expect(revoked.json.code).toBe("GRANT_REVOKED");

    expect((await api("GET", `/api/wallet/share/${randomUUID()}`, granteeToken)).status).toBe(404);
  });

  it("deleting a record deletes its grants", async () => {
    const res = await api("DELETE", `/api/wallet/data/record/${recordId}`, ownerToken);
    expect(res.status).toBe(200);
    expect((await api("GET", `/api/wallet/data/record/${recordId}`, ownerToken)).status).toBe(404);
    const ledger = await api("GET", `/api/wallet/data/grants?recordId=${recordId}`, ownerToken);
    expect(ledger.json.grants.length).toBe(0);
  });
});

// ─── Backup, messages, refresh, admin ────────────────────────────────────────

describe("credential backup", () => {
  it("upserts a batch and lists without ciphertext by default", async () => {
    const res = await api("POST", "/api/wallet/credentials/backup", ownerToken, {
      items: [{ localId: "vc-1", category: "identity", ciphertext: CIPHERTEXT, iv: "iv" }],
    });
    expect(res.status).toBe(200);
    expect(res.json.results[0]).toMatchObject({ localId: "vc-1", status: "created" });
    const list = await api("GET", "/api/wallet/credentials/backup", ownerToken);
    expect(list.json.items[0].ciphertext).toBeUndefined();
    const full = await api("GET", "/api/wallet/credentials/backup?include=ciphertext", ownerToken);
    expect(full.json.items[0].ciphertext).toBe(CIPHERTEXT);
    expect((await api("DELETE", "/api/wallet/credentials/backup/vc-1", ownerToken)).status).toBe(200);
  });
});

describe("messages waiting", () => {
  it("reflects DID linkage", async () => {
    const noDid = await api("GET", "/api/wallet/messages/waiting", ownerToken);
    expect(noDid.json.didLinked).toBe(false);
    const withDid = await api("GET", "/api/wallet/messages/waiting", granteeToken);
    expect(withDid.json.didLinked).toBe(true);
    expect((await api("PUT", "/api/wallet/messages/waiting", granteeToken, {})).status).toBe(200);
  });
});

describe("token refresh", () => {
  it("exchanges a stored refresh token for a verifiable JWT", async () => {
    const refreshToken = "test-refresh-token";
    const hash = createHash("sha256").update(refreshToken).digest("hex");
    sql(`INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ('${hash}', '${owner.id}', datetime('now', '+1 day'))`);
    const res = await api("POST", "/api/wallet/refresh", null, { refreshToken });
    expect(res.status).toBe(200);
    expect(verifyToken(res.json.token)?.sub).toBe(owner.id);
    expect((await api("POST", "/api/wallet/refresh", null, { refreshToken: "wrong" })).status).toBe(401);
  });
});

describe("admin endpoints", () => {
  it("rejects non-admins via the DB-verified role", async () => {
    const res = await api("GET", "/api/wallet/admin/users", ownerToken);
    expect(res.status).toBe(403);
  });

  it("serves admins without any admin claim in the JWT", async () => {
    sql(`UPDATE ssi_users SET admin = 1 WHERE id = '${owner.id}'`);
    const res = await api("GET", "/api/wallet/admin/users", ownerToken);
    expect(res.status).toBe(200);
    expect((await api("GET", "/api/wallet/admin/grants", ownerToken)).status).toBe(200);
    const log = await api("GET", `/api/wallet/admin/grants/${randomUUID()}/access-log`, ownerToken);
    expect(log.status).toBe(200);
    sql(`UPDATE ssi_users SET admin = 0 WHERE id = '${owner.id}'`);
  });
});
