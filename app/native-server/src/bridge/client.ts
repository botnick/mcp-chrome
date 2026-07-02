/**
 * Bridge client — runs inside the Chrome-spawned native host (`index.js`).
 *
 * If a standalone `serve` process is already running, this host attaches to it as a thin
 * bridge and becomes a dumb byte pipe: bytes from the extension (stdin) are forwarded to
 * the hub socket, and bytes from the hub are forwarded to the extension (stdout). Because
 * both use identical native-messaging framing, no parsing is needed here — all
 * request/response correlation lives in the hub.
 *
 * If no standalone server is reachable, the caller falls back to hosting the server
 * in-process (legacy behaviour), so ordinary desktop installs are unaffected.
 */
import * as net from 'net';
import { resolveBridgeSocketPath } from './framing';

/**
 * Attempt to attach as a thin bridge to a running standalone server.
 *
 * @returns true if attached (the caller must NOT start the in-process server — this
 *          process is now piping), false if no standalone server was reachable.
 */
export function tryRunBridgeClient(timeoutMs = 1500): Promise<boolean> {
  const socketPath = resolveBridgeSocketPath();

  return new Promise((resolve) => {
    const sock = net.connect(socketPath);
    let settled = false;
    const settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const timeout = setTimeout(() => {
      try {
        sock.destroy();
      } catch {
        // Ignore
      }
      settle(false);
    }, timeoutMs);

    sock.once('connect', () => {
      clearTimeout(timeout);

      // Pure byte pipe in both directions (identical framing on each side).
      process.stdin.pipe(sock);
      sock.pipe(process.stdout);

      const exitBridge = (code = 0) => process.exit(code);
      // Extension closed the native port -> this bridge is done; Chrome will spawn a fresh
      // one on the next connectNative.
      process.stdin.on('end', () => exitBridge(0));
      // Hub went away -> exit so the extension observes a dropped port and reconnects.
      sock.on('close', () => exitBridge(0));
      sock.on('error', () => exitBridge(1));

      settle(true);
    });

    sock.once('error', () => {
      clearTimeout(timeout);
      settle(false);
    });
  });
}
