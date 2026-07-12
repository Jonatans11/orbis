/**
 * Tests for on-device ZK selective-disclosure proving (m/core/vc/zk).
 * Verifies wire-compatibility with the server verifier in orbis-repo src/vc/zk.ts:
 * same canonicalization, same SHA-256-then-Ed25519 signature, same multibase encoding.
 */
import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { ed25519 } from "@noble/curves/ed25519";
import { base58 } from "@scure/base";
import { randomBytes } from "@noble/hashes/utils";
import {
  createZKPresentation,
  deterministicStringify,
  verifyZKPresentationSignature,
} from "../src/vc/zk.js";
import { didKeyFromEd25519PublicKey } from "../src/did/didkey.js";

function keyPair() {
  const secretKey = randomBytes(32);
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}

function fixture() {
  const holder = keyPair();
  const holderDID = didKeyFromEd25519PublicKey(holder.publicKey);
  const credential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    id: "urn:uuid:cred-1",
    type: ["VerifiableCredential", "HealthRecord"],
    issuer: "did:key:z6MkIssuer",
    credentialSubject: {
      id: holderDID,
      name: "Ada Lovelace",
      bloodType: "O-",
      age: 42,
    },
    proof: { type: "DataIntegrityProof", proofValue: "zIssuerSig" },
  };
  return { holder, holderDID, credential };
}

describe("createZKPresentation (on-device proving)", () => {
  it("hides selected fields behind salted SHA-256 commitments and reveals the rest", () => {
    const { holder, holderDID, credential } = fixture();
    const { proof } = createZKPresentation({
      credential,
      holderDID,
      holderSecretKey: holder.secretKey,
      hideFields: ["bloodType", "age"],
      challenge: "chal-123",
    });

    expect(proof.revealedFields).toEqual(["name"]);
    expect(proof.hiddenFields).toEqual(["bloodType", "age"]);
    expect(proof.hiddenCommitments).toHaveLength(2);

    // Commitment reproducible from value + nonce, opaque without it
    const c = proof.hiddenCommitments.find((x) => x.field === "bloodType")!;
    expect(c.hash).toHaveLength(64);
    expect(c.hash).toBe(bytesToHex(sha256(utf8ToBytes(`O-:${c.nonce}`))));

    // Structure matches the server contract
    expect(proof.type).toEqual(["VerifiablePresentation", "ZKPresentation"]);
    expect(proof.proof.type).toBe("OrbisZKSelectiveDisclosure2025");
    expect(proof.proof.cryptosuite).toBe("orbis-zk-sd-2025");
    expect(proof.proof.challenge).toBe("chal-123");
    expect(proof.proof.proofValue.startsWith("z")).toBe(true);
    expect(proof.id).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("produces a signature the server-side verifier logic accepts (public key only)", () => {
    const { holder, holderDID, credential } = fixture();
    const { proof } = createZKPresentation({
      credential,
      holderDID,
      holderSecretKey: holder.secretKey,
      revealFields: ["name"],
      challenge: "chal-456",
      domain: "orbis.id",
    });

    // Our local mirror of the server's reconstruction
    expect(verifyZKPresentationSignature(proof, holder.publicKey)).toBe(true);

    // Independent re-derivation, exactly as src/vc/zk.ts verifyHolderSignature does
    const payload = {
      id: proof.id,
      holder: proof.holder,
      verifiableCredentialId: proof.verifiableCredential.id,
      revealedFields: proof.revealedFields,
      hiddenFields: proof.hiddenFields,
      hiddenCommitments: proof.hiddenCommitments.map((c) => ({ field: c.field, hash: c.hash })),
      derivedPredicates: [],
      created: proof.proof.created,
      challenge: proof.proof.challenge,
      domain: proof.proof.domain,
    };
    const digest = sha256(utf8ToBytes(deterministicStringify(payload)));
    const sig = base58.decode(proof.proof.proofValue.slice(1));
    expect(ed25519.verify(sig, digest, holder.publicKey)).toBe(true);
  });

  it("rejects signature verification with the wrong public key or tampered fields", () => {
    const { holder, holderDID, credential } = fixture();
    const { proof } = createZKPresentation({
      credential,
      holderDID,
      holderSecretKey: holder.secretKey,
      hideFields: ["age"],
    });

    const stranger = keyPair();
    expect(verifyZKPresentationSignature(proof, stranger.publicKey)).toBe(false);

    const tampered = { ...proof, revealedFields: [...proof.revealedFields, "age"] };
    expect(verifyZKPresentationSignature(tampered, holder.publicKey)).toBe(false);
  });

  it("refuses to prove for a mismatched holder or malformed key", () => {
    const { holder, credential } = fixture();
    expect(() =>
      createZKPresentation({
        credential,
        holderDID: "did:key:z6MkSomeoneElse",
        holderSecretKey: holder.secretKey,
      }),
    ).toThrow(/must match credentialSubject.id/);

    expect(() =>
      createZKPresentation({
        credential,
        holderDID: credential.credentialSubject.id as string,
        holderSecretKey: new Uint8Array(16),
      }),
    ).toThrow(/32 bytes/);

    expect(() =>
      createZKPresentation({
        credential,
        holderDID: credential.credentialSubject.id as string,
        holderSecretKey: holder.secretKey,
        hideFields: ["nonexistent"],
      }),
    ).toThrow(/not found in credential subject/);
  });

  it("matches the server's deterministic stringify on tricky shapes", () => {
    expect(deterministicStringify({ b: 1, a: [null, "x", { d: true, c: 2 }] })).toBe(
      '{"a":[null,"x",{"c":2,"d":true}],"b":1}',
    );
  });
});
