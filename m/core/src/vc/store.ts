/**
 * Encrypted credential store over an injected VaultStore.
 * VC JSON is AES-256-GCM encrypted with the "credentials" HKDF subkey;
 * only list-safe metadata stays plaintext (wallet-specs/03-STORAGE-SCHEMA.md §3).
 */
import type { VaultStore, RandomSource } from "../platform/interfaces.js";
import type { VerifiableCredential, VaultCategory } from "../api/types.js";
import { encryptJson, decryptJson, makeAad } from "../vault/crypto.js";

const TABLE = "credentials";

export interface StoredCredentialMeta {
  id: string;
  category: VaultCategory;
  title: string;
  issuerDid: string;
  types: string[];
  issuedAt?: string | undefined;
  expiresAt?: string | undefined;
}

function issuerDidOf(vc: VerifiableCredential): string {
  return typeof vc.issuer === "string" ? vc.issuer : vc.issuer.id;
}

export class CredentialStore {
  constructor(
    private readonly store: VaultStore,
    /** HKDF-derived credentials key: deriveKey(mwk, KeyInfo.vault("credentials")) */
    private readonly key: Uint8Array,
    private readonly random: RandomSource,
  ) {}

  async save(id: string, category: VaultCategory, title: string, vc: VerifiableCredential): Promise<void> {
    const enc = encryptJson(this.key, vc, this.random, makeAad(id, TABLE));
    await this.store.put({
      id,
      table: TABLE,
      meta: {
        category,
        title,
        issuerDid: issuerDidOf(vc),
        types: JSON.stringify(vc.type),
        issuedAt: vc.validFrom ?? null,
        expiresAt: vc.validUntil ?? null,
      },
      payload: enc.ciphertext,
      iv: enc.iv,
      updatedAt: new Date().toISOString(),
    });
  }

  async list(category?: VaultCategory): Promise<StoredCredentialMeta[]> {
    const rows = await this.store.query({
      table: TABLE,
      ...(category ? { where: { category } } : {}),
    });
    return rows.map((r) => ({
      id: r.id,
      category: String(r.meta["category"]) as VaultCategory,
      title: String(r.meta["title"]),
      issuerDid: String(r.meta["issuerDid"]),
      types: JSON.parse(String(r.meta["types"] ?? "[]")) as string[],
      issuedAt: r.meta["issuedAt"] ? String(r.meta["issuedAt"]) : undefined,
      expiresAt: r.meta["expiresAt"] ? String(r.meta["expiresAt"]) : undefined,
    }));
  }

  /** Decrypt the full VC — requires unlocked wallet (key in memory). */
  async open(id: string): Promise<VerifiableCredential | null> {
    const row = await this.store.get(TABLE, id);
    if (!row) return null;
    return decryptJson<VerifiableCredential>(
      this.key,
      { ciphertext: row.payload, iv: row.iv, alg: "A256GCM" },
      makeAad(id, TABLE),
    );
  }

  async remove(id: string): Promise<void> {
    await this.store.delete(TABLE, id);
  }
}
