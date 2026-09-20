# ORBIS.ID — agent guidance

ORBIS.ID is a member-owned self-sovereign identity (SSI) platform: W3C DIDs,
Verifiable Credentials, ZK selective disclosure, DIDComm v2, a trust registry,
a developer gateway, a React web console, and an Expo mobile wallet.

## The reasoning map (read this before changing anything)

Every known decision, law/standard, rule, constraint, roadmap direction, and
principle of this project is recorded in a knowledge graph:

- **`reasoning/reasoning-map.json`** — authoritative machine-readable graph
  (nodes + typed edges + 3D coordinates). Load this to know *why* the project
  is the way it is and what a change may violate.
- **`reasoning/REASONING_MAP.md`** — human-readable index of the same graph.
- **`reasoning/viewer.html`** — self-contained interactive 3D visualization
  (open in any browser; regenerate after data changes with
  `node reasoning/build-viewer.mjs`).

**Before making an architectural, security, cryptographic, governance, or
product decision — or when you need the rationale behind existing behavior —
consult the `reason` subagent** (`.claude/agents/reason.md`). It reads the
map, answers "why" questions with sources, checks proposed changes for
violations, and records new decisions into the map.

If you make a new significant decision in a session, record it in the map
(directly or via the `reason` agent) so the graph stays complete.

## Hard rules that trip up newcomers

- Private keys never persist server-side; `did/create` returns key material
  only in non-production mode.
- The `team-db` CLI accepts **single-line SQL only** — never multi-line
  statements.
- High-frequency DB writes (audit logs, webhooks, usage tracking) must use
  non-blocking async `exec`, never `execSync`.
- ZK predicates are only valid over **hidden** fields.

## Validation

```bash
npm run build        # backend typecheck
npm test             # vitest suites, isolated DB per run
cd web && npm run build
```
