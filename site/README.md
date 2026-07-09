# ORBIS.ID — Website & Wallet App

The official ORBIS.ID website and self-sovereign identity wallet — a fast, privacy-first web app where users generate and manage their digital identity.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [TanStack Start](https://tanstack.com/start) (React 19 + Vite 7) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) + CSS Design Tokens |
| **SSR** | Server-side rendering (built-in TanStack) |
| **Fonts** | Inter (UI), JetBrains Mono (code) |
| **Icons** | Custom SVG set (24×24, 1.75px stroke) |
| **Backend** | Express.js (separate `ssi-backend/` service) |
| **Key Generation** | Web Crypto API (in-browser, self-custodied) |

## Project Structure

```
site/
├── src/
│   ├── routes/              # Page routes (file-based routing)
│   │   ├── __root.tsx       # HTML shell, layout, SEO meta
│   │   ├── index.tsx        # Landing page (marketing site)
│   │   ├── wallet.tsx       # Wallet dashboard (connected to SSI backend)
│   │   └── wallet.onboard.tsx  # Onboarding wizard (4-step)
│   ├── components/          # Shared UI components
│   │   ├── Header.tsx       # Fixed navigation with logo
│   │   └── Footer.tsx       # Site footer with links
│   └── styles/
│       └── app.css          # Design tokens + Tailwind v4
├── public/
│   ├── logo/                # ORBIS.ID brand logos
│   ├── illustrations/       # Hero and feature SVGs
│   ├── components/          # Trust badges
│   ├── icons/               # SVG icon set
│   ├── og/                  # Open Graph / Twitter banners
│   └── patterns/            # Background patterns
├── package.json
├── vite.config.ts
├── serve.ts                 # Production server entry
├── publish.sh               # Build & publish script
└── vercel-entry.ts          # Vercel serverless adapter
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.3+ (or Node.js v20+)
- SSI Backend (see `../ssi-backend/`)

### Development

```bash
cd site
bun install
bun run dev          # Dev server with HMR on port 3000
```

### Production

```bash
bun run publish      # Build SSR + client, serve on port 3000
```

The publish script (1) builds the app, (2) kills any existing server on port 3000, (3) starts the production server.

### Going Live

```bash
export VERCEL_TOKEN=<your-token>
bun run go-live      # Deploy to Vercel
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing page — hero, features, tiers, CTA |
| `/wallet` | Identity wallet dashboard — DID display, credential count, actions |
| `/wallet/onboard` | Multi-step onboarding — intro, tier select, key gen, recovery phrase |

## Wallet API Integration

The wallet app connects to the SSI backend on `http://localhost:3001` via direct fetch calls. To configure the backend URL, set the `SSI_BACKEND_URL` environment variable (defaults to `http://localhost:3001`).

Key API calls:
- `GET /api/did/list` — fetch registered DIDs
- `POST /api/did/create` — create a new did:key
- `GET /api/vc/credentials` — list verifiable credentials

## Design System

The visual identity is defined in `src/styles/app.css` using CSS custom properties, based on the tokens in `../design/colors/tokens.css`:

- **Primary**: `#4F46E5` (indigo) — CTAs, links, active states
- **Accent**: `#22D3EE` (cyan) — verification signals, badges
- **Surface**: `#FFFFFF` / `#0B1020` (light/dark)
- **Font**: Inter (headings + body), JetBrains Mono (code)
- **Gradient**: Orbit — `linear-gradient(135deg, #6366F1, #4F46E5, #22D3EE)`

See `../design/docs/BRAND-GUIDELINES.md` for the full spec.

## Publishing Changes

```bash
bun run publish
```

This rebuilds and restarts the server. Changes aren't live until you publish.
