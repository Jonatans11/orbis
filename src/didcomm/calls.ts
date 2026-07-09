/**
 * Secure WebRTC Call Signaling using DIDComm v2 encrypted envelopes.
 *
 * Implements decentralized voice/video call signaling where all
 * offer/answer/ICE candidate exchanges are encrypted using DIDComm authcrypt
 * envelopes, providing DID-authenticated peer-to-peer communication.
 *
 * Key design:
 * - Every signaling message is wrapped in a DIDComm authcrypt envelope
 * - Call state is tracked in team-db (ssi_calls, ssi_call_messages)
 * - Peers authenticate via their DIDs, no central server needed
 * - ICE candidates flow through DIDComm encrypted channels
 */

import { v4 as uuidv4 } from "uuid";
import * as types from "./types.js";
import * as envelope from "./envelope.js";
import * as db from "../db/metadata.js";
import * as didRegistry from "../did/index.js";

// ─── Call Status Constants ───────────────────────────────────────────────────

export type CallStatus = "ringing" | "connecting" | "active" | "ended";
export type CallMessageType = "offer" | "answer" | "ice_candidate" | "end";

// ─── DIDComm Call Types ─────────────────────────────────────────────────────

const CALL_TYPE_PREFIX = "https://didcomm.org/calls/1.0";
export const CALL_OFFER_TYPE = `${CALL_TYPE_PREFIX}/offer`;
export const CALL_ANSWER_TYPE = `${CALL_TYPE_PREFIX}/answer`;
export const CALL_ICE_CANDIDATE_TYPE = `${CALL_TYPE_PREFIX}/ice-candidate`;
export const CALL_END_TYPE = `${CALL_TYPE_PREFIX}/end`;

// ─── Create WebRTC Offer ────────────────────────────────────────────────────

export interface CreateOfferParams {
  callerDID: string;
  calleeDID: string;
  sdp: string;
  senderSecretKey: Uint8Array;
}

export interface CreateOfferResult {
  callId: string;
  messageId: string;
  storedCall: db.CallRecord;
  storedMessage: db.CallMessage;
}

/**
 * Create a WebRTC offer for a peer DID.
 * The SDP offer is encrypted in a DIDComm authcrypt envelope.
 */
export async function createOffer(params: CreateOfferParams): Promise<CreateOfferResult> {
  const { callerDID, calleeDID, sdp, senderSecretKey } = params;

  // Get callee's public key for encryption
  const calleePubKey = didRegistry.extractPublicKey(calleeDID);
  if (!calleePubKey) {
    throw new Error(`Cannot resolve public key for callee: ${calleeDID}`);
  }

  // Generate a unique call ID
  const callId = uuidv4();

  // Build the DIDComm message for the offer
  const offerMsg: types.DIDCommMessage = {
    from: callerDID,
    to: [calleeDID],
    type: CALL_OFFER_TYPE,
    id: uuidv4(),
    thid: callId,
    created_time: Math.floor(Date.now() / 1000),
    body: {
      callId,
      sdp,
      callerDID,
    },
  };

  // Encrypt the offer using DIDComm authcrypt
  const encryptedPayload = await envelope.encryptEnvelope(
    JSON.stringify(offerMsg),
    callerDID,
    senderSecretKey,
    calleeDID,
    calleePubKey,
    "authcrypt"
  );

  // Store the call record
  const callRecordId = uuidv4();
  const callRecord: Omit<db.CallRecord, "created_at"> = {
    id: callRecordId,
    call_id: callId,
    caller_did: callerDID,
    callee_did: calleeDID,
    status: "ringing",
    started_at: null,
    ended_at: null,
  };
  db.insertCall(callRecord);

  // Store the offer message
  const msgRecord: Omit<db.CallMessage, "created_at"> = {
    id: uuidv4(),
    call_id: callId,
    from_did: callerDID,
    msg_type: "offer",
    sdp,
    ice_candidate: null,
    encrypted_payload: encryptedPayload,
  };
  db.insertCallMessage(msgRecord);

  return {
    callId,
    messageId: offerMsg.id,
    storedCall: { ...callRecord, created_at: new Date().toISOString() },
    storedMessage: { ...msgRecord, created_at: new Date().toISOString() },
  };
}

// ─── Answer WebRTC Offer ─────────────────────────────────────────────────────

export interface CreateAnswerParams {
  callId: string;
  answererDID: string;
  callerDID: string;
  sdp: string;
  senderSecretKey: Uint8Array;
}

export interface CreateAnswerResult {
  messageId: string;
  storedMessage: db.CallMessage;
}

/**
 * Accept a WebRTC offer by creating an encrypted answer.
 */
export async function createAnswer(params: CreateAnswerParams): Promise<CreateAnswerResult> {
  const { callId, answererDID, callerDID, sdp, senderSecretKey } = params;

  // Verify the call exists
  const call = db.getCallByCallId(callId);
  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }

  // Get caller's public key for encryption
  const callerPubKey = didRegistry.extractPublicKey(callerDID);
  if (!callerPubKey) {
    throw new Error(`Cannot resolve public key for caller: ${callerDID}`);
  }

  // Build the DIDComm message for the answer
  const answerMsg: types.DIDCommMessage = {
    from: answererDID,
    to: [callerDID],
    type: CALL_ANSWER_TYPE,
    id: uuidv4(),
    thid: callId,
    created_time: Math.floor(Date.now() / 1000),
    body: {
      callId,
      sdp,
      answererDID,
    },
  };

  // Encrypt the answer
  const encryptedPayload = await envelope.encryptEnvelope(
    JSON.stringify(answerMsg),
    answererDID,
    senderSecretKey,
    callerDID,
    callerPubKey,
    "authcrypt"
  );

  // Update call status to connecting
  db.updateCallStatus(callId, "connecting");

  // Store the answer message
  const msgRecord: Omit<db.CallMessage, "created_at"> = {
    id: uuidv4(),
    call_id: callId,
    from_did: answererDID,
    msg_type: "answer",
    sdp,
    ice_candidate: null,
    encrypted_payload: encryptedPayload,
  };
  db.insertCallMessage(msgRecord);

  return {
    messageId: answerMsg.id,
    storedMessage: { ...msgRecord, created_at: new Date().toISOString() },
  };
}

// ─── Exchange ICE Candidates ─────────────────────────────────────────────────

export interface ICECandidateParams {
  callId: string;
  fromDID: string;
  toDID: string;
  candidate: string;
  senderSecretKey: Uint8Array;
}

export interface ICECandidateResult {
  messageId: string;
  storedMessage: db.CallMessage;
}

/**
 * Send an ICE candidate to the peer, encrypted via DIDComm.
 */
export async function sendICECandidate(params: ICECandidateParams): Promise<ICECandidateResult> {
  const { callId, fromDID, toDID, candidate, senderSecretKey } = params;

  // Verify the call exists and is active
  const call = db.getCallByCallId(callId);
  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }
  if (call.status === "ended") {
    throw new Error("Call has already ended");
  }

  // Get recipient's public key for encryption
  const toPubKey = didRegistry.extractPublicKey(toDID);
  if (!toPubKey) {
    throw new Error(`Cannot resolve public key for ${toDID}`);
  }

  // Build the DIDComm message for the ICE candidate
  const iceMsg: types.DIDCommMessage = {
    from: fromDID,
    to: [toDID],
    type: CALL_ICE_CANDIDATE_TYPE,
    id: uuidv4(),
    thid: callId,
    created_time: Math.floor(Date.now() / 1000),
    body: {
      callId,
      candidate,
    },
  };

  // Encrypt the ICE candidate
  const encryptedPayload = await envelope.encryptEnvelope(
    JSON.stringify(iceMsg),
    fromDID,
    senderSecretKey,
    toDID,
    toPubKey,
    "authcrypt"
  );

  // Store the ICE candidate
  const msgRecord: Omit<db.CallMessage, "created_at"> = {
    id: uuidv4(),
    call_id: callId,
    from_did: fromDID,
    msg_type: "ice_candidate",
    sdp: null,
    ice_candidate: candidate,
    encrypted_payload: encryptedPayload,
  };
  db.insertCallMessage(msgRecord);

  return {
    messageId: iceMsg.id,
    storedMessage: { ...msgRecord, created_at: new Date().toISOString() },
  };
}

// ─── End a Call ──────────────────────────────────────────────────────────────

export interface EndCallParams {
  callId: string;
  fromDID: string;
  toDID: string;
  senderSecretKey: Uint8Array;
  reason?: string;
}

export interface EndCallResult {
  messageId: string;
  storedMessage: db.CallMessage;
}

/**
 * End an active call by sending an encrypted end signal.
 */
export async function endCall(params: EndCallParams): Promise<EndCallResult> {
  const { callId, fromDID, toDID, senderSecretKey, reason } = params;

  // Verify the call exists
  const call = db.getCallByCallId(callId);
  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }

  // Get recipient's public key for encryption
  const toPubKey = didRegistry.extractPublicKey(toDID);
  if (!toPubKey) {
    throw new Error(`Cannot resolve public key for ${toDID}`);
  }

  // Build the DIDComm message for the end signal
  const endMsg: types.DIDCommMessage = {
    from: fromDID,
    to: [toDID],
    type: CALL_END_TYPE,
    id: uuidv4(),
    thid: callId,
    created_time: Math.floor(Date.now() / 1000),
    body: {
      callId,
      reason: reason || "caller-ended",
    },
  };

  // Encrypt the end signal
  const encryptedPayload = await envelope.encryptEnvelope(
    JSON.stringify(endMsg),
    fromDID,
    senderSecretKey,
    toDID,
    toPubKey,
    "authcrypt"
  );

  // Update call status to ended
  db.updateCallStatus(callId, "ended");

  // Store the end message
  const msgRecord: Omit<db.CallMessage, "created_at"> = {
    id: uuidv4(),
    call_id: callId,
    from_did: fromDID,
    msg_type: "end",
    sdp: null,
    ice_candidate: null,
    encrypted_payload: encryptedPayload,
  };
  db.insertCallMessage(msgRecord);

  return {
    messageId: endMsg.id,
    storedMessage: { ...msgRecord, created_at: new Date().toISOString() },
  };
}

// ─── List Calls ──────────────────────────────────────────────────────────────

/**
 * List all calls involving a DID (active or recent).
 */
export function listCalls(did: string): db.CallRecord[] {
  return db.listCalls(did);
}

/**
 * Get details for a specific call including its messages.
 */
export function getCallDetails(callId: string): {
  call: db.CallRecord | null;
  messages: db.CallMessage[];
} {
  const call = db.getCallByCallId(callId);
  const messages = call ? db.getCallMessages(callId) : [];
  return { call, messages };
}

/**
 * Mark a call as active (once the peer connection is established).
 */
export function markCallActive(callId: string): void {
  db.updateCallStatus(callId, "active");
}

/**
 * Update call status.
 */
export function updateCallStatus(callId: string, status: CallStatus): void {
  db.updateCallStatus(callId, status);
}