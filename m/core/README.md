# @orbis/wallet-core

Shared TypeScript core for the ORBIS.ID mobile wallet. Consumed by:

- `m/wallet-app` — React Native (Expo) app for iOS/Android
- `m/web` — mobile web PWA served at `/m`

**No UI. No platform APIs.** Platform capabilities (secure storage, structured encrypted storage, randomness) are injected through the interfaces in `src/platform/interfaces.ts`.

Specs: `/home/team/shared/wallet-specs/` (00-ARCHITECTURE, 02-API-SPEC, 03-STORAGE-SCHEMA).

## Modules

| Module | Purpose |
|--------|---------|
| `platform/` | `SecureKV`, `VaultStore`, `RandomSource` interfaces + `defaultRandom` |
| `keys/keygen` | Ed25519 (sign/verify) & X25519 (ECDH) key pairs — @noble/curves |
| `keys/hkdf` | Key hierarchy: MWK generation, HKDF subkey derivation, BIP-39 recovery phrase ↔ MWK |
| `vault/crypto` | AES-256-GCM encrypt/decrypt (12B IV, AAD context binding), per-record keys, key wrapping |
| `vault/seal` | ECDH-ES sealing of record keys for sharing grants (server never sees plaintext keys) |
| `did/didkey` | Local `did:key` create/parse (Ed25519, multicodec 0xed01, base58btc) |
| `api/` | Typed `OrbisApiClient` for all live endpoints + planned `/api/wallet/*` contract |

## Security invariants (do not break)

1. Secret keys never leave the process except **wrapped** (`wrapKey`) or **sealed** (`sealKeyForRecipient`).
2. Every AES-GCM encryption uses a fresh random 12-byte IV.
3. AAD binds ciphertext to its context (`recordId|context|version`) — transplanted ciphertext fails to decrypt.
4. The recovery phrase deterministically re-derives the MWK; the server can never decrypt backups.

## Develop

```bash
npm install
npm test          # vitest — crypto round-trips, DID vectors, API client contract
npm run build     # emits dist/
```

Consumers (Expo/Vite) import `src` directly via their bundlers or the built `dist`.
React Native: install the `expo-crypto` getRandomValues polyfill before importing this package.
