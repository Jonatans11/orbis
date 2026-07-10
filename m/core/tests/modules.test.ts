import { describe, it, expect, vi } from "vitest";
import {
  SessionManager,
  CredentialStore,
  DidcommClient,
  OrbisApiClient,
  defaultRandom,
  generateMwk,
  deriveKey,
  KeyInfo,
  NetworkError,
  type SecureKV,
  type VaultStore,
  type VaultRow,
  type VerifiableCredential,
} from "../src/index.js";

function memKV(): SecureKV {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
  };
}

function memVault(): VaultStore {
  const rows = new Map<string, VaultRow>();
  return {
    put: async (r) => void rows.set(`${r.table}/${r.id}`, r),
    get: async (t, id) => rows.get(`${t}/${id}`) ?? null,
    query: async (q) =>
      [...rows.values()].filter(
        (r) =>
          r.table === q.table &&
          (!q.where || Object.entries(q.where).every(([k, v]) => r.meta[k] === v)),
      ),
    delete: async (t, id) => void rows.delete(`${t}/${id}`),
    wipeAll: async () => void rows.clear(),
  };
}

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("auth/SessionManager", () => {
  it("persists sessions to SecureKV and clears", async () => {
    const kv = memKV();
    const api = new OrbisApiClient({
      baseUrl: "https://api.test",
      fetchFn: (async () => okJson({ token: "t1", user: { id: "u1", email: "a@b.c" } })) as typeof fetch,
    });
    const sm = new SessionManager(kv, api);
    const s = await sm.login("a@b.c", "pw");
    expect(s.userId).toBe("u1");
    expect(await sm.getValidToken()).toBe("t1"); // no exp claim → used as-is
    await sm.clear();
    expect(await sm.getValidToken()).toBeNull();
  });
});

describe("vc/CredentialStore", () => {
  const vc: VerifiableCredential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HealthCredential"],
    issuer: "did:key:z6MkIssuer",
    credentialSubject: { bloodType: "O-" },
  };

  it("encrypts at rest, lists by category, decrypts on open", async () => {
    const store = memVault();
    const key = deriveKey(generateMwk(defaultRandom), KeyInfo.vault("credentials"));
    const cs = new CredentialStore(store, key, defaultRandom);
    await cs.save("c1", "medical", "Blood type", vc);

    const raw = await store.get("credentials", "c1");
    expect(raw!.payload).not.toContain("O-"); // ciphertext only at rest
    expect(await cs.list("medical")).toHaveLength(1);
    expect(await cs.list("financial")).toHaveLength(0);
    expect((await cs.open("c1"))!.credentialSubject["bloodType"]).toBe("O-");
    await cs.remove("c1");
    expect(await cs.open("c1")).toBeNull();
  });
});

describe("didcomm/DidcommClient", () => {
  it("sends basic messages and drains inbox", async () => {
    const f = vi.fn(async (url: string) =>
      String(url).includes("/inbox") ? okJson({ messages: [{ id: "m1" }] }) : okJson({ id: "sent-1" }),
    ) as unknown as typeof fetch;
    const dc = new DidcommClient(new OrbisApiClient({ baseUrl: "https://api.test", fetchFn: f }));
    expect((await dc.sendBasicMessage("did:key:a", "did:key:b", "hi")).id).toBe("sent-1");
    expect(await dc.drainInbox("did:key:b")).toEqual([{ id: "m1" }]);
  });
});

describe("api retry logic", () => {
  it("retries transient GET failures, does not retry POST", async () => {
    let getCalls = 0;
    const flaky = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        getCalls++;
        if (getCalls < 3) throw new Error("ECONNRESET");
        return okJson({ status: "ok" });
      }
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const api = new OrbisApiClient({ baseUrl: "https://api.test", fetchFn: flaky });
    expect((await api.health()).status).toBe("ok"); // succeeded on 3rd attempt
    expect(getCalls).toBe(3);
    await expect(api.didcomm.send({})).rejects.toBeInstanceOf(NetworkError); // POST: 1 attempt
  });
});
