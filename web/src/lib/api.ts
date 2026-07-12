/**
 * Typed API client for the ORBIS.ID SSI backend.
 * All calls go through the Vite dev proxy (`/api` → backend :3001).
 */

export interface ApiError {
  error: true;
  message: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ApiError).message || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Like request() but adds an optional JWT Bearer token. */
async function requestWithToken<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return request<T>(path, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const put = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Health {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export interface DIDRecord {
  id: string;
  did: string;
  method: "key" | "web";
  status: "active" | "revoked" | "deactivated";
  created_at: string;
}

export interface DIDCreateResult {
  success: boolean;
  did: string;
  method: string;
  verificationMethodId: string;
  didDocument: Record<string, unknown>;
  _debug?: { publicKey: string };
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface CredentialRecord {
  credential_id: string;
  issuer_did: string;
  subject_did: string;
  type: string;
  status: string;
  issuance_date: string;
}

export interface TrustEntry {
  id: string;
  did: string;
  name: string;
  category: "issuer" | "verifier" | "both";
  authorizedCredentialTypes: string[];
  status: "active" | "suspended" | "revoked";
  addedBy: string | null;
  addedAt: string;
  updatedAt: string;
}

export interface DIDCommMessage {
  id: string;
  msg_type: string;
  from_did: string;
  to_did: string;
  body: Record<string, unknown>;
  status: "sent" | "delivered" | "read";
  thread_id: string | null;
  created_at: string;
}

export interface UsageStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgResponseTimeMs: number;
  byEndpoint: Record<string, number>;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
}

export interface WebhookInfo {
  id: string;
  url: string;
  events: string;
  active: number;
  created_at: string;
}

// ─── Auth & User Types ───────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  did: string | null;
  verified: boolean;
  admin: boolean;
  created_at?: string;
}

export interface LoginResult {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface MeResult {
  success: boolean;
  user: AuthUser & { created_at: string };
}

// ─── Admin Types ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  did: string | null;
  admin: boolean;
  status: string;
  display_name: string;
  verified: boolean;
  created_at: string;
}

export interface AdminAuditEntry {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  result: string;
  message: string;
  ip_address: string;
  timestamp: string;
}

export interface SystemStats {
  users: { total: number; active: number; suspended: number; admins: number };
  dids: { total: number; did_key: number; did_web: number };
  credentials: { total: number; active: number; revoked: number };
  trust_registry: { total_entries: number };
  audit_log: { total_entries: number };
  messages: { total: number };
  api_keys: { total: number };
}

export interface AdminCredential {
  id: string;
  credential_id: string;
  issuer_did: string;
  subject_did: string;
  type: string;
  status: string;
  schema_url: string;
  issuance_date: string;
  expiration_date: string;
  proof_type: string;
  created_at: string;
}

export interface AdminDID {
  id: string;
  did: string;
  method: string;
  status: string;
  verification_method_id: string;
  created_at: string;
  updated_at: string;
}

export interface AdminApiKey {
  id: string;
  name: string;
  email: string;
  scopes: string[];
  status: string;
  member_id: string | null;
  total_requests: number;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

// ─── API surface ─────────────────────────────────────────────────────────────

export const api = {
  health: () => get<Health>("/api/health"),

  did: {
    create: (body: { method: "key" | "web"; domain?: string; path?: string }) =>
      post<DIDCreateResult>("/api/did/create", body),
    resolve: (did: string) =>
      get<{ success: boolean; did: string; didDocument: Record<string, unknown>; record: { id: string; status: string; created_at: string } | null }>(
        `/api/did/resolve/${encodeURIComponent(did)}`
      ),
    list: (method?: string) =>
      get<{ success: boolean; count: number; dids: DIDRecord[] }>(
        `/api/did/list${method ? `?method=${method}` : ""}`
      ),
    revoke: (id: string) => put<{ success: boolean }>(`/api/did/${id}/revoke`),
  },

  vc: {
    issue: (body: Record<string, unknown>) =>
      post<{ success: boolean; credentialId: string; credential: Record<string, unknown> }>(
        "/api/vc/issue",
        body
      ),
    verify: (body: Record<string, unknown>) =>
      post<{ success: boolean; verified: boolean; checks: VerificationCheck[]; credentialId?: string; issuerDID?: string; subjectDID?: string }>(
        "/api/vc/verify",
        body
      ),
    list: (issuer?: string) =>
      get<{ success: boolean; count: number; credentials: CredentialRecord[] }>(
        `/api/vc/credentials${issuer ? `?issuer=${encodeURIComponent(issuer)}` : ""}`
      ),
    verifications: (credentialId: string) =>
      get<{ success: boolean; count: number; verifications: { verified: boolean; reason: string; timestamp: string }[] }>(
        `/api/vc/credentials/${encodeURIComponent(credentialId)}/verifications`
      ),
    zkProve: (body: Record<string, unknown>) =>
      post<{ success: boolean; proofId: string; proof: Record<string, unknown> }>(
        "/api/vc/zk/prove",
        body
      ),
    zkVerify: (body: Record<string, unknown>) =>
      post<{ success: boolean; verified: boolean; checks: VerificationCheck[] }>(
        "/api/vc/zk/verify",
        body
      ),
    zkChallenge: () =>
      post<{ success: boolean; challenge: string; expiresIn: number }>("/api/vc/zk/challenge", {}),
  },

  trust: {
    register: (body: { did: string; name: string; category?: string; authorizedCredentialTypes?: string[]; addedBy?: string }) =>
      post<{ success: boolean; entry: TrustEntry }>("/api/trust/register", body),
    issuers: () => get<{ success: boolean; count: number; issuers: TrustEntry[] }>("/api/trust/issuers"),
    entities: (category?: string) =>
      get<{ success: boolean; count: number; entities: TrustEntry[] }>(
        `/api/trust/entities${category ? `?category=${category}` : ""}`
      ),
    check: (did: string) =>
      get<{ success: boolean; did: string; trusted: boolean; entry: TrustEntry | null }>(
        `/api/trust/check/${encodeURIComponent(did)}`
      ),
    suspend: (id: string) => put<{ success: boolean }>(`/api/trust/${id}/suspend`),
    reactivate: (id: string) => put<{ success: boolean }>(`/api/trust/${id}/reactivate`),
    remove: (id: string) => del<{ success: boolean }>(`/api/trust/${id}`),
  },

  didcomm: {
    send: (body: Record<string, unknown>) =>
      post<{ success: boolean; messageId: string }>("/api/didcomm/send", body),
    inbox: (did: string, status?: string) =>
      get<{ success: boolean; count: number; messages: DIDCommMessage[] }>(
        `/api/didcomm/inbox?did=${encodeURIComponent(did)}${status ? `&status=${status}` : ""}`
      ),
    trustPing: (body: Record<string, unknown>) =>
      post<{ success: boolean; messageId: string; status: string }>("/api/didcomm/trust-ping", body),
    oobCreate: (body: Record<string, unknown>) =>
      post<{ success: boolean; invitationId: string; invitationUrl: string }>(
        "/api/didcomm/oob/create",
        body
      ),
    oobParse: (url: string) =>
      get<{ success: boolean; invitation: Record<string, unknown> }>(
        `/api/didcomm/oob/parse?url=${encodeURIComponent(url)}`
      ),
  },

  gateway: {
    register: (body: { name: string; email: string }) =>
      post<{
        success: boolean;
        message: string;
        key: { id: string; name: string; scopes: string[]; created_at: string };
        raw_key: string;
      }>("/api/developer/register", body),
    scopes: () => get<{ success: boolean; scopes: string[] }>("/api/gateway/scopes"),
    keys: (apiKey: string) =>
      request<{ success: boolean; count: number; keys: ApiKeyInfo[] }>("/api/gateway/keys", {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    revokeKey: (apiKey: string, id: string) =>
      request<{ success: boolean }>(`/api/gateway/keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    stats: (apiKey: string) =>
      request<{
        success: boolean;
        since: string;
        usage: UsageStats;
        rate_limit: Record<string, unknown> | null;
        webhooks: { count: number; registered: { id: string; url: string; events: string; active: number; created_at: string }[] };
      }>("/api/gateway/stats", {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    webhooks: {
      list: (apiKey: string) =>
        request<{ success: boolean; count: number; webhooks: WebhookInfo[] }>("/api/gateway/webhooks", {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      create: (apiKey: string, body: { url: string; events: string[] }) =>
        request<{ success: boolean; webhook: WebhookInfo }>("/api/gateway/webhooks", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      remove: (apiKey: string, id: string) =>
        request<{ success: boolean }>(`/api/gateway/webhooks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
    },
  },

  // ─── Auth ──────────────────────────────────────────────────────────────────

  auth: {
    /** POST /api/auth/register — create a new user account. */
    register: (body: { email: string; password: string; displayName: string }) =>
      post<LoginResult>("/api/auth/register", body),

    /** POST /api/auth/login — authenticate and receive a JWT token. */
    login: (body: { email: string; password: string }) =>
      post<LoginResult>("/api/auth/login", body),

    /** GET /api/auth/me — get current user profile (requires JWT). */
    me: (token?: string) =>
      requestWithToken<MeResult>("/api/auth/me", token),

    /** PUT /api/auth/password — change password (requires JWT). */
    changePassword: (body: { currentPassword: string; newPassword: string }, token?: string) =>
      requestWithToken<{ success: boolean; message: string }>(
        "/api/auth/password", token,
        { method: "PUT", body: JSON.stringify(body) }
      ),

    /** PUT /api/auth/did — link a DID to the user account (requires JWT). */
    linkDID: (body: { did: string }, token?: string) =>
      requestWithToken<{ success: boolean; message: string }>(
        "/api/auth/did", token,
        { method: "PUT", body: JSON.stringify(body) }
      ),
  },

  // ─── Admin ─────────────────────────────────────────────────────────────────

  admin: {
    /** GET /api/admin/users — list all registered users. */
    users: (token?: string) =>
      requestWithToken<{ success: boolean; count: number; users: AdminUser[] }>(
        "/api/admin/users", token
      ),

    /** PUT /api/admin/users/:id/suspend — suspend a user. */
    suspendUser: (userId: string, token?: string) =>
      requestWithToken<{ success: boolean; message: string }>(
        `/api/admin/users/${userId}/suspend`, token,
        { method: "PUT" }
      ),

    /** PUT /api/admin/users/:id/activate — reactivate a user. */
    activateUser: (userId: string, token?: string) =>
      requestWithToken<{ success: boolean; message: string }>(
        `/api/admin/users/${userId}/activate`, token,
        { method: "PUT" }
      ),

    /** GET /api/admin/audit-log — view audit logs. */
    auditLog: (params: { limit?: number; offset?: number; actor_id?: string } = {}, token?: string) =>
      requestWithToken<{
        success: boolean; count: number; total: number; limit: number; offset: number;
        entries: AdminAuditEntry[];
      }>(
        `/api/admin/audit-log?limit=${params.limit || 100}&offset=${params.offset || 0}${params.actor_id ? `&actor_id=${encodeURIComponent(params.actor_id)}` : ""}`,
        token
      ),

    /** GET /api/admin/system/stats — aggregated system statistics. */
    stats: (token?: string) =>
      requestWithToken<{ success: boolean; stats: SystemStats }>(
        "/api/admin/system/stats", token
      ),

    /** GET /api/admin/credentials — view all credentials. */
    credentials: (params: { limit?: number; offset?: number } = {}, token?: string) =>
      requestWithToken<{
        success: boolean; count: number; total: number; limit: number; offset: number;
        credentials: AdminCredential[];
      }>(
        `/api/admin/credentials?limit=${params.limit || 50}&offset=${params.offset || 0}`,
        token
      ),

    /** GET /api/admin/dids — view all DIDs. */
    dids: (params: { limit?: number; offset?: number } = {}, token?: string) =>
      requestWithToken<{
        success: boolean; count: number; total: number; limit: number; offset: number;
        dids: AdminDID[];
      }>(
        `/api/admin/dids?limit=${params.limit || 50}&offset=${params.offset || 0}`,
        token
      ),

    /** GET /api/admin/api-keys — view all API keys. */
    apiKeys: (token?: string) =>
      requestWithToken<{ success: boolean; count: number; keys: AdminApiKey[] }>(
        "/api/admin/api-keys", token
      ),

    /** GET /api/admin/health/detailed — detailed health check. */
    detailedHealth: (token?: string) =>
      requestWithToken<{
        success: boolean; status: string; version: string; service: string;
        timestamp: string; checks: Record<string, unknown>;
      }>("/api/admin/health/detailed", token),
  },
};