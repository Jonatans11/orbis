/**
 * Typed ORBIS API client, shared by the native app (m/wallet-app) and PWA (m/web).
 *
 * Verified against the live backend:
 * - /api/auth   → src/security/jwt.ts   (register/login/me/change-password/link-did)
 * - /api/did, /api/vc, /api/trust, /api/didcomm → src/index.ts
 * - /api/wallet → src/wallet/routes.ts  (lifecycle, backup, vault, grants, push, admin)
 *
 * Error envelope is flat: { error: true, code?, message } — parseErrorBody() also
 * accepts the nested { error: { code, message } } form for forward compatibility.
 *
 * Planned-only endpoints (02-API-SPEC §5, not on the server yet): auth.oauthExchange,
 * auth.refresh — typed now so app code compiles against the contract.
 */
import { ApiError, NetworkError } from "./errors.js";
import type {
  AuthSession,
  AuthUser,
  BackupItem,
  BackupListResult,
  BackupResult,
  DidRecord,
  DidcommMessage,
  GrantListResult,
  GrantRedemption,
  MessagesWaiting,
  OAuthProvider,
  OkResponse,
  OobInvitation,
  ShareGrantCreated,
  ShareGrantRequest,
  TrustCheck,
  VaultCategory,
  VaultListResult,
  VaultRecordResult,
  VaultStoreRequest,
  VaultStoreResult,
  VerifiableCredential,
  VerifyResult,
  WalletAdminCredentialsResult,
  WalletAdminUsersResult,
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

/** Accepts both the live flat envelope and the nested spec envelope. */
function parseErrorBody(
  payload: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): { code: string; message: string } {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    // nested: { error: { code, message } }
    if (p.error && typeof p.error === "object") {
      const e = p.error as Record<string, unknown>;
      return {
        code: typeof e.code === "string" ? e.code : fallbackCode,
        message: typeof e.message === "string" ? e.message : fallbackMessage,
      };
    }
    // flat (live server): { error: true, code?, message }
    return {
      code: typeof p.code === "string" ? p.code : fallbackCode,
      message: typeof p.message === "string" ? p.message : fallbackMessage,
    };
  }
  return { code: fallbackCode, message: fallbackMessage };
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
    // Retry transient transport failures for idempotent requests only (GET), max 2 retries.
    const maxAttempts = method === "GET" ? 3 : 1;
    let res: Response | null = null;
    let lastCause: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        res = await fetchFn(url.toString(), {
          method,
          headers,
          body: body === undefined ? null : JSON.stringify(body),
        });
        break;
      } catch (cause) {
        lastCause = cause;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250 * attempt));
        }
      }
    }
    if (!res) throw new NetworkError(`Network request failed: ${method} ${path}`, lastCause);

    if (!res.ok) {
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        /* non-JSON error body */
      }
      const { code, message } = parseErrorBody(payload, `HTTP_${res.status}`, res.statusText);
      const err = new ApiError(res.status, code, message);
      if (err.isWalletWiped) this.opts.onWalletWiped?.();
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---------------- auth (live: src/security/jwt.ts) ----------------
  readonly auth = {
    /** POST /api/auth/register — displayName is required by the server. */
    register: (email: string, password: string, displayName: string) =>
      this.request<AuthSession>("/api/auth/register", {
        method: "POST",
        body: { email, password, displayName },
        auth: false,
      }),
    login: (email: string, password: string) =>
      this.request<AuthSession>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      }),
    me: () => this.request<{ success: boolean; user: AuthUser }>("/api/auth/me"),
    changePassword: (currentPassword: string, newPassword: string) =>
      this.request<OkResponse>("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      }),
    linkDid: (did: string) =>
      this.request<OkResponse>("/api/auth/link-did", { method: "POST", body: { did } }),
    // planned (02-API-SPEC §5) — server does not implement these yet
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
      this.request<OkResponse>(`/api/did/${encodeURIComponent(id)}/revoke`, { method: "PUT" }),
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
    /**
     * SECURITY: do NOT call from wallet code with holder secrets — proving must happen
     * on-device (m/core/vc/zk). Server-side prove is a verifier/test utility only.
     */
    zkProve: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("/api/vc/zk/prove", { method: "POST", body }),
    zkVerify: (body: Record<string, unknown>) =>
      this.request<VerifyResult>("/api/vc/zk/verify", { method: "POST", body }),
  };

  // ---------------- trust (live) ----------------
  readonly trust = {
    register: (body: Record<string, unknown>) =>
      this.request<Record<string, unknown>>("/api/trust/register", { method: "POST", body }),
    check: (did: string) => this.request<TrustCheck>(`/api/trust/check/${encodeURIComponent(did)}`),
    issuers: () => this.request<unknown>("/api/trust/issuers"),
    entities: () => this.request<unknown>("/api/trust/entities"),
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
    oobInvitations: () =>
      this.request<{ invitations: OobInvitation[] } | OobInvitation[]>(
        "/api/didcomm/oob/invitations",
      ),
    oobConsume: (id: string) =>
      this.request<OkResponse>(`/api/didcomm/oob/${encodeURIComponent(id)}/consume`, {
        method: "PUT",
      }),
  };

  // ---------------- wallet (live: src/wallet/routes.ts) ----------------
  readonly wallet = {
    // --- lifecycle ---
    register: (body: WalletRegisterRequest) =>
      this.request<WalletRegistration>("/api/wallet/register", { method: "POST", body }),
    /** Poll on app foreground. Throws ApiError(410 WALLET_WIPED) if remotely wiped. */
    status: () => this.request<WalletStatus>("/api/wallet/status"),
    deleteDevice: (deviceId: string) =>
      this.request<OkResponse>(`/api/wallet/device/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      }),
    setPushToken: (pushToken: string) =>
      this.request<OkResponse>("/api/wallet/push-token", { method: "PUT", body: { pushToken } }),

    // --- credential backup (ciphertext only — server never sees plaintext) ---
    backupCredentials: (items: BackupItem[]) =>
      this.request<BackupResult>("/api/wallet/credentials/backup", {
        method: "POST",
        body: { items },
      }),
    listBackups: (includeCiphertext = false) =>
      this.request<BackupListResult>("/api/wallet/credentials/backup", {
        query: includeCiphertext ? { include: "ciphertext" } : undefined,
      }),
    deleteBackup: (localId: string) =>
      this.request<OkResponse>(`/api/wallet/credentials/backup/${encodeURIComponent(localId)}`, {
        method: "DELETE",
      }),

    // --- encrypted data vault ---
    storeData: (body: VaultStoreRequest) =>
      this.request<VaultStoreResult>("/api/wallet/data/store", { method: "POST", body }),
    listData: (category: VaultCategory, opts?: { cursor?: string; limit?: number }) =>
      this.request<VaultListResult>(`/api/wallet/data/${category}`, {
        query: { cursor: opts?.cursor, limit: opts?.limit },
      }),
    getRecord: (recordId: string, includeCiphertext = true) =>
      this.request<VaultRecordResult>(`/api/wallet/data/record/${encodeURIComponent(recordId)}`, {
        query: includeCiphertext ? { include: "ciphertext" } : undefined,
      }),
    deleteRecord: (recordId: string) =>
      this.request<OkResponse>(`/api/wallet/data/record/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      }),

    // --- data sharing grants (consent ledger) ---
    createGrant: (body: ShareGrantRequest) =>
      this.request<ShareGrantCreated>("/api/wallet/data/share", { method: "POST", body }),
    /** Grantee-side redemption. Caller must have the grantee DID linked to their account. */
    redeemGrant: (grantId: string) =>
      this.request<GrantRedemption>(`/api/wallet/share/${encodeURIComponent(grantId)}`),
    listGrants: (recordId?: string) =>
      this.request<GrantListResult>("/api/wallet/data/grants", {
        query: recordId ? { recordId } : undefined,
      }),
    revokeGrant: (grantId: string) =>
      this.request<OkResponse>(`/api/wallet/data/grants/${encodeURIComponent(grantId)}`, {
        method: "DELETE",
      }),

    // --- didcomm push hints ---
    messagesWaiting: () => this.request<MessagesWaiting>("/api/wallet/messages/waiting"),
    /** Acknowledge receipt — marks the given messages 'delivered'. */
    ackMessages: (messageIds?: string[]) =>
      this.request<OkResponse>("/api/wallet/messages/waiting", {
        method: "PUT",
        body: { messageIds },
      }),
  };

  // ---------------- wallet admin (live; requires admin JWT) ----------------
  readonly admin = {
    walletUsers: () => this.request<WalletAdminUsersResult>("/api/wallet/admin/users"),
    walletCredentials: () =>
      this.request<WalletAdminCredentialsResult>("/api/wallet/admin/credentials"),
    remoteWipe: (walletId: string, reason: string) =>
      this.request<OkResponse>(`/api/wallet/admin/remote-wipe/${encodeURIComponent(walletId)}`, {
        method: "DELETE",
        body: { reason },
      }),
  };

  // ---------------- misc ----------------
  health = () =>
    this.request<{ status: string; [k: string]: unknown }>("/api/health", { auth: false });
}
