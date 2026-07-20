# ORBIS.ID Reasoning Map — index

Human-readable index of [`reasoning-map.json`](reasoning-map.json) (the
authoritative machine-readable graph: 217 nodes, 210 typed edges).
Interactive 3D view: open [`viewer.html`](viewer.html) in a browser; regenerate
it after data changes with `node reasoning/build-viewer.mjs`.

Consult the `reason` subagent (`.claude/agents/reason.md`) to query this map,
check a proposed change against it, or record a new decision into it.

Generated 2026-07-20. Do not hand-edit numbers here without updating the JSON.

## Principles — values the project favors (17)

**core**

- `self-sovereign-identity` — **Self-sovereign identity: identity you hold.** Identifiers are self-certifying and holders control their own keys and proofs; the server orchestrates but does not custody secrets by default. Includes data sovereignty: local storage, selective disclosure, right to be forgotten. _(src/index.ts:1-8; web/src/pages/Landing.tsx:25,268)_
- `aligned-economics` — **Members earn from platform success.** Economic alignment: members share the platform's upside through the distribution formula, Orbis Coin, and vested Liberty Fund accumulation. _(web/src/pages/Landing.tsx:21,244-245)_
- `member-owned` — **Member-owned, not corporate-controlled.** The people who create the network's value own it — the platform's founding premise. _(web/src/pages/Landing.tsx:110,169-170,312)_
- `privacy-by-default` — **Privacy-preserving by design.** No personal data on chain; ORBIS stores ciphertext only; members hold 100% control of their data privacy. _(web/src/pages/Landing.tsx:223,268,313; m/wallet-app/src/features/vault/copy.ts:9-11)_
- `user-consent` — **Nothing shared without explicit consent.** Every disclosure requires the holder's explicit approval of who, what, how long, and at what price — and is revocable at any time. _(m/wallet-app/src/features/vault/copy.ts:55-56)_
- `data-minimization` — **Reveal only what is asked.** Selective disclosure proves a fact (over-18, licensed, accredited) without revealing underlying data; fields not requested are hidden automatically. _(web/src/pages/Landing.tsx:27; src/vc/zk.ts:1-15)_
- `on-device-proving` — **Favor holder-side, on-device proving.** ZK proofs and DIDComm require the holder to supply their own secret key per request, binding proofs to holder control instead of server-side key custody. _(src/vc/zk.ts:85-104,167-176,486-552)_
- `unlinkability-goal` — **Favor unlinkable, non-correlatable credentials.** The BBS+ option is described as offering unlinkable (non-correlated) credentials — a design preference for privacy against correlation, currently aspirational. _(src/vc/zk.ts:9-13,480)_
- `user-presence` — **High-value crypto ops require physical presence.** Unlock, signing, ZK proving, and share confirmation require active biometric presence (FaceID/TouchID/fingerprint). _(m/wallet-app/src/context/AuthContext.tsx; NEXT_STEPS_ASSESSMENT.md:36)_
- `auditability` — **Every sensitive operation is auditable.** Every credential access and security event is logged with actor, entity, result, IP, and timestamp; audit trails are exportable and the access log is visible only to the member. _(src/security/audit.ts:1-13; m/wallet-app/src/features/vault/copy.ts:42)_
- `standards-interop` — **Standards-based and interoperable.** The platform builds on W3C DIDs/VCs, DIF protocols, and eIDAS so it interoperates with global SSI systems rather than creating a silo. _(web/src/pages/Landing.tsx:220-223)_
- `honest-ux` — **Honest UX: never claim what hasn't happened.** V1 copy never says money moved before it does and no UI is built against non-existent capability. _(m/wallet-app/src/features/vault/copy.ts:2-6)_
- `non-blocking-io` — **Never block the event loop on logging or writes.** Analytics, audit, verification, webhook, and message writes are pushed to background processes so compliance reporting never blocks critical operations. _(src/db/metadata.ts:36-49; src/security/audit.ts:116-135)_
- `multi-process-consistency` — **Database is source of truth over in-memory cache.** Rate-limit state is loaded from the DB on every request for perfect multi-process consistency, deliberately trading round-trips for correctness. _(src/gateway/ratelimit.ts:88-92,166-170)_
- `least-privilege` — **Least-privilege runtime.** Deployment minimizes privilege: dedicated non-root user, systemd hardening flags, docker no-new-privileges, read-only mounts. _(deploy/orbis-ssi-backend.service:8-22; docker-compose.yml:30-39)_
- `graceful-degradation` — **Degrade gracefully rather than crash.** Resolution, storage, and audit failures degrade (mock docs, empty arrays, degraded health status, non-fatal catches) rather than failing the request. _(src/did/web.ts:188-227; src/index.ts:49-77)_
- `key-reveal-once` — **Secrets revealed once, never re-shown.** Raw API keys are returned only at creation; every list and read path omits the hash and never re-exposes raw keys. _(src/gateway/apikey.ts:131-148)_

## Laws & standards — external rules Orbis obeys (23)

**governance**

- `mica-genius-compliance` — **MiCA & GENIUS Act (crypto-asset regulation).** Orbis Coin is declared compliant with the EU Markets in Crypto-Assets regulation and the US GENIUS Act. _(web/src/pages/Landing.tsx:266,54)_

**did**

- `w3c-did-core` — **W3C DID Core data model.** DID Documents use the https://www.w3.org/ns/did/v1 context with standard verificationMethod, authentication, assertionMethod, keyAgreement, capabilityInvocation, and capabilityDelegation properties. _(src/did/key.ts:29-38; src/did/web.ts:99-110; src/did/peer.ts:116-127)_
- `did-key-spec` — **W3C did:key method.** did:key encodes an Ed25519 public key as z-base58btc(0xed01 multicodec + raw key); resolution is deterministic with no network access. _(src/did/key.ts:66-152)_
- `did-web-spec` — **W3C did:web method.** did:web:<domain>[:<path>] maps to a DID Document served at https://<domain>/.well-known/did.json (or /<path>/did.json), fetched over HTTPS. _(src/did/web.ts:51-163)_
- `did-peer-spec` — **DIF Peer DID method 2.** Offline, self-certifying did:peer:2.E<enc>.V<sign>.S<service> identifiers encoding signing (Ed25519), key-agreement (X25519), and a base64url DIDComm service element. _(src/did/peer.ts:30-128)_
- `multicodec-multibase` — **Multicodec + multibase key encoding.** Public keys carry multicodec varint prefixes (Ed25519 0xed01, X25519 0xec01) then base58btc multibase (z prefix) via the multiformats library. _(src/did/key.ts:11-15,72; src/did/peer.ts:12-16)_
- `ed25519-verification-key-2020` — **Ed25519VerificationKey2020 method type.** All verification methods declare type Ed25519VerificationKey2020 with publicKeyMultibase and the ed25519-2020 security context. _(src/did/key.ts:76-87; src/did/web.ts:92-103)_

**vc**

- `w3c-vc-data-model-2` — **W3C Verifiable Credentials Data Model 2.0.** Credentials use the https://www.w3.org/ns/credentials/v2 context with issuer, issuanceDate, credentialSubject, optional expirationDate and credentialSchema, and urn:uuid ids. _(src/vc/issue.ts:21-34,88-118)_
- `ed25519-signature-2020` — **Ed25519Signature2020 proof suite.** VC proofs use type Ed25519Signature2020, cryptosuite ed25519-2020, proofPurpose assertionMethod, signing over canonicalized credential + proof options, multibase-encoded. _(src/vc/issue.ts:141,161-213)_
- `statuslist-2021` — **W3C StatusList2021 revocation/suspension.** Status is a gzipped, base64url-encoded bitstring (StatusList2021Credential / StatusList2021Entry); bit=1 means revoked or suspended; purposes are revocation and suspension. _(src/vc/statuslist.ts:46-93,167-196)_

**zk**

- `dif-presentation-exchange` — **DIF Presentation Exchange.** Verifiers express required claims via a PresentationDefinition (input_descriptors, constraints, JSONPath fields, filters); the holder evaluates it and auto-generates a matching disclosure. _(src/vc/presentation-exchange.ts:1-117)_
- `bbs-bls-2020` — **BBS+ / BbsBlsSignatureProof2020 suite (declared).** A second ZK cryptosuite bbs-bls-2020 is declared for pairing-based BLS12-381 unlinkable disclosure, selectable per request. _(src/vc/zk.ts:10-13,142-144,215-222)_

**trust**

- `eidas-trusted-lists` — **eIDAS 2.0 QTSP trusted lists.** The trust registry classifies DIDs as QTSP/Non-QTSP with granted/withdrawn/deprecated status; verifyEidasTrust gates a DID as an eIDAS Qualified Trust Service Provider if it is an active trusted issuer. _(src/trust/registry.ts:160-180; tests/eidas.test.ts:9-36)_

**didcomm**

- `didcomm-v2` — **DIDComm Messaging v2.** The messaging layer implements DIF DIDComm v2: authcrypt/anoncrypt encrypted envelopes, standard plaintext message structure, and the application/didcomm-encrypted+json media type. _(src/didcomm/envelope.ts:1-13,196-232; src/didcomm/types.ts:1-61)_
- `didcomm-basicmessage` — **DIDComm BasicMessage 2.0.** Implements https://didcomm.org/basicmessage/2.0/message for plain text messaging. _(src/didcomm/types.ts:63-90)_
- `didcomm-trust-ping` — **DIDComm Trust Ping 2.0.** Implements ping and ping_response for connectivity checks; response_requested defaults true. _(src/didcomm/types.ts:92-147)_
- `didcomm-oob` — **DIDComm Out-of-Band 2.0 invitations.** Encodes inviter DID plus a DIDCommMessaging service (accept didcomm/v2) into a URL parameter for QR/side-channel delivery. _(src/didcomm/types.ts:149-195; src/didcomm/outofband.ts:1-92)_
- `didcomm-mediation` — **DIDComm Coordinate Mediation 2.0.** Routing grants and message forwarding/queueing for offline edge clients. _(src/didcomm/mediation.ts:1-89)_
- `x25519-key-agreement` — **X25519 ECDH key agreement.** Key agreement uses ECDH over X25519 with the standard edwards25519→curve25519 conversion; peer DIDs carry X25519KeyAgreementKey2020 entries in keyAgreement. _(src/didcomm/envelope.ts:15-51; src/did/peer.ts:89-98)_
- `jose-jwe-headers` — **JOSE/JWE-style protected headers (nominal).** Envelope headers advertise alg ECDH-ES+A256KW and enc A256GCM following the JWE shape — but the actual cipher is a custom substitute. _(src/didcomm/envelope.ts:194-209)_

**wallet**

- `wcag-accessibility` — **WCAG accessibility treated as required.** The wallet uses accessibilityRole/Label throughout, announces wizard steps via AccessibilityInfo, marks radio states, and keeps 44px minimum touch targets. _(m/wallet-app/src/screens/vault/VaultShareScreen.tsx:97-103,375-397,604)_
- `expo-conventions` — **Expo managed-workflow conventions.** The wallet follows Expo managed-workflow requirements: app.json plugins, iOS infoPlist usage strings, Android permissions, expo-secure-store keychain, expo-local-authentication, expo-camera, new architecture enabled. _(m/wallet-app/app.json:11-65)_

**ops**

- `openapi-31` — **OpenAPI 3.1 API contract.** The full public API surface is specified as an OpenAPI 3.1.0 document served at /openapi.yaml. _(openapi.yaml:1-7; src/gateway/routes.ts:531)_

## Decisions — choices the project made (55)

**governance**

- `member-ownership` — **Members own 50% of the operating company.** Global Holdings LLC is split 50% Member Trust, 49% XFabrix, 1% SSI Trust; members receive quarterly cash distributions and accumulate wealth in the Liberty Fund. _(web/src/pages/Landing.tsx:17-22,190-192)_
- `perpetual-trust` — **South Dakota Dynasty Trust holds IP and governance in perpetuity.** The ORBIS.ID SSI Trust holds all IP, perpetual governance authority, and a 51% coin reserve; it is creditor-protected and built to exist in perpetuity. _(web/src/pages/Landing.tsx:19,39-44,187-189)_
- `five-entity-structure` — **Five-entity legal structure.** ORBIS.ID SSI Trust (SD), Global Holdings LLC (DE, 50% member-owned), Member Trust (SD, 100% privacy control), Liberty Fund LP (DE, vested 5-15 yrs), and regional subsidiaries in the Netherlands, Singapore, Delaware, UAE, and Mauritius. _(web/src/pages/Landing.tsx:39-45,190-193)_
- `global-compliance` — **Multi-jurisdictional compliance from day one.** The platform commits to GDPR, MiCA, CCPA/CPRA, PIPL, LGPD, eIDAS 2.0, and the GENIUS Act, with hubs across Europe, Asia, the Americas, the Middle East, and Africa. _(web/src/pages/Landing.tsx:20,54,196)_
- `distribution-formula` — **Quarterly member distribution formula.** Distributions split 30% individual activity, 25% equal share, 25% country transaction volume, 10% low-income members, 10% country-weighted equity; 50% of distributions auto-invest into the Liberty Fund (vested 5-15 years). _(web/src/pages/Landing.tsx:31-37,244-245)_
- `orbis-coin` — **Orbis Coin: 100-billion utility token.** 50 coins per verified member, 20% fee discount, governance power, and staking; declared MiCA and GENIUS Act compliant. _(web/src/pages/Landing.tsx:12,266)_
- `multi-tier-democracy` — **One member, one vote democracy.** Members elect the Member Trust Board and SSI Trust directors, can veto privacy changes, and can submit proposals. _(web/src/pages/Landing.tsx:267)_
- `headline-commitments` — **Headline commitments: 50% / 100% / 100B / 5.** The platform publicly commits to 50% member economic ownership, 100% member control of data privacy, a 100-billion coin supply, and 5 regional hubs. _(web/src/pages/Landing.tsx:10-15)_

**did**

- `two-did-methods-plus-peer` — **Support did:key + did:web (did:peer for DIDComm only).** The registry restricts creatable/resolvable methods to key and web, with did:peer reserved for offline DIDComm channels. _(src/did/index.ts:11,79-90; src/index.ts:90-104)_
- `did-web-ttl-cache` — **5-minute TTL cache for did:web resolution.** did:web resolution caches documents in-memory with a 5-minute TTL and a 5-second HTTPS abort timeout to keep resolution non-blocking. _(src/did/web.ts:35-44,146-175)_
- `did-owner-scoping` — **DID records are owner-scoped.** DIDRecord now requires owner_user_id so /api/did/list is scoped per user rather than global — introduced on main after the map's first extraction. _(src/db/metadata.ts (DIDRecord); git c9e36d9)_

**vc**

- `custom-canonicalization` — **Custom deterministic-JSON canonicalization.** Instead of JSON-LD RDF canonicalization, issuance and verification use a home-grown sorted-key deterministic stringify, then SHA-256, then Ed25519 — issuer and verifier must share this exact algorithm. _(src/vc/issue.ts:178-213; src/vc/verify.ts:209-246)_
- `webcrypto-sha256` — **WebCrypto SHA-256 for hashing.** Signature and commitment hashing use crypto.subtle.digest('SHA-256'); the simple ZK verifier uses Node createHash instead. _(src/vc/issue.ts:192-196; src/vc/verify-zk.ts:89-91)_

**zk**

- `orbis-zk-suite` — **Custom OrbisZKSelectiveDisclosure2025 suite.** The default ZK suite (cryptosuite orbis-zk-sd-2025, context https://orbis.id/ns/zkp/v1) hides fields behind SHA-256(value+nonce) 64-hex commitments inside a VerifiablePresentation, with optional Merkle inclusion and derived predicates. _(src/vc/zk.ts:1-15,102-104; tests/zk.test.ts:59-60)_
- `separate-simple-zk-endpoint` — **Separate lightweight hash/Merkle verifier.** verify-zk is a distinct, presentation-free endpoint for direct SHA-256 hash-commitment checks and Merkle-inclusion proofs, avoiding full-presentation overhead. _(src/vc/verify-zk.ts:110-383)_
- `on-device-zk` — **On-device ZK proving via wallet.presentVc.** The wallet's presentVc client method proves selective disclosure on-device, aiming for an Apple/Google-style permission screen showing revealed vs hidden fields before consent. _(PROGRESS_REVIEW.md:25; NEXT_STEPS_ASSESSMENT.md:35)_

**trust**

- `trust-registry-model` — **Trust registry with category + status lifecycle.** Trust entries carry category issuer/verifier/both and status active/suspended/revoked, are uniquely keyed by DID, and list authorized credential types. _(openapi.yaml:294-457; src/trust/registry.ts)_

**gateway**

- `apikey-sha256-hashing` — **API keys stored as SHA-256 hashes.** Raw keys are orb_-prefixed 24 random bytes (base64url); only the SHA-256 hex hash persists; lookup re-hashes the presented key; the raw key is revealed exactly once at creation. _(src/gateway/apikey.ts:43-96)_
- `token-bucket-ratelimit` — **Token-bucket rate limiting persisted in DB.** Rate limiting is a token bucket persisted per API key, reloaded from the DB on every request for multi-process consistency (no in-memory cache). _(src/gateway/ratelimit.ts:1-133)_
- `ratelimit-plan-tiers` — **Tiered quotas: free 100 / developer 1000 / enterprise 10000.** Plans map to bucket sizes refilling maxTokens per 60s; the plan column is added via a runtime ALTER TABLE migration. _(src/gateway/ratelimit.ts:14-30)_
- `webhook-design` — **Webhook fan-out with delivery log and retry.** Webhooks subscribe to credential.issued/credential.verified; delivery is an HTTP POST with X-Webhook-* headers, 10s timeout, 2xx = success; every attempt is logged and retryable by delivery id. _(src/gateway/webhooks.ts:120-244)_
- `bearer-auth-scheme` — **Bearer-token API authentication.** Auth extracts the key from Authorization: Bearer <key>, requiring exactly two space-separated parts. _(src/gateway/middleware.ts:29-50)_
- `dashboard-server-render` — **Server-rendered developer dashboard.** /api/developer/dashboard returns a single server-built HTML page (inline CSS, vanilla JS) showing keys, stats, webhook deliveries with retry, audit trail, and recent requests. _(src/gateway/routes.ts:40-72,407-703)_

**security**

- `noble-crypto` — **Audited @noble libraries for all curve crypto.** All Ed25519 keygen/sign/verify and curve conversion use the audited @noble/ed25519 and @noble/curves async APIs. _(src/did/key.ts:10,50-63; src/vc/issue.ts:8,199)_
- `keys-not-persisted-server-side` — **Private keys never persist server-side.** DID creation returns the keypair to the caller; the DB stores only public material; issuance, ZK proving, and DIDComm all require the caller to pass the secret key per request. _(src/did/index.ts:29-64; src/vc/issue.ts:49-56; src/index.ts:206-245)_
- `aes-256-gcm-envelope` — **AES-256-GCM KMS envelope encryption.** Optional envelope encryption wraps a raw private key with a 32-byte master key using AES-256-GCM (random 12-byte IV, auth tag), returning hex ciphertext/iv/tag. _(src/did/key.ts:189-246)_
- `jwt-bcrypt-auth` — **JWT + bcrypt user authentication.** User auth uses bcrypt (12 rounds) password hashing and 24h HS256 JWTs; a requireJwt Bearer middleware protects routes. _(src/security/jwt.ts:12-23,101-183)_

**data**

- `team-db-shell-store` — **Persistence via team-db shell CLI.** All persistence shells out to a team-db CLI (Turso/SQLite semantics) returning JSON rows, rather than a DB driver; each module carries its own db() helper. _(src/db/metadata.ts:11-49; scripts/team-db:1-44)_
- `turso-shared-store` — **Shared Turso/SQLite store, no DB container.** The backend uses the shared team-db so docker-compose runs without a database container; the host binary is bind-mounted read-only. _(docker-compose.yml:3-8,30-32)_
- `teamdb-python-shim` — **Python SQLite shim for local development.** A local shim (scripts/team-db, python3) fulfills the team-db contract against a local SQLite file (TEAM_DB_PATH, default ./.data/team.db) so backend and tests run anywhere. _(scripts/team-db:1-44; .env.example:26-30)_
- `runtime-migration` — **Idempotent runtime schema migration.** initDatabase creates all tables with IF NOT EXISTS and runs a try/catch-guarded ALTER TABLE for the plan column, since team-db runs one statement per call. _(src/db/metadata.ts:69-115)_
- `async-exec-writes` — **Non-blocking async exec for write/log paths.** Read paths use synchronous execSync; high-volume writes (usage logs, audit logs, messages, webhook deliveries) use non-blocking exec callbacks so logging never blocks the event loop. _(src/db/metadata.ts:42-63; src/gateway/usage.ts:37-55)_
- `env-var-contract` — **Environment variable contract.** The contract: PORT (3001), NODE_ENV, JWT_SECRET, ENCRYPTION_KEY, DATABASE_URL, TEAM_DB_PATH; CI adds TEAM_DB_SYNC_URL; deploy adds REGISTRY/IMAGE_NAME. _(.env.example:1-31; .github/workflows/ci.yml:13-14)_

**web**

- `web-stack-react18` — **Web stack: React 18 + Vite 6 + Tailwind CSS 4.** The frontend uses React 18.3, Vite 6, Tailwind CSS 4 (@tailwindcss/vite), react-router-dom 7, lucide-react, and TypeScript 5.7. _(web/package.json:13-27)_
- `vite-proxy-api` — **Dev server proxies /api to the backend.** The Vite dev server (:5173) proxies /api to http://localhost:3001 with changeOrigin, so all web API calls are relative. _(web/vite.config.ts:10-16)_
- `identity-console` — **Identity Console at /app.** The console (ConsoleLayout) has routes for Overview, DIDs, Credentials, Trust, Messages, Developer, Audit, and Status Lists; the public marketing site lives at /. _(web/src/App.tsx:13-30)_
- `statuslist-ui-console` — **Dedicated StatusList2021 UI console.** The console includes a StatusList2021 panel to create lists and set/check revocation bits by index. _(web/src/pages/console/StatusLists.tsx:98-200)_
- `site-tanstack-marketing` — **site/ is a standalone TanStack Start marketing site.** site/ is an SSR TanStack Start (React 19 + Vite + Tailwind) app on port 3000, Bun-run, driven by site.json — a 'coming soon' placeholder meant to grow into the dynamic public site, distinct from the web/ console SPA. _(site/SITE.md:1-40; site/package.json)_
- `web-vitest-harness` — **Web frontend tests: Vitest + jsdom + Testing Library.** Vitest is configured with globals, jsdom environment, a jest-dom setup file, and css:true; scripts test/test:watch/test:coverage. _(web/vite.config.ts:1-16; web/src/test/setup.ts)_
- `web-eslint-flat-config` — **Flat ESLint config with typescript-eslint + react-hooks.** web/eslint.config.js extends js and typescript-eslint recommended plus react-hooks rules, warns on no-unused-vars (ignoring _-prefixed) and no-explicit-any, ignoring dist/. _(web/eslint.config.js:1-24)_

**wallet**

- `expo-sdk-57` — **Mobile wallet on Expo SDK 57.** The wallet uses Expo SDK 57 (React Native 0.86 / React 19), React Navigation 7, strict TypeScript, dark default theme — note the web app remains on React 18. _(m/wallet-app/README.md:3-16; m/wallet-app/app.json:8)_
- `biometric-gating` — **Biometrics gate the wallet.** expo-local-authentication (FaceID/TouchID/fingerprint) gates the app through an auth state machine: loading → onboarding → locked → unlocked, with opt-in unlock in Settings. _(m/wallet-app/src/services/biometrics.ts; src/context/AuthContext.tsx:1-88)_
- `e2e-share-encryption` — **End-to-end encrypted vault sharing.** Vault records are encrypted on-device with a per-record AES-256-GCM key (AAD-bound to record id) wrapped under a keychain-held device master key; sharing seals only that record's key for the grantee's X25519 key (ECDH-ES) — the server sees ciphertext only. _(m/wallet-app/src/services/vaultCrypto.ts:1-116)_
- `wallet-api-base-url` — **Wallet talks to https://orbis.ctonew.app.** The wallet's live backend base URL is https://orbis.ctonew.app, overridable via app.json extra.apiBaseUrl, with a JWT bearer held in the secure store. _(m/wallet-app/src/services/api.ts:12-43)_
- `wallet-server-tables` — **Wallet server owns 9 tables in the shared store.** initWalletTables creates wallet_devices, wallet_backup_items, vault_records, vault_grants, grant_access_log, refresh_tokens, wallet_push_tokens, wallet_message_queue, and oauth_identities. _(src/wallet/db.ts:31-41)_
- `wallet-consent-toggle` — **Per-record consent flag: private ↔ monetizable.** PATCH /vault/:recordId/consent toggles between private (default) and monetizable (opt-in to compensation requests); toggling never auto-shares — explicit per-grant consent is still required — and the change is audit-logged. _(src/wallet/routes.ts:293-345)_
- `wallet-grants-dual-role` — **Unified grant list spans grantor and grantee roles.** GET /grants unions grants the user owns with grants received by their DID, deriving status active/expired/revoked and an is_paid flag. _(src/wallet/routes.ts:412-459)_

**ops**

- `bun-runtime` — **Bun 1.3 runtime with multi-stage Docker.** Production containers run on Bun 1.3 via a two-stage Dockerfile (deps → runtime) with curl only for the healthcheck; CI standardizes on Bun 1.3 too. _(Dockerfile:1-35; .github/workflows/ci.yml:25-28)_
- `systemd-node-tsx` — **systemd deployment via node --import tsx.** A systemd unit runs the service as a dedicated orbis user under /opt/orbis-ssi-backend with node --import tsx, hardening flags, restart-on-failure, and journal logging — a different runtime than the Docker path. _(deploy/orbis-ssi-backend.service:1-25)_
- `ci-pipeline` — **CI: typecheck + tests + gated Docker build.** CI runs on pushes to main/feat/fix/chore branches and PRs to main: Bun install, tsc --noEmit, vitest, then a Docker build that runs only on push and depends on tests passing. _(.github/workflows/ci.yml:1-72)_
- `deploy-pipeline` — **Deploy: push image to GHCR on main.** On push to main, tests run then a Docker image is built and pushed to ghcr.io with sha/branch/semver/latest tags; the actual cloud deploy step is a documented placeholder. _(.github/workflows/deploy.yml:1-79)_
- `port-3001` — **Fixed port 3001 contract.** The service listens on 3001 across the env default, docker-compose mapping and healthcheck, Dockerfile EXPOSE, and the OpenAPI local server URL. _(.env.example:7-8; Dockerfile:27-31; openapi.yaml:11-13)_

## Rules — invariants enforced in code and tests (70)

**did**

- `did-format-guard` — **DIDs must match known method prefixes.** Resolution and creation reject inputs not matching did:, did:key:z, did:web:, or did:peer:2.; unknown methods return null/400. _(src/did/index.ts:79-90; src/did/key.ts:108-115)_
- `ed25519-multicodec-guard` — **Reject non-Ed25519 or wrong-length keys.** Decoders require the 0xed01 multicodec prefix and a 32-byte public key; mismatches return null. _(src/did/key.ts:120-126,162,180-183)_
- `did-web-doc-id-match` — **Fetched did:web document id must match the DID.** A remotely fetched did.json is only accepted if doc.id equals the requested DID; otherwise resolution falls through to the local DB then a mock. _(src/did/web.ts:177-186)_
- `did-registry-lifecycle` — **DID lifecycle: active → revoked.** Created DIDs persist with status active; resolve returns the stored document; revoke sets status revoked; tests pin this lifecycle. _(tests/ssi.test.ts:142-216)_
- `did-key-shape-tests` — **did:key document shape pinned by tests.** Tests enforce: ^did:key:z prefix, 32-byte keys, single Ed25519VerificationKey2020 VM with id ${did}#${suffix}, controller = did, deterministic generation from seed, and null for invalid input. _(tests/ssi.test.ts:38-98)_

**vc**

- `vc-verify-check-chain` — **Verification is an all-must-pass check chain.** verifyCredential runs structure → expiration → issuer-DID resolution → proof signature → optional trust registry → optional required types → StatusList revocation; verified is true only if every check passes. _(src/vc/verify.ts:48-112)_
- `expiry-check` — **Expired credentials fail verification.** If expirationDate is present and past (or unparseable) the check fails; absent expiration passes as non-expiring. _(src/vc/verify.ts:144-161)_
- `proof-vm-must-match` — **Proof verified only against its named verification method.** The proof's verificationMethod must exist in the resolved DID document; the public key is taken from that specific VM and the signature must validate over recomputed canonical data. _(src/vc/verify.ts:177-246)_
- `revocation-check` — **StatusList2021 revocation gate.** If a StatusList2021Entry credentialStatus exists, verification reads the bit at statusListIndex; bit=1 fails verification and flips a previously-valid VC to unverified. Unsupported status types pass through. _(src/vc/verify.ts:285-320; tests/statuslist.test.ts:71-109)_
- `status-update-validation` — **StatusList updates validated.** Updates require a listId, a non-negative numeric index within list bounds, and a boolean status. _(src/index.ts:574-600; src/vc/statuslist.ts:63-82)_
- `vc-issuance-contract` — **Issuance contract pinned by tests.** Issued VCs must carry a urn:uuid id, the requested types, correct issuer/subject/claims, an Ed25519Signature2020 assertionMethod proof, and support expirationDate, additionalContexts, and credentialSchema; issuance under 5s. _(tests/ssi.test.ts:220-316)_
- `vc-metadata-logging` — **Issuance and verification leave metadata trails.** Issuance persists credential metadata (issuer, subject, id, status active); every verification appends a verification log row. _(tests/ssi.test.ts:774-827)_
- `vc-claims-fidelity` — **Claims survive round-trips with full fidelity.** Claims preserve mixed types (string/number/bool/null/nested/array); empty claims yield a subject with only id; 10k-character values survive. _(tests/ssi.test.ts:831-887)_

**zk**

- `holder-must-equal-subject` — **ZK holder must equal credentialSubject.id.** createZKProof throws unless the holder DID matches the credential subject id, binding the presentation to the credential's subject. _(src/vc/zk.ts:167-169)_
- `zk-field-partition` — **Every field revealed XOR hidden.** Reveal/hide sets must exist in the subject, never overlap, and jointly account for every subject field; commitment count must equal hidden count with 64-hex hashes. _(src/vc/zk.ts:198-203,421-483)_
- `predicates-over-hidden-only` — **Predicates only valid over hidden fields.** A derived predicate (e.g. age >= 18) must reference a field in hiddenFields with a matching commitment; predicates on revealed fields fail verification. _(src/vc/zk.ts:544-578; tests/zk.test.ts:499-575)_
- `zk-challenge-replay-guard` — **Challenge binding prevents replay.** A verifier-supplied challenge must equal the challenge embedded in the proof or holder-binding fails; /zk/challenge mints 32-byte random challenges with 5-minute expiry. _(src/vc/zk.ts:521-524; src/index.ts:481-493)_
- `bbs-blinding-required` — **BBS+ commitments must carry a blinding factor.** When the cryptosuite is bbs-bls-2020, each hidden commitment must include a blindingFactor scalar or verification fails. _(src/vc/zk.ts:474-477)_
- `zk-verification-checks` — **ZK verification check chain.** Verification runs zk-structure, original-vc signature, hidden-commitments, and holder-binding checks; tampered reveals, tampered VCs, removed commitments, and wrong challenges each fail their named check. _(tests/zk.test.ts:214-409)_
- `zk-commitment-math` — **Commitment math pinned by tests.** sha256Hex is deterministic 64-hex; hashWithNonce differs by nonce; hash commitments verify only on exact match; Merkle roots and inclusion proofs recompute correctly and reject wrong siblings. _(tests/verify-zk.test.ts:19-333)_
- `presentation-auto-disclosure` — **Requested fields revealed, everything else hidden.** generatePresentationFromQuery auto-reveals fields requested by the presentation definition and auto-hides all others; the generated presentation must verify. _(tests/presentation-exchange.test.ts:12-77)_

**trust**

- `trust-registry-active-check` — **Trusted issuer must be active and type-authorized.** Trust checks fail if the issuer is absent, not active, or lacks the required authorizedCredentialTypes; category must be issuer or both. _(src/vc/verify.ts:248-272; src/trust/registry.ts:141-158)_
- `trust-registry-lifecycle` — **Registry lifecycle pinned by tests.** Duplicate DIDs are rejected; suspend↔reactivate toggles trust; revoke/remove drop trust; revoking an issuer flips previously-valid VCs to unverified when trust checking is on. _(tests/ssi.test.ts:441-770)_

**didcomm**

- `encrypt-then-mac` — **Encrypt-then-MAC with constant-time tag check.** Envelopes compute ciphertext then an HMAC-SHA256 tag over protected||ciphertext; decryption recomputes and compares byte-by-byte before decrypting. _(src/didcomm/envelope.ts:218-223,325-344)_
- `inbox-access-rule` — **Inbox vs history query scoping.** The inbox returns only messages where to_did = did; history returns messages where the DID is sender OR recipient, newest first; status lifecycle sent→delivered→read. _(src/db/metadata.ts:291-297; src/didcomm/index.ts:174-199)_

**gateway**

- `scope-enforcement` — **Per-request scope enforcement.** requireAuth rejects missing/malformed auth (401), unknown/revoked keys (401), and keys lacking a required scope (403); scopes are membership checks against a fixed set (did:read/write, vc:issue/verify, trust:read/write). _(src/gateway/middleware.ts:29-72)_
- `revoked-key-invalid` — **Revoked keys resolve to null.** findApiKey returns null when revoked_at is set, so revoked keys fail auth; revocation only sets revoked_at where currently null. _(src/gateway/apikey.ts:113-128)_
- `ratelimit-after-auth` — **Rate limiting runs after auth, keyed by key id.** The rate-limit middleware passes through unauthenticated requests and otherwise decrements the bucket for the API key, returning 429 with Retry-After when empty. _(src/gateway/middleware.ts:74-100,145-147)_
- `ratelimit-header-hardcoded` — **X-RateLimit-Limit hardcoded to 100.** The middleware always emits X-RateLimit-Limit: 100 regardless of plan tier, so the advertised limit disagrees with the enforced quota for developer/enterprise keys. _(src/gateway/middleware.ts:86)_
- `usage-after-routes` — **Usage middleware wraps res.json, logs async.** Usage tracking monkey-patches res.json to capture status and response time, logs in the background, must be registered after routes, and skips unauthenticated requests. _(src/gateway/middleware.ts:102-140)_
- `usage-analytics` — **Usage stats aggregate per key and endpoint.** Stats aggregate total/success/error counts, average response time, and per-endpoint breakdown; unknown keys yield zeros; aggregate stats expose totalRequests and activeKeys. _(tests/gateway.test.ts:121-157)_
- `webhook-url-validation` — **Webhook URL and event validation.** Registration rejects URLs not starting with http(s):// and event lists outside credential.issued/credential.verified; deletion and listing are scoped to the owning API key. _(src/gateway/webhooks.ts:66-117)_
- `html-escaping` — **Dashboard HTML escaping.** Dashboard cell values pass through escHtml to reduce stored XSS in rendered key names, emails, and paths. _(src/gateway/routes.ts:701-703)_
- `admin-key-seed-once` — **Admin API key seeded only when none exist.** On boot the server seeds a full-scope orb_ admin key (sha256-hashed, printed once) only if the api_keys table is empty. _(src/index.ts:1132-1165)_

**security**

- `kms-wrong-key-fails` — **Wrong master key must fail decryption.** The AES-256-GCM envelope round-trips, and decryption under a different master key must throw (auth tag mismatch); master keys must decode to exactly 32 bytes. _(tests/kms.test.ts:5-42; src/did/key.ts:199-231)_
- `secretkey-32-byte-check` — **Secret keys must be 32-byte hex.** Issue, ZK, DIDComm, and status endpoints reject any supplied secret key that does not decode to exactly 32 bytes. _(src/index.ts:342-344,527-528,789-790)_
- `password-min-8` — **Passwords ≥ 8 chars; emails normalized.** Registration and password change reject passwords under 8 characters; emails are lowercased, trimmed, and unique. _(src/security/jwt.ts:83-108,200-206)_
- `bearer-token-format` — **Strict Bearer <jwt> header enforcement.** requireJwt rejects requests lacking an Authorization header, not shaped exactly 'Bearer <token>', or carrying an invalid/expired token. _(src/security/jwt.ts:153-183)_
- `linked-did-format` — **Linked DID must start with did:.** PUT /api/auth/did rejects a DID that is not a string starting with did:. _(src/security/jwt.ts:358-364)_
- `debug-key-production-guard` — **Debug key material suppressed in production.** DID creation only attaches a _debug block (public key hex) when NODE_ENV is not production, explicitly to avoid exposing key material in production. _(src/index.ts:213-218)_
- `audit-logging` — **Append-only audit log for sensitive operations.** All sensitive operations (did.*, vc.*, zk.*, trust.*, auth.*, compliance.*, key rotation) log actor type/id, action, entity, result, IP, and timestamp; writes are async and never crash the caller. _(src/security/audit.ts:41-135; tests/audit.test.ts:10-30)_
- `audit-actor-derivation` — **Actor and client IP derivation.** Actor is user (req.user.sub), else api_key (req.apiKey.id), else unknown; client IP prefers the first x-forwarded-for entry, then req.ip, then 0.0.0.0. _(src/security/audit.ts:194-217)_
- `audit-db-constraints` — **Audit rows constrained by CHECK enums.** ssi_audit_log enforces actor_type IN (user, api_key, system, unknown) and result IN (success, failure) at the schema level, with entity/timestamp/actor indexes. _(src/security/audit.ts:41-56)_

**data**

- `metadata-only-store` — **No personal data in the metadata store.** The team-db store holds only non-sensitive indexed metadata (DID/credential/trust metadata); personal data never touches this store. _(src/db/metadata.ts:4-9)_
- `sql-quote-escaping` — **Single-quote doubling as SQL escaping.** Values are interpolated via a quote() helper that null-checks and doubles single quotes (SQLite escaping) — string escaping, not parameterization. _(src/db/metadata.ts:258-262)_
- `sql-execfilesync-no-shell` — **SQL executed via execFileSync argv, no shell.** New admin/wallet modules pass SQL as an argv element to execFileSync('team-db', [sql]) — avoiding shell interpolation so bcrypt hashes and whitespace survive — with quote-doubling as the only injection guard. _(src/admin/auth.ts:23-41; src/wallet/routes.ts:21-35)_

**web**

- `web-console-validation` — **Console input validation.** Console inputs expect did:key:z…/did:web:… formats, a 32-byte hex issuer secret in a password field, valid JSON bodies with explicit error messages, and required status-list fields. _(web/src/pages/console/*.tsx)_
- `web-smoke-test` — **Landing smoke test uses getAllByText.** App.test.tsx renders Landing in a MemoryRouter and asserts getAllByText(/ORBIS\.ID/i).length >= 1 — deliberately not getByText, because the wordmark appears multiple times. _(web/src/test/App.test.tsx:6-27)_

**wallet**

- `consent-wizard` — **Every share answers WHO / WHAT / HOW LONG / PRICE.** A 4-step wizard collects recipient, scope, duration, and price before any grant, reviews it in a plain-language sentence, and confirms with biometrics before sealing on-device. _(m/wallet-app/src/features/vault/copy.ts:2-6; VaultShareScreen.tsx:41,173-195)_
- `share-requires-keyagreement` — **Shares blocked without a resolvable X25519 key.** Sharing is blocked if the grantee DID has no resolvable key-agreement key; shares are DID-bound — never 'anyone with the link'. _(m/wallet-app/src/screens/vault/VaultShareScreen.tsx:117-122,296-297)_
- `grant-max-90-days` — **Grant expiry capped at 90 days.** Custom grant durations must be 1-90 days (MAX_GRANT_DAYS=90); the server rejects longer expiries. _(m/wallet-app/src/services/walletApi.ts:107; VaultShareScreen.tsx:141-162)_
- `vault-regate` — **Vault re-gates after 5 minutes.** The vault requires fresh biometric auth when the last auth is older than 5 minutes (VAULT_AUTH_TTL_MS); devices without enrolled biometrics fall through to the app lock. _(m/wallet-app/src/features/vault/session.ts:1-36)_
- `honest-money-copy` — **Money copy says 'requested', never 'earned'.** Compensation copy uses the verb 'request compensation' and status 'pending' only; never earned/paid/balance until money actually moves, and no payout-method UI is built. _(m/wallet-app/src/features/vault/copy.ts:2-6,17-19)_
- `title-plaintext-only` — **Only record titles are plaintext server-side.** The only plaintext the server sees is record metadata (title ≤120 chars + type); the title helper warns to keep personal details out; the body is ciphertext. _(m/wallet-app/src/services/walletApi.ts:29-33)_
- `blob-quota-limits` — **512 KB per record, 50 MB per vault.** Per-record blobs are capped at 512 KB and total vault quota at 50 MB, with quota warnings and vault-full copy. _(m/wallet-app/src/services/walletApi.ts:105-106)_
- `network-retry-dedupe` — **Share retries dedupe against recent grants.** On a network error after a share POST, the client checks for a just-created (<2 min) matching non-revoked grant before retrying, avoiding duplicate grants. _(m/wallet-app/src/screens/vault/VaultShareScreen.tsx:216-234)_
- `wallet-device-binding` — **Device identity via X-Orbis-Device-Id header.** Wallet installs are bound per device: /register mints walletId and deviceId, platform must be ios/android/web, and the device id header identifies subsequent requests. _(src/wallet/routes.ts:52-89)_
- `wallet-remote-wipe` — **Remote wipe surfaces as HTTP 410 WALLET_WIPED.** GET /status returns 410 WALLET_WIPED if any of the user's devices is flagged wiped; the admin wipe endpoint requires a reason and audit-logs admin.wallet.wipe. _(src/wallet/routes.ts:95-108,680-702)_
- `wallet-payload-cap-50mb` — **Single encrypted payload capped at 50 MB.** Backup and vault PUT endpoints reject ciphertext over 50 MB with 413; the encryption algorithm defaults to A256GCM. _(src/wallet/routes.ts:176,230)_
- `wallet-server-ciphertext-only` — **Wallet server persists only encrypted blobs.** Vault and backup rows store ciphertext, IV, and algorithm; list endpoints omit ciphertext by default and the vault list never returns it. _(src/wallet/routes.ts:192-194,248)_
- `wallet-zk-present-endpoint` — **Server verifies on-device ZK presentations.** POST /vc/present verifies a selective-disclosure proof the wallet generated and signed on-device (the holder secret never leaves the device); failures return 403 with per-check detail. _(src/wallet/routes.ts:524-632)_

**ops**

- `health-endpoint` — **/api/health liveness contract.** GET /api/health returns status/version/service/timestamp and is the liveness probe for docker-compose and Dockerfile healthchecks (curl, 30s interval). _(openapi.yaml:15-27; docker-compose.yml:23-28)_
- `error-handling-contract` — **Uniform error/404 JSON contract.** AppError yields {error:true,message} with its status; unknown errors return a generic 500 with no internals leaked; 404s return 'Resource not found'; all errors log with stack. _(src/middleware/error.ts:1-44)_

## Constraints — accepted limitations (34)

**did**

- `did-web-mock-fallback` — **did:web falls back to an empty mock document.** If the HTTPS fetch fails and no local record exists, resolution returns a mock DID Document with empty verification arrays (cached 5 min) — resolution can 'succeed' with no keys. _(src/did/web.ts:188-227)_
- `resolvedid-not-awaited` — **resolveDID promise not awaited in resolve endpoint.** GET /api/did/resolve/:did truthiness-checks an un-awaited Promise, so did:web resolution results are mishandled at this endpoint — a known defect recorded here until fixed. _(src/index.ts:137-149)_
- `broken-did-owner-field` — **did/index.ts omits owner_user_id and calls a missing helper.** insertDID calls omit the now-required owner_user_id and did/index.ts:138 calls getPublicKeyFromVerificationMethod which does not exist on did/key — both are tsc errors on main. _(src/did/index.ts:29,56,138)_

**vc**

- `verify-vm-derivation-fragile` — **verificationMethod derived by string-splitting the DID.** Issuance builds the VM id as ${issuerDID}#${lastSegment}, which aligns only with did:key fragments; did:web VMs (uuid fragment) can mismatch at verification. _(src/vc/issue.ts:167; src/did/web.ts:82-84)_
- `issuance-perf-noop` — **Issuance timing telemetry is a no-op.** issuanceTimeMs measures Date.now() - startTime where both are captured after issuance completes — always ~0ms placeholder telemetry. _(src/index.ts:262-271)_
- `broken-statuslist-persistence` — **StatusList persistence layer missing (typecheck fails).** src/vc/statuslist.ts imports db.insertStatusList/getStatusListById/updateStatusListEncoded and the StatusListRecord type, none of which exist in src/db/metadata.ts — npm run build fails on main. _(src/vc/statuslist.ts:106-171 vs src/db/metadata.ts)_

**zk**

- `bbs-simulated` — **BBS+ is simulated, not real pairing crypto.** The bbs-bls-2020 path simulates BBS+ by hashing 'BBS+Commitment:<value>:<blindingFactor>' with a random-UUID blinding factor and Ed25519-signing — no real pairing-based unlinkability. _(src/vc/zk.ts:215-222,258-263)_
- `predicate-not-cryptographic` — **Predicates verified structurally, not cryptographically.** Range predicates are checked only for statement/field/proof presence and a matching commitment; the predicate math is never evaluated, so its truth is trusted, not proven. _(src/vc/zk.ts:544-578)_
- `zk-hash-not-circuit` — **ZK is hash-commitment based, not a ZK circuit.** Selective disclosure uses SHA-256 + nonce commitments and Merkle proofs rather than a full zero-knowledge circuit; derived-predicate proof strings are simplified. _(tests/zk.test.ts:517-520)_

**didcomm**

- `envelope-crypto-substitution` — **Custom SHA-256 stream cipher substitutes AEAD.** Instead of XChaCha20-Poly1305/A256GCM, the envelope uses a self-rolled SHA-256-counter XOR keystream with hand-rolled HMAC and HKDF-like derivation — explicitly a simplified interim construction. _(src/didcomm/envelope.ts:53-153)_
- `single-recipient-envelope` — **Single-recipient envelopes only.** Encryption targets one recipient (msg.to[0]); the recipients array has a single entry and decryption reads recipients[0]. _(src/didcomm/index.ts:109; src/didcomm/envelope.ts:236-261)_
- `non-random-message-id` — **Message IDs use Math.random UUIDs.** DIDComm message IDs come from a Math.random-based UUIDv4, not crypto-random — an accepted shortcut for correlation IDs (the gateway uses randomBytes by contrast). _(src/didcomm/types.ts:199-214)_
- `mediation-fetch-not-atomic` — **Queue fetch-then-clear is non-atomic.** fetchAndClearQueue reads queued rows synchronously then marks them delivered via a background write; the read and status flip are not transactional. _(src/didcomm/mediation.ts:80-89)_

**gateway**

- `full-scope-public-registration` — **Public self-registration grants all scopes.** The unauthenticated /api/developer/register endpoint issues a key with the full scope set from just a name and email, with no verification. _(src/gateway/routes.ts:79-113)_
- `webhook-schema-drift` — **Webhook delivery schema mismatch.** initDatabase creates webhook_deliveries with columns event/status_code/response_body but the webhook code reads/writes event_type/response_status — an internal schema inconsistency. _(src/db/metadata.ts:104 vs src/gateway/webhooks.ts:163,187)_

**security**

- `jwt-secret-ephemeral` — **Auto-generated JWT secret invalidates tokens on restart.** If JWT_SECRET is unset a random per-process secret is generated (dev only), invalidating all JWTs on restart; .env.example instructs openssl rand -hex 32 for production. _(src/security/jwt.ts:20-22; .env.example:13-23)_
- `broken-jwtpayload-admin` — **req.user.admin read but JwtPayload has no admin field.** JwtPayload defines only sub/email/did/iat/exp, yet req.user?.admin is read in wallet routes (5 sites) and index.ts (2 sites): a compile error, and at runtime tokens never carry admin so every wallet admin endpoint returns 403. _(src/security/jwt.ts:39-45 vs src/wallet/routes.ts:643-736; src/index.ts:272,415)_

**data**

- `single-line-sql` — **team-db accepts single-line SQL only.** The CLI supports neither multi-line SQL nor multiple statements per call, so every query is whitespace-collapsed to one line and each DDL statement is a separate invocation. _(src/db/metadata.ts:8-9,17-34)_
- `raw-sql-interpolation` — **SQL built by string interpolation.** With no parameter binding available through the CLI, all queries interpolate values directly, relying on quote-doubling — an accepted injection surface (some paths escape only ad hoc). _(src/gateway/webhooks.ts:130; src/vc/verify-zk.ts:401; src/index.ts:1149-1152)_
- `async-write-loss-risk` — **Background writes have no durability guarantee.** Fire-and-forget audit/usage/message/webhook writes only console.error on failure, so failed compliance writes are silently lost — the accepted price of non-blocking IO. _(src/security/audit.ts:126-134; src/gateway/usage.ts:50-54)_
- `serial-tests` — **Test suites run serially on one DB.** Vitest runs with fileParallelism false and a fresh temp SQLite DB per run; suites share one team-db file and must run sequentially to avoid write races. _(vitest.config.ts:6-18)_

**web**

- `broken-web-lockfile` — **web/package-lock.json out of sync — npm ci fails.** The web testing/lint devDependencies (vitest, @testing-library/react, eslint, jsdom and their trees) are in web/package.json but absent from package-lock.json, so the CI web lane aborts at npm ci. _(web/package.json:24-46 vs web/package-lock.json)_

**wallet**

- `record-key-device-bound` — **Per-record keys live only on the originating device.** A record fetched on a device without its key fails to decrypt (RECORD_KEY_MISSING) — cross-device key sync does not exist yet. _(m/wallet-app/src/services/vaultCrypto.ts:91-98)_
- `scope-full-or-meta` — **Share scope: full or meta-only.** V1 share scope is limited to full or meta-only; field-level sharing is not yet available. _(m/wallet-app/src/services/walletApi.ts:27)_
- `usd-only` — **Compensation currency is USD only.** Only USD is supported for share compensation; more currencies are promised later. _(m/wallet-app/src/screens/vault/VaultShareScreen.tsx:193,460)_
- `ios-portrait-dark-only` — **iOS: no tablet, portrait, dark only.** app.json sets supportsTablet false, portrait orientation, and a dark-only UI. _(m/wallet-app/app.json:6-12)_
- `wallet-quota-not-enforced` — **50 MB vault quota reported but not enforced.** /status reports quotaLimitBytes of 50 MB and usage as SUM(vault_records.size), but writes only check per-payload size — total quota is not enforced server-side. _(src/wallet/routes.ts:109-119)_
- `wallet-refresh-esm-gap` — **Refresh handler uses require() in an ESM module.** POST /refresh calls CommonJS require('crypto')/require('jsonwebtoken') in a type:module package and, when JWT_SECRET is unset, signs with a per-call random secret that can never verify later tokens. _(src/wallet/routes.ts:504-519)_
- `broken-wallet-no-jwt-middleware` — **Wallet routes mounted without JWT middleware.** app.use('/api/wallet', walletRoutes) claims per-route requireJwt in a comment, but no handler attaches it and req.user is never populated — wallet endpoints return 401 Authentication required. _(src/index.ts:758; src/wallet/routes.ts)_

**ops**

- `main-ci-red` — **Both CI lanes fail on current main.** As of 2026-07-18, main's last 8 CI runs failed: the Bun lane on backend typecheck errors (statuslist persistence, JwtPayload.admin, admin health ActionType, DID owner fields) and the Node web lane on the out-of-sync lockfile. Any PR against main inherits red CI until these are fixed. _(.github/workflows/ci.yml; GitHub Actions history)_
- `ssi-backend-legacy-duplicate` — **ssi-backend/ is a stale legacy duplicate of src/.** Top-level ssi-backend/ is the pre-expansion lineage (db/did/middleware/trust/vc only — no admin, wallet, security, gateway, didcomm); history shows it was merged into root src/, which is now the superset source of truth. _(ssi-backend/; git log ('ssi-backend wins conflicts as deployed truth'))_

## Directions — roadmap, TODOs, planned evolution (18)

**governance**

- `roadmap-p1-foundation` — **Phase 01 (Years 1-2): Foundation.** US and EU launch, 10M members, first partnerships. _(web/src/pages/Landing.tsx:48)_
- `roadmap-p2-growth` — **Phase 02 (Years 3-5): Growth.** Expansion to Asia-Pacific, Middle East, and Latin America; 100M members; break-even. _(web/src/pages/Landing.tsx:49)_
- `roadmap-p3-acceleration` — **Phase 03 (Years 6-10): Acceleration.** Global presence, 500M members, dominant market position. _(web/src/pages/Landing.tsx:50)_
- `roadmap-p4-maturity` — **Phase 04 (Years 11+): Maturity.** 1B+ members, the global standard for identity, perpetual operation. _(web/src/pages/Landing.tsx:51)_

**vc**

- `credentialstatus-backcompat` — **credentialStatus injection kept for back-compat.** The issue endpoint supports injecting a credentialStatus after issuance 'for backward compatibility' — a transitional path. _(src/index.ts:257-260)_

**didcomm**

- `xchacha-todo` — **Move to real XChaCha20-Poly1305 AEAD.** Comments direct that production DIDComm should use XChaCha20-Poly1305 via @noble/ciphers; the current construction is interim. _(src/didcomm/envelope.ts:55-62)_
- `oob-base-url-todo` — **Make the OOB base URL configurable.** OOB_BASE_URL is hardcoded to https://orbis.id/oob with a note that production should make it configurable. _(src/didcomm/outofband.ts:17-21,43)_
- `wallet-didcomm-ux` — **Chat-like DIDComm UI in the wallet.** Planned: a chat-like interface for DIDComm v2 messages translating OOB invitations into simple Accept Connection prompts, with deep biometric coupling for high-value operations. _(NEXT_STEPS_ASSESSMENT.md:35-37)_

**security**

- `remove-debug-in-prod` — **Remove debug key exposure for production.** An inline comment directs removing the _debug public-key block entirely in production deployments. _(src/index.ts:213-218)_

**web**

- `uiux-guided-tours` — **Guided tours and visual trust indicators.** Planned: react-joyride onboarding tours, visual verified/hidden-field indicators, and Recharts/Chart.js gateway analytics dashboards. _(NEXT_STEPS_ASSESSMENT.md:19-21)_
- `admin-trust-mgmt` — **Deeper admin control surfaces.** Planned: bulk eIDAS trusted-list import/export, granular trust-request approval workflow, audit/compliance filter/search/export views, temporary key suspension, and rate-limit metric views. _(NEXT_STEPS_ASSESSMENT.md:27-29)_

**wallet**

- `wallet-phase1` — **Wallet Phase 1 complete; follow-ups pending.** Done: scaffold, tokens, nav shell, email auth, biometric unlock, keychain, QR. Pending: social login, push-notification registration, on-device DID creation. _(m/wallet-app/README.md:43-54)_
- `social-login-pending` — **Social login stubbed until OAuth IDs supplied.** signInWithProvider (Google/Apple/Microsoft via expo-auth-session) throws until the owner supplies OAuth client IDs. _(m/wallet-app/src/services/auth.ts:35-39)_
- `share-field-level` — **Field-level selective sharing coming.** Sharing specific fields is 'coming soon'; it will relax the full/meta-only scope constraint. _(m/wallet-app/src/features/vault/copy.ts:29)_
- `payments-pending` — **Payments and payouts not yet live.** Compensation is recorded per share and payable when payouts launch; USD only for now. _(m/wallet-app/src/features/vault/copy.ts:31-32)_
- `ondevice-did-pending` — **On-device DID creation pending.** Creating DIDs on-device in the wallet is a Phase 1 follow-up not yet implemented. _(m/wallet-app/README.md:54)_

**ops**

- `deploy-target-todo` — **Cloud deploy target not configured.** The deploy workflow explicitly ends with 'Deployment target not configured — extend this workflow for your cloud provider', with commented Railway/Fly.io/Kubernetes examples. _(.github/workflows/deploy.yml:69-79)_
- `site-vercel-golive` — **site/ deploys to Vercel via go-live script.** bun run go-live bundles the SSR handler via vercel-entry.ts into .vercel/output, deploys, and makes the project public using only a VERCEL_TOKEN — no Git integration. _(site/SITE.md:32-58; site/go-live.sh)_

## Relations

Edges use: implements, enforces, constrains, enables, derives-from, conflicts-with, part-of, motivates. Query them from the JSON — each edge is `{source, relation, target}`.
