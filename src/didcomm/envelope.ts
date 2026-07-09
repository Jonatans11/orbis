/**
 * DIDComm v2 Message Envelope encryption/decryption.
 *
 * Implements the DIDComm v2 envelope wire format:
 * - Authcrypt: Authenticated encryption (ECDH key agreement via X25519)
 * - Anoncrypt: Anonymous encryption (no sender authentication)
 *
 * Key agreement: Ed25519 → X25519 key derivation via @noble/curves edwardsToMontgomery
 * Symmetric encryption: XOR cipher with HMAC-SHA256 authentication tag
 */

import { x25519, edwardsToMontgomeryPub, edwardsToMontgomeryPriv } from "@noble/curves/ed25519";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";

const _sha256 = (data: Uint8Array): Uint8Array => createHash("sha256").update(data).digest();

const IV_LENGTH = 16;

// ─── Key Agreement: Ed25519 → X25519 Conversion ──────────────────────────────

/**
 * Convert an Ed25519 public key to an X25519 public key (montgomery form).
 */
export function ed25519PublicKeyToX25519(ed25519Pub: Uint8Array): Uint8Array {
  if (ed25519Pub.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${ed25519Pub.length}`);
  }
  return edwardsToMontgomeryPub(ed25519Pub);
}

/**
 * Convert an Ed25519 secret key (seed) to an X25519 secret key.
 */
export function ed25519SecretKeyToX25519(ed25519Sec: Uint8Array): Uint8Array {
  if (ed25519Sec.length !== 32) {
    throw new Error(`Invalid Ed25519 secret key length: ${ed25519Sec.length}`);
  }
  return edwardsToMontgomeryPriv(ed25519Sec);
}

/**
 * Compute an ECDH shared secret between X25519 keys.
 */
export function computeSharedSecret(
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(mySecretKey, theirPublicKey);
}

// ─── Symmetric Encryption (Encrypt-then-MAC) ─────────────────────────────────

/**
 * Derive a symmetric encryption key using HKDF-like extract-and-expand.
 */
function deriveKey(sharedSecret: Uint8Array, salt: Uint8Array, info: string): Uint8Array {
  const prk = hmacSha256(salt, sharedSecret);
  const data = new Uint8Array(info.length + 1);
  for (let i = 0; i < info.length; i++) data[i] = info.charCodeAt(i);
  data[data.length - 1] = 0x01;
  return hmacSha256(prk, data);
}

/**
 * HMAC-SHA256.
 */
function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  if (key.length > blockSize) {
    key = _sha256(key);
  }
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(key);
    key = padded;
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = key[i] ^ 0x5c;
    iKeyPad[i] = key[i] ^ 0x36;
  }

  const inner = _sha256(concatBytes(iKeyPad, message));
  return _sha256(concatBytes(oKeyPad, inner));
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

/**
 * XOR stream cipher using SHA-256 keystream.
 */
function xorCipher(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  let offset = 0;
  let counter = 0;

  while (offset < data.length) {
    const counterBytes = new Uint8Array(4);
    counterBytes[0] = (counter >> 24) & 0xff;
    counterBytes[1] = (counter >> 16) & 0xff;
    counterBytes[2] = (counter >> 8) & 0xff;
    counterBytes[3] = counter & 0xff;

    const keystreamInput = concatBytes(concatBytes(key, iv), counterBytes);
    const keystreamBlock = _sha256(keystreamInput);

    const remaining = data.length - offset;
    const chunkSize = Math.min(32, remaining);

    for (let i = 0; i < chunkSize; i++) {
      result[offset + i] = data[offset + i] ^ keystreamBlock[i];
    }

    offset += chunkSize;
    counter++;
  }

  return result;
}

// ─── DIDComm Envelope ────────────────────────────────────────────────────────

export type EncryptionType = "authcrypt" | "anoncrypt";

/**
 * Encrypt a plaintext message into a DIDComm envelope.
 */
export async function encryptEnvelope(
  plaintext: string,
  senderDID: string,
  senderSecretKey: Uint8Array,
  recipientDID: string,
  recipientPublicKey: Uint8Array,
  type: EncryptionType = "authcrypt"
): Promise<string> {
  const senderX25519Sec = ed25519SecretKeyToX25519(senderSecretKey);
  const recipientX25519Pub = ed25519PublicKeyToX25519(recipientPublicKey);
  const sharedSecret = computeSharedSecret(recipientX25519Pub, senderX25519Sec);

  const iv = randomBytes(IV_LENGTH);
  const encKey = deriveKey(sharedSecret, iv, type === "authcrypt" ? "OrbisDIDCommAuth" : "OrbisDIDCommAnon");

  const protectedHeaders: Record<string, any> = {
    type: "application/didcomm-encrypted+json",
    alg: "ECDH-ES+A256KW",
    enc: "A256GCM",
  };
  if (type === "authcrypt") {
    protectedHeaders.from = senderDID;
  }

  const protectedJson = JSON.stringify(protectedHeaders);
  const protectedB64 = uint8ArrayToBase64Url(Buffer.from(protectedJson));

  const plaintextBytes = Buffer.from(plaintext);
  const ciphertext = xorCipher(encKey, iv, plaintextBytes);
  const tagInput = concatBytes(Buffer.from(protectedB64), ciphertext);
  const tag = hmacSha256(encKey, tagInput);

  const envelope: Record<string, any> = {
    ciphertext: uint8ArrayToBase64Url(ciphertext),
    iv: uint8ArrayToBase64Url(iv),
    protected: protectedB64,
    tag: uint8ArrayToBase64Url(tag),
    type: "application/didcomm-encrypted+json",
  };

  if (type === "anoncrypt") {
    envelope.recipientKey = uint8ArrayToBase64Url(recipientX25519Pub);
  } else {
    const ephemKey = x25519.getPublicKey(senderX25519Sec);
    const encKeyForRecipient = deriveKey(sharedSecret, new Uint8Array(IV_LENGTH).fill(0), "key_wrap");
    const encryptedKey = xorCipher(
      encKeyForRecipient,
      iv,
      Buffer.from(JSON.stringify({ k: uint8ArrayToBase64Url(encKey) }))
    );

    envelope.recipients = [
      {
        recipientKey: uint8ArrayToBase64Url(ephemKey),
        encrypted_key: uint8ArrayToBase64Url(encryptedKey),
        header: { kid: "#key-agreement-1", from: senderDID },
      },
    ];
  }

  return JSON.stringify(envelope);
}

/**
 * Decrypt a DIDComm envelope back to plaintext.
 */
export async function decryptEnvelope(
  envelopeJson: string,
  recipientSecretKey: Uint8Array,
  senderPublicKey?: Uint8Array
): Promise<string> {
  const envelope = JSON.parse(envelopeJson) as Record<string, any>;

  const ciphertext = base64UrlToUint8Array(envelope.ciphertext);
  const iv = base64UrlToUint8Array(envelope.iv);
  const tag = base64UrlToUint8Array(envelope.tag);
  const protectedB64 = envelope.protected as string;

  const protectedJson = Buffer.from(base64UrlToUint8Array(protectedB64)).toString();
  const protectedHeaders = JSON.parse(protectedJson);

  const myX25519Sec = ed25519SecretKeyToX25519(recipientSecretKey);

  let sharedSecret: Uint8Array;

  if (envelope.recipients && envelope.recipients.length > 0) {
    const ephemPub = base64UrlToUint8Array(envelope.recipients[0].recipientKey);
    sharedSecret = computeSharedSecret(ephemPub, myX25519Sec);
  } else if (envelope.recipientKey) {
    const theirPub = base64UrlToUint8Array(envelope.recipientKey);
    if (senderPublicKey) {
      const senderX25519Pub = ed25519PublicKeyToX25519(senderPublicKey);
      sharedSecret = computeSharedSecret(senderX25519Pub, myX25519Sec);
    } else {
      sharedSecret = computeSharedSecret(theirPub, myX25519Sec);
    }
  } else {
    throw new Error("Invalid envelope: no recipients or recipientKey found");
  }

  const encKey = deriveKey(
    sharedSecret,
    iv,
    protectedHeaders.from ? "OrbisDIDCommAuth" : "OrbisDIDCommAnon"
  );

  const tagInput = concatBytes(Buffer.from(protectedB64), ciphertext);
  const expectedTag = hmacSha256(encKey, tagInput);

  if (tag.length !== expectedTag.length) {
    throw new Error("Tag verification failed: length mismatch");
  }
  for (let i = 0; i < tag.length; i++) {
    if (tag[i] !== expectedTag[i]) {
      throw new Error("Tag verification failed: invalid authentication tag");
    }
  }

  const plaintextBytes = xorCipher(encKey, iv, ciphertext);
  return Buffer.from(plaintextBytes).toString();
}

// ─── Base64URL Encoding/Decoding ─────────────────────────────────────────────

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  return Buffer.from(base64url, "base64url");
}