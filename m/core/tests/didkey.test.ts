import { describe, it, expect } from "vitest";
import {
  defaultRandom,
  generateEd25519,
  didKeyFromEd25519PublicKey,
  ed25519PublicKeyFromDidKey,
  isDidKey,
} from "../src/index.js";

describe("did/didkey", () => {
  it("round-trips a generated key", () => {
    const kp = generateEd25519(defaultRandom);
    const did = didKeyFromEd25519PublicKey(kp.publicKey);
    expect(did.startsWith("did:key:z6Mk")).toBe(true); // ed25519 multicodec prefix property
    expect(ed25519PublicKeyFromDidKey(did)).toEqual(kp.publicKey);
    expect(isDidKey(did)).toBe(true);
  });

  it("matches the W3C did:key Ed25519 test vector", () => {
    // https://w3c-ccg.github.io/did-method-key/#example-1
    const did = "did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp";
    const pub = ed25519PublicKeyFromDidKey(did);
    expect(pub.length).toBe(32);
    expect(didKeyFromEd25519PublicKey(pub)).toBe(did);
  });

  it("rejects non-did:key inputs", () => {
    expect(isDidKey("did:web:orbis.id")).toBe(false);
    expect(() => ed25519PublicKeyFromDidKey("did:key:zINVALID0OIl")).toThrow();
  });
});
