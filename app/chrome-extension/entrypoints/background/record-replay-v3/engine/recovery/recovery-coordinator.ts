/**
 * @fileoverview Crash recovery coordinator (P3-06)
 * @description
 * MV3 Service Workers can be terminated at any time. This coordinator reconciles
 * queue state and Run records on SW startup so interrupted Runs can be recovered.
 *
 * Recovery strategy:
 * - Orphan running items: reclaim to queued, await rescheduling (restart from beginning)
 * - Orphan paused items: adopt lease, keep paused status
 * - Terminal Run queue leftovers: clean up
 *
 * Invocation timing:
 * - Must be called before scheduler.start()
 * - Typically called once on SW startup
 */

import type { UnixMillis } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import { isTerminalStatus, type RunStatus } from '../../domain/events';
import type { StoragePort } from '../storage/storage-port';
import type { EventsBus } from '../transport/events-bus';

// ==================== Types ====================

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Running Run IDs reclaimed to queued */
  requeuedRunning: RunId[];
  /** Adopted paused Run IDs */
  adoptedPaused: RunId[];
  /** Cleaned up terminal Run IDs */
  cleanedTerminal: RunId[];
}

/**
 * Recovery coordinator dependencies
 */
export interface RecoveryCoordinatorDeps {
  /** Storage layer */
  storage: StoragePort;
  /** Event bus */
  events: EventsBus;
  /** Current Service Worker's ownerId */
  ownerId: string;
  /** Time source */
  now: () => UnixMillis;
  /** Logger */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

// ==================== Main Function ====================

/**
 * Perform crash recovery
 * @description
 * Called on SW startup to reconcile queue state and Run records.
 *
 * Execution order:
 * 1. Pre-clean: check all queue items, clean up terminal or orphaned items without RunRecord
 * 2. Recover orphan leases: reclaim running, adopt paused
 * 3. Sync RunRecord status: ensure RunRecord is consistent with queue state
 * 4. Emit recovery events: send run.recovered events for requeued running items
 */
export async function recoverFromCrash(deps: RecoveryCoordinatorDeps): Promise<RecoveryResult> {
  const logger = deps.logger ?? console;

  if (!deps.ownerId) {
    throw new Error('ownerId is required');
  }

  const now = deps.now();

  // Design rationale: recovery must "clean first, then adopt/reclaim", otherwise terminal Runs could be re-enqueued
  const cleanedTerminalSet = new Set<RunId>();

  // ==================== Step 1: Pre-clean ====================
  // Check all queue items, clean up terminal or orphaned items without RunRecord
  try {
    const items = await deps.storage.queue.list();
    for (const item of items) {
      const runId = item.id;
      const run = await deps.storage.runs.get(runId);

      // Defensive cleanup: queue items without RunRecord cannot be executed
      if (!run) {
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
          logger.debug(`[Recovery] Cleaned orphan queue item without RunRecord: ${runId}`);
        } catch (e) {
          logger.warn('[Recovery] markDone for missing RunRecord failed:', runId, e);
        }
        continue;
      }

      // Clean up terminal Runs (SW may have crashed after runner completed but before scheduler markDone)
      if (isTerminalStatus(run.status)) {
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
          logger.debug(`[Recovery] Cleaned terminal queue item: ${runId} (status=${run.status})`);
        } catch (e) {
          logger.warn('[Recovery] markDone for terminal run failed:', runId, e);
        }
      }
    }
  } catch (e) {
    logger.warn('[Recovery] Pre-clean failed:', e);
  }

  // ==================== Step 2: Recover orphan leases ====================
  // Best-effort: failure should not block startup
  let requeuedRunning: Array<{ runId: RunId; prevOwnerId?: string }> = [];
  let adoptedPaused: Array<{ runId: RunId; prevOwnerId?: string }> = [];
  try {
    const result = await deps.storage.queue.recoverOrphanLeases(deps.ownerId, now);
    requeuedRunning = result.requeuedRunning;
    adoptedPaused = result.adoptedPaused;
  } catch (e) {
    logger.error('[Recovery] recoverOrphanLeases failed:', e);
    // Continue execution, do not block startup
  }

  // ==================== Step 3: Sync RunRecord status ====================
  const requeuedRunningIds: RunId[] = [];
  for (const entry of requeuedRunning) {
    const runId = entry.runId;
    requeuedRunningIds.push(runId);

    // Skip items already cleaned in Step 1
    if (cleanedTerminalSet.has(runId)) {
      continue;
    }

    try {
      const run = await deps.storage.runs.get(runId);
      if (!run) {
        // RunRecord missing, clean up queue item (defensive)
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
        } catch (markDoneErr) {
          logger.warn(
            '[Recovery] markDone for missing RunRecord in Step3 failed:',
            runId,
            markDoneErr,
          );
        }
        continue;
      }

      // Skip terminal Runs (may have been updated by other logic during recovery)
      // Also clean up queue item to prevent leftovers
      if (isTerminalStatus(run.status)) {
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
          logger.debug(
            `[Recovery] Cleaned terminal queue item in Step3: ${runId} (status=${run.status})`,
          );
        } catch (markDoneErr) {
          logger.warn('[Recovery] markDone for terminal run in Step3 failed:', runId, markDoneErr);
        }
        continue;
      }

      // Update RunRecord status to queued
      await deps.storage.runs.patch(runId, { status: 'queued', updatedAt: now });

      // Emit recovery event (best-effort, failure does not affect recovery)
      try {
        const fromStatus: 'running' | 'paused' = run.status === 'paused' ? 'paused' : 'running';
        await deps.events.append({
          runId,
          type: 'run.recovered',
          reason: 'sw_restart',
          fromStatus,
          toStatus: 'queued',
          prevOwnerId: entry.prevOwnerId,
          ts: now,
        });
        logger.info(`[Recovery] Requeued orphan running run: ${runId} (from=${fromStatus})`);
      } catch (eventErr) {
        logger.warn('[Recovery] Failed to emit run.recovered event:', runId, eventErr);
        // Continue execution, does not affect recovery
      }
    } catch (e) {
      logger.warn('[Recovery] Reconcile requeued running failed:', runId, e);
    }
  }

  // ==================== Step 4: Sync adopted paused RunRecords ====================
  const adoptedPausedIds: RunId[] = [];
  for (const entry of adoptedPaused) {
    const runId = entry.runId;
    adoptedPausedIds.push(runId);

    // Skip items already cleaned in Step 1
    if (cleanedTerminalSet.has(runId)) {
      continue;
    }

    try {
      const run = await deps.storage.runs.get(runId);
      if (!run) {
        // RunRecord missing, clean up queue item (defensive)
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
        } catch (markDoneErr) {
          logger.warn(
            '[Recovery] markDone for missing RunRecord in Step4 failed:',
            runId,
            markDoneErr,
          );
        }
        continue;
      }

      // Skip terminal Runs, also clean up queue item
      if (isTerminalStatus(run.status)) {
        try {
          await deps.storage.queue.markDone(runId, now);
          cleanedTerminalSet.add(runId);
          logger.debug(
            `[Recovery] Cleaned terminal queue item in Step4: ${runId} (status=${run.status})`,
          );
        } catch (markDoneErr) {
          logger.warn('[Recovery] markDone for terminal run in Step4 failed:', runId, markDoneErr);
        }
        continue;
      }

      // If RunRecord status is not paused, sync it
      if (run.status !== 'paused') {
        await deps.storage.runs.patch(runId, { status: 'paused' as RunStatus, updatedAt: now });
      }

      logger.info(`[Recovery] Adopted orphan paused run: ${runId}`);
    } catch (e) {
      logger.warn('[Recovery] Reconcile adopted paused failed:', runId, e);
    }
  }

  const result: RecoveryResult = {
    requeuedRunning: requeuedRunningIds,
    adoptedPaused: adoptedPausedIds,
    cleanedTerminal: Array.from(cleanedTerminalSet),
  };

  logger.info('[Recovery] Complete:', {
    requeuedRunning: result.requeuedRunning.length,
    adoptedPaused: result.adoptedPaused.length,
    cleanedTerminal: result.cleanedTerminal.length,
  });

  return result;
}
