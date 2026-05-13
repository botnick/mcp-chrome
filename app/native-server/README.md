# Chrome Native Messaging Server

A Fastify-based TypeScript service for native communication with Chrome extensions.

## Features

- Bidirectional communication via Chrome Native Messaging protocol
- **Multi-browser support**: Chrome and Chromium (Linux, macOS, Windows)
- RESTful API server
- Full TypeScript
- Complete test suite

## Setup

### Prerequisites

- Node.js 20+
- npm 8+ or pnpm 8+

### Install

```bash
git clone https://github.com/botnick/mcp-chrome.git
cd mcp-chrome
npm install
```

### Development

1. Build and register the native server:

```bash
cd app/native-server
npm run dev
```

2. Start the Chrome extension:

```bash
cd app/chrome-extension
npm run dev
```

### Build

```bash
npm run build
```

### Register Native Messaging Host

#### Auto-detect and register all installed browsers

```bash
mcp-chrome-bridge register --detect
```

#### Register a specific browser

```bash
# Chrome only
mcp-chrome-bridge register --browser chrome

# Chromium only
mcp-chrome-bridge register --browser chromium

# All supported browsers
mcp-chrome-bridge register --browser all
```

#### Global install (auto-registers detected browsers)

```bash
npm i -g mcp-chrome-bridge
```

#### Browser Support

| Browser       | Linux | macOS | Windows |
| ------------- | ----- | ----- | ------- |
| Google Chrome | Yes   | Yes   | Yes     |
| Chromium      | Yes   | Yes   | Yes     |

Registration paths:

- **Linux**: `~/.config/[browser-name]/NativeMessagingHosts/`
- **macOS**: `~/Library/Application Support/[Browser]/NativeMessagingHosts/`
- **Windows**: `%APPDATA%\[Browser]\NativeMessagingHosts\`

### Chrome Extension Integration

```javascript
// background.js
let nativePort = null;
let serverRunning = false;

function startServer() {
  if (nativePort) return;

  try {
    nativePort = chrome.runtime.connectNative('com.yourcompany.fastify_native_host');

    nativePort.onMessage.addListener((message) => {
      if (message.type === 'started') {
        serverRunning = true;
      } else if (message.type === 'stopped') {
        serverRunning = false;
      } else if (message.type === 'error') {
        console.error('Native error:', message.payload.message);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      serverRunning = false;
    });

    nativePort.postMessage({ type: 'start', payload: { port: 3000 } });
  } catch (error) {
    console.error('Failed to start Native Messaging:', error);
  }
}

function stopServer() {
  if (nativePort && serverRunning) {
    nativePort.postMessage({ type: 'stop' });
  }
}

chrome.runtime.onStartup.addListener(startServer);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startServer') {
    startServer();
    sendResponse({ success: true });
  } else if (message.action === 'stopServer') {
    stopServer();
    sendResponse({ success: true });
  } else if (message.action === 'testPing') {
    fetch('http://localhost:3000/ping')
      .then((r) => r.json())
      .then(sendResponse);
    return true;
  }
});
```

### Tests

```bash
npm run test
```

### License

MIT
