import { describe, it, expect, beforeAll } from "vitest";
import { initDatabase } from "../src/db/metadata.js";
import { addTrustedEntity, verifyEidasTrust, removeEntity, listTrustedEntities } from "../src/trust/registry.js";

beforeAll(() => {
  initDatabase();
});

describe("eIDAS Trusted Lists & Interoperability", () => {
  it("should verify QTSP trust status on active trusted issuers", () => {
    const did = `did:key:z6MkuQTSpEidasTest${Math.floor(Math.random() * 100000)}`;

    const entry = addTrustedEntity({
      did,
      name: "EU Qualified Trust Service Provider",
      category: "both",
      authorizedCredentialTypes: ["VerifiableID"],
      addedBy: "system-admin",
    });

    // QTSP verification should pass
    const isQTSP = verifyEidasTrust(did, "QTSP");
    expect(isQTSP).toBe(true);

    // Non-QTSP verification should also pass (as active)
    const isAnyTrust = verifyEidasTrust(did, "Any");
    expect(isAnyTrust).toBe(true);

    // Clean up
    removeEntity(entry.id);
  });

  it("should fail QTSP trust verification on non-existent DIDs", () => {
    const isQTSP = verifyEidasTrust("did:key:z6MkuUnknownEidasDID");
    expect(isQTSP).toBe(false);
  });
});