#!/usr/bin/env bash
#
# Chrome MCP Server — one-shot installer
#
# Usage:
#   ./scripts/quick-install.sh                       # build + open chrome://extensions, then prompt for ID
#   ./scripts/quick-install.sh <EXT_ID>              # build + register + claude mcp add (no prompt)
#   ./scripts/quick-install.sh --rebuild <EXT_ID>    # force-rebuild even if dist/ exists
#   ./scripts/quick-install.sh --skip-build <EXT_ID> # only register + claude mcp add (use existing build)
#
# What it does, in order:
#   1. Installs deps with --ignore-scripts (avoids native-server postinstall chicken-and-egg)
#   2. Drops prebuilt WASM into expected paths (extracted from releases/ zip)
#   3. Builds shared -> native-server -> chrome-extension
#   4. Registers the native messaging host for the given extension ID
#   5. Adds chrome-mcp to Claude Code (user scope), idempotent
#   6. Prints next steps (Cmd+Q Chrome, click Connect)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_OUT="${ROOT}/app/chrome-extension/.output/chrome-mv3"
BRIDGE_DIST="${ROOT}/app/native-server/dist"
WASM_PKG="${ROOT}/packages/wasm-simd/pkg"
WASM_PREBUILT="${ROOT}/releases/chrome-extension/latest/chrome-mcp-server-extension/workers"
WASM_ZIP="${ROOT}/releases/chrome-extension/latest/chrome-mcp-server-lastest.zip"
EXT_WORKERS="${ROOT}/app/chrome-extension/workers"

color() { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info() { color "34" "-> $1"; }
ok() { color "32" "[ok] $1"; }
warn() { color "33" "[warn] $1"; }
err() { color "31" "[err] $1"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

REBUILD=0
SKIP_BUILD=0
EXT_ID=""

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --help|-h)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      if [ -z "$EXT_ID" ]; then EXT_ID="$arg"; fi
      ;;
  esac
done

require_cmd node
require_cmd pnpm

ensure_wasm_prebuilt() {
  if [ -f "${WASM_PREBUILT}/simd_math.js" ] && [ -f "${WASM_PREBUILT}/simd_math_bg.wasm" ]; then
    return 0
  fi
  if [ ! -f "$WASM_ZIP" ]; then
    err "Prebuilt WASM zip not found at $WASM_ZIP"
    err "You'll need Rust + wasm-pack to build from source. See packages/wasm-simd/BUILD.md."
    exit 1
  fi
  info "Extracting prebuilt WASM from release zip"
  mkdir -p "$WASM_PREBUILT"
  require_cmd unzip
  unzip -j -o "$WASM_ZIP" "workers/simd_math.js" "workers/simd_math_bg.wasm" -d "$WASM_PREBUILT" >/dev/null
  ok "Extracted WASM to $WASM_PREBUILT"
}

cmd_build() {
  if [ "$SKIP_BUILD" -eq 1 ]; then
    if [ ! -d "$EXT_OUT" ] || [ ! -f "${BRIDGE_DIST}/cli.js" ]; then
      err "--skip-build given but artifacts missing. Run without --skip-build first."
      exit 1
    fi
    ok "Skipping build (--skip-build); using existing artifacts"
    return 0
  fi

  if [ "$REBUILD" -eq 0 ] && [ -d "$EXT_OUT" ] && [ -f "${BRIDGE_DIST}/cli.js" ]; then
    info "Build artifacts already present (pass --rebuild to force)"
    return 0
  fi

  info "Installing workspace dependencies (--ignore-scripts to avoid postinstall chicken-and-egg)"
  (cd "$ROOT" && pnpm install --ignore-scripts)

  ensure_wasm_prebuilt

  info "Copying WASM into wasm-simd/pkg (so copy:wasm finds it later)"
  mkdir -p "$WASM_PKG"
  cp "${WASM_PREBUILT}/simd_math.js" "${WASM_PREBUILT}/simd_math_bg.wasm" "$WASM_PKG/"

  info "Copying WASM into extension/workers"
  mkdir -p "$EXT_WORKERS"
  cp "${WASM_PREBUILT}/simd_math.js" "${WASM_PREBUILT}/simd_math_bg.wasm" "$EXT_WORKERS/"

  info "Building shared package"
  (cd "$ROOT" && pnpm --filter chrome-mcp-shared build)

  info "Building native-server (bridge)"
  (cd "$ROOT" && pnpm --filter mcp-chrome-bridge build)

  info "Building Chrome extension"
  (cd "$ROOT" && pnpm --filter chrome-mcp-server build)

  ok "Build complete"
  echo "  Extension: $EXT_OUT"
  echo "  Bridge:    $BRIDGE_DIST"
}

prompt_for_ext_id() {
  echo
  warn "No extension ID provided. Load the unpacked extension first:"
  echo
  echo "  1. Open chrome://extensions"
  echo "  2. Enable Developer mode (top-right)"
  echo "  3. Click 'Load unpacked' and select:"
  echo "       $EXT_OUT"
  echo "  4. Copy the 32-character extension ID shown under the extension name"
  echo
  read -r -p "Paste the Extension ID: " EXT_ID
  if [ -z "$EXT_ID" ]; then
    err "No ID entered. Aborting."
    exit 1
  fi
}

cmd_register() {
  if [ -z "$EXT_ID" ]; then
    prompt_for_ext_id
  fi

  if [ ! -f "${BRIDGE_DIST}/cli.js" ]; then
    err "Bridge not built — run without --skip-build."
    exit 1
  fi

  info "Registering native messaging host for $EXT_ID"
  node "${BRIDGE_DIST}/cli.js" register --extension-id "$EXT_ID"
  ok "Native messaging host registered"
}

cmd_claude_add() {
  if ! command -v claude >/dev/null 2>&1; then
    warn "Claude Code CLI not found on PATH — skipping mcp add"
    warn "Install Claude Code, then run:"
    echo "    claude mcp add --scope user --transport http chrome-mcp http://127.0.0.1:12306/mcp"
    return 0
  fi

  # Idempotent: remove existing entry, then add fresh.
  if claude mcp list 2>/dev/null | grep -q '^chrome-mcp:'; then
    info "chrome-mcp already registered in Claude Code — refreshing"
    claude mcp remove --scope user chrome-mcp >/dev/null 2>&1 || true
  fi

  info "Adding chrome-mcp to Claude Code (user scope)"
  claude mcp add --scope user --transport http chrome-mcp http://127.0.0.1:12306/mcp >/dev/null
  ok "chrome-mcp registered with Claude Code"
}

print_next_steps() {
  cat <<EOF

$(color "32" "[ok] Install complete")

Next:
  1. $(color "33" "Cmd+Q to fully quit Chrome, then reopen")
     (Chrome caches the native messaging manifest at startup)
  2. Open the extension popup -> click $(color "1" "Connect")
  3. Verify with: $(color "1" "claude mcp list")
     You should see: chrome-mcp ... Connected

Browser tools default to background mode (no focus stealing). To
explicitly bring a tab to the foreground, the AI can pass
$(color "1" "background: false") in the tool args.
EOF
}

main() {
  info "Chrome MCP Server — quick install"
  cmd_build
  cmd_register
  cmd_claude_add
  print_next_steps
}

main
