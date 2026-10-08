# xFlo: Ruflo super agent

xFlo is a Claude Code agent built on [Ruflo](https://github.com/ruvnet/ruflo), the agent meta-harness formerly called
Claude Flow. It runs every objective through a recall → plan/route → coordinate → execute → verify → learn loop. Ruflo
supplies the persistent vector memory, 3-tier model routing, swarms, task tracking and security scans; Claude Code
supplies files, shell and subagents. It works in the Claude Code **desktop app** and in the **CLI**.

| File | Purpose |
|------|---------|
| `xflo.md` | The agent definition: Claude Code subagent format, user-level |
| `install.sh` | Installs xFlo and all its dependencies (macOS, Linux) |

## Install on a Mac

Open **Terminal** and run:

```bash
git clone https://github.com/Jonatans11/orbis.git
cd orbis
git checkout claude/nice-thompson-uz611u     # until the PR is merged
agents/xflo/install.sh
```

Then **quit and reopen Claude Code desktop** (⌘Q, then open it again) so it loads the new agent and MCP server.

The installer is idempotent; re-run it any time, for example after editing `xflo.md`. It installs, in order:

| # | Dependency | How | When |
|---|------------|-----|------|
| 1 | Node.js ≥ 20 | Homebrew (`brew install node`), or [nvm](https://github.com/nvm-sh/nvm) if Homebrew is absent | only if missing or older |
| 2 | Claude Code CLI | official installer (`claude.ai/install.sh`), npm fallback; needed to register the MCP server | only if missing |
| 3 | Ruflo CLI | `npm install -g ruflo@3.55.0` (override with `RUFLO_VERSION=x.y.z`) | always (pinned) |
| 4 | Embedding model | all-MiniLM-L6-v2 (~23 MB) from Hugging Face → `~/.ruvector/models`, for real semantic memory | always; non-fatal if offline |
| 5 | Ruflo MCP server | `claude mcp add --scope user ruflo …`, so tools appear as `mcp__ruflo__*` in every project | always |
| 6 | xflo agent | copied to `~/.claude/agents/xflo.md` (or `$CLAUDE_CONFIG_DIR/agents`) | always |
| 7 | `xflo` command | launcher next to the global npm binaries (`exec claude --agent xflo "$@"`) | always |

The MCP server is registered with absolute paths to `node` and Ruflo, plus your shell's `PATH`. Apps opened from the
Dock don't inherit your shell `PATH`, so without this the desktop app could not find a Homebrew or nvm `node`.

Options:

- `--default-agent` makes xFlo the main agent of **every** Claude Code session, desktop included, by setting
  `"agent": "xflo"` in `~/.claude/settings.json`. Other settings are left untouched.
- `--uninstall` removes the agent, launcher, MCP server and default-agent setting. It leaves Node.js, Claude Code and
  Ruflo installed; `npm uninstall -g ruflo` removes Ruflo.

## Use

**Claude Code desktop:** in any session, ask for it: *"use the xflo agent to add rate limiting to /v1/credentials"*.
If you installed with `--default-agent`, every new session is already xFlo.

**Terminal:**

```bash
xflo                                   # interactive session driven by xFlo
xflo -p "audit the DIDComm module"     # headless
```

Check the wiring with `claude mcp list`, which should show `ruflo: … ✓ Connected`.

## Notes

- Ruflo keeps per-project state (memory DB, swarm state) in the directory it runs in: `.swarm/`, `.claude-flow/` and
  `ruvector.db`. That is local runtime data, and this repo git-ignores it.
- If the embedding-model step warns (offline, or `huggingface.co` blocked), memory still works with hash vectors,
  which carry no semantic meaning. Re-run the installer once you're online to enable real semantic search.
- Some `ruflo` CLI commands start a background worker daemon for the current directory. Stop it with
  `ruflo daemon stop`.
- The Ruflo version is pinned so a new upstream release can't change behaviour silently. Bump `RUFLO_VERSION` in
  `install.sh` deliberately.
