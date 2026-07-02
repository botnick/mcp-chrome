import { stdin, stdout } from 'process';
import { Server } from './server';
import { v4 as uuidv4 } from 'uuid';
import { NativeMessageType } from 'chrome-mcp-shared';
import { TIMEOUTS } from './constant';
import fileHandler from './file-handler';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

export class NativeMessagingHost {
  private associatedServer: Server | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  // Standalone mode decouples the HTTP server lifecycle from the native-messaging stdin.
  // When true, losing stdin (MV3 service worker slept / Chrome dropped the port) must NOT
  // tear down the HTTP server or exit the process.
  private standalone = false;

  // Outbound transport. In legacy (Chrome-spawned, in-process) mode this is null and
  // messages are written to stdout. In hub mode (the standalone `serve` process) the
  // BridgeHub installs a sink that writes to the active bridge socket, so outbound
  // messages reach the browser through the Chrome-spawned bridge rather than a dead stdout.
  private outbound: ((message: any) => void) | null = null;
  // Whether a bridge is currently connected (only meaningful in hub mode).
  private bridgeConnected = false;

  public setServer(serverInstance: Server): void {
    this.associatedServer = serverInstance;
  }

  public setStandalone(value: boolean): void {
    this.standalone = value;
  }

  private isStandalone(): boolean {
    return this.standalone || process.env.CHROME_MCP_STANDALONE === '1';
  }

  /**
   * Install (or clear) the outbound sink used to reach the browser. Set by BridgeHub.
   */
  public setOutbound(sink: ((message: any) => void) | null): void {
    this.outbound = sink;
  }

  /**
   * Mark whether a bridge (Chrome-spawned native host) is currently connected to the hub.
   */
  public setBridgeConnected(connected: boolean): void {
    this.bridgeConnected = connected;
  }

  /**
   * Feed a message that arrived from the bridge into the normal message handler.
   */
  public dispatchFromBridge(message: any): void {
    void this.handleMessage(message);
  }

  /**
   * Whether the browser is currently reachable. In hub mode this requires a live bridge;
   * in legacy stdio mode stdout is always present so we optimistically return true (a
   * missing extension surfaces as a request timeout, exactly as before).
   */
  public isExtensionReachable(): boolean {
    if (this.outbound) return this.bridgeConnected;
    return true;
  }

  // add message handler to wait for start server
  public start(): void {
    try {
      this.setupMessageHandling();
    } catch (error: any) {
      process.exit(1);
    }
  }

  private setupMessageHandling(): void {
    let buffer = Buffer.alloc(0);
    let expectedLength = -1;
    const MAX_MESSAGES_PER_TICK = 100; // Safety guard to avoid long-running loops per readable tick
    const MAX_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024; // 16MB upper bound for a single message

    const processAvailable = () => {
      let processed = 0;
      while (processed < MAX_MESSAGES_PER_TICK) {
        // Read length header when needed
        if (expectedLength === -1) {
          if (buffer.length < 4) break; // not enough for header
          expectedLength = buffer.readUInt32LE(0);
          buffer = buffer.slice(4);

          // Validate length header
          if (expectedLength <= 0 || expectedLength > MAX_MESSAGE_SIZE_BYTES) {
            this.sendError(`Invalid message length: ${expectedLength}`);
            // Reset state to resynchronize stream
            expectedLength = -1;
            buffer = Buffer.alloc(0);
            break;
          }
        }

        // Wait for complete body
        if (buffer.length < expectedLength) break;

        const messageBuffer = buffer.slice(0, expectedLength);
        buffer = buffer.slice(expectedLength);
        expectedLength = -1;
        processed++;

        try {
          const message = JSON.parse(messageBuffer.toString());
          this.handleMessage(message);
        } catch (error: any) {
          this.sendError(`Failed to parse message: ${error.message}`);
        }
      }

      // If we hit the cap but still have at least one complete message pending, schedule to continue soon
      if (processed === MAX_MESSAGES_PER_TICK) {
        setImmediate(processAvailable);
      }
    };

    stdin.on('readable', () => {
      let chunk;
      while ((chunk = stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);
        processAvailable();
      }
    });

    stdin.on('end', () => {
      this.cleanup();
    });

    stdin.on('error', () => {
      this.cleanup();
    });
  }

  private async handleMessage(message: any): Promise<void> {
    if (!message || typeof message !== 'object') {
      this.sendError('Invalid message format');
      return;
    }

    if (message.responseToRequestId) {
      const requestId = message.responseToRequestId;
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        clearTimeout(pending.timeoutId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.payload);
        }
        this.pendingRequests.delete(requestId);
      } else {
        // just ignore
      }
      return;
    }

    // Handle directive messages from Chrome
    try {
      switch (message.type) {
        case NativeMessageType.START:
          await this.startServer(message.payload?.port || 12306);
          break;
        case NativeMessageType.STOP:
          await this.stopServer();
          break;
        // Keep ping/pong for simple liveness detection, but this differs from request-response pattern
        case 'ping_from_extension':
          this.sendMessage({ type: 'pong_to_extension' });
          break;
        case 'file_operation':
          await this.handleFileOperation(message);
          break;
        default:
          // Double check when message type is not supported
          if (!message.responseToRequestId) {
            this.sendError(
              `Unknown message type or non-response message: ${message.type || 'no type'}`,
            );
          }
      }
    } catch (error: any) {
      this.sendError(`Failed to handle directive message: ${error.message}`);
    }
  }

  /**
   * Handle file operations from the extension
   */
  private async handleFileOperation(message: any): Promise<void> {
    try {
      const result = await fileHandler.handleFileRequest(message.payload);

      if (message.requestId) {
        // Send response back with the request ID
        this.sendMessage({
          type: 'file_operation_response',
          responseToRequestId: message.requestId,
          payload: result,
        });
      } else {
        // No request ID, just send result
        this.sendMessage({
          type: 'file_operation_result',
          payload: result,
        });
      }
    } catch (error: any) {
      const errorResponse = {
        success: false,
        error: error.message || 'Unknown error during file operation',
      };

      if (message.requestId) {
        this.sendMessage({
          type: 'file_operation_response',
          responseToRequestId: message.requestId,
          error: errorResponse.error,
        });
      } else {
        this.sendError(`File operation failed: ${errorResponse.error}`);
      }
    }
  }

  /**
   * Send request to Chrome and wait for response
   * @param messagePayload Data to send to Chrome
   * @param timeoutMs Timeout for waiting response (milliseconds)
   * @returns Promise, resolves to Chrome's returned payload on success, rejects on failure
   */
  public sendRequestToExtensionAndWait(
    messagePayload: any,
    messageType: string = 'request_data',
    timeoutMs: number = TIMEOUTS.DEFAULT_REQUEST_TIMEOUT,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Fail fast when the browser is not reachable instead of enqueuing a request that
      // can only ever time out (hub mode with no bridge connected).
      if (!this.isExtensionReachable()) {
        reject(new Error('No active browser bridge connected'));
        return;
      }

      const requestId = uuidv4(); // Generate unique request ID

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId); // Remove from Map after timeout
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store request's resolve/reject functions and timeout ID
      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      // Send message with requestId to Chrome
      this.sendMessage({
        type: messageType, // Define a request type, e.g. 'request_data'
        payload: messagePayload,
        requestId: requestId, // <--- Key: include request ID
      });
    });
  }

  /**
   * Start Fastify server (now accepts Server instance)
   */
  private async startServer(port: number): Promise<void> {
    if (!this.associatedServer) {
      this.sendError('Internal error: server instance not set');
      return;
    }
    try {
      if (this.associatedServer.isRunning) {
        // The server is already up (typical in standalone mode, where the server outlives
        // any single native host). Report SERVER_STARTED — not ERROR — so the extension
        // treats itself as connected and resets its reconnect loop instead of spinning on
        // a "port already running" error.
        this.sendMessage({
          type: NativeMessageType.SERVER_STARTED,
          payload: { port: this.associatedServer.getRunningPort() ?? port },
        });
        return;
      }

      await this.associatedServer.start(port, this);

      this.sendMessage({
        type: NativeMessageType.SERVER_STARTED,
        payload: { port },
      });
    } catch (error: any) {
      this.sendError(`Failed to start server: ${error.message}`);
    }
  }

  /**
   * Stop Fastify server
   */
  private async stopServer(): Promise<void> {
    if (!this.associatedServer) {
      this.sendError('Internal error: server instance not set');
      return;
    }
    // In standalone/hub mode the HTTP server is shared and outlives any single native host;
    // a STOP from one browser must not tear it down for everyone. Acknowledge without
    // actually stopping the shared server.
    if (this.isStandalone()) {
      this.sendMessage({ type: NativeMessageType.SERVER_STOPPED });
      return;
    }
    try {
      // Check status through associatedServer
      if (!this.associatedServer.isRunning) {
        this.sendMessage({
          type: NativeMessageType.ERROR,
          payload: { message: 'Server is not running' },
        });
        return;
      }

      await this.associatedServer.stop();
      // this.serverStarted = false; // Server should update its own status after successful stop

      this.sendMessage({ type: NativeMessageType.SERVER_STOPPED }); // Distinguish from previous 'stopped'
    } catch (error: any) {
      this.sendError(`Failed to stop server: ${error.message}`);
    }
  }

  /**
   * Send message to Chrome extension
   */
  public sendMessage(message: any): void {
    // Hub mode: route to the active bridge socket instead of this process's stdout
    // (which, in the standalone server, is not connected to any browser).
    if (this.outbound) {
      try {
        this.outbound(message);
      } catch {
        // Ignore; the hub clears the bridge on socket errors.
      }
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageString);
      const headerBuffer = Buffer.alloc(4);
      headerBuffer.writeUInt32LE(messageBuffer.length, 0);
      // Ensure atomic write
      stdout.write(Buffer.concat([headerBuffer, messageBuffer]), (err) => {
        if (err) {
          // Consider how to handle write failure, may affect request completion
        } else {
          // Message sent successfully, no action needed
        }
      });
    } catch (error: any) {
      // Catch JSON.stringify or Buffer operation errors
      // If preparation stage fails, associated request may never be sent
      // Need to consider whether to reject corresponding Promise (if called within sendRequestToExtensionAndWait)
    }
  }

  /**
   * Send error message to Chrome extension (mainly for sending non-request-response type errors)
   */
  private sendError(errorMessage: string): void {
    this.sendMessage({
      type: NativeMessageType.ERROR_FROM_NATIVE_HOST, // Use more explicit type
      payload: { message: errorMessage },
    });
  }

  /**
   * Reject and clear all in-flight requests. Called on stdin teardown and, in hub mode,
   * when the active bridge disconnects — so callers fail fast instead of awaiting a timeout.
   */
  public rejectPendingRequests(reason: string): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(reason));
    });
    this.pendingRequests.clear();
  }

  /**
   * Clean up resources when the native-messaging stdin ends.
   */
  private cleanup(): void {
    this.rejectPendingRequests('Native host is shutting down or Chrome disconnected.');

    // Standalone mode: the HTTP server is a long-lived process independent of the
    // native-messaging bridge. A dropped stdin only means the current stdio bridge is gone
    // (the extension will re-attach); it must NOT stop the HTTP server or kill the process.
    // This is the structural fix for the "server dies when the MV3 SW sleeps" disconnect.
    if (this.isStandalone()) {
      return;
    }

    if (this.associatedServer && this.associatedServer.isRunning) {
      this.associatedServer
        .stop()
        .then(() => {
          process.exit(0);
        })
        .catch(() => {
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  }
}

const nativeMessagingHostInstance = new NativeMessagingHost();
export default nativeMessagingHostInstance;
