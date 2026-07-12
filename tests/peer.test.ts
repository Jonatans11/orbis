import { describe, it, expect } from "vitest";
import { generatePeerDIDMethod2, resolvePeerDIDMethod2 } from "../src/did/peer.js";

describe("did:peer Method 2", () => {
  it("should generate a valid did:peer Method 2 identifier", () => {
    const signingPublicKey = new Uint8Array(32).fill(1);
    const encryptionPublicKey = new Uint8Array(32).fill(2);
    const serviceEndpoint = "https://mediator.orbis.id/didcomm";

    const peerDID = generatePeerDIDMethod2({
      signingPublicKey,
      encryptionPublicKey,
      serviceEndpoint
    });

    expect(peerDID).startsWith("did:peer:2.");
    expect(peerDID).toContain(".V");
    expect(peerDID).toContain(".E");
    expect(peerDID).toContain(".S");
  });

  it("should resolve a did:peer Method 2 identifier to a fully populated DID Document", () => {
    const signingPublicKey = new Uint8Array(32).fill(3);
    const encryptionPublicKey = new Uint8Array(32).fill(4);
    const serviceEndpoint = "https://mediator.orbis.id/didcomm";

    const peerDID = generatePeerDIDMethod2({
      signingPublicKey,
      encryptionPublicKey,
      serviceEndpoint
    });

    const doc = resolvePeerDIDMethod2(peerDID);
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe(peerDID);
    expect(doc!.verificationMethod.length).toBe(2);
    expect(doc!.authentication).toHaveLength(1);
    expect((doc as any).service).toBeDefined();
    expect((doc as any).service[0].serviceEndpoint).toBe(serviceEndpoint);
  });
});