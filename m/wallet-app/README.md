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
  context/      # AuthContext — loading → onboarding → locked → unlocked
  navigation/   # RootNavigator (auth stack, main tabs, QR modals)
  screens/      # Onboarding, Login, Locked, Home, Credentials, Vault,
                # Messages, Settings, ScanQR, ShowQR
  services/     # api (ORBIS backend client), auth, biometrics
  storage/      # secureStore — single gate for all secrets
  theme/        # Design tokens from /design/colors/tokens.json (dark default)
```

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
