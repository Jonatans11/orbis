/**
 * Trust Registry for ORBIS.ID SSI.
 * Manages a registry of authorized credential issuers and verifiers.
 * 
 * The trust registry enables:
 * - Verification that a credential was issued by a trusted entity
 * - Authorization of issuers for specific credential types
 * - Suspension and revocation of trust relationships
 */

import { v4 as uuidv4 } from "uuid";
import * as db from "../db/metadata.js";

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface AddTrustEntryOptions {
  did: string;
  name: string;
  category?: "issuer" | "verifier" | "both";
  authorizedCredentialTypes?: string[];
  addedBy?: string;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Add a trusted entity to the registry.
 */
export function addTrustedEntity(options: AddTrustEntryOptions): TrustEntry {
  const {
    did,
    name,
    category = "issuer",
    authorizedCredentialTypes = [],
    addedBy,
  } = options;

  // Check if already exists
  const existing = db.getTrustEntryByDID(did);
  if (existing) {
    throw new Error(`Entity with DID ${did} is already in the trust registry`);
  }

  const id = uuidv4();
  const authorizedTypes = JSON.stringify(authorizedCredentialTypes || []);

  db.insertTrustEntry({
    id,
    did,
    name,
    category,
    authorized_credential_types: authorizedTypes,
    status: "active",
    added_by: addedBy || null,
  });

  return {
    id,
    did,
    name,
    category,
    authorizedCredentialTypes,
    status: "active",
    addedBy: addedBy || null,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a trusted entity by DID.
 */
export function getTrustedIssuer(did: string): TrustEntry | null {
  const record = db.getTrustEntryByDID(did);
  if (!record) return null;

  return mapToTrustEntry(record);
}

/**
 * List all trusted entities, optionally filtered by category.
 */
export function listTrustedEntities(category?: "issuer" | "verifier" | "both"): TrustEntry[] {
  const records = db.listTrustEntries(category);
  return records.map(mapToTrustEntry);
}

/**
 * List only active (non-suspended, non-revoked) trusted issuers.
 */
export function listActiveIssuers(): TrustEntry[] {
  const all = db.listTrustEntries();
  return all
    .filter((r) => r.status === "active" && (r.category === "issuer" || r.category === "both"))
    .map(mapToTrustEntry);
}

/**
 * Suspend a trusted entity.
 */
export function suspendEntity(id: string): void {
  db.updateTrustEntryStatus(id, "suspended");
}

/**
 * Revoke a trusted entity.
 */
export function revokeEntity(id: string): void {
  db.updateTrustEntryStatus(id, "revoked");
}

/**
 * Reactivate a suspended or revoked entity.
 */
export function reactivateEntity(id: string): void {
  db.updateTrustEntryStatus(id, "active");
}

/**
 * Remove an entity from the trust registry entirely.
 */
export function removeEntity(id: string): void {
  db.removeTrustEntry(id);
}

/**
 * Check if a DID is a trusted issuer for specific credential types.
 */
export function isTrustedIssuer(did: string, credentialTypes?: string[]): boolean {
  const entry = db.getTrustEntryByDID(did);
  if (!entry) return false;
  if (entry.status !== "active") return false;
  if (entry.category !== "issuer" && entry.category !== "both") return false;

  if (credentialTypes && credentialTypes.length > 0) {
    let authorizedTypes: string[] = [];
    try {
      authorizedTypes = JSON.parse(entry.authorized_credential_types || "[]") as string[];
    } catch {
      authorizedTypes = [];
    }
    return credentialTypes.every((t) => authorizedTypes.includes(t));
  }

  return true;
}

// ─── eIDAS Interoperability ──────────────────────────────────────────────────

export type EidasServiceType = "QTSP" | "Non-QTSP" | "Unknown";
export type EidasServiceStatus = "granted" | "withdrawn" | "deprecated";

/**
 * Verifies if a given DID is registered in the Trust Registry and matches
 * eIDAS Qualified Trust Service Provider (QTSP) criteria.
 */
export function verifyEidasTrust(did: string, serviceType: string = "QTSP"): boolean {
  const entry = getTrustedIssuer(did);
  if (!entry) return false;
  if (entry.status !== "active") return false;

  // QTSPs must be trusted issuers or both
  if (serviceType === "QTSP") {
    return entry.category === "issuer" || entry.category === "both";
  }

  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapToTrustEntry(record: db.TrustRegistryEntry): TrustEntry {
  let authorizedTypes: string[] = [];
  try {
    authorizedTypes = JSON.parse(record.authorized_credential_types || "[]") as string[];
  } catch {
    authorizedTypes = [];
  }
  return {
    id: record.id,
    did: record.did,
    name: record.name,
    category: record.category as "issuer" | "verifier" | "both",
    authorizedCredentialTypes: authorizedTypes,
    status: record.status as "active" | "suspended" | "revoked",
    addedBy: record.added_by,
    addedAt: record.added_at,
    updatedAt: record.updated_at,
  };
}