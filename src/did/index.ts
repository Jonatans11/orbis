/**
 * DID Registry — central hub for DID creation, resolution, and storage.
 * Coordinates did:key and did:web methods with the metadata database.
 */

import { v4 as uuidv4 } from "uuid";
import * as keyModule from "./key.js";
import * as webModule from "./web.js";
import * as db from "../db/metadata.js";

export type DIDMethod = "key" | "web";

export interface DIDCreationResult {
  id: string;
  did: string;
  method: DIDMethod;
  didDocument: keyModule.DIDDocument;
  keyPair: keyModule.KeyPair;
  verificationMethodId: string;
}

/**
 * Create a new did:key and store its metadata.
 */
export async function createDIDKey(): Promise<DIDCreationResult> {
  const result = await keyModule.generateDIDKey();
  const recordId = uuidv4();

  db.insertDID({
    id: recordId,
    did: result.did,
    method: "key",
    public_key_multibase: result.didDocument.verificationMethod[0]!.publicKeyMultibase,
    verification_method_id: result.verificationMethodId,
    document: JSON.stringify(result.didDocument),
    status: "active",
  });

  return {
    id: recordId,
    did: result.did,
    method: "key",
    didDocument: result.didDocument,
    keyPair: result.keyPair,
    verificationMethodId: result.verificationMethodId,
  };
}

/**
 * Create a new did:web and store its metadata.
 */
export async function createDIDWeb(options: webModule.DIDWebOptions): Promise<DIDCreationResult> {
  const result = await webModule.generateDIDWeb(options);
  const recordId = uuidv4();

  db.insertDID({
    id: recordId,
    did: result.did,
    method: "web",
    public_key_multibase: result.didDocument.verificationMethod[0]!.publicKeyMultibase,
    verification_method_id: result.verificationMethodId,
    document: JSON.stringify(result.didDocument),
    status: "active",
  });

  return {
    id: recordId,
    did: result.did,
    method: "web",
    didDocument: result.didDocument,
    keyPair: result.keyPair,
    verificationMethodId: result.verificationMethodId,
  };
}

/**
 * Resolve a DID to its DID Document.
 */
export async function resolveDID(did: string): Promise<keyModule.DIDDocument | null> {
  if (did.startsWith("did:key:")) {
    return keyModule.resolveDIDKey(did);
  }

  if (did.startsWith("did:web:")) {
    const { didDocument } = await webModule.resolveDIDWeb(did);
    return didDocument;
  }

  return null;
}

/**
 * Get a DID record from the database.
 */
export function getDIDRecord(did: string): db.DIDRecord | null {
  // Try to find by exact DID
  const all = db.listDIDs();
  return all.find((r) => r.did === did) ?? null;
}

/**
 * List all stored DIDs, optionally filtered by method.
 */
export function listDIDs(method?: DIDMethod): db.DIDRecord[] {
  return db.listDIDs(method);
}

/**
 * Revoke a DID (mark as revoked).
 */
export function revokeDID(id: string): void {
  db.updateDIDStatus(id, "revoked");
}

/**
 * Get the raw public key bytes from a DID.
 */
export function extractPublicKey(did: string): Uint8Array | null {
  if (did.startsWith("did:key:")) {
    return keyModule.extractPublicKey(did);
  }

  // For did:web, look up in database
  if (did.startsWith("did:web:")) {
    const record = getDIDRecord(did);
    if (!record) return null;
    const doc = JSON.parse(record.document) as keyModule.DIDDocument;
    return keyModule.getPublicKeyFromDocument(doc);
  }

  return null;
}

/**
 * Get the public key bytes from a VerificationMethod.
 */
export function getPublicKeyFromVerificationMethod(vm: keyModule.VerificationMethod): Uint8Array | null {
  return keyModule.getPublicKeyFromVerificationMethod(vm);
}