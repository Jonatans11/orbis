/**
 * Input Validation Module for ORBIS.ID SSI Backend.
 *
 * Uses Zod schemas to validate all API request bodies.
 * Returns 400 with structured validation errors.
 */

import { z } from "zod/v3";
import type { Request, Response, NextFunction } from "express";

// ─── Helper Middleware ──────────────────────────────────────────────────────

type ZodSchema = z.ZodTypeAny;

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On failure, returns 400 with field-level error details.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      res.status(400).json({
        error: true,
        message: "Validation failed",
        validationErrors: errors,
      });
      return;
    }

    // Replace body with parsed (and possibly transformed) data
    req.body = result.data;
    next();
  };
}

// ─── DID Schemas ────────────────────────────────────────────────────────────

export const createDIDSchema = z.object({
  method: z.enum(["key", "web"] as const, {
    message: "method must be 'key' or 'web'",
  }),
  domain: z.string().min(1).optional(),
  path: z.string().optional(),
});

export const resolveDIDSchema = z.object({
  did: z.string().regex(/^did:/, "Invalid DID format"),
});

// ─── VC Schemas ─────────────────────────────────────────────────────────────

export const issueCredentialSchema = z.object({
  issuerDID: z.string().min(1, "issuerDID is required"),
  issuerSecretKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "issuerSecretKey must be a 32-byte hex string (64 chars)"),
  subjectDID: z.string().min(1, "subjectDID is required"),
  claims: z.object({}).passthrough(),
  type: z.array(z.string()).optional(),
  schemaUrl: z.string().url().optional().or(z.literal("")),
  expirationDate: z.string().optional(),
});

export const verifyCredentialSchema = z.object({
  credential: z.any().refine((val) => val != null, {
    message: "credential is required",
  }),
  verifierDID: z.string().optional(),
  checkTrustRegistry: z.boolean().optional(),
  requiredCredentialTypes: z.array(z.string()).optional(),
});

// ─── ZK Proof Schemas ───────────────────────────────────────────────────────

export const createZKProofSchema = z.object({
  credential: z.any().refine((val) => val != null, {
    message: "credential is required",
  }),
  holderDID: z.string().min(1, "holderDID is required"),
  holderSecretKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "holderSecretKey must be a 32-byte hex string (64 chars)"),
  revealFields: z.array(z.string()).optional(),
  hideFields: z.array(z.string()).optional(),
  derivedPredicates: z.array(z.any()).optional(),
  challenge: z.string().optional(),
  domain: z.string().optional(),
});

export const verifyZKProofSchema = z.object({
  proof: z.any().refine((val) => val != null, {
    message: "proof is required",
  }),
  verifierDID: z.string().optional(),
  challenge: z.string().optional(),
  checkTrustRegistry: z.boolean().optional(),
  requiredCredentialTypes: z.array(z.string()).optional(),
});

// ─── Trust Registry Schemas ─────────────────────────────────────────────────

export const registerTrustEntitySchema = z.object({
  did: z.string().min(1, "did is required"),
  name: z.string().min(1, "name is required"),
  category: z.enum(["issuer", "verifier", "both"] as const).optional(),
  authorizedCredentialTypes: z.array(z.string()).optional(),
  addedBy: z.string().optional(),
});

// ─── DIDComm Schemas ────────────────────────────────────────────────────────

export const sendDIDCommMessageSchema = z.object({
  fromDID: z.string().min(1, "fromDID is required"),
  toDID: z.string().min(1, "toDID is required"),
  type: z.string().optional(),
  body: z.object({}).passthrough(),
  threadId: z.string().optional(),
  senderSecretKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "senderSecretKey must be a 32-byte hex string (64 chars)"),
  encryptionType: z.enum(["authcrypt", "anoncrypt"] as const).optional(),
});

export const trustPingSchema = z.object({
  fromDID: z.string().min(1, "fromDID is required"),
  toDID: z.string().min(1, "toDID is required"),
  senderSecretKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "senderSecretKey must be a 32-byte hex string (64 chars)"),
  comment: z.string().optional(),
});

export const createOOBSchema = z.object({
  fromDID: z.string().min(1, "fromDID is required"),
  label: z.string().min(1, "label is required"),
  goal: z.string().optional(),
  goalCode: z.string().optional(),
  endpoint: z.string().optional(),
});

export const updateMessageStatusSchema = z.object({
  status: z.enum(["delivered", "read"] as const, {
    message: "status must be 'delivered' or 'read'",
  }),
});

// ─── Auth Schemas ───────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be at most 100 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password must be at most 128 characters"),
});

export const linkDIDSchema = z.object({
  did: z.string().regex(/^did:/, "Valid DID required (must start with 'did:')"),
});

// ─── Gateway Schemas ────────────────────────────────────────────────────────

export const registerApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  scopes: z
    .array(
      z.enum([
        "did:read",
        "did:write",
        "vc:issue",
        "vc:verify",
        "trust:read",
        "trust:write",
      ] as const)
    )
    .nonempty(),
});

// ─── GDPR Schemas ───────────────────────────────────────────────────────────

export const consentSchema = z.object({
  consentGiven: z.boolean({
    invalid_type_error: "consentGiven must be a boolean",
  }),
  purpose: z.string().min(1).optional(),
});

export const confirmDeleteSchema = z.object({
  confirmation: z.literal("DELETE", {
    message: "Must send confirmation: 'DELETE' to confirm data deletion",
  }),
});