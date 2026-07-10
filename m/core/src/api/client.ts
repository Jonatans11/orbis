/**
 * Typed ORBIS API client, shared by the native app and PWA.
 *
 * - Live endpoints: /api/auth, /api/did, /api/vc, /api/trust, /api/didcomm (orbis-repo src/index.ts)
 * - Planned endpoints (wallet-specs/02-API-SPEC.md): /api/wallet/*, /api/auth/oauth/exchange, /api/auth/refresh
 *   — typed now so app code compiles against the contract; server lands in Phases 1–3.
 */
import { ApiError, NetworkError } from "./errors.js";
import type {
  AuthSession,
  AuthUser,
  BackupItem,
  DidRecord,
  DidcommMessage,
  OAuthProvider,
  OobInvitation,
  ShareGrant,
  ShareGrantRequest,
  TrustCheck,
  VaultCategory,
  VaultRecordMeta,
  VaultStoreRequest,
  VerifiableCredential,
  VerifyResult,
  WalletRegisterRequest,
  WalletRegistration,
  WalletStatus,
} from "./types.js";

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current JWT, or null when logged out. */
  getToken?: () => Promise<string | null> | string | null;
  /** Device binding header (X-Orbis-Device-Id), set after wallet registration. */
  getDeviceId?: () => Promise<string | null> | string | null;
  /** Injectable for tests / platform polyfills. Defaults to globalThis.fetch. */
  fetchFn?: typeof fetch;
  /** Called when the server signals remote wipe (410 WALLET_WIPED). */
  onWalletWiped?: () => void;
}

interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  auth?: boolean;
}

export class OrbisApiClient {
  private readonly opts: ApiClientOptions;

  constructor(opts: ApiClientOptions) {
    this.opts = { ...opts, baseUrl: opts.baseUrl.replace(/\/+$/, "") };
  }

  // ---------------- core request ----------------
  private async request<T>(path: string, o: RequestOpts = {}): Promise<T> {
    const { method = "GET", body, query, auth = true } = o;
    const url = new URL(this.opts.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = await this.opts.getToken?.();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const deviceId = await this.opts.getDeviceId?.();
      if (deviceId) headers["X-Orbis-Device-Id"] = deviceId;
    }

    const fetchFn = this.opts.fetchFn ?? globalThis.fetch;
    let res: Response;
    try {
      res = await fetchFn(url.toString(), {
        method,
        headers,
        body: body === undefined ? null : JSON.stringify(body),
      });
    } catch (cause) {
      throw new NetworkError(`Network request failed: ${method} ${path}`, cause);
    }

    if (!res.ok) {
      let code = `HTTP_${res.status}`;
      let message = res.statusText;
      try {
        const payload = (await res.json()) as { error?: { code?: string; message?: string } };
        code = payload.error?.code ?? code;
        message = payload.error?.message ?? message;
      } catch {
        /* non-JSON error body */
      }
      const err = new ApiError(res.status, code, message);
      if (err.isWalletWiped) this.opts.onWalletWiped?.();
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---------------- auth (live) ----------------
  readonly auth = {
    register: (email: string, password: string) =>
      this.request<AuthSession>("/api/auth/register", {
        method: "POST",
        body: { email, password },
        auth: false,
      }),
    login: (email: string, password: string) =>
      this.request<AuthSession>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      }),
    me: () => this.request<AuthUser>("/api/auth/me"),
    changePassword: (currentPassword: string, newPassword: string) =>
      this.request<{ ok: boolean }>("/api/auth/password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      }),
    linkDid: (did: string) =>
      this.request<{ ok: boolean }>("/api/auth/did", { method: "PUT", body: { did } }),
    // planned (02-API-SPEC §5)
    oauthExchange: (provider: OAuthProvider, idToken: string, nonce: string) =>
      this.request<AuthSession>("/api/auth/oauth/exchange", {
        method: "POST",
        body: { provider, idToken, nonce },
        auth: false,
      }),
    refresh: (refreshToken: string) =>
      this.request<AuthSession>("/api/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      }),
  };

  // ---------------- did (live) ----------------
  readonly did = {
    create: (body: { method: "key" | "web"; [k: string]: unknown }) =>
      this.request<DidRecord>("/api/did/create", { method: "POST", body }),
    resolve: (did: string) =>
      this.request<Record<string, unknown>>(`/api/did/resolve/${encodeURIComponent(did)}`),
    list: () => this.request<{ dids: DidRecord[] } | DidRecord[]>("/api/did/list"),
    revoke: (id: string) =>
      this.request<{ ok: boolean }>(`/api/did/${encodeURIComponent(id)}/revoke`, { method: "PUT" }),
  };

  // ---------------- vc (live) ----------------
  readonly vc = {
    issue: (body: Record<string, unknown>) =>
      this.request<VerifiableCredential>("/api/vc/issue", { method: "POST", body }),
    verify: (credential: VerifiableCredential) =>
      this.request<VerifyResult>("/api/vc/verify", { method: "POST", body: { credential } }),
    list: () =>
      this.request<{ credentials: VerifiableCredential[] } | VerifiableCredential[]>(
        "/api/vc/credentials",
      ),
    zkChallenge: () =>
      this.request<{ challenge: string; [k: string]: unknown }>("/api/vc/zk/challenge", {
        method: "POST",
      }),
    zkProve: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("/api/vc/zk/prove", { method: "POST", body }),
    zkVerify: (body: Record<string, unknown>) =>
      this.request<VerifyResult>("/api/vc/zk/verify", { method: "POST", body }),
  };

  // ---------------- trust (live) ----------------
  readonly trust = {
    check: (did: string) => this.request<TrustCheck>(`/api/trust/check/${encodeURIComponent(did)}`),
    issuers: () => this.request<unknown>("/api/trust/issuers"),
  };

  // ---------------- didcomm (live) ----------------
  readonly didcomm = {
    send: (body: Record<string, unknown>) =>
      this.request<DidcommMessage>("/api/didcomm/send", { method: "POST", body }),
    inbox: (params: { did: string; status?: string }) =>
      this.request<{ messages: DidcommMessage[] } | DidcommMessage[]>("/api/didcomm/inbox", {
        query: params,
      }),
    message: (id: string) =>
      this.request<DidcommMessage>(`/api/didcomm/messages/${encodeURIComponent(id)}`),
    updateStatus: (id: string, status: string) =>
      this.request<DidcommMessage>(`/api/didcomm/messages/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        body: { status },
      }),
    trustPing: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("/api/didcomm/trust-ping", { method: "POST", body }),
    oobCreate: (body: Record<string, unknown>) =>
      this.request<OobInvitation>("/api/didcomm/oob/create", { method: "POST", body }),
    oobParse: (url: string) =>
      this.request<OobInvitation>("/api/didcomm/oob/parse", { query: { url } }),
  };

  // ---------------- wallet (planned — 02-API-SPEC) ----------------
  readonly wallet = {
    register: (body: WalletRegisterRequest) =>
      this.request<WalletRegistration>("/api/wallet/register", { method: "POST", body }),
    status: () => this.request<WalletStatus>("/api/wallet/status"),
    deleteDevice: (deviceId: string) =>
      this.request<void>(`/api/wallet/device/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      }),
    setPushToken: (pushToken: string) =>
      this.request<void>("/api/wallet/push-token", { method: "PUT", body: { pushToken } }),

    backupCredentials: (items: BackupItem[]) =>
      this.request<{ results: unknown[] }>("/api/wallet/credentials/backup", {
        method: "POST",
        body: { items },
      }),
    listBackups: (includeCiphertext = false) =>
      this.request<{ items: BackupItem[] }>("/api/wallet/credentials/backup", {
        query: includeCiphertext ? { include: "ciphertext" } : undefined,
      }),
    deleteBackup: (localId: string) =>
      this.request<void>(`/api/wallet/credentials/backup/${encodeURIComponent(localId)}`, {
        method: "DELETE",
      }),

    storeData: (body: VaultStoreRequest) =>
      this.request<VaultRecordMeta>("/api/wallet/data/store", { method: "POST", body }),
    listData: (category: VaultCategory, cursor?: string) =>
      this.request<{ items: VaultRecordMeta[]; nextCursor?: string }>(
        `/api/wallet/data/${category}`,
        { query: cursor ? { cursor } : undefined },
      ),
    getRecord: (recordId: string, includeCiphertext = true) =>
      this.request<VaultRecordMeta>(`/api/wallet/data/record/${encodeURIComponent(recordId)}`, {
        query: includeCiphertext ? { include: "ciphertext" } : undefined,
      }),
    deleteRecord: (recordId: string) =>
      this.request<void>(`/api/wallet/data/record/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      }),

    createGrant: (body: ShareGrantRequest) =>
      this.request<ShareGrant>("/api/wallet/data/share", { method: "POST", body }),
    redeemGrant: (grantId: string) =>
      this.request<VaultRecordMeta & { encryptedKey: string }>(
        `/api/wallet/share/${encodeURIComponent(grantId)}`,
      ),
    listGrants: (recordId?: string) =>
      this.request<{ grants: ShareGrant[] }>("/api/wallet/data/grants", {
        query: recordId ? { recordId } : undefined,
      }),
    revokeGrant: (grantId: string) =>
      this.request<void>(`/api/wallet/data/grants/${encodeURIComponent(grantId)}`, {
        method: "DELETE",
      }),
  };

  // ---------------- misc ----------------
  health = () => this.request<{ status: string; [k: string]: unknown }>("/api/health", { auth: false });
}
