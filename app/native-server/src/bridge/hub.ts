/**
 * Bridge hub — runs inside the long-lived standalone `serve` process.
 *
 * Listens on a local socket for the Chrome-spawned native host (the "bridge") to connect.
 * The hub owns the request/response correlation (via NativeMessagingHost): outbound
 * messages to the browser are written to the active bridge socket, and messages coming
 * back from the bridge are dispatched into the host. Only one bridge is active at a time
 * (latest connection wins).
 */
import * as net from 'net';
import * as fs from 'fs';
import { NativeMessagingHost } from '../native-messaging-host';
import {
  encodeFrame,
  FrameDecoder,
  resolveBridgeSocketPath,
  ensureBridgeSocketDir,
} from './framing';

export class BridgeHub {
  private server: net.Server | null = null;
  private active: net.Socket | null = null;

  constructor(private readonly host: NativeMessagingHost) {}

  get socketPath(): string {
    return resolveBridgeSocketPath();
  }

  async start(): Promise<void> {
    const socketPath = this.socketPath;

    // Route the host's outbound messages to whatever bridge is currently connected.
    this.host.setOutbound((msg) => this.sendToBridge(msg));
    this.host.setBridgeConnected(false);

    // Ensure the socket lives in a user-private (0700) directory.
    ensureBridgeSocketDir(socketPath);

    // On Unix, a stale socket file from a crashed prior run blocks listen(); remove it,
    // but only if nothing is actually listening there.
    if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
      await this.reclaimStaleSocket(socketPath);
    }

    await new Promise<void>((resolve, reject) => {
      this.server = net.createServer((sock) => this.onConnect(sock));
      this.server.once('error', reject);
      this.server.listen(socketPath, () => {
        this.server?.removeListener('error', reject);
        // Restrict the socket to the owner (defense in depth alongside the 0700 dir).
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(socketPath, 0o600);
          } catch {
            // Best effort.
          }
        }
        resolve();
      });
    });
  }

  private reclaimStaleSocket(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const probe = net.connect(socketPath);
      probe.once('connect', () => {
        probe.destroy();
        reject(new Error(`Bridge socket already in use: ${socketPath}`));
      });
      probe.once('error', () => {
        try {
          fs.unlinkSync(socketPath);
        } catch {
          // Ignore — listen() will surface a real error if the path is unusable.
        }
        resolve();
      });
    });
  }

  private sendToBridge(msg: any): void {
    if (this.active && !this.active.destroyed) {
      try {
        this.active.write(encodeFrame(msg));
      } catch {
        // Ignore write failures; the disconnect handler will clear the active bridge.
      }
    }
  }

  private onConnect(sock: net.Socket): void {
    // Latest connection wins: drop any previous bridge.
    if (this.active && this.active !== sock) {
      try {
        this.active.destroy();
      } catch {
        // Ignore
      }
    }
    this.active = sock;
    this.host.setBridgeConnected(true);

    const decoder = new FrameDecoder((msg) => this.host.dispatchFromBridge(msg));
    sock.on('data', (chunk) => decoder.push(chunk));

    const onGone = () => {
      if (this.active === sock) {
        this.active = null;
        this.host.setBridgeConnected(false);
        // Fail in-flight requests immediately rather than letting them wait for a timeout —
        // the browser they were bound to is gone.
        this.host.rejectPendingRequests('bridge disconnected');
      }
    };
    sock.on('close', onGone);
    sock.on('error', onGone);
  }

  async stop(): Promise<void> {
    try {
      this.active?.destroy();
    } catch {
      // Ignore
    }
    this.active = null;
    this.host.setBridgeConnected(false);
    this.host.setOutbound(null);

    await new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
    this.server = null;
  }
}
