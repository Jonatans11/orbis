# xFlo: Ruflo super agent

xFlo is a Claude Code agent built on [Ruflo](https://github.com/ruvnet/ruflo), the agent meta-harness formerly called
Claude Flow. It runs every objective through a recall → plan/route → coordinate → execute → verify → learn loop. Ruflo
supplies the persistent vector memory, 3-tier model routing, swarms, task tracking and security scans; Claude Code
supplies files, shell and subagents.

| File | Purpose |
|------|---------|
| `xflo.md` | The agent definition: Claude Code subagent format, user-level |
| `install.sh` | Global installer: Ruflo CLI, MCP registration, agent and `xflo` launcher |

## Install (global)

Requires Node.js 20+ and npm; Claude Code is needed for the MCP registration and the launcher.

```bash
agents/xflo/install.sh
```

This:

1. runs `npm install -g ruflo@3.55.0` (override with `RUFLO_VERSION=x.y.z`);
2. registers Ruflo's MCP server with Claude Code at **user scope** as `ruflo`
   (`claude mcp add --scope user ruflo -- <npm-bin>/ruflo mcp start`), so its tools appear as `mcp__ruflo__*`
   in every project;
3. copies `xflo.md` to `~/.claude/agents/xflo.md` (or `$CLAUDE_CONFIG_DIR/agents`), so the agent is available in
   every project;
4. writes an `xflo` launcher into the global npm bin directory (`exec claude --agent xflo "$@"`).

The script is idempotent; re-run it after editing `xflo.md`. Uninstall with `agents/xflo/install.sh --uninstall`;
that leaves Ruflo itself installed (`npm uninstall -g ruflo` removes it).

## Use

```bash
xflo                                   # interactive Claude Code session driven by xFlo
xflo -p "add rate limiting to /v1/credentials and test it"   # headless
```

Inside any Claude Code session you can also delegate to it: *"use the xflo agent to audit the DIDComm module"*.
`claude mcp list` should show `ruflo: … ✓ Connected`, and the agent file is at `~/.claude/agents/xflo.md`.

## Notes

- Ruflo keeps its state (memory DB, swarm state) in the directory it runs in: `.swarm/`, `.claude-flow/` and
  `ruvector.db`. That is local runtime data, and this repo git-ignores it.
- Out of the box, Ruflo memory uses mock embedding vectors, so semantic recall works but is weak. Run
  `ruflo embeddings init` once to download the ONNX embedding model for real semantic search.
- Some `ruflo` CLI commands start a background worker daemon for the current directory. Stop it with
  `ruflo daemon stop`.
- The Ruflo version is pinned so a new upstream release can't change behaviour silently. Bump `RUFLO_VERSION` in
  `install.sh` deliberately.
