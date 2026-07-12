/**
 * Request/response types for the ORBIS API.
 * Verified against the live backend (orbis-repo src/index.ts, src/security/jwt.ts,
 * src/wallet/routes.ts). Server envelopes are `{ success: true, ... }` on success and
 * `{ error: true, code?, message }` on failure. Row objects come back snake_case
 * straight from SQLite — types below mirror that faithfully rather than pretending.
 */
import { z } from "zod";

// ---------- common ----------
/** Standard mutation acknowledgement: { success: true, message } */
export interface OkResponse {
  success: boolean;
  message?: string;
}

// ---------- auth (live: src/security/jwt.ts) ----------
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  did: string | null;
  verified: boolean;
  admin: boolean;
  created_at?: string;
}
export interface AuthSession {
  success: boolean;
  token: string;
  user: AuthUser;
  /** Planned (02-API-SPEC §5) — not returned by the live server yet. */
  refreshToken?: string;
}
export type OAuthProvider = "google" | "apple" | "microsoft";

// ---------- did ----------
export interface DidRecord {
  did: string;
  method: "key" | "web";
  status?: string;
  createdAt?: string;
  [k: string]: unknown;
}

// ---------- vc ----------
export interface VerifiableCredential {
  "@context": unknown[];
  id?: string;
  type: string[];
  issuer: string | { id: string };
  credentialSubject: Record<string, unknown>;
  validFrom?: string;
  validUntil?: string;
  proof?: Record<string, unknown>;
  [k: string]: unknown;
}
export interface VerifyResult {
  verified: boolean;
  checks?: unknown[];
  errors?: unknown[];
  [k: string]: unknown;
}

// ---------- trust ----------
export interface TrustCheck {
  did: string;
  trusted: boolean;
  status?: "active" | "suspended" | "unknown" | string;
  [k: string]: unknown;
}

// ---------- didcomm ----------
export interface DidcommMessage {
  id: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  [k: string]: unknown;
}
export interface OobInvitation {
  id: string;
  url?: string;
  invitation?: Record<string, unknown>;
  [k: string]: unknown;
}

// ---------- wallet lifecycle (live: src/wallet/routes.ts §1) ----------
export const WalletPlatform = z.enum(["ios", "android", "web"]);
export type WalletPlatform = z.infer<typeof WalletPlatform>;

export const WalletRegisterRequest = z.object({
  deviceName: z.string().min(1).max(80),
  platform: WalletPlatform,
  pushToken: z.string().nullable(),
});
export type WalletRegisterRequest = z.infer<typeof WalletRegisterRequest>;

export interface WalletRegistration {
  success: boolean;
  walletId: string;
  deviceId: string;
  createdAt: string;
}
export interface WalletStatus {
  success: boolean;
  walletId: string | null;
  wiped: boolean;
  deviceCount: number;
  quotaUsedBytes: number;
  quotaLimitBytes: number;
}

// ---------- vault (live: src/wallet/routes.ts §2–3) ----------
export const VaultCategory = z.enum([
  "identity",
  "medical",
  "financial",
  "assets",
  "documents",
  "education",
  "membership",
]);
export type VaultCategory = z.infer<typeof VaultCategory>;

export const EncryptedPayload = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  alg: z.literal("A256GCM"),
});
export type EncryptedPayload = z.infer<typeof EncryptedPayload>;

export const VaultStoreRequest = z.object({
  recordId: z.string().uuid(),
  category: VaultCategory,
  meta: z.object({ title: z.string().max(120), type: z.string().max(60) }),
  ciphertext: z.string(),
  iv: z.string(),
  alg: z.literal("A256GCM"),
});
export type VaultStoreRequest = z.infer<typeof VaultStoreRequest>;

export interface VaultStoreResult {
  success: boolean;
  recordId: string;
  size: number;
  updatedAt: string;
}

/** Vault list row as returned by GET /api/wallet/data/:category (snake_case, meta as JSON string). */
export interface VaultRecordRow {
  record_id: string;
  /** JSON string — parse with parseVaultMeta(). */
  meta_json: string;
  size: number;
  consent: "private" | "shared" | "monetizable" | string;
  updated_at: string;
  grantCount?: number;
  // present only with ?include=ciphertext
  ciphertext?: string;
  iv?: string;
  alg?: string;
  category?: string;
  user_id?: string;
}

export interface VaultListResult {
  success: boolean;
  items: VaultRecordRow[];
  nextCursor: string | null;
}

export interface VaultRecordResult {
  success: boolean;
  record: VaultRecordRow;
}

/** Safe helper for the meta_json column. */
export function parseVaultMeta(row: Pick<VaultRecordRow, "meta_json">): {
  title?: string;
  type?: string;
  [k: string]: unknown;
} {
  try {
    return JSON.parse(row.meta_json || "{}");
  } catch {
    return {};
  }
}

// ---------- backup (live: src/wallet/routes.ts §2) ----------
export interface BackupItem {
  localId: string;
  category: VaultCategory;
  ciphertext: string;
  iv: string;
  alg?: "A256GCM";
}
/** Backup list row (snake_case). Ciphertext/iv present only with ?include=ciphertext. */
export interface BackupItemRow {
  local_id: string;
  category: string;
  size: number;
  updated_at: string;
  ciphertext?: string;
  iv?: string;
  alg?: string;
  user_id?: string;
}
export interface BackupResult {
  success: boolean;
  results: Array<{ localId: string; status: "created" | "error"; size?: number; message?: string }>;
}
export interface BackupListResult {
  success: boolean;
  count: number;
  items: BackupItemRow[];
}

// ---------- sharing grants / consent ledger (live: src/wallet/routes.ts §4) ----------
export const ShareGrantRequest = z.object({
  recordId: z.string().uuid(),
  granteeDid: z.string().startsWith("did:"),
  scope: z.enum(["full", "meta-only"]),
  /** ISO datetime; server enforces ≤ 90 days out. */
  expiresAt: z.string().datetime(),
  price: z.object({ amount: z.number().int().min(0), currency: z.string().length(3) }).optional(),
  /** Record key sealed to the grantee's X25519 key (ECDH-ES) — server never sees plaintext keys. */
  encryptedKey: z.string().min(1),
});
export type ShareGrantRequest = z.infer<typeof ShareGrantRequest>;

export interface ShareGrantCreated {
  success: boolean;
  grantId: string;
  shareUrl: string;
}

/** Grant row as returned by GET /api/wallet/data/grants (snake_case). */
export interface GrantRow {
  grant_id: string;
  record_id: string;
  owner_user_id: string;
  grantee_did: string;
  scope: "full" | "meta-only" | string;
  price_amount: number;
  price_currency: string;
  expires_at: string;
  revoked: number;
  created_at?: string;
  access_count?: number;
  accessLog?: Array<{ accessed_by_did: string; accessed_at: string }>;
}
export interface GrantListResult {
  success: boolean;
  count: number;
  grants: GrantRow[];
}

/** GET /api/wallet/share/:grantId — grantee redemption payload. */
export interface GrantRedemption {
  success: boolean;
  meta: Record<string, unknown>;
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  scope: string;
  expiresAt: string;
  price: { amount: number; currency: string };
}

// ---------- didcomm push (live: src/wallet/routes.ts §5) ----------
export interface MessagesWaiting {
  success: boolean;
  waiting: boolean;
  unreadCount: number;
  didLinked: boolean;
  lastMessageAt?: string | null;
  pushHint?: { type: string; count: number } | null;
}

// ---------- wallet admin (live: src/wallet/routes.ts §6; requires admin JWT) ----------
export interface WalletAdminUserRow {
  id: string;
  user_id: string;
  wallet_id: string;
  device_name: string | null;
  platform: string | null;
  wiped: number;
  created_at: string;
  last_seen_at: string | null;
  vault_count: number;
  grant_count: number;
}
export interface WalletAdminUsersResult {
  success: boolean;
  count: number;
  users: WalletAdminUserRow[];
}
export interface WalletAdminCredentialsResult {
  success: boolean;
  count: number;
  items: Array<Pick<BackupItemRow, "local_id" | "user_id" | "category" | "size" | "updated_at">>;
}
