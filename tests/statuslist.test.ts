import { describe, it, expect, beforeAll } from "vitest";
import { initDatabase } from "../src/db/metadata.js";
import * as statusList from "../src/vc/statuslist.js";
import * as didRegistry from "../src/did/index.js";
import { verifyCredential } from "../src/vc/verify.js";
import { issueCredential } from "../src/vc/issue.js";

beforeAll(() => {
  initDatabase();
});

describe("StatusList2021 Core", () => {
  it("should create an empty gzipped base64url status list", () => {
    const list = statusList.createEmptyEncodedList(100);
    expect(list).toBeTruthy();
    expect(typeof list).toBe("string");
  });

  it("should set and check bit statuses", () => {
    let list = statusList.createEmptyEncodedList(100);
    expect(statusList.getBitStatus(list, 10)).toBe(false);

    list = statusList.setBitStatus(list, 10, true);
    expect(statusList.getBitStatus(list, 10)).toBe(true);
    expect(statusList.getBitStatus(list, 9)).toBe(false);

    list = statusList.setBitStatus(list, 10, false);
    expect(statusList.getBitStatus(list, 10)).toBe(false);
  });

  it("should create status list records in database", () => {
    const record = statusList.createStatusList({
      name: "Revocation List",
      issuerDid: "did:key:z6MkhaXgBZDv",
    });

    expect(record.id).toBeTruthy();
    expect(record.name).toBe("Revocation List");
    expect(record.status_purpose).toBe("revocation");

    const resolved = statusList.getStatusList(record.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe("Revocation List");
  });

  it("should perform bit updates inside the database", () => {
    const record = statusList.createStatusList({
      name: "Update Test",
      issuerDid: "did:key:z6MkhaXgBZDv",
    });

    expect(statusList.checkStatusBit(record.id, 15)).toBe(false);

    statusList.updateStatusBit(record.id, 15, true);
    expect(statusList.checkStatusBit(record.id, 15)).toBe(true);
  });

  it("should sign a W3C StatusList2021 Credential", async () => {
    const issuer = await didRegistry.createDIDKey();
    const list = statusList.createStatusList({
      name: "Credential Test",
      issuerDid: issuer.did,
    });

    const vc = await statusList.generateStatusListVC(list.id, issuer.keyPair.secretKey);
    expect(vc).toBeTruthy();
    expect(vc.type).toContain("StatusList2021Credential");
    expect(vc.credentialSubject.encodedList).toBe(list.encoded_list);
  });

  it("should automatically detect and verify revocation from StatusList in verifyCredential", async () => {
    const issuer = await didRegistry.createDIDKey();
    const subject = await didRegistry.createDIDKey();

    const list = statusList.createStatusList({
      name: "Automated Revocation",
      issuerDid: issuer.did,
    });

    // Create a credential that references index 5 in the status list
    const { credential } = await issueCredential({
      issuerDID: issuer.did,
      issuerSecretKey: issuer.keyPair.secretKey,
      subjectDID: subject.did,
      claims: { email: "user@example.com" },
    });

    // Manually inject W3C credentialStatus
    credential.credentialStatus = {
      id: `https://orbis.id/api/status/list/${list.id}#5`,
      type: "StatusList2021Entry",
      statusPurpose: "revocation",
      statusListIndex: "5",
      statusListCredential: `https://orbis.id/api/status/list/${list.id}`,
    };

    // First check: should be verified (bit 5 is 0)
    let result = await verifyCredential(credential);
    expect(result.verified).toBe(true);
    expect(result.checks.some(c => c.name === "revocation-statuslist" && c.passed)).toBe(true);

    // Revoke the credential at index 5
    statusList.updateStatusBit(list.id, 5, true);

    // Second check: should fail verification (bit 5 is 1)
    result = await verifyCredential(credential);
    expect(result.verified).toBe(false);
    expect(result.checks.some(c => c.name === "revocation-statuslist" && !c.passed)).toBe(true);
  });
});