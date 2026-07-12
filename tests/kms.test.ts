import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { envelopeEncryptKey, envelopeDecryptKey } from "../src/did/key.js";

describe("KMS Envelope Encryption Utilities", () => {
  it("should successfully encrypt and decrypt raw keys", () => {
    const rawKey = crypto.randomBytes(32);
    const masterKeyHex = crypto.randomBytes(32).toString("hex");

    // Encrypt
    const envelope = envelopeEncryptKey(rawKey, masterKeyHex);
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.iv).toBeDefined();
    expect(envelope.tag).toBeDefined();

    // Decrypt
    const decrypted = envelopeDecryptKey(
      envelope.ciphertext,
      envelope.iv,
      envelope.tag,
      masterKeyHex
    );

    expect(Buffer.from(decrypted).toString("hex")).toBe(rawKey.toString("hex"));
  });

  it("should fail decryption when using the wrong master key", () => {
    const rawKey = crypto.randomBytes(32);
    const masterKeyHex1 = crypto.randomBytes(32).toString("hex");
    const masterKeyHex2 = crypto.randomBytes(32).toString("hex");

    const envelope = envelopeEncryptKey(rawKey, masterKeyHex1);

    expect(() => {
      envelopeDecryptKey(
        envelope.ciphertext,
        envelope.iv,
        envelope.tag,
        masterKeyHex2
      );
    }).toThrow();
  });
});