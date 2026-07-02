#!/usr/bin/env node

import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  tryRegisterUserLevelHost,
  colorText,
  registerWithElevatedPermissions,
  ensureExecutionPermissions,
  writeNodePathFile,
} from './scripts/utils';
import { BrowserType, parseBrowserType, detectInstalledBrowsers } from './scripts/browser-config';
import { runDoctor } from './scripts/doctor';
import { runReport } from './scripts/report';
import serverInstance from './server';
import nativeMessagingHostInstance from './native-messaging-host';
import { NATIVE_SERVER_PORT } from './constant';
import { BridgeHub } from './bridge/hub';

program
  .version(require('../package.json').version)
  .description('Mcp Chrome Bridge - Local service for communicating with Chrome extension');

// Register Native Messaging host
program
  .command('register')
  .description('Register Native Messaging host')
  .option('-f, --force', 'Force re-registration')
  .option('-s, --system', 'Use system-level installation (requires administrator/sudo privileges)')
  .option('-b, --browser <browser>', 'Register for specific browser (chrome, chromium, or all)')
  .option('-d, --detect', 'Auto-detect installed browsers')
  .option(
    '-e, --extension-id <id>',
    'Chrome extension ID(s) to allow (comma-separated for multiple). Overrides the built-in ID.',
  )
  .action(async (options) => {
    try {
      // Propagate extension ID override to manifest builder via env var
      if (options.extensionId) {
        process.env.CHROME_MCP_EXTENSION_ID = options.extensionId;
      }

      // Write Node.js path for run_host scripts
      writeNodePathFile(__dirname);

      // Determine which browsers to register
      let targetBrowsers: BrowserType[] | undefined;

      if (options.browser) {
        if (options.browser.toLowerCase() === 'all') {
          targetBrowsers = [BrowserType.CHROME, BrowserType.CHROMIUM];
          console.log(colorText('Registering for all supported browsers...', 'blue'));
        } else {
          const browserType = parseBrowserType(options.browser);
          if (!browserType) {
            console.error(
              colorText(
                `Invalid browser: ${options.browser}. Use 'chrome', 'chromium', or 'all'`,
                'red',
              ),
            );
            process.exit(1);
          }
          targetBrowsers = [browserType];
        }
      } else if (options.detect) {
        targetBrowsers = detectInstalledBrowsers();
        if (targetBrowsers.length === 0) {
          console.log(
            colorText(
              'No supported browsers detected, will register for Chrome and Chromium',
              'yellow',
            ),
          );
          targetBrowsers = undefined; // Will use default behavior
        }
      }
      // If neither option specified, tryRegisterUserLevelHost will detect browsers

      // Detect if running with root/administrator privileges
      const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac

      let isAdmin = false;
      if (process.platform === 'win32') {
        try {
          isAdmin = require('is-admin')(); // Windows requires additional package
        } catch (error) {
          console.warn(
            colorText('Warning: Unable to detect administrator privileges on Windows', 'yellow'),
          );
          isAdmin = false;
        }
      }

      const hasElevatedPermissions = isRoot || isAdmin;

      // If --system option is specified or running with root/administrator privileges
      if (options.system || hasElevatedPermissions) {
        // TODO: Update registerWithElevatedPermissions to support multiple browsers
        await registerWithElevatedPermissions();
        console.log(
          colorText('System-level Native Messaging host registered successfully!', 'green'),
        );
        console.log(
          colorText(
            'You can now use connectNative in Chrome extension to connect to this service.',
            'blue',
          ),
        );
      } else {
        // Regular user-level installation
        console.log(colorText('Registering user-level Native Messaging host...', 'blue'));
        const success = await tryRegisterUserLevelHost(targetBrowsers);

        if (success) {
          console.log(colorText('Native Messaging host registered successfully!', 'green'));
          console.log(
            colorText(
              'You can now use connectNative in Chrome extension to connect to this service.',
              'blue',
            ),
          );
        } else {
          console.log(
            colorText(
              'User-level registration failed, please try the following methods:',
              'yellow',
            ),
          );
          console.log(colorText('  1. sudo mcp-chrome-bridge register', 'yellow'));
          console.log(colorText('  2. mcp-chrome-bridge register --system', 'yellow'));
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error(colorText(`Registration failed: ${error.message}`, 'red'));
      process.exit(1);
    }
  });

// Run the HTTP/MCP server as a long-lived standalone process
program
  .command('serve')
  .description(
    'Run the MCP HTTP server as a long-lived standalone process, decoupled from the ' +
      'Chrome native-messaging stdin lifecycle (the server stays up even if the MV3 ' +
      'service worker sleeps or the native port drops)',
  )
  .option('-p, --port <port>', 'Port to listen on (default: 12306)')
  .action(async (options) => {
    const parsed = options.port ? parseInt(options.port, 10) : NATIVE_SERVER_PORT;
    const port =
      Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : NATIVE_SERVER_PORT;

    // Mark standalone so a dropped native-messaging stdin never stops the server or exits.
    process.env.CHROME_MCP_STANDALONE = '1';
    nativeMessagingHostInstance.setStandalone(true);
    serverInstance.setNativeHost(nativeMessagingHostInstance);
    nativeMessagingHostInstance.setServer(serverInstance);

    const hub = new BridgeHub(nativeMessagingHostInstance);

    try {
      await serverInstance.start(port, nativeMessagingHostInstance);
      // Start the IPC hub so the Chrome-spawned native host can attach as a thin bridge
      // and forward MCP tool traffic to the browser.
      await hub.start();
      console.log(
        colorText(`Standalone MCP server listening on http://127.0.0.1:${port}`, 'green'),
      );
      console.log(colorText(`Bridge socket ready at ${hub.socketPath}`, 'blue'));
    } catch (error: any) {
      console.error(colorText(`Failed to start standalone server: ${error.message}`, 'red'));
      process.exit(1);
    }

    const shutdown = async (signal: string) => {
      console.log(colorText(`Received ${signal}, shutting down standalone server...`, 'blue'));
      try {
        await hub.stop();
      } catch {
        // Ignore errors during shutdown
      }
      try {
        await serverInstance.stop();
      } catch {
        // Ignore errors during shutdown
      }
      process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    // The open Fastify server handle keeps the event loop alive; no stdin is read here.
  });

// Fix execution permissions
program
  .command('fix-permissions')
  .description('Fix execution permissions for native host files')
  .action(async () => {
    try {
      console.log(colorText('Fixing execution permissions...', 'blue'));
      await ensureExecutionPermissions();
      console.log(colorText('✓ Execution permissions fixed successfully!', 'green'));
    } catch (error: any) {
      console.error(colorText(`Failed to fix permissions: ${error.message}`, 'red'));
      process.exit(1);
    }
  });

// Update port in stdio-config.json
program
  .command('update-port <port>')
  .description('Update the port number in stdio-config.json')
  .action(async (port: string) => {
    try {
      const portNumber = parseInt(port, 10);
      if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
        console.error(colorText('Error: Port must be a valid number between 1 and 65535', 'red'));
        process.exit(1);
      }

      const configPath = path.join(__dirname, 'mcp', 'stdio-config.json');

      if (!fs.existsSync(configPath)) {
        console.error(colorText(`Error: Configuration file not found at ${configPath}`, 'red'));
        process.exit(1);
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);

      const currentUrl = new URL(config.url);
      currentUrl.port = portNumber.toString();
      config.url = currentUrl.toString();

      fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

      console.log(colorText(`✓ Port updated successfully to ${portNumber}`, 'green'));
      console.log(colorText(`Updated URL: ${config.url}`, 'blue'));
    } catch (error: any) {
      console.error(colorText(`Failed to update port: ${error.message}`, 'red'));
      process.exit(1);
    }
  });

// Diagnose installation and environment issues
program
  .command('doctor')
  .description('Diagnose installation and environment issues')
  .option('--json', 'Output diagnostics as JSON')
  .option('--fix', 'Attempt to fix common issues automatically')
  .option('-b, --browser <browser>', 'Target browser (chrome, chromium, or all)')
  .action(async (options) => {
    try {
      const exitCode = await runDoctor({
        json: Boolean(options.json),
        fix: Boolean(options.fix),
        browser: options.browser,
      });
      process.exit(exitCode);
    } catch (error: any) {
      console.error(colorText(`Doctor failed: ${error.message}`, 'red'));
      process.exit(1);
    }
  });

// Export diagnostic report for GitHub Issues
program
  .command('report')
  .description('Export a diagnostic report for GitHub Issues')
  .option('--json', 'Output report as JSON (default: Markdown)')
  .option('--output <file>', 'Write report to file instead of stdout')
  .option('--copy', 'Copy report to clipboard')
  .option('--no-redact', 'Disable redaction of usernames/paths/tokens')
  .option('--include-logs <mode>', 'Include wrapper logs: none | tail | full', 'tail')
  .option('--log-lines <n>', 'Lines to include when --include-logs=tail', '200')
  .option('-b, --browser <browser>', 'Target browser (chrome, chromium, or all)')
  .action(async (options) => {
    try {
      const exitCode = await runReport({
        json: Boolean(options.json),
        output: options.output,
        copy: Boolean(options.copy),
        redact: options.redact,
        includeLogs: options.includeLogs,
        logLines: options.logLines ? parseInt(options.logLines, 10) : undefined,
        browser: options.browser,
      });
      process.exit(exitCode);
    } catch (error: any) {
      console.error(colorText(`Report failed: ${error.message}`, 'red'));
      process.exit(1);
    }
  });

program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
