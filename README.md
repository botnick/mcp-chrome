# Chrome MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

An MCP server that lets AI control your real Chrome browser — your tabs, logins, and extensions, no separate browser needed.

## Why This Over Playwright?

|            | Playwright MCP                | Chrome MCP                |
| ---------- | ----------------------------- | ------------------------- |
| **Setup**  | Needs browser binary download | Uses your existing Chrome |
| **Logins** | Starts logged out             | Keeps all sessions        |
| **Speed**  | Launches new process          | Activates extension       |
| **APIs**   | Playwright API only           | Full Chrome APIs          |

## Features

- Works with any LLM client (Claude, ChatGPT, etc.)
- Uses your actual browser with all logins intact
- Fully local — nothing leaves your machine
- 20+ tools: screenshots, network capture, DOM interaction, bookmarks, history
- Semantic search across open tabs (WASM SIMD accelerated)
- Cross-tab context
- Visual Editor for Claude Code & Codex ([docs](docs/VisualEditor.md))

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Chrome

> No Rust needed — prebuilt WASM is included.

### One-Shot Install

Clone and run the installer for your platform:

```bash
git clone https://github.com/botnick/mcp-chrome.git
cd mcp-chrome
```

**macOS / Linux:**

```bash
./scripts/quick-install.sh                # build + prompt for extension ID
./scripts/quick-install.sh <EXT_ID>       # build + register in one shot
```

**Windows (PowerShell):**

```powershell
.\scripts\quick-install.ps1                          # build + prompt for extension ID
.\scripts\quick-install.ps1 -ExtensionId <EXT_ID>    # build + register in one shot
```

The installer builds everything, registers the native host, and adds `chrome-mcp` to Claude Code automatically. After it finishes, close Chrome completely, reopen it, and click **Connect** in the extension popup.

### Manual Install

**1. Build**

```bash
./scripts/install.sh build
```

**2. Load extension in Chrome**

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `app/chrome-extension/.output/chrome-mv3`
4. Copy the **extension ID**

**3. Register native host**

```bash
./scripts/install.sh register <YOUR_EXTENSION_ID>
```

**4. Restart Chrome completely**, then click **Connect** in the extension popup.

**5. Add to your MCP client**

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

Or via CLI:

```bash
claude mcp add --scope user --transport http chrome-mcp http://127.0.0.1:12306/mcp
```

### Rebuild

```bash
./scripts/install.sh build                 # rebuild
./scripts/install.sh register <EXT_ID>     # re-register (if ID changed)
./scripts/install.sh unregister            # remove native host manifest
```

## Tools

Full reference: [docs/TOOLS.md](docs/TOOLS.md)

| Category        | Tools                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser**     | `get_windows_and_tabs`, `chrome_navigate`, `chrome_switch_tab`, `chrome_close_tabs`, `chrome_go_back_or_forward`, `chrome_inject_script`, `chrome_send_command_to_inject_script` |
| **Screenshot**  | `chrome_screenshot` (element targeting, full-page, custom dimensions)                                                                                                            |
| **Network**     | `chrome_network_capture_start/stop`, `chrome_network_debugger_start/stop`, `chrome_network_request`                                                                              |
| **Content**     | `search_tabs_content`, `chrome_get_web_content`, `chrome_get_interactive_elements`, `chrome_console`                                                                             |
| **Interaction** | `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard`                                                                                                               |
| **Data**        | `chrome_history`, `chrome_bookmark_search`, `chrome_bookmark_add`, `chrome_bookmark_delete`                                                                                      |

## Troubleshooting

- **"Native host has exited"** — Extension ID mismatch. Re-run `register` with current ID.
- **"Connected, Service Not Started"** — Click Disconnect then Connect, or restart Chrome.
- **Manifest not picked up** — Quit Chrome completely and reopen.
- **macOS + project under `~/Desktop`** — TCC blocks Chrome. Move repo elsewhere.

Full guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Roadmap

- [ ] Authentication
- [ ] Recording and Playback
- [ ] Workflow Automation
- [ ] Firefox Extension

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Tools API](docs/TOOLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Contributing](docs/CONTRIBUTING.md)

## License

MIT — see [LICENSE](LICENSE).
