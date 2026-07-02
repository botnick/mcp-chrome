/**
 * @fileoverview Keepalive Manager
 * @description Global singleton service for managing Service Worker keepalive.
 *
 * This module provides a unified interface for acquiring and releasing keepalive
 * references. Multiple modules can acquire keepalive independently using tags,
 * and the underlying keepalive mechanism will remain active as long as at least
 * one reference is held.
 */

import {
  createOffscreenKeepaliveController,
  type KeepaliveController,
} from './record-replay-v3/engine/keepalive/offscreen-keepalive';

const LOG_PREFIX = '[KeepaliveManager]';

// ==================== Alarm Heartbeat (backup) ====================
//
// The offscreen-document Port heartbeat is the primary keepalive. chrome.alarms is a
// second, independent, best-effort signal: an alarm wakes the service worker periodically
// (it does not keep it continuously alive), so if the offscreen port ever drops the worker
// still gets woken on the next alarm and can re-establish keepalive.

const KEEPALIVE_ALARM_NAME = 'keepalive-heartbeat';
let alarmListenerRegistered = false;

/**
 * Register the alarm listener once. On fire, touch a chrome API — this runs while the SW is
 * awake and is a best-effort nudge, not a guarantee the worker stays alive between alarms.
 */
function registerKeepaliveAlarmListener(): void {
  if (alarmListenerRegistered) return;
  alarmListenerRegistered = true;
  try {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== KEEPALIVE_ALARM_NAME) return;
      if (!isKeepaliveActive()) return;
      // Best-effort nudge while the SW is awake; the offscreen port is the real keepalive.
      try {
        chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
      } catch {
        // Ignore
      }
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to register keepalive alarm listener:`, error);
  }
}

/**
 * Arm or disarm the backup alarm to match whether keepalive is currently held.
 */
function syncKeepaliveAlarm(): void {
  try {
    if (isKeepaliveActive()) {
      // periodInMinutes is clamped by Chrome to its minimum (~0.5–1 min); that is fine
      // for a backup — the offscreen port covers the fast cadence.
      chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: 0.5 });
    } else {
      chrome.alarms.clear(KEEPALIVE_ALARM_NAME);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to sync keepalive alarm:`, error);
  }
}

/**
 * Singleton keepalive controller instance.
 * Created lazily to avoid initialization issues during module loading.
 */
let controller: KeepaliveController | null = null;

/**
 * Get or create the singleton keepalive controller.
 */
function getController(): KeepaliveController {
  if (!controller) {
    controller = createOffscreenKeepaliveController({ logger: console });
    console.debug(`${LOG_PREFIX} Controller initialized`);
  }
  return controller;
}

/**
 * Acquire a keepalive reference with a tag.
 *
 * @param tag - Identifier for the reference (e.g., 'native-host', 'rr-engine')
 * @returns A release function to call when keepalive is no longer needed
 *
 * @example
 * ```typescript
 * const release = acquireKeepalive('native-host');
 * // ... do work that needs SW to stay alive ...
 * release(); // Release when done
 * ```
 */
export function acquireKeepalive(tag: string): () => void {
  registerKeepaliveAlarmListener();
  try {
    const release = getController().acquire(tag);
    syncKeepaliveAlarm(); // arm backup alarm now that a reference is held
    console.debug(`${LOG_PREFIX} Acquired keepalive for tag: ${tag}`);
    return () => {
      try {
        release();
        syncKeepaliveAlarm(); // disarm if this was the last reference
        console.debug(`${LOG_PREFIX} Released keepalive for tag: ${tag}`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to release keepalive for ${tag}:`, error);
      }
    };
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to acquire keepalive for ${tag}:`, error);
    return () => {};
  }
}

/**
 * Check if keepalive is currently active (any references held).
 */
export function isKeepaliveActive(): boolean {
  try {
    return getController().isActive();
  } catch {
    return false;
  }
}

/**
 * Get the current keepalive reference count.
 * Useful for debugging.
 */
export function getKeepaliveRefCount(): number {
  try {
    return getController().getRefCount();
  } catch {
    return 0;
  }
}
