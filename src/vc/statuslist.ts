/**
 * W3C StatusList2021 Core Implementation.
 *
 * Provides bit manipulation of status list bitstrings, gzip compression/decompression,
 * base64url encoding/decoding, and integration with Verifiable Credentials.
 *
 * Reference:
 * - https://www.w3.org/TR/vc-status-list/
 */

import { gzipSync, gunzipSync } from "node:zlib";
import { v4 as uuidv4 } from "uuid";
import * as db from "../db/metadata.js";
import { issueCredential, type VerifiableCredentialWithProof } from "./issue.js";

const DEFAULT_NUM_BITS = 131072; // 131,072 bits = 16,384 bytes (16 KB)

// ─── Base64URL Helpers ────────────────────────────────────────────────────────

function bufferToBase64Url(buffer: Uint8Array): string {
  const binary = Array.from(buffer).map(b => String.fromCharCode(b)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Bit Manipulation ─────────────────────────────────────────────────────────

/**
 * Create a new, empty (all zeros) gzipped, base64url encoded bitstring.
 */
export function createEmptyEncodedList(numBits: number = DEFAULT_NUM_BITS): string {
  const numBytes = Math.ceil(numBits / 8);
  const buffer = new Uint8Array(numBytes); // filled with 0s
  const compressed = gzipSync(buffer);
  return bufferToBase64Url(compressed);
}

/**
 * Get the status of a specific bit in an encoded status list.
 */
export function getBitStatus(encodedList: string, index: number): boolean {
  const compressed = base64UrlToBuffer(encodedList);
  const buffer = gunzipSync(compressed);

  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;

  if (byteIndex >= buffer.length) {
    throw new Error(`Bit index ${index} out of bounds for list size ${buffer.length * 8}`);
  }

  // 1 means revoked/suspended, 0 means active
  return (buffer[byteIndex]! & (1 << (7 - bitIndex))) !== 0;
}

/**
 * Set the status of a specific bit in an encoded status list and return the new encoded list.
 */
export function setBitStatus(encodedList: string, index: number, status: boolean): string {
  const compressed = base64UrlToBuffer(encodedList);
  const buffer = gunzipSync(compressed);

  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;

  if (byteIndex >= buffer.length) {
    throw new Error(`Bit index ${index} out of bounds for list size ${buffer.length * 8}`);
  }

  if (status) {
    buffer[byteIndex] |= (1 << (7 - bitIndex));
  } else {
    buffer[byteIndex] &= ~(1 << (7 - bitIndex));
  }

  const newCompressed = gzipSync(buffer);
  return bufferToBase64Url(newCompressed);
}

// ─── Business Logic & DB Actions ─────────────────────────────────────────────

/**
 * Create a new StatusList2021 database record.
 */
export function createStatusList(options: {
  id?: string;
  name: string;
  issuerDid: string;
  statusPurpose?: "revocation" | "suspension";
  numBits?: number;
}): db.StatusListRecord {
  const id = options.id || uuidv4();
  const purpose = options.statusPurpose || "revocation";
  const numBits = options.numBits || DEFAULT_NUM_BITS;
  const encodedList = createEmptyEncodedList(numBits);

  const record: db.StatusListRecord = {
    id,
    name: options.name,
    issuer_did: options.issuerDid,
    status_purpose: purpose,
    encoded_list: encodedList,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.insertStatusList(record);
  return record;
}

/**
 * Update a specific bit in a stored StatusList.
 */
export function updateStatusBit(listId: string, index: number, status: boolean): db.StatusListRecord {
  const record = db.getStatusListById(listId);
  if (!record) {
    throw new Error(`StatusList not found: ${listId}`);
  }

  const updatedEncoded = setBitStatus(record.encoded_list, index, status);
  db.updateStatusListEncoded(listId, updatedEncoded);

  return {
    ...record,
    encoded_list: updatedEncoded,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Check the status of a specific bit in a stored StatusList.
 */
export function checkStatusBit(listId: string, index: number): boolean {
  const record = db.getStatusListById(listId);
  if (!record) {
    throw new Error(`StatusList not found: ${listId}`);
  }

  return getBitStatus(record.encoded_list, index);
}

/**
 * Get a StatusList by ID.
 */
export function getStatusList(listId: string): db.StatusListRecord | null {
  return db.getStatusListById(listId);
}

/**
 * Generate a signed W3C StatusList2021 Verifiable Credential for a stored list.
 */
export async function generateStatusListVC(
  listId: string,
  issuerSecretKey: Uint8Array
): Promise<VerifiableCredentialWithProof> {
  const record = db.getStatusListById(listId);
  if (!record) {
    throw new Error(`StatusList not found: ${listId}`);
  }

  // W3C StatusList2021 standard context and type
  const type = ["VerifiableCredential", "StatusList2021Credential"];
  const additionalContexts = ["https://w3id.org/vc/status-list/2021/v1"];

  const claims = {
    type: "StatusList2021",
    statusPurpose: record.status_purpose,
    encodedList: record.encoded_list,
  };

  const result = await issueCredential({
    issuerDID: record.issuer_did,
    issuerSecretKey,
    subjectDID: `${record.issuer_did}#list-${listId}`,
    claims,
    type,
    additionalContexts,
  });

  return result.credential;
}