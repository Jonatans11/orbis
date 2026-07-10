# ORBIS.ID — Global Self-Sovereign Identity Platform

Member-owned SSI infrastructure: W3C DIDs, Verifiable Credentials, ZK selective
disclosure, DIDComm v2 messaging, a trust registry, and a developer gateway —
plus a modern web frontend (public site + identity console).

## Repository layout

```
├── src/            SSI backend (Express + TypeScript)
│   ├── did/        did:key / did:web creation & resolution (Ed25519)
│   ├── vc/         credential issuance, verification, ZK proofs
│   ├── trust/      trust registry
│   ├── didcomm/    encrypted DIDComm v2 messaging + OOB invitations
│   ├── gateway/    API keys, rate limiting, usage analytics, webhooks
│   └── db/         metadata store (team-db / SQLite)
├── web/            Frontend (React 18 + Vite 6 + Tailwind CSS 4)
│   └── src/
│       ├── pages/Landing.tsx        public marketing site
│       └── pages/console/           identity console (DIDs, VCs, trust, messages, developer)
├── scripts/team-db local SQLite shim for the team-db CLI
├── openapi.yaml    OpenAPI 3.1 spec for the backend API
└── tests/          vitest suites (100 tests)
```

## Quick start

### 1. Backend (port 3001)

The backend shells out to a `team-db` CLI for storage. For local development a
SQLite-backed shim is included:

```bash
chmod +x scripts/team-db
ln -sf "$(pwd)/scripts/team-db" /usr/local/bin/team-db   # or add scripts/ to PATH

npm install
npm run dev          # tsx watch src/index.ts → http://localhost:3001
```

Data lands in `./.data/team.db` (override with `TEAM_DB_PATH`).

### 2. Frontend (port 5173)

```bash
cd web
npm install
npm run dev          # http://localhost:5173 (proxies /api → :3001)
```

- `/` — public site (vision, structure, member benefits, roadmap)
- `/app` — identity console: create/resolve/revoke DIDs, issue & verify
  credentials, ZK selective-disclosure proofs, trust registry management,
  DIDComm messaging, and developer API keys with live usage analytics.

### 3. Validate

```bash
npm run build        # backend typecheck (tsc --noEmit)
npm test             # 100 vitest tests, isolated DB per run
cd web && npm run build   # frontend typecheck + production bundle
```

## API

Full spec in [`openapi.yaml`](openapi.yaml). Highlights:

| Area | Endpoints |
|---|---|
| DIDs | `POST /api/did/create`, `GET /api/did/resolve/:did`, `GET /api/did/list`, `PUT /api/did/:id/revoke` |
| Credentials | `POST /api/vc/issue`, `POST /api/vc/verify`, `GET /api/vc/credentials` |
| ZK proofs | `POST /api/vc/zk/prove`, `POST /api/vc/zk/verify`, `POST /api/vc/zk/challenge` |
| Trust registry | `POST /api/trust/register`, `GET /api/trust/issuers`, `GET /api/trust/check/:did` |
| DIDComm | `POST /api/didcomm/send`, `GET /api/didcomm/inbox`, `POST /api/didcomm/oob/create` |
| Gateway | `POST /api/developer/register`, `GET /api/gateway/stats`, `GET /api/gateway/keys` |

Secrets never persist server-side: issuing, proving, and sending require the
caller to supply the relevant private key (hex), and `did/create` returns key
material only in non-production mode.

## Security notes

- Ed25519Signature2020 proofs via `@noble` cryptography.
- ZK selective disclosure: SHA-256 field commitments with reveal/hide sets and
  derived predicates (predicates are only valid over hidden fields).
- DIDComm v2 envelopes: Ed25519 → X25519 ECDH (authcrypt/anoncrypt),
  encrypt-then-MAC.
- Gateway keys are stored as SHA-256 hashes; scopes enforced per request;
  token-bucket rate limiting per key.
