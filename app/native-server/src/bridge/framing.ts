/**
 * Bridge IPC framing.
 *
 * The standalone server (hub) and the Chrome-spawned native host (bridge) talk over a
 * local socket using the SAME length-prefixed framing as Chrome native messaging
 * (4-byte little-endian length header + JSON body). Because the framing is identical in
 * both directions, the Chrome-spawned host can be a dumb byte pipe (stdin <-> socket <->
 * stdout) — all request/response correlation stays in the hub.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const MAX_FRAME_SIZE_BYTES = 64 * 1024 * 1024; // 64MB upper bound for a single framed message

/**
 * Encode a message into a length-prefixed frame.
 */
export function encodeFrame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * Incremental decoder that reassembles length-prefixed frames from a byte stream and
 * emits each complete JSON message. Handles partial reads and multiple frames per chunk.
 */
export class FrameDecoder {
  private buffer = Buffer.alloc(0);
  private expectedLength = -1;

  constructor(
    private readonly onMessage: (message: any) => void,
    private readonly maxSize: number = MAX_FRAME_SIZE_BYTES,
  ) {}

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (;;) {
      if (this.expectedLength === -1) {
        if (this.buffer.length < 4) break; // not enough for a header yet
        this.expectedLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.subarray(4);

        if (this.expectedLength <= 0 || this.expectedLength > this.maxSize) {
          // Corrupt/desynced stream — reset to avoid unbounded buffering.
          this.expectedLength = -1;
          this.buffer = Buffer.alloc(0);
          break;
        }
      }

      if (this.buffer.length < this.expectedLength) break; // wait for the full body

      const body = this.buffer.subarray(0, this.expectedLength);
      this.buffer = this.buffer.subarray(this.expectedLength);
      this.expectedLength = -1;

      try {
        this.onMessage(JSON.parse(body.toString()));
      } catch {
        // Skip an unparseable frame rather than tearing down the whole stream.
      }
    }
  }
}

/**
 * Resolve the bridge socket path. The path is intentionally NOT keyed by the HTTP port:
 * the hub is a single per-user control channel (one active browser bridge, latest wins),
 * so the Chrome-spawned host finds it regardless of which port `serve` chose — avoiding a
 * port mismatch that would silently fall back to a second in-process server.
 *
 * - Windows: a per-user named pipe (`\\.\pipe\...`), which Node's `net` supports transparently.
 * - Unix: a socket file inside a user-private directory (see `ensureBridgeSocketDir`).
 */
export function resolveBridgeSocketPath(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';

  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\mcp-chrome-bridge-${uid}`;
  }

  return path.join(bridgeSocketDir(uid), 'bridge.sock');
}

/**
 * The directory that holds the Unix socket. Prefers XDG_RUNTIME_DIR (already user-private,
 * mode 0700); otherwise a uid-scoped directory under the OS temp dir.
 */
function bridgeSocketDir(uid: number | string): string {
  const runtime = process.env.XDG_RUNTIME_DIR;
  if (runtime) {
    return path.join(runtime, 'mcp-chrome');
  }
  return path.join(os.tmpdir(), `mcp-chrome-${uid}`);
}

/**
 * Ensure the socket's parent directory exists and is private (owner-only, 0700). Prevents
 * other local users from reaching (or pre-creating) the socket in a shared temp dir.
 * No-op on Windows (named pipes are not filesystem paths).
 */
export function ensureBridgeSocketDir(socketPath: string): void {
  if (process.platform === 'win32') return;
  const dir = path.dirname(socketPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    // Tighten perms even if the directory already existed with looser bits.
    fs.chmodSync(dir, 0o700);
  } catch {
    // Best effort — listen()/chmod on the socket is the real guard.
  }
}
