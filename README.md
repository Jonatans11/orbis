# ORBIS.ID — Self-Sovereign Identity Platform

[![Status](https://img.shields.io/badge/status-alpha-blue)](https://orbis.id)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> A member-owned self-sovereign identity platform where every individual and entity controls a single, verifiable digital identity — without surveillance, without a central data honeypot, and with the ability to prove claims via zero-knowledge proofs without disclosing personal data.

## Overview

ORBIS.ID is a privacy-first digital identity platform. Users generate self-custodied cryptographic keys in their browser, register **Decentralized Identifiers (DIDs)**, receive **Verifiable Credentials (VCs)** from trusted issuers, and present them to verifiers using **zero-knowledge proofs** — all without any central authority or data honeypot.

The platform is **member-owned**: users govern the platform and share in its economics.

### Key Features

- **Self-Custodied Identity** — Private keys generated in-browser via Web Crypto API. Never leave your device.
- **W3C-Compliant DIDs** — Supports `did:key` and `did:web` methods.
- **Verifiable Credentials** — Issue, receive, and present W3C-compliant credentials.
- **Zero-Knowledge Proofs** — Prove claims (age, citizenship, membership) without revealing personal data.
- **Trust Registry** — Curated list of trusted issuers and verifiers.
- **Member Governance** — Identity holders vote on platform decisions.
- **QR-Based Verification** — Instant credential verification via QR code scan.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (Client)                │
│  ┌───────────────────────────────────────┐  │
│  │       TanStack Start (React + SSR)    │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │Landing  │ │  Wallet  │ │Onboard │ │  │
│  │  │  Page   │ │  App     │ │  Flow   │ │  │
│  │  └─────────┘ └──────────┘ └────────┘ │  │
│  │        Web Crypto API (key gen)       │  │
│  └───────────────────────────────────────┘  │
│                    │ HTTP                     │
└────────────────────┼─────────────────────────┘
                     │
┌────────────────────┼─────────────────────────┐
│         Express.js Backend (Port 3001)       │
│  ┌───────────────────────────────────────┐  │
│  │  ┌──────┐ ┌──────┐ ┌──────────────┐ │  │
│  │  │ DID  │ │  VC  │ │ Trust        │ │  │
│  │  │ APIs │ │ APIs │ │ Registry API │ │  │
│  │  └──────┘ └──────┘ └──────────────┘ │  │
│  │  ┌──────┐ ┌──────────────────────┐  │  │
│  │  │DB    │ │  Crypto (ed25519)    │  │  │
│  │  │Layer │ │  + Multiformats      │  │  │
│  │  └──────┘ └──────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Project Structure

```
orbis/
├── site/                          # Frontend — website + wallet PWA
│   ├── src/
│   │   ├── routes/
│   │   │   ├── __root.tsx         # HTML shell, layout, SEO
│   │   │   ├── index.tsx          # Landing page (marketing site)
│   │   │   ├── wallet.tsx         # Wallet dashboard (connected to SSI backend)
│   │   │   └── wallet.onboard.tsx # Onboarding wizard flow
│   │   ├── components/
│   │   │   ├── Header.tsx         # Site navigation
│   │   │   └── Footer.tsx         # Site footer
│   │   └── styles/
│   │       └── app.css            # Design tokens + Tailwind v4 setup
│   ├── public/
│   │   ├── logo/                  # ORBIS.ID brand logos
│   │   ├── illustrations/        # Hero and feature illustrations
│   │   ├── components/           # Trust badges
│   │   ├── og/                   # OG/Twitter banners
│   │   └── icons/                # Icon set
│   ├── package.json              # TanStack Start + React + Tailwind
│   └── vite.config.ts            # Vite configuration
│
├── ssi-backend/                   # Backend — SSI API server (Express)
│   └── src/
│       ├── index.ts               # Server entry, route definitions
│       ├── did/                   # DID creation & resolution (did:key, did:web)
│       ├── vc/                    # Verifiable Credential issuance & verification
│       ├── trust/                 # Trust registry management
│       ├── db/                    # SQLite database layer
│       └── middleware/            # Error handling
│
└── design/                        # Brand design system
    ├── colors/tokens.css          # Design tokens (source of truth)
    ├── logo/                      # SVG logo variants
    ├── icons/                     # SVG icon set (24x24, 1.75px stroke)
    ├── illustrations/            # Marketing illustrations
    ├── components/               # Component specs & trust badges
    ├── marketing/                # OG/Twitter banners
    └── docs/                     # Brand guidelines
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (for the site) or [Node.js](https://nodejs.org) v20+
- npm (for the SSI backend)

### Setup

```bash
# Clone the repository
git clone https://github.com/Jonatans11/orbis.git
cd orbis

# --- Frontend (Site) ---
cd site
bun install
bun run dev          # Dev server on port 3000
bun run publish      # Build & serve production on port 3000

# --- Backend (SSI) ---
cd ../ssi-backend
npm install
PORT=3001 bun run src/index.ts   # SSI server on port 3001
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` (site) | `3000` | Site server port |
| `PORT` (backend) | `3000` | SSI backend port (use `3001` when running alongside site) |
| `SSI_BACKEND_URL` | `http://localhost:3001` | Used by wallet to reach the backend |
| `DATABASE_URL` | — | Postgres connection string (for production) |

## API Endpoints

### DID Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/did/create` | Create a new DID (body: `{method: "key" \| "web"}`) |
| `GET` | `/api/did/list` | List all registered DIDs |
| `GET` | `/api/did/resolve/:did` | Resolve a DID to its DID Document |
| `PUT` | `/api/did/:id/revoke` | Revoke a DID |

### Verifiable Credentials
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vc/issue` | Issue a new VC |
| `POST` | `/api/vc/verify` | Verify a VC |
| `GET` | `/api/vc/credentials` | List issued credentials |
| `GET` | `/api/vc/credentials/:id/verifications` | Verification history |

### Trust Registry
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/trust/register` | Register a trusted entity |
| `GET` | `/api/trust/issuers` | List trusted issuers |
| `GET` | `/api/trust/entities` | List all trust entries |
| `GET` | `/api/trust/check/:did` | Check if a DID is trusted |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | TanStack Start (React 19 + Vite) |
| **Styling** | Tailwind CSS v4 + CSS Design Tokens |
| **SSR** | Server-side rendering via TanStack |
| **Backend** | Express.js v5 (TypeScript) |
| **Database** | SQLite (via Turso for team sync, NeDB for metadata) |
| **Cryptography** | @noble/ed25519, Web Crypto API |
| **DID Methods** | did:key, did:web |
| **VC Format** | W3C Verifiable Credentials (JSON-LD) |
| **Fonts** | Inter (UI), JetBrains Mono (code) |

## Brand

The ORBIS.ID brand system is defined in `/design/`. Key assets:

- **Color palette**: Indigo primary (`#4F46E5`), Cyan accent (`#22D3EE`), Dark base (`#0B1020`)
- **Logo**: Three concentric rings with a checkmark at center
- **Typography**: Inter (UI) + JetBrains Mono (code)
- **Tone**: Calm, precise, privacy-first. "You own your identity."

See `/design/docs/BRAND-GUIDELINES.md` for the full spec.

## Contributing

1. Create a feature branch from `main`: `git checkout -b feat/your-feature`
2. Commit with conventional messages (`feat:`, `fix:`, `chore:`, `docs:`)
3. Push and open a PR to `main`
4. The team lead reviews and squash-merges

## License

MIT — see [LICENSE](LICENSE) for details.
