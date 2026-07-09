/**
 * DIDComm v2 Out-of-Band (OOB) Protocol.
 *
 * Implements the DIDComm v2 Out-of-Band specification for
 * creating and parsing invitations that can be delivered via
 * URL, QR code, or other side-channel.
 *
 * https://identity.foundation/didcomm-messaging/spec/v2.0/#out-of-band-messages
 */

import { v4 as uuidv4 } from "uuid";
import * as types from "./types.js";
import * as db from "../db/metadata.js";

// ─── OOB Invitation URL Format ───────────────────────────────────────────────

/**
 * The base URL for ORBIS.ID OOB invitations.
 * In production this would be configurable.
 */
const OOB_BASE_URL = "https://orbis.id/oob";

/**
 * Create an out-of-band invitation.
 *
 * The invitation encodes the inviter's DID and services into a URL
 * that the invitee can use to establish DIDComm messaging.
 */
export function createOOBInvitation(
  fromDID: string,
  label: string,
  options?: {
    goal?: string;
    goalCode?: string;
    endpoint?: string;
    routingKeys?: string[];
  }
): {
  message: types.DIDCommMessage;
  invitationUrl: string;
  record: db.OOBInvitation;
} {
  const endpoint = options?.endpoint || `${OOB_BASE_URL}/didcomm`;
  const serviceId = `${fromDID}#didcomm-1`;

  const services: types.OOBInvitationBody["services"] = [
    {
      id: serviceId,
      type: "DIDCommMessaging",
      serviceEndpoint: endpoint,
      ...(options?.routingKeys ? { routingKeys: options.routingKeys } : {}),
      accept: ["didcomm/v2"],
    },
  ];

  const message = types.createOOBInvitation(fromDID, services, label, {
    goal: options?.goal,
    goalCode: options?.goalCode,
  });

  // Encode the invitation as a URL parameter
  const invitationData = JSON.stringify({
    id: message.id,
    from: message.from,
    label,
    services,
    ...(options?.goal ? { goal: options.goal } : {}),
    ...(options?.goalCode ? { goal_code: options.goalCode } : {}),
  });

  const invitationUrl = `${OOB_BASE_URL}?invitation=${encodeURIComponent(invitationData)}`;

  // Store in database
  const recordId = uuidv4();
  const record: Omit<db.OOBInvitation, "created_at"> = {
    id: recordId,
    invitation_url: invitationUrl,
    from_did: fromDID,
    label: label,
    goal: options?.goal || null,
    goal_code: options?.goalCode || null,
    status: "active",
  };

  db.insertOOBInvitation(record);

  return {
    message,
    invitationUrl,
    record: { ...record, created_at: new Date().toISOString() },
  };
}

/**
 * Parse an OOB invitation URL and extract the invitation data.
 */
export function parseOOBInvitation(
  invitationUrl: string
): {
  id: string;
  from: string;
  label: string;
  services: types.OOBInvitationBody["services"];
  goal?: string;
  goalCode?: string;
} | null {
  try {
    const url = new URL(invitationUrl);
    const invitationParam = url.searchParams.get("invitation");
    if (!invitationParam) return null;

    const decoded = JSON.parse(decodeURIComponent(invitationParam));

    if (!decoded.id || !decoded.from || !decoded.label || !decoded.services) {
      return null;
    }

    return {
      id: decoded.id,
      from: decoded.from,
      label: decoded.label,
      services: decoded.services,
      goal: decoded.goal,
      goalCode: decoded.goal_code,
    };
  } catch {
    return null;
  }
}

/**
 * Consume an OOB invitation (mark as consumed in the database).
 */
export function consumeOOBInvitation(invitationId: string): void {
  db.consumeOOBInvitation(invitationId);
}

/**
 * List active OOB invitations for a DID.
 */
export function listActiveInvitations(did: string): db.OOBInvitation[] {
  return db.listActiveOOBInvitations(did);
}

/**
 * Get an OOB invitation by its database ID.
 */
export function getOOBInvitation(id: string): db.OOBInvitation | null {
  return db.getOOBInvitation(id);
}