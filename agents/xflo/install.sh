#!/usr/bin/env bash
# Install the xFlo super agent globally:
#   1. installs the Ruflo CLI globally with npm (pinned; override with RUFLO_VERSION)
#   2. registers Ruflo's MCP server with Claude Code at user scope, as "ruflo"
#   3. copies the xflo agent into the user-level Claude Code agents directory
#   4. puts an `xflo` launcher next to the global npm binaries
#
# Usage: agents/xflo/install.sh [--uninstall]
set -euo pipefail

RUFLO_VERSION="${RUFLO_VERSION:-3.55.0}"
MCP_NAME="ruflo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
AGENTS_DIR="$CLAUDE_HOME/agents"
AGENT_FILE="$AGENTS_DIR/xflo.md"

log() { printf '[xflo] %s\n' "$*"; }
die() { printf '[xflo] error: %s\n' "$*" >&2; exit 1; }

command -v npm >/dev/null 2>&1 || die "npm is required (Node.js 20+)."
NPM_BIN="$(npm prefix -g)/bin"
LAUNCHER="$NPM_BIN/xflo"
HAVE_CLAUDE=0
command -v claude >/dev/null 2>&1 && HAVE_CLAUDE=1

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$AGENT_FILE" "$LAUNCHER"
  if [[ $HAVE_CLAUDE == 1 ]]; then
    claude mcp remove --scope user "$MCP_NAME" >/dev/null 2>&1 || true
  fi
  log "removed the xflo agent, launcher and '$MCP_NAME' MCP server."
  log "Ruflo itself is still installed; remove it with: npm uninstall -g ruflo"
  exit 0
fi
[[ $# -eq 0 ]] || die "unknown argument: $1 (usage: install.sh [--uninstall])"

log "installing ruflo@$RUFLO_VERSION globally..."
npm install -g "ruflo@$RUFLO_VERSION" --no-fund --no-audit >/dev/null
RUFLO_BIN="$NPM_BIN/ruflo"
[[ -x "$RUFLO_BIN" ]] || die "ruflo was not found at $RUFLO_BIN after install."
log "$("$RUFLO_BIN" --version)"

mkdir -p "$AGENTS_DIR"
install -m 0644 "$SCRIPT_DIR/xflo.md" "$AGENT_FILE"
log "agent installed: $AGENT_FILE"

if [[ $HAVE_CLAUDE == 1 ]]; then
  # Re-register so a changed ruflo path or version takes effect.
  claude mcp remove --scope user "$MCP_NAME" >/dev/null 2>&1 || true
  claude mcp add --scope user "$MCP_NAME" -- "$RUFLO_BIN" mcp start >/dev/null
  log "MCP server '$MCP_NAME' registered at user scope ($RUFLO_BIN mcp start)."
else
  log "warning: Claude Code CLI not found; skipped MCP registration."
  log "  after installing Claude Code, run: claude mcp add --scope user $MCP_NAME -- $RUFLO_BIN mcp start"
fi

cat >"$LAUNCHER" <<'EOF'
#!/usr/bin/env bash
# xFlo launcher: start Claude Code with the xflo super agent (installed by orbis agents/xflo/install.sh).
exec claude --agent xflo "$@"
EOF
chmod 0755 "$LAUNCHER"
log "launcher installed: $LAUNCHER"

log "done. Start it with:  xflo            (interactive)"
log "                  or:  xflo -p \"<objective>\"   (headless)"
log "or use it as a subagent inside any Claude Code session: \"use the xflo agent to ...\""
