/**
 * DIDComm Push Notification Hints for ORBIS.ID Mobile Wallet.
 * Maps DIDs to device push tokens for new-message notifications.
 */

import { v4 as uuidv4 } from "uuid";
import * as db from "../db/metadata.js";

export interface PushRegistration {
  id: string; did: string; push_token: string; platform: "ios" | "android" | "web"; device_id: string; active: boolean; created_at: string; updated_at: string;
}

export interface RegisterPushParams { did: string; pushToken: string; platform: "ios" | "android" | "web"; deviceId: string; }

export function registerPushToken(params: RegisterPushParams): PushRegistration {
  const existing = db.findPushRegistration(params.deviceId);
  if (existing) {
    const now = new Date().toISOString();
    db.updatePushRegistration(existing.id, params.pushToken, params.did, now);
    return db.getPushRegistration(existing.id)!;
  }
  const id = uuidv4(); const now = new Date().toISOString();
  db.insertPushRegistration({ id, did: params.did, push_token: params.pushToken, platform: params.platform, device_id: params.deviceId, active: true, created_at: now, updated_at: now });
  return db.getPushRegistration(id)!;
}

export function unregisterPushToken(deviceId: string): void {
  const existing = db.findPushRegistration(deviceId);
  if (existing) db.deactivatePushRegistration(existing.id);
}

export function getPushRegistrations(did: string): PushRegistration[] { return db.getPushRegistrations(did); }

export function getPushHints(did: string): { pendingMessageCount: number; activeDevices: number; pushTokens: string[] } {
  const registrations = getPushRegistrations(did);
  return { pendingMessageCount: db.getUnreadMessageCount(did), activeDevices: registrations.length, pushTokens: registrations.map(r => r.push_token) };
}
