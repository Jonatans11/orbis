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

export interface AuditLogEntry {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  result: "success" | "failure";
  message: string | null;
  ip_address: string | null;
  timestamp: string;
}

export interface StatusListRecord {
  id: string;
  name: string;
  issuer_did: string;
  status_purpose: "revocation" | "suspension";
  encoded_list: string;
  created_at: string;
  updated_at: string;
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

  status: {
    create: (body: { name: string; issuerDid: string; statusPurpose?: "revocation" | "suspension"; numBits?: number }) =>
      post<{ success: boolean; statusList: StatusListRecord }>("/api/status/create", body),
    get: (listId: string) =>
      get<{ success: boolean; statusList: StatusListRecord }>(`/api/status/list/${encodeURIComponent(listId)}`),
    update: (body: { listId: string; index: number; status: boolean }) =>
      post<{ success: boolean; statusList: StatusListRecord }>("/api/status/update", body),
    check: (listId: string, index: number) =>
      get<{ success: boolean; listId: string; index: number; status: boolean }>(`/api/status/check/${encodeURIComponent(listId)}/${index}`),
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
    listAuditLogs: (apiKey?: string) => {
      // Intelligently fallback to localStorage saved dev keys if none passed
      const key = apiKey || localStorage.getItem("orb_dev_key") || "orb_admin_stub";
      return request<{ success: boolean; count: number; total: number; logs: AuditLogEntry[] }>("/api/gateway/audit", {
        headers: { Authorization: `Bearer ${key}` },
      });
    }
  },
};
