# Progress Review: ORBIS.ID SSI Infrastructure

This document provides a summary of the recently implemented features, core components, and architectural decisions made in the ORBIS.ID Self-Sovereign Identity platform repository.

## Core Components and Features Developed

1.  **SSI Backend Infrastructure (Express + TypeScript)**
    *   **DIDs & KMS (`src/did/key.ts`, `src/did/web.ts`)**: Implementation of `did:key` and `did:web` methods. Secure KMS envelope encryption/decryption (`envelopeEncryptKey` and `envelopeDecryptKey`) using Node's native `crypto` AES-256-GCM module has been established in `src/did/key.ts`.
    *   **Verifiable Credentials & ZK Proofs (`src/vc/zk.ts`, `src/vc/verify-zk.ts`)**: Implementation of credential issuance, verification, and Zero-Knowledge (ZK) selective-disclosure proving and verification capabilities. On-device ZK selective disclosure proving and `verify-zk` endpoints have been integrated.
    *   **Trust Registry (`src/trust/registry.ts`)**: Authoritative lists and eIDAS trusted lists support has been developed.
    *   **Encrypted Messaging (`src/didcomm/`)**: DIDComm v2 messaging with OOB (out-of-band) invitations has been established, enabling secure interactions.
    *   **Developer Gateway (`src/gateway/`)**: API keys, rate limiting, token-bucket controls, usage tracking, and webhooks are functional.

2.  **Database & Performance Architecture (`scripts/team-db`)**
    *   **Storage**: The project utilizes a custom `team-db` CLI wrapper for Turso/SQLite.
    *   **SQL Formatting**: To accommodate the `team-db` CLI's limitation, all SQL queries have been normalized into single-line statements (multi-line input is not supported).
    *   **Asynchronous Processing**: High-frequency database operations—such as audit logging, webhook deliveries, and usage tracking—are executed using non-blocking asynchronous `exec` processes rather than `execSync` to eliminate performance bottlenecks.

3.  **Frontend & Console (`web/`)**
    *   **Tech Stack**: Built with React 18, Vite 6, and Tailwind CSS 4.
    *   **Features**: Includes a public marketing site and an Identity Console that enables users to manage DIDs, VCs, trust lists (including a W3C StatusList2021 UI Console), messages, and developer configurations.

4.  **Mobile Wallet (`feat/mobile-wallet-init`, etc.)**
    *   **Initialization**: The ORBIS.ID mobile wallet has been initialized using Expo SDK 57, complete with a navigation shell, design system, authentication flows, biometrics integration, and QR code capabilities.
    *   **On-Device Proving**: Features the `wallet.presentVc` client method leveraging on-device ZK selective-disclosure.

5.  **DevOps & CI/CD**
    *   **Docker & CI/CD**: Recent PR merges include Docker configuration, GitHub Actions workflows for continuous integration and deployment (`.github/workflows/ci.yml`, `deploy.yml`), and production deployment readiness (systemd service definitions).
    *   **Testing**: The backend is comprehensively tested using Vitest (`npm test`).

## Next Steps
The infrastructure provides a robust foundation for SSI operations with strict security parameters and a highly concurrent backend architecture.
