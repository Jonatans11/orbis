/**
 * DIDComm client conveniences over OrbisApiClient (send / inbox drain / read receipts).
 * Full messaging UX (threads, cache encryption, calls) lands in Phase 4 (task 4.1,
 * DIDComm Engineer) — this module gives every consumer a stable seam to build on.
 */
import type { OrbisApiClient } from "../api/client.js";
import type { DidcommMessage } from "../api/types.js";

export class DidcommClient {
  constructor(private readonly api: OrbisApiClient) {}

  /** Send a DIDComm v2 basic message (server packs authcrypt envelope). */
  sendBasicMessage(from: string, to: string, body: string): Promise<DidcommMessage> {
    return this.api.didcomm.send({
      from,
      to,
      type: "https://didcomm.org/basicmessage/2.0/message",
      body: { content: body },
    });
  }

  /** Fetch pending inbox messages for a DID. */
  async drainInbox(did: string): Promise<DidcommMessage[]> {
    const res = await this.api.didcomm.inbox({ did });
    return Array.isArray(res) ? res : res.messages;
  }

  markRead(messageId: string): Promise<DidcommMessage> {
    return this.api.didcomm.updateStatus(messageId, "read");
  }

  trustPing(from: string, to: string): Promise<Record<string, unknown>> {
    return this.api.didcomm.trustPing({ from, to });
  }

  /** Parse an out-of-band invitation URL (QR scan → contact/credential offer). */
  parseInvitation(url: string) {
    return this.api.didcomm.oobParse(url);
  }
}
