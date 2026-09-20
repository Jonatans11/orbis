# ORBIS.ID Mobile Wallet

React Native (Expo SDK 57, managed workflow) wallet for the ORBIS.ID
self-sovereign identity platform. See `/home/team/shared/MOBILE-WALLET-PLAN.md`
for the full implementation plan.

## Stack

- **Expo SDK 57** / React Native 0.86 / React 19, TypeScript strict mode
- **React Navigation 7** — native stack + bottom tabs
- **expo-secure-store** — keychain-backed secret storage (JWT, DID keys)
- **expo-local-authentication** — Face ID / fingerprint unlock
- **expo-camera** — QR scanning for credential exchange
- **expo-auth-session** — social login (Google/Apple/Microsoft, pending client IDs)
- **expo-notifications** — push notifications
- **react-native-qrcode-svg** — DID/credential QR presentation

## Getting started

```bash
cd m/wallet-app
npm install
npm start          # Expo dev server (scan with Expo Go)
npm run typecheck  # tsc --noEmit
```

The backend base URL is configured in `app.json` under `expo.extra.apiBaseUrl`.

## Structure

```
src/
  components/   # Design-system primitives (Screen, Button, Card, Badge, …)
                # + vault/ (QuotaMeter, GrantRow, ShareStatusPill)
  context/      # AuthContext — loading → onboarding → locked → unlocked
  features/     # vault/ — biometric re-gate, copy, categories, formatting
  navigation/   # RootNavigator (auth stack, main tabs, QR modals, deep links)
  screens/      # Onboarding, Login, Locked, Home, Credentials, Messages,
                # Settings, ScanQR, ShowQR + vault/ (Home, Category, Record,
                # Share, AllShares, Compensation, ShareRedeem)
  services/     # api (ORBIS backend client), walletApi (vault + grants),
                # walletRegistration, vaultCrypto, auth, biometrics
  storage/      # secureStore — single gate for all secrets
  theme/        # Design tokens from /design/colors/tokens.json (dark default)
```

## Data Vault (spec 07)

End-to-end encrypted personal data vault with a consent ledger:

- **On-device encryption** — every record gets a fresh AES-256-GCM key
  (AAD-bound to the record id), wrapped under the device vault master key
  (`services/vaultCrypto.ts` + `@orbis/wallet-core`). The server stores
  ciphertext plus plaintext title/type only.
- **Categories** — medical, financial, assets, documents, identity, with
  notes, key/value fields, camera captures, and picked files as payloads.
- **Selective sharing** — a grant seals the record key to the grantee's
  X25519 key (ECDH-ES); scope `full` or `meta-only`, expiry ≤ 90 days,
  optional requested compensation. Consent is server-authoritative
  (`PATCH /api/wallet/vault/:recordId/consent`).
- **Redemption** — grantees open shares via the `orbisid://share/:grantId`
  deep link, `https://orbis.id/share/:grantId`, or by scanning a share QR;
  shares are DID-bound, never "anyone with the link". Every access lands in
  the member-visible access log.
- **Device binding** — `POST /api/wallet/register` runs after sign-in and
  the returned device id is sent on every request as `X-Orbis-Device-Id`.

## Status (Phase 1 — Foundation)

- [x] Project scaffold, TypeScript strict, path aliases
- [x] Design system tokens (dark fintech theme per design spec)
- [x] Navigation shell: onboarding → login → tabs + QR modals
- [x] Email login/register against `/api/auth/*`
- [x] Biometric unlock gate (opt-in via Settings)
- [x] Secure keychain storage wrapper
- [x] QR scan (expo-camera) and QR display screens
- [ ] Social login — needs OAuth client IDs from owner
- [ ] Push notifications registration
- [ ] DID creation on device (Phase 1 follow-up with SSI Wallet Engineer)
