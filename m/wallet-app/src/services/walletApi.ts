/**
 * Typed client for the ORBIS wallet API (/api/wallet/*) — vault records,
 * sharing grants (consent ledger), and quota. Shapes mirror
 * orbis-repo/src/wallet/routes.ts exactly.
 */
import { request } from '@/services/api';

// ---------------------------------------------------------------------------
// Types (server row shapes — snake_case comes straight from SQLite)
// ---------------------------------------------------------------------------

export type VaultCategoryId =
  | 'medical'
  | 'financial'
  | 'assets'
  | 'documents'
  | 'identity';

export const VAULT_CATEGORIES: VaultCategoryId[] = [
  'medical',
  'financial',
  'assets',
  'documents',
  'identity',
];

export type GrantScope = 'full' | 'meta-only';

/** Plaintext metadata — the ONLY plaintext the server ever sees (title ≤120 + type). */
export interface VaultRecordMeta {
  title: string;
  type: string;
}

export interface WalletStatus {
  success: boolean;
  walletId: string | null;
  wiped: boolean;
  deviceCount: number;
  quotaUsedBytes: number;
  quotaLimitBytes: number;
}

export interface VaultListItem {
  record_id: string;
  meta_json: string;
  size: number;
  consent: string | null;
  updated_at: string;
  grantCount: number;
}

export interface VaultRecordRow {
  record_id: string;
  user_id?: string;
  category: string;
  meta_json: string;
  size: number;
  consent: string | null;
  updated_at: string;
  ciphertext?: string;
  iv?: string;
  alg?: string;
}

export interface GrantAccessLogEntry {
  accessed_by_did: string;
  accessed_at: string;
}

export interface Grant {
  grant_id: string;
  record_id: string;
  owner_user_id: string;
  grantee_did: string;
  scope: GrantScope;
  encrypted_key?: string;
  price_amount: number;
  price_currency: string;
  expires_at: string;
  revoked: number;
  created_at: string;
  access_count: number;
  accessLog: GrantAccessLogEntry[];
}

export interface ShareRedemption {
  success: boolean;
  meta: Partial<VaultRecordMeta>;
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  scope: GrantScope;
  expiresAt: string;
  price: { amount: number; currency: string };
}

export interface TrustCheck {
  success: boolean;
  did: string;
  trusted: boolean;
  entry: { name?: string; status?: string } | null;
}

export const MAX_BLOB_BYTES = 512 * 1024;
export const QUOTA_LIMIT_BYTES = 50 * 1024 * 1024;
export const MAX_GRANT_DAYS = 90;

/** Parse `meta_json` defensively — server stores whatever JSON the client sent. */
export function parseMeta(metaJson: string | null | undefined): VaultRecordMeta {
  try {
    const parsed = JSON.parse(metaJson ?? '{}') as Partial<VaultRecordMeta>;
    return { title: parsed.title ?? 'Untitled', type: parsed.type ?? 'record' };
  } catch {
    return { title: 'Untitled', type: 'record' };
  }
}

export function isGrantActive(grant: Grant, now: Date = new Date()): boolean {
  return grant.revoked !== 1 && new Date(grant.expires_at).getTime() > now.getTime();
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const walletApi = {
  status: () => request<WalletStatus>('GET', '/api/wallet/status'),

  listRecords: (category: VaultCategoryId, cursor?: string, limit = 20) =>
    request<{ success: boolean; items: VaultListItem[]; nextCursor: string | null }>(
      'GET',
      `/api/wallet/data/${category}?limit=${limit}${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`,
    ),

  storeRecord: (body: {
    recordId: string;
    category: VaultCategoryId;
    meta: VaultRecordMeta;
    ciphertext: string;
    iv: string;
    alg: string;
  }) =>
    request<{ success: boolean; recordId: string; size: number; updatedAt: string }>(
      'POST',
      '/api/wallet/data/store',
      body,
    ),

  getRecord: (recordId: string, includeCiphertext = false) =>
    request<{ success: boolean; record: VaultRecordRow }>(
      'GET',
      `/api/wallet/data/record/${encodeURIComponent(recordId)}${
        includeCiphertext ? '?include=ciphertext' : ''
      }`,
    ),

  deleteRecord: (recordId: string) =>
    request<{ success: boolean }>(
      'DELETE',
      `/api/wallet/data/record/${encodeURIComponent(recordId)}`,
    ),

  /**
   * List grants (whole consent ledger, or one record's with `recordId`).
   * Defensive: tolerates a missing `grants` field (see route-order note in PR).
   */
  listGrants: async (recordId?: string): Promise<Grant[]> => {
    const res = await request<{ success: boolean; grants?: Grant[] }>(
      'GET',
      `/api/wallet/data/grants${recordId ? `?recordId=${encodeURIComponent(recordId)}` : ''}`,
    );
    return res.grants ?? [];
  },

  createGrant: (body: {
    recordId: string;
    granteeDid: string;
    scope: GrantScope;
    expiresAt: string;
    price?: { amount: number; currency: string };
    encryptedKey: string;
  }) =>
    request<{ success: boolean; grantId: string; shareUrl: string }>(
      'POST',
      '/api/wallet/data/share',
      body,
    ),

  revokeGrant: (grantId: string) =>
    request<{ success: boolean }>(
      'DELETE',
      `/api/wallet/data/grants/${encodeURIComponent(grantId)}`,
    ),

  /** Grantee-side redemption. Throws ApiError with code GRANT_EXPIRED / GRANT_REVOKED / DEVICE_MISMATCH. */
  redeemShare: (grantId: string) =>
    request<ShareRedemption>('GET', `/api/wallet/share/${encodeURIComponent(grantId)}`),

  trustCheck: (did: string) =>
    request<TrustCheck>('GET', `/api/trust/check/${encodeURIComponent(did)}`),
};

// ---------------------------------------------------------------------------
// Record title cache — grants reference records by id only; screens showing
// grant rows (Vault home, All shares, Compensation) need titles without N+1
// refetching on every render.
// ---------------------------------------------------------------------------

const titleCache = new Map<string, VaultRecordMeta>();

export async function getRecordMetas(
  recordIds: string[],
): Promise<Map<string, VaultRecordMeta>> {
  const missing = [...new Set(recordIds)].filter((id) => !titleCache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const res = await walletApi.getRecord(id);
        titleCache.set(id, parseMeta(res.record.meta_json));
      } catch {
        // Record deleted or unreachable — fall back to a neutral label.
        titleCache.set(id, { title: 'Deleted record', type: 'record' });
      }
    }),
  );
  const out = new Map<string, VaultRecordMeta>();
  for (const id of recordIds) {
    const meta = titleCache.get(id);
    if (meta) out.set(id, meta);
  }
  return out;
}

export function primeRecordMeta(recordId: string, meta: VaultRecordMeta): void {
  titleCache.set(recordId, meta);
}
