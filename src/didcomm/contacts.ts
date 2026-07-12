/**
 * DIDComm Contact Management for ORBIS.ID Mobile Wallet.
 * Manages pairwise DID contacts with labels, unread counts, and search.
 */

import { v4 as uuidv4 } from "uuid";
import * as db from "../db/metadata.js";

export interface DIDCommContact {
  id: string; user_did: string; contact_did: string; label: string;
  avatar_url: string | null; last_interaction_at: string | null;
  unread_count: number; created_at: string; updated_at: string;
}

export interface CreateContactParams { userDID: string; contactDID: string; label: string; avatarUrl?: string; }
export interface UpdateContactParams { label?: string; avatarUrl?: string; }

export function addContact(params: CreateContactParams): DIDCommContact {
  const existing = db.findContactByDIDs(params.userDID, params.contactDID);
  if (existing) throw new Error(`Contact ${params.contactDID} already exists`);
  const id = uuidv4(); const now = new Date().toISOString();
  db.insertContact({ id, user_did: params.userDID, contact_did: params.contactDID, label: params.label, avatar_url: params.avatarUrl || null, last_interaction_at: null, unread_count: 0, created_at: now, updated_at: now });
  return db.getContactById(id)!;
}

export function getContactById(id: string): DIDCommContact | null { return db.getContactById(id); }
export function findContactByDIDs(userDID: string, contactDID: string): DIDCommContact | null { return db.findContactByDIDs(userDID, contactDID); }
export function listContacts(userDID: string): DIDCommContact[] { return db.listContacts(userDID); }

export function updateContact(id: string, params: UpdateContactParams): DIDCommContact | null {
  const contact = getContactById(id); if (!contact) return null;
  const sets: string[] = []; const now = new Date().toISOString();
  if (params.label !== undefined) sets.push(`label = ${db.quote(params.label)}`);
  if (params.avatarUrl !== undefined) sets.push(`avatar_url = ${db.quote(params.avatarUrl)}`);
  sets.push(`updated_at = ${db.quote(now)}`);
  if (sets.length > 1) db.updateContactFields(id, sets.join(", "));
  return getContactById(id);
}

export function deleteContact(id: string): boolean { const c = getContactById(id); if (!c) return false; db.deleteContact(id); return true; }
export function updateLastInteraction(userDID: string, contactDID: string): void {
  const c = db.findContactByDIDs(userDID, contactDID); if (!c) return;
  const now = new Date().toISOString();
  db.updateContactFields(c.id, `last_interaction_at = ${db.quote(now)}, unread_count = 0, updated_at = ${db.quote(now)}`);
}
export function incrementUnread(userDID: string, contactDID: string): void {
  const c = db.findContactByDIDs(userDID, contactDID); if (!c) return; db.incrementContactUnread(c.id);
}
export function resetUnread(contactId: string): void {
  const now = new Date().toISOString(); db.updateContactFields(contactId, `unread_count = 0, updated_at = ${db.quote(now)}`);
}
export function searchContacts(userDID: string, query: string): DIDCommContact[] { return db.searchContacts(userDID, query); }
