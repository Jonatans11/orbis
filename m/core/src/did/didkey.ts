/**
 * did:key creation and parsing (Ed25519, multicodec 0xed01, base58btc multibase).
 * Local-only: creating a did:key never requires the network.
 */
import { base58 } from "@scure/base";

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export function didKeyFromEd25519PublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  const prefixed = new Uint8Array(2 + publicKey.length);
  prefixed.set(ED25519_MULTICODEC, 0);
  prefixed.set(publicKey, 2);
  return `did:key:z${base58.encode(prefixed)}`;
}

export function ed25519PublicKeyFromDidKey(did: string): Uint8Array {
  if (!did.startsWith("did:key:z")) throw new Error(`Not a base58btc did:key: ${did}`);
  const decoded = base58.decode(did.slice("did:key:z".length));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("did:key is not an Ed25519 key");
  }
  return decoded.slice(2);
}

export function isDidKey(did: string): boolean {
  try {
    ed25519PublicKeyFromDidKey(did);
    return true;
  } catch {
    return false;
  }
}
