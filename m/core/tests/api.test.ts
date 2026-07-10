import { describe, it, expect, vi } from "vitest";
import { OrbisApiClient, ApiError, NetworkError } from "../src/index.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function client(fetchFn: typeof fetch, extra: Partial<ConstructorParameters<typeof OrbisApiClient>[0]> = {}) {
  return new OrbisApiClient({
    baseUrl: "https://api.test/",
    getToken: () => "jwt-123",
    getDeviceId: () => "dev-456",
    fetchFn,
    ...extra,
  });
}

describe("OrbisApiClient", () => {
  it("sends auth + device headers and builds URLs correctly", async () => {
    const f = mockFetch(200, { walletId: "w", wiped: false, deviceCount: 1, quotaUsedBytes: 0 });
    await client(f).wallet.status();
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/wallet/status");
    expect(init.headers["Authorization"]).toBe("Bearer jwt-123");
    expect(init.headers["X-Orbis-Device-Id"]).toBe("dev-456");
  });

  it("skips auth header for unauthenticated endpoints", async () => {
    const f = mockFetch(200, { token: "t", user: { id: "1", email: "a@b.c" } });
    await client(f).auth.login("a@b.c", "pw");
    const [, init] = f.mock.calls[0]!;
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.c", password: "pw" });
  });

  it("serializes query params", async () => {
    const f = mockFetch(200, { messages: [] });
    await client(f).didcomm.inbox({ did: "did:key:z6Mk", status: "received" });
    const [url] = f.mock.calls[0]!;
    expect(url).toContain("/api/didcomm/inbox?");
    expect(url).toContain("did=did%3Akey%3Az6Mk");
    expect(url).toContain("status=received");
  });

  it("maps server errors to ApiError with code", async () => {
    const f = mockFetch(403, { error: { code: "GRANT_REVOKED", message: "Grant was revoked" } });
    const err = await client(f).wallet.redeemGrant("g1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe("GRANT_REVOKED");
  });

  it("fires onWalletWiped for 410 WALLET_WIPED", async () => {
    const onWalletWiped = vi.fn();
    const f = mockFetch(410, { error: { code: "WALLET_WIPED", message: "Wallet wiped by admin" } });
    const err = await client(f, { onWalletWiped }).wallet.status().catch((e: unknown) => e);
    expect((err as ApiError).isWalletWiped).toBe(true);
    expect(onWalletWiped).toHaveBeenCalledOnce();
  });

  it("wraps transport failures in NetworkError", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const err = await client(f).health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
  });
});
