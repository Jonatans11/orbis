/**
 * DIDComm v2 Message Mediation & Routing.
 *
 * Implements standard mediation specifications:
 * - Routing grant & coordinate mediation
 * - Queueing messages for offline edge clients
 * - Message Forwarding envelope unwrapping
 *
 * References:
 * - https://didcomm.org/coordinate-mediation/2.0/
 */

import { v4 as uuidv4 } from "uuid";
import * as db from "../db/metadata.js";
import { executeSQL, executeSQLAsync } from "../db/metadata.js";

export interface MediationGrant {
  id: string;
  mediator_did: string;
  recipient_did: string;
  routing_keys: string; // comma-separated
  status: "granted" | "denied";
  created_at: string;
}

/**
 * Initialize Mediation tables inside SQLite database if not exists.
 */
export function initMediationTables(): void {
  executeSQL("CREATE TABLE IF NOT EXISTS ssi_mediation_grants (id TEXT PRIMARY KEY, mediator_did TEXT NOT NULL, recipient_did TEXT NOT NULL UNIQUE, routing_keys TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'granted', created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  executeSQL("CREATE TABLE IF NOT EXISTS ssi_mediated_queue (id TEXT PRIMARY KEY, recipient_did TEXT NOT NULL, encrypted_payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'delivered')), queued_at TEXT NOT NULL DEFAULT (datetime('now')))");
}

/**
 * Request mediation and grant routing keys.
 */
export function grantMediation(mediatorDid: string, recipientDid: string, routingKeys: string[]): MediationGrant {
  initMediationTables();

  const id = uuidv4();
  const keysStr = routingKeys.join(",");
  const now = new Date().toISOString();

  executeSQL(`INSERT OR REPLACE INTO ssi_mediation_grants (id, mediator_did, recipient_did, routing_keys, status, created_at) VALUES ('${id}', '${mediatorDid}', '${recipientDid}', '${keysStr}', 'granted', '${now}')`);

  return {
    id,
    mediator_did: mediatorDid,
    recipient_did: recipientDid,
    routing_keys: keysStr,
    status: "granted",
    created_at: now
  };
}

/**
 * Check if a mediation grant exists for a recipient.
 */
export function getMediationGrant(recipientDid: string): MediationGrant | null {
  initMediationTables();
  const rows = executeSQL(`SELECT * FROM ssi_mediation_grants WHERE recipient_did = '${recipientDid}'`);
  if (rows.length === 0) return null;
  return rows[0] as MediationGrant;
}

/**
 * Forward a message envelope to a recipient's queue (mediator inbox).
 */
export function queueMediatedMessage(recipientDid: string, encryptedPayload: string): void {
  initMediationTables();
  const id = uuidv4();
  const now = new Date().toISOString();

  executeSQLAsync(`INSERT INTO ssi_mediated_queue (id, recipient_did, encrypted_payload, status, queued_at) VALUES ('${id}', '${recipientDid}', '${encryptedPayload}', 'queued', '${now}')`);
}

/**
 * Fetch and clear queued messages for an edge client.
 */
export function fetchAndClearQueue(recipientDid: string): string[] {
  initMediationTables();
  const rows = executeSQL(`SELECT * FROM ssi_mediated_queue WHERE recipient_did = '${recipientDid}' AND status = 'queued'`);
  if (rows.length === 0) return [];

  // Update status to delivered in the background
  executeSQLAsync(`UPDATE ssi_mediated_queue SET status = 'delivered' WHERE recipient_did = '${recipientDid}'`);

  return rows.map((r: any) => r.encrypted_payload);
}
