import { describe, it, expect } from "vitest";
import {
  defaultRandom,
  encryptBytes,
  decryptBytes,
  encryptJson,
  decryptJson,
  makeAad,
  generateRecordKey,
  wrapKey,
  unwrapKey,
  sealKeyForRecipient,
  openSealedKey,
  generateX25519,
} from "../src/index.js";

const R = defaultRandom;
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("vault/crypto — AES-256-GCM", () => {
  it("encrypt/decrypt round trip with AAD", () => {
    const key = generateRecordKey(R);
    const aad = makeAad("rec-1", "vault/medical");
    const enc = encryptBytes(key, utf8("blood type O-"), R, aad);
    expect(enc.alg).toBe("A256GCM");
    expect(new TextDecoder().decode(decryptBytes(key, enc, aad))).toBe("blood type O-");
  });

  it("fails on wrong key, tampered ciphertext, and transplanted AAD", () => {
    const key = generateRecordKey(R);
    const aad = makeAad("rec-1", "vault/medical");
    const enc = encryptBytes(key, utf8("secret"), R, aad);
    expect(() => decryptBytes(generateRecordKey(R), enc, aad)).toThrow();
    expect(() => decryptBytes(key, enc, makeAad("rec-2", "vault/medical"))).toThrow();
    const tampered = { ...enc, ciphertext: enc.ciphertext.slice(0, -4) + "AAAA" };
    expect(() => decryptBytes(key, tampered, aad)).toThrow();
  });

  it("unique IV per encryption", () => {
    const key = generateRecordKey(R);
    const a = encryptBytes(key, utf8("x"), R);
    const b = encryptBytes(key, utf8("x"), R);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("JSON helpers round trip", () => {
    const key = generateRecordKey(R);
    const value = { title: "Lab result", items: [1, 2, 3], nested: { ok: true } };
    expect(decryptJson(key, encryptJson(key, value, R))).toEqual(value);
  });
});

describe("vault/crypto — key wrapping", () => {
  it("wrap/unwrap round trip, context-bound", () => {
    const wrapping = generateRecordKey(R);
    const inner = generateRecordKey(R);
    const wrapped = wrapKey(wrapping, inner, R, "keyring/ed25519");
    expect(unwrapKey(wrapping, wrapped, "keyring/ed25519")).toEqual(inner);
    expect(() => unwrapKey(wrapping, wrapped, "keyring/x25519")).toThrow(); // wrong context
    expect(() => unwrapKey(generateRecordKey(R), wrapped, "keyring/ed25519")).toThrow();
    expect(() => unwrapKey(wrapping, "garbage", "keyring/ed25519")).toThrow();
  });
});

describe("vault/seal — ECDH-ES grant sealing", () => {
  it("grantee (and only the grantee) can open a sealed record key", () => {
    const grantee = generateX25519(R);
    const stranger = generateX25519(R);
    const recordKey = generateRecordKey(R);
    const sealed = sealKeyForRecipient(grantee.publicKey, recordKey, R);
    expect(openSealedKey(grantee.secretKey, sealed)).toEqual(recordKey);
    expect(() => openSealedKey(stranger.secretKey, sealed)).toThrow();
  });

  it("full sharing flow: record encrypted with record key, key sealed, grantee decrypts", () => {
    const grantee = generateX25519(R);
    const recordKey = generateRecordKey(R);
    const aad = makeAad("rec-9", "vault/medical");
    const enc = encryptBytes(recordKey, utf8("prescription: 10mg"), R, aad);
    const sealed = sealKeyForRecipient(grantee.publicKey, recordKey, R);
    // grantee side: open key, decrypt record
    const opened = openSealedKey(grantee.secretKey, sealed);
    expect(new TextDecoder().decode(decryptBytes(opened, enc, aad))).toBe("prescription: 10mg");
  });
});
