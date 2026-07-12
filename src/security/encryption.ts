/**
 * Encryption at Rest Module for ORBIS.ID SSI Backend.
 *
 * Encrypts sensitive credential data before storing in team-db
 * using AES-256-GCM with a server-side key.
 *
 * Features:
 * - AES-256-GCM with random IV per encryption
 * - Base64-encoded output (IV + auth tag + ciphertext)
 * - Server-side key from ENCRYPTION_KEY env var or auto-generated (dev only)
 * - Key rotation support
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

// ─── Configuration ──────────────────────────────────────────────────────────

const ENCRYPTION_KEY: Buffer = (() => {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (keyHex) {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be 64 hex chars (32 bytes), got ${keyHex.length} chars`
      );
    }
    return key;
  }

  // Auto-generate for development — log a warning
  const devKey = randomBytes(32);
  console.warn(
    "[SECURITY] No ENCRYPTION_KEY set. Generated ephemeral dev key (credentials will be unrecoverable after restart). Set ENCRYPTION_KEY (64 hex chars) in production."
  );
  console.warn(
    `[SECURITY] Dev key (SAVE THIS for dev sessions): ${devKey.toString("hex")}`
  );
  return devKey;
})();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Encrypted payload structure.
 * Stored as a colon-delimited base64 string: iv:authTag:ciphertext
 */
export interface EncryptedPayload {
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

/**
 * Serialize encrypted parts to a single colon-delimited string.
 */
function serialize(iv: Buffer, authTag: Buffer, ciphertext: Buffer): string {
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Deserialize a colon-delimited encrypted string.
 */
function deserialize(payload: string): {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
} {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  return {
    iv: Buffer.from(parts[0]!, "base64"),
    authTag: Buffer.from(parts[1]!, "base64"),
    ciphertext: Buffer.from(parts[2]!, "base64"),
  };
}

// ─── Primary API ────────────────────────────────────────────────────────────

/**
 * Encrypt plaintext string using AES-256-GCM.
 * Returns a colon-delimited base64 string: iv:authTag:ciphertext.
 *
 * @param plaintext - The plaintext to encrypt
 * @returns Encrypted payload string
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf-8")),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return serialize(iv, authTag, ciphertext);
}

/**
 * Decrypt an encrypted payload string produced by encrypt().
 *
 * @param encrypted - Colon-delimited base64 string: iv:authTag:ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(encrypted: string): string {
  const { iv, authTag, ciphertext } = deserialize(encrypted);

  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf-8");
}

/**
 * Encrypt a JSON-serializable object.
 * Convenience wrapper for storing structured data.
 *
 * @param data - Any JSON-serializable value
 * @returns Encrypted payload string
 */
export function encryptJSON(data: unknown): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt and parse JSON data.
 *
 * @param encrypted - Colon-delimited base64 string
 * @returns Decrypted and parsed JSON value
 */
export function decryptJSON<T = unknown>(encrypted: string): T {
  const plaintext = decrypt(encrypted);
  return JSON.parse(plaintext) as T;
}

// ─── Key Rotation ───────────────────────────────────────────────────────────

/**
 * Re-encrypt data from an old key to the current key.
 * This is used during key rotation — decrypt with old key,
 * re-encrypt with current key.
 *
 * @param encrypted - Data encrypted with old key
 * @param oldKey - The previous encryption key (32 bytes hex)
 * @returns Re-encrypted data using current ENCRYPTION_KEY
 */
export function reEncrypt(encrypted: string, oldKeyHex: string): string {
  const oldKey = Buffer.from(oldKeyHex, "hex");
  if (oldKey.length !== 32) {
    throw new Error("oldKey must be 32 bytes (64 hex chars)");
  }

  const { iv, authTag, ciphertext } = deserialize(encrypted);
  const decipher = createDecipheriv(ALGORITHM, oldKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  // Re-encrypt with current key
  const newIv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, newIv);
  const newCiphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const newAuthTag = cipher.getAuthTag();

  return serialize(newIv, newAuthTag, newCiphertext);
}

// ─── Verification ───────────────────────────────────────────────────────────

/**
 * Verify that the current encryption key is valid by encrypting and decrypting
 * a test value. Returns true if the key works correctly.
 */
export function verifyEncryptionKey(): boolean {
  try {
    const testPlaintext = `__ORBIS_ENCRYPTION_TEST__${Date.now()}`;
    const encrypted = encrypt(testPlaintext);
    const decrypted = decrypt(encrypted);
    return timingSafeEqual(
      Buffer.from(testPlaintext),
      Buffer.from(decrypted)
    );
  } catch {
    return false;
  }
}