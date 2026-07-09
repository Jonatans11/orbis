/**
 * DIDComm v2 Message Types for ORBIS.ID.
 *
 * Implements core DIDComm message types:
 * - BasicMessage (https://didcomm.org/basicmessage/2.0/message)
 * - TrustPing (https://didcomm.org/trust-ping/2.0/ping, ping-response)
 * - Out-of-Band Invitation (https://didcomm.org/out-of-band/2.0/invitation)
 */

// ─── DIDComm Message Envelope ─────────────────────────────────────────────────

/**
 * Raw DIDComm message before encryption (the "plaintext" payload).
 */
export interface DIDCommMessage {
  /** DID of the sender */
  from: string;
  /** DID of the recipient */
  to: string[];
  /** Message type URI (e.g. https://didcomm.org/basicmessage/2.0/message) */
  type: string;
  /** Message ID (should be unique) */
  id: string;
  /** Thread ID for correlation (optional) */
  thid?: string;
  /** Parent thread ID (optional) */
  pthid?: string;
  /** Created timestamp in ISO 8601 */
  created_time?: number;
  /** Expires timestamp in ISO 8601 */
  expires_time?: number;
  /** Message body (type-specific content) */
  body: Record<string, any>;
}

/**
 * Encrypted DIDComm envelope (authcrypt or anoncrypt).
 */
export interface EncryptedDIDCommEnvelope {
  /** Ciphertext (base64url encoded) */
  ciphertext: string;
  /** IV/nonce (base64url encoded) */
  iv: string;
  /** Protected headers (base64url encoded JSON) */
  protected: string;
  /** Recipients array for authcrypt */
  recipients?: Array<{
    /** Recipient's verification method DID URL */
    recipientKey: string;
    /** Encrypted content encryption key (base64url encoded) */
    encrypted_key: string;
    /** Header info (base64url encoded JSON with `kid` and `from` if authcrypt) */
    header: Record<string, any>;
  }>;
  /** Single recipient key for anoncrypt */
  recipientKey?: string;
  /** Tag (base64url encoded) */
  tag: string;
  /** Message type URI */
  type: string;
}

// ─── BasicMessage (https://didcomm.org/basicmessage/2.0) ──────────────────────

export const BASIC_MESSAGE_TYPE = "https://didcomm.org/basicmessage/2.0/message";

export interface BasicMessageBody {
  /** The content/sent text */
  content: string;
}

/**
 * Create a BasicMessage.
 */
export function createBasicMessage(
  from: string,
  to: string,
  content: string,
  threadId?: string
): DIDCommMessage {
  return {
    from,
    to: [to],
    type: BASIC_MESSAGE_TYPE,
    id: generateId(),
    thid: threadId,
    created_time: Math.floor(Date.now() / 1000),
    body: { content } as BasicMessageBody,
  };
}

// ─── TrustPing (https://didcomm.org/trust-ping/2.0) ───────────────────────────

export const TRUST_PING_TYPE = "https://didcomm.org/trust-ping/2.0/ping";
export const TRUST_PING_RESPONSE_TYPE = "https://didcomm.org/trust-ping/2.0/ping_response";

export interface TrustPingBody {
  /** Request a response (default true) */
  response_requested: boolean;
  /** Optional comment */
  comment?: string;
}

export interface TrustPingResponseBody {
  /** The thread ID of the ping being responded to */
  comment?: string;
}

/**
 * Create a TrustPing message.
 */
export function createTrustPing(
  from: string,
  to: string,
  comment?: string,
  threadId?: string
): DIDCommMessage {
  return {
    from,
    to: [to],
    type: TRUST_PING_TYPE,
    id: generateId(),
    thid: threadId,
    created_time: Math.floor(Date.now() / 1000),
    body: { response_requested: true, ...(comment ? { comment } : {}) } as TrustPingBody,
  };
}

/**
 * Create a TrustPing response.
 */
export function createTrustPingResponse(
  from: string,
  to: string,
  threadId: string,
  comment?: string
): DIDCommMessage {
  return {
    from,
    to: [to],
    type: TRUST_PING_RESPONSE_TYPE,
    id: generateId(),
    thid: threadId,
    created_time: Math.floor(Date.now() / 1000),
    body: { ...(comment ? { comment } : {}) } as TrustPingResponseBody,
  };
}

// ─── Out-of-Band Invitation (https://didcomm.org/out-of-band/2.0) ─────────────

export const OOB_INVITATION_TYPE = "https://didcomm.org/out-of-band/2.0/invitation";

export interface OOBInvitationBody {
  /** Human-readable label for the inviter */
  label: string;
  /** Goal code (e.g. "issue-vc", "request-proof") */
  goal_code?: string;
  /** Human-readable goal description */
  goal?: string;
  /** Handshake protocol (e.g. ["https://didcomm.org/didexchange/1.0"]) */
  handshake_protocols?: string[];
  /** Services — array of DIDs or DIDComm service endpoints */
  services: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
    routingKeys?: string[];
    accept?: string[];
  }>;
}

/**
 * Create an Out-of-Band invitation message.
 */
export function createOOBInvitation(
  from: string,
  services: OOBInvitationBody["services"],
  label: string,
  options?: { goal?: string; goalCode?: string; handshakeProtocols?: string[] }
): DIDCommMessage {
  return {
    from,
    to: [],
    type: OOB_INVITATION_TYPE,
    id: generateId(),
    created_time: Math.floor(Date.now() / 1000),
    body: {
      label,
      ...(options?.goalCode ? { goal_code: options.goalCode } : {}),
      ...(options?.goal ? { goal: options.goal } : {}),
      ...(options?.handshakeProtocols ? { handshake_protocols: options.handshakeProtocols } : {}),
      services,
    } as OOBInvitationBody,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  // Generate a DIDComm-compliant message ID: uuid in urn:uuid: format
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}