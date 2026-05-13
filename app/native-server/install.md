# Chrome MCP Bridge Installation Guide

## Overview

```
npm install -g mcp-chrome-bridge
└─ postinstall.js
   ├─ Copy executable to npm_prefix/bin       ← always writable (user or root)
   ├─ Attempt user-level registration         ← no sudo needed, works most of the time
   └─ If failed → prompt to run: mcp-chrome-bridge register --system
      └─ Requires admin privileges
```

## Installation Steps

### 1. Global Install

```bash
npm install -g mcp-chrome-bridge
```

After install, the system automatically attempts user-level Native Messaging host registration. No admin privileges needed — this is the recommended approach.

### 2. User-Level Registration

Creates the manifest file at:

```
Manifest Locations
├─ User-level (no admin needed)
│  ├─ Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
│  ├─ macOS:   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
│  └─ Linux:   ~/.config/google-chrome/NativeMessagingHosts/
│
└─ System-level (admin required)
   ├─ Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
   ├─ macOS:   /Library/Google/Chrome/NativeMessagingHosts/
   └─ Linux:   /etc/opt/chrome/native-messaging-hosts/
```

To register manually:

```bash
mcp-chrome-bridge register
```

Run diagnostics:

```bash
mcp-chrome-bridge doctor
```

### 3. System-Level Registration

If user-level registration fails, use system-level instead.

#### Option A: `--system` flag (recommended)

```bash
# macOS/Linux
sudo mcp-chrome-bridge register --system

# Windows (run as Administrator)
mcp-chrome-bridge register --system
```

#### Option B: Run with admin privileges directly

**Windows**: Open Command Prompt as Administrator, then:

```
mcp-chrome-bridge register
```

**macOS/Linux**:

```
sudo mcp-chrome-bridge register
```

## Registration Details

### Manifest Structure

```
manifest.json
├─ name: "com.chromemcp.nativehost"
├─ description: "Node.js Host for Browser Bridge Extension"
├─ path: "/path/to/run_host.sh"       ← startup script
├─ type: "stdio"                      ← communication type
└─ allowed_origins: [                 ← allowed extensions
   "chrome-extension://<EXTENSION_ID>/"
]
```

### User-Level Flow

1. Determine user-level manifest path
2. Create directories
3. Generate manifest (host name, description, Node.js path, stdio type, extension ID, args)
4. Write manifest file
5. On Windows: create registry entry

### System-Level Flow

1. Check for admin privileges
2. If admin: create system directory, write manifest, set permissions, create registry (Windows)
3. If not admin: prompt to re-run with elevated privileges

## Verify Installation

1. Check manifest file exists at the correct path
2. Install the Chrome extension with `nativeMessaging` permission
3. Test connection via the extension popup

## Troubleshooting

### Permission Issues

**macOS/Linux**:

- "Permission denied" or "Native host has exited" errors
- Fix: `mcp-chrome-bridge fix-permissions`
- Or: `mcp-chrome-bridge doctor --fix`
- Manual fix:
  ```bash
  chmod +x /path/to/node_modules/mcp-chrome-bridge/run_host.sh
  chmod +x /path/to/node_modules/mcp-chrome-bridge/index.js
  chmod +x /path/to/node_modules/mcp-chrome-bridge/cli.js
  ```

**Windows**:

- "Access denied" or file won't execute
- Fix: `mcp-chrome-bridge fix-permissions`
- Or: `mcp-chrome-bridge doctor --fix`
- Check file properties — make sure `run_host.bat` isn't read-only

### Other Issues

1. Verify Node.js: `node -v` (>= 20.x)
2. Check directory write permissions
3. Windows: verify registry access at `HKCU\Software\Google\Chrome\NativeMessagingHosts\`
4. Try system-level install: `mcp-chrome-bridge register --system`
5. Add `--verbose` for detailed logs

If problems persist, open an issue with: OS version, Node.js version, install command, error message, and what you've tried.
