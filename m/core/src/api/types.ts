/** Request/response types for the ORBIS API. Live endpoints per src/index.ts; wallet endpoints per wallet-specs/02-API-SPEC.md. */
import { z } from "zod";

// ---------- auth ----------
export interface AuthUser {
  id: string;
  email: string;
  isNew?: boolean;
}
export interface AuthSession {
  token: string;
  refreshToken?: string;
  user: AuthUser;
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

// ---------- wallet (planned — 02-API-SPEC) ----------
export const WalletPlatform = z.enum(["ios", "android", "web"]);
export type WalletPlatform = z.infer<typeof WalletPlatform>;

export const WalletRegisterRequest = z.object({
  deviceName: z.string().min(1).max(80),
  platform: WalletPlatform,
  pushToken: z.string().nullable(),
});
export type WalletRegisterRequest = z.infer<typeof WalletRegisterRequest>;

export interface WalletRegistration {
  walletId: string;
  deviceId: string;
  createdAt: string;
}
export interface WalletStatus {
  walletId: string;
  wiped: boolean;
  deviceCount: number;
  quotaUsedBytes: number;
}

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

export interface VaultRecordMeta {
  recordId: string;
  meta: { title: string; type: string };
  size: number;
  updatedAt: string;
  consent: "private" | "shared" | "monetizable";
  grantCount?: number;
  ciphertext?: string;
  iv?: string;
}

export const ShareGrantRequest = z.object({
  recordId: z.string().uuid(),
  granteeDid: z.string().startsWith("did:"),
  scope: z.enum(["full", "meta-only"]),
  expiresAt: z.string().datetime(),
  price: z.object({ amount: z.number().int().min(0), currency: z.string().length(3) }),
  encryptedKey: z.string().min(1),
});
export type ShareGrantRequest = z.infer<typeof ShareGrantRequest>;

export interface ShareGrant {
  grantId: string;
  recordId?: string;
  granteeDid?: string;
  scope?: string;
  expiresAt?: string;
  revoked?: boolean;
  shareUrl?: string;
  accessCount?: number;
}

export interface BackupItem {
  localId: string;
  category: VaultCategory;
  ciphertext?: string;
  iv?: string;
  alg?: "A256GCM";
  size?: number;
  updatedAt?: string;
}
