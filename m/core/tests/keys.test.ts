import { describe, it, expect } from "vitest";
import {
  generateEd25519,
  generateX25519,
  sign,
  verify,
  sharedSecret,
  defaultRandom,
  deriveKey,
  KeyInfo,
  generateMwk,
  generateRecoveryPhrase,
  isValidRecoveryPhrase,
  mwkFromRecoveryPhrase,
} from "../src/index.js";

const R = defaultRandom;

describe("keys/keygen", () => {
  it("Ed25519 sign/verify round trip", () => {
    const kp = generateEd25519(R);
    const msg = new TextEncoder().encode("orbis test message");
    const sig = sign(msg, kp.secretKey);
    expect(verify(sig, msg, kp.publicKey)).toBe(true);
  });

  it("rejects tampered message and wrong key", () => {
    const kp = generateEd25519(R);
    const other = generateEd25519(R);
    const msg = new TextEncoder().encode("orbis");
    const sig = sign(msg, kp.secretKey);
    expect(verify(sig, new TextEncoder().encode("orbis!"), kp.publicKey)).toBe(false);
    expect(verify(sig, msg, other.publicKey)).toBe(false);
  });

  it("X25519 shared secret agrees on both sides", () => {
    const a = generateX25519(R);
    const b = generateX25519(R);
    expect(sharedSecret(a.secretKey, b.publicKey)).toEqual(sharedSecret(b.secretKey, a.publicKey));
  });
});

describe("keys/hkdf — key hierarchy", () => {
  it("derives deterministic, purpose-separated subkeys", () => {
    const mwk = generateMwk(R);
    const med1 = deriveKey(mwk, KeyInfo.vault("medical"));
    const med2 = deriveKey(mwk, KeyInfo.vault("medical"));
    const fin = deriveKey(mwk, KeyInfo.vault("financial"));
    const msgs = deriveKey(mwk, KeyInfo.messages);
    expect(med1).toEqual(med2);
    expect(med1).not.toEqual(fin);
    expect(med1).not.toEqual(msgs);
    expect(med1.length).toBe(32);
  });

  it("rejects non-32-byte MWK", () => {
    expect(() => deriveKey(new Uint8Array(16), KeyInfo.messages)).toThrow();
  });
});

describe("recovery phrase", () => {
  it("generates a valid 12-word phrase that re-derives the same MWK", () => {
    const phrase = generateRecoveryPhrase(R);
    expect(phrase.split(" ")).toHaveLength(12);
    expect(isValidRecoveryPhrase(phrase)).toBe(true);
    expect(mwkFromRecoveryPhrase(phrase)).toEqual(mwkFromRecoveryPhrase(phrase.toUpperCase()));
    expect(mwkFromRecoveryPhrase(phrase).length).toBe(32);
  });

  it("different phrases give different MWKs; invalid phrases rejected", () => {
    const a = generateRecoveryPhrase(R);
    const b = generateRecoveryPhrase(R);
    expect(mwkFromRecoveryPhrase(a)).not.toEqual(mwkFromRecoveryPhrase(b));
    expect(isValidRecoveryPhrase("not a real phrase at all")).toBe(false);
    expect(() => mwkFromRecoveryPhrase("nope nope nope")).toThrow();
  });
});
