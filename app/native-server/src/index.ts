#!/usr/bin/env node
import serverInstance from './server';
import nativeMessagingHostInstance from './native-messaging-host';
import { tryRunBridgeClient } from './bridge/client';

/**
 * Start the in-process server (legacy behaviour). Used when no standalone `serve` process
 * is running — ordinary desktop installs are unaffected.
 */
function startInProcess(): void {
  serverInstance.setNativeHost(nativeMessagingHostInstance); // Server needs setNativeHost method
  nativeMessagingHostInstance.setServer(serverInstance); // NativeHost needs setServer method
  nativeMessagingHostInstance.start();
}

async function main(): Promise<void> {
  // If a long-lived standalone server is already running, attach to it as a thin bridge
  // (dumb stdin<->socket<->stdout pipe) instead of hosting the server in this process.
  // Set CHROME_MCP_NO_BRIDGE=1 to force legacy in-process mode.
  if (process.env.CHROME_MCP_NO_BRIDGE !== '1') {
    try {
      const attached = await tryRunBridgeClient();
      if (attached) return; // now piping to the hub; do not start a second server
    } catch {
      // Fall through to legacy in-process mode.
    }
  }
  startInProcess();
}

try {
  void main();
} catch (error) {
  process.exit(1);
}

process.on('error', (error) => {
  process.exit(1);
});

// Handle process signals and uncaught exceptions
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('exit', (code) => {
});

process.on('uncaughtException', (error) => {
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Don't exit immediately, let the program continue running
});
