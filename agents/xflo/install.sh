#!/usr/bin/env bash
# Install the xFlo super agent and everything it depends on, for Claude Code CLI and Claude Code desktop
# (macOS / Linux):
#   1. Node.js >= 20            (installed via Homebrew on macOS, else nvm, when missing or too old)
#   2. Claude Code CLI          (official installer, npm fallback) - needed to register the MCP server
#   3. Ruflo CLI                (npm -g, pinned; override with RUFLO_VERSION)
#   4. Ruflo embedding model    (all-MiniLM-L6-v2, pre-downloaded to ~/.ruvector/models for semantic memory)
#   5. Ruflo MCP server         (Claude Code user scope, as "ruflo", launched by absolute paths so the desktop
#                                app works even though GUI apps don't inherit your shell PATH)
#   6. xflo agent               (~/.claude/agents/xflo.md, or $CLAUDE_CONFIG_DIR/agents)
#   7. `xflo` launcher          (next to the global npm binaries)
#
# Usage: agents/xflo/install.sh [--default-agent] [--uninstall]
#   --default-agent  also make xflo the main agent of every Claude Code session (CLI and desktop),
#                    by setting "agent": "xflo" in ~/.claude/settings.json
#   --uninstall      remove the agent, launcher, MCP server and default-agent setting (keeps Node, Claude Code, Ruflo)
set -euo pipefail

RUFLO_VERSION="${RUFLO_VERSION:-3.55.0}"
NODE_MIN_MAJOR=20
NVM_VERSION="v0.40.3"
MCP_NAME="ruflo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
AGENTS_DIR="$CLAUDE_HOME/agents"
AGENT_FILE="$AGENTS_DIR/xflo.md"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"

log() { printf '[xflo] %s\n' "$*"; }
warn() { printf '[xflo] warning: %s\n' "$*" >&2; }
die() { printf '[xflo] error: %s\n' "$*" >&2; exit 1; }

DEFAULT_AGENT=0
UNINSTALL=0
for arg in ${1+"$@"}; do # ${1+...}: bash 3.2 (macOS) treats an empty "$@" as unbound under set -u
  case "$arg" in
    --default-agent) DEFAULT_AGENT=1 ;;
    --uninstall) UNINSTALL=1 ;;
    *) die "unknown argument: $arg (usage: install.sh [--default-agent] [--uninstall])" ;;
  esac
done

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# Global npm prefix. npm 11 masks secret-looking substrings (e.g. UUIDs) in what it prints, so fall back to the
# default prefix next to the node binary when npm's answer is not a real directory.
npm_prefix() {
  local p
  p="$(npm prefix -g)"
  [[ -d "$p" ]] || p="$(dirname "$(dirname "$(command -v node)")")"
  printf '%s' "$p"
}

# Set or clear the "agent" key in settings.json without touching any other setting.
set_default_agent() { # $1 = agent name, or "" to clear it if it is xflo
  mkdir -p "$CLAUDE_HOME"
  node - "$SETTINGS_FILE" "$1" <<'EOF'
const fs = require('fs');
const [file, agent] = process.argv.slice(2);
let s = {};
if (fs.existsSync(file)) {
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`[xflo] error: ${file} is not valid JSON; left unchanged`); process.exit(1); }
}
if (agent) s.agent = agent; else if (s.agent === 'xflo') delete s.agent; else process.exit(0);
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
EOF
}

# --- uninstall -------------------------------------------------------------------------------------------------
if [[ $UNINSTALL == 1 ]]; then
  command -v npm >/dev/null 2>&1 && rm -f "$(npm_prefix)/bin/xflo"
  rm -f "$AGENT_FILE"
  command -v claude >/dev/null 2>&1 && { claude mcp remove --scope user "$MCP_NAME" >/dev/null 2>&1 || true; }
  [[ -f "$SETTINGS_FILE" ]] && command -v node >/dev/null 2>&1 && set_default_agent ""
  log "removed the xflo agent, launcher, '$MCP_NAME' MCP server and default-agent setting."
  log "Node.js, Claude Code and Ruflo are still installed; remove Ruflo with: npm uninstall -g ruflo"
  exit 0
fi

# --- 1. Node.js ------------------------------------------------------------------------------------------------
if [[ $(node_major) -lt $NODE_MIN_MAJOR ]]; then
  log "Node.js >= $NODE_MIN_MAJOR not found (have: $(node -v 2>/dev/null || echo none)); installing..."
  if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    brew install node
  else
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
      curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
    fi
    set +eu # nvm.sh is not compatible with errexit/nounset
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install --lts && nvm alias default 'lts/*' >/dev/null
    set -eu
  fi
  hash -r
  [[ $(node_major) -ge $NODE_MIN_MAJOR ]] || die "Node.js install did not produce node >= $NODE_MIN_MAJOR."
fi
# The PATH entry, not process.execPath: for Homebrew that resolves into a versioned Cellar directory
# (/opt/homebrew/Cellar/node/<ver>/bin) that `brew upgrade node` deletes, which would break the MCP server.
NODE_BIN="$(command -v node)"
log "Node.js $(node -v) at $NODE_BIN"

NPM_PREFIX="$(npm_prefix)"
NPM_BIN="$NPM_PREFIX/bin"
NPM_ROOT="$NPM_PREFIX/lib/node_modules"

# --- 2. Claude Code CLI ----------------------------------------------------------------------------------------
if ! command -v claude >/dev/null 2>&1; then
  log "Claude Code CLI not found; installing..."
  if ! curl -fsSL https://claude.ai/install.sh | bash; then
    warn "official installer failed; falling back to npm."
    npm install -g @anthropic-ai/claude-code --no-fund --no-audit >/dev/null
  fi
  export PATH="$HOME/.local/bin:$NPM_BIN:$PATH"
  hash -r
  command -v claude >/dev/null 2>&1 || die "Claude Code CLI is still not on PATH after install."
fi
log "Claude Code $(claude --version 2>/dev/null | head -1)"

# --- 3. Ruflo --------------------------------------------------------------------------------------------------
log "installing ruflo@$RUFLO_VERSION globally..."
npm install -g "ruflo@$RUFLO_VERSION" --no-fund --no-audit >/dev/null
RUFLO_JS="$NPM_ROOT/ruflo/bin/ruflo.js"
[[ -f "$RUFLO_JS" ]] || die "ruflo was not found at $RUFLO_JS after install."
log "$("$NODE_BIN" "$RUFLO_JS" --version)"

# --- 4. Embedding model (non-fatal: memory still works, with hash vectors, until it is downloaded) -------------
log "downloading Ruflo's embedding model (all-MiniLM-L6-v2, ~23 MB) for semantic memory..."
if "$NODE_BIN" - "$RUFLO_JS" <<'EOF'
const { createRequire } = require('module');
const req = createRequire(process.argv[2]);
(async () => {
  const rv = await import(req.resolve('ruvector'));
  await rv.initOnnxEmbedder();
  const v = await rv.getOptimizedOnnxEmbedder().embed('xflo warm-up');
  if (!v || !v.length) throw new Error('empty embedding');
  console.log(`[xflo] embedding model ready (${v.length} dimensions)`);
})().catch((e) => { console.error(`[xflo] ${e.message}`); process.exit(1); });
EOF
then :; else
  warn "embedding model download failed (offline, or huggingface.co blocked?)."
  warn "  memory still works with hash vectors; re-run this installer later to enable semantic search."
fi

# --- 5. Agent --------------------------------------------------------------------------------------------------
mkdir -p "$AGENTS_DIR"
install -m 0644 "$SCRIPT_DIR/xflo.md" "$AGENT_FILE"
log "agent installed: $AGENT_FILE"

# --- 6. MCP server (absolute paths: the desktop app does not see your shell PATH) ------------------------------
claude mcp remove --scope user "$MCP_NAME" >/dev/null 2>&1 || true
# PATH is passed along too: Ruflo shells out to npm/git/claude, and GUI apps get a minimal PATH.
# The name goes before -e: -e takes several values and would swallow it.
if ! out="$(claude mcp add --scope user "$MCP_NAME" -e "PATH=$(dirname "$NODE_BIN"):$PATH" \
    -- "$NODE_BIN" "$RUFLO_JS" mcp start 2>&1)"; then
  die "claude mcp add failed: $out"
fi
log "MCP server '$MCP_NAME' registered at user scope."

# --- 7. Launcher -----------------------------------------------------------------------------------------------
cat >"$NPM_BIN/xflo" <<'EOF'
#!/usr/bin/env bash
# xFlo launcher: start Claude Code with the xflo super agent (installed by orbis agents/xflo/install.sh).
exec claude --agent xflo "$@"
EOF
chmod 0755 "$NPM_BIN/xflo"
log "launcher installed: $NPM_BIN/xflo"

if [[ $DEFAULT_AGENT == 1 ]]; then
  set_default_agent xflo
  log "xflo is now the default agent for every Claude Code session ($SETTINGS_FILE)."
fi

# --- verify ----------------------------------------------------------------------------------------------------
if claude mcp list 2>/dev/null | grep -q "^$MCP_NAME:.*Connected"; then
  log "verified: '$MCP_NAME' MCP server connects."
else
  warn "'$MCP_NAME' MCP server did not report Connected; check with: claude mcp list"
fi

log "done. Restart Claude Code desktop (quit and reopen) so it picks up the new agent and MCP server."
log "  desktop / any session:  \"use the xflo agent to ...\"   (or install with --default-agent)"
log "  terminal:               xflo     |     xflo -p \"<objective>\""
