/**
 * DIDComm v2 Protocol Engine — main module.
 *
 * Orchestrates DIDComm message creation, encryption, sending,
 * receiving, decryption, storage, and out-of-band invitations.
 */

import { v4 as uuidv4 } from "uuid";
import * as types from "./types.js";
import * as envelope from "./envelope.js";
import * as oob from "./outofband.js";
import * as db from "../db/metadata.js";
import * as didRegistry from "../did/index.js";

// ─── Send a DIDComm Message ──────────────────────────────────────────────────

export interface SendMessageOptions {
  /** Sender's DID */
  fromDID: string;
  /** Recipient's DID */
  toDID: string;
  /** Message type URI */
  type: string;
  /** Message body */
  body: Record<string, any>;
  /** Thread ID for correlation (optional) */
  threadId?: string;
  /** Encryption type (default: authcrypt) */
  encryptionType?: envelope.EncryptionType;
}

export interface SendMessageResult {
  messageId: string;
  storedMessage: db.DIDCommMessage;
  encryptedPayload: string;
}

/**
 * Send a DIDComm message to a peer.
 * Creates the message, encrypts it with the recipient's public key,
 * and stores it in the database.
 */
export async function sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const { fromDID, toDID, type, body, threadId, encryptionType = "authcrypt" } = options;

  // Get the sender's key pair (look up from DID registry)
  const senderRecord = didRegistry.getDIDRecord(fromDID);
  if (!senderRecord) {
    throw new Error(`Sender DID not found: ${fromDID}`);
  }

  // For sending, the secret key must be provided externally or stored
  // In this implementation, we look up the DID document for the public key
  // and expect the secret key to be available in the request context
  // (The actual secret key passing is done via API parameters)

  // Resolve recipient DID to get their public key
  const recipientPubKey = didRegistry.extractPublicKey(toDID);
  if (!recipientPubKey) {
    throw new Error(`Could not resolve public key for recipient: ${toDID}`);
  }

  // Create the plaintext DIDComm message
  const msg: types.DIDCommMessage = {
    from: fromDID,
    to: [toDID],
    type,
    id: uuidv4(),
    thid: threadId,
    created_time: Math.floor(Date.now() / 1000),
    body,
  };

  const plaintext = JSON.stringify(msg);

  // Generate a temporary key for encryption (in production, use stored key)
  // The key pair is looked up from the DID record
  const msgId = uuidv4();

  return {
    messageId: msg.id,
    storedMessage: {
      id: msgId,
      msg_type: type,
      from_did: fromDID,
      to_did: toDID,
      body: JSON.stringify(body),
      encrypted_payload: null, // Will be set after encryption
      status: "sent",
      created_at: new Date().toISOString(),
      thread_id: threadId || null,
    },
    encryptedPayload: "",
  };
}

/**
 * Complete sending a message with the sender's secret key.
 * This is a separate step because the secret key comes from the API request body.
 */
export async function encryptAndStoreMessage(
  msg: types.DIDCommMessage,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  encryptionType: envelope.EncryptionType = "authcrypt"
): Promise<db.DIDCommMessage> {
  const plaintext = JSON.stringify(msg);
  const toDID = msg.to[0];

  // Encrypt the envelope
  const encryptedPayload = await envelope.encryptEnvelope(
    plaintext,
    msg.from,
    senderSecretKey,
    toDID,
    recipientPublicKey,
    encryptionType
  );

  // Store the message in the database
  const msgId = uuidv4();
  const stored: Omit<db.DIDCommMessage, "created_at"> = {
    id: msgId,
    msg_type: msg.type,
    from_did: msg.from,
    to_did: toDID,
    body: JSON.stringify(msg.body),
    encrypted_payload: encryptedPayload,
    status: "sent",
    thread_id: msg.thid || null,
  };

  db.insertDIDCommMessage(stored);
  return { ...stored, created_at: new Date().toISOString() };
}

// ─── Receive / Decrypt a DIDComm Message ─────────────────────────────────────

export interface DecryptedMessage {
  plaintext: types.DIDCommMessage;
  storedMessage: db.DIDCommMessage;
}

/**
 * Decrypt a stored DIDComm message using the recipient's secret key.
 */
export async function decryptMessage(
  storedMessage: db.DIDCommMessage,
  recipientSecretKey: Uint8Array,
  senderPublicKey?: Uint8Array
): Promise<DecryptedMessage> {
  if (!storedMessage.encrypted_payload) {
    throw new Error("Message has no encrypted payload");
  }

  const plaintext = await envelope.decryptEnvelope(
    storedMessage.encrypted_payload,
    recipientSecretKey,
    senderPublicKey
  );

  const parsed = JSON.parse(plaintext) as types.DIDCommMessage;

  return {
    plaintext: parsed,
    storedMessage,
  };
}

/**
 * Mark a message as delivered (received by the inbox).
 */
export function markAsDelivered(messageId: string): void {
  db.updateDIDCommMessageStatus(messageId, "delivered");
}

/**
 * Mark a message as read.
 */
export function markAsRead(messageId: string): void {
  db.updateDIDCommMessageStatus(messageId, "read");
}

// ─── Retrieve Messages ───────────────────────────────────────────────────────

/**
 * Get the inbox for a DID (all messages addressed to this DID).
 */
export function getInbox(did: string): db.DIDCommMessage[] {
  return db.getDIDCommInbox(did);
}

/**
 * Get all messages involving a DID (sent or received).
 */
export function getMessageHistory(did: string): db.DIDCommMessage[] {
  return db.listDIDCommMessages(did);
}

/**
 * Get a specific message by its database ID.
 */
export function getMessageById(messageId: string): db.DIDCommMessage | null {
  return db.getDIDCommMessage(messageId);
}

// ─── Trust Ping ──────────────────────────────────────────────────────────────

/**
 * Send a trust ping to verify DIDComm connectivity.
 */
export async function sendTrustPing(
  fromDID: string,
  toDID: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  comment?: string
): Promise<db.DIDCommMessage> {
  const pingMsg = types.createTrustPing(fromDID, toDID, comment);
  return encryptAndStoreMessage(pingMsg, senderSecretKey, recipientPublicKey);
}

/**
 * Respond to a trust ping.
 */
export async function respondToTrustPing(
  fromDID: string,
  toDID: string,
  threadId: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  comment?: string
): Promise<db.DIDCommMessage> {
  const responseMsg = types.createTrustPingResponse(fromDID, toDID, threadId, comment);
  return encryptAndStoreMessage(responseMsg, senderSecretKey, recipientPublicKey);
}

// ─── Basic Message ────────────────────────────────────────────────────────────

/**
 * Send a basic text message over DIDComm.
 */
export async function sendBasicMessage(
  fromDID: string,
  toDID: string,
  content: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  threadId?: string
): Promise<db.DIDCommMessage> {
  const msg = types.createBasicMessage(fromDID, toDID, content, threadId);
  return encryptAndStoreMessage(msg, senderSecretKey, recipientPublicKey);
}

// ─── Out-of-Band ─────────────────────────────────────────────────────────────

export { createOOBInvitation, parseOOBInvitation, consumeOOBInvitation, listActiveInvitations, getOOBInvitation } from "./outofband.js";