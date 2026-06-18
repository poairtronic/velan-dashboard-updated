const { Worker } = require('bullmq');
const { MockWorker } = require('../queues/mockQueueHelper');
const { saveLiveRows, insertRows, getTotalCount, logSync } = require('../db/pool');
const { invalidatePattern } = require('../cache/cacheService');
const state = require('../state');
const logger = require('../utils/logger');
const { runAlertEngine, logTimelineEvent } = require('../services/alertEngine');
const { broadcast } = require('../utils/websocket');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let syncWorker;

const workerHandler = async (job) => {
  logger.info(logger.categories.SYNC, `[SyncWorker] Starting job ${job.id} of type ${job.name}`);
  const { incoming, syncType } = job.data;
  const incomingLength = incoming ? incoming.length : 0;
  const startTime = Date.now();

  try {
    if (!incoming || !Array.isArray(incoming)) {
      throw new Error('Incoming rows must be an array');
    }

    // 1. Replace the live snapshot table in database
    await saveLiveRows(incoming);
    state._liveRows = incoming;

    // 2. Save/Upsert new rows to velan_rows in Neon
    const saved = await insertRows(incoming);

    const currentTotal = await getTotalCount();
    const lastSyncStr = new Date().toLocaleString('en-IN');
    state._lastSync = lastSyncStr;
    state._lastSyncTime = new Date();

    // Invalidate caches
    await invalidatePattern('dashboard:*');

    const durationMs = Date.now() - startTime;
    const rowsSkipped = incomingLength - saved;

    // 3. Log the successful sync
    await logSync(syncType, incomingLength, 'success', durationMs, saved, rowsSkipped, null);

    // 4. Run Alert Engine on new data
    try {
      await runAlertEngine(incoming);
    } catch (alertErr) {
      logger.error(logger.categories.SYNC, `Alert Engine run failed: ${alertErr.message}`, alertErr);
    }

    // 5. Log Timeline Event
    try {
      await logTimelineEvent('SYNC_EXECUTED', 'Google Sheets Sync Completed', `Synchronized ${incoming.length} active rows. Database contains ${currentTotal} total archive rows.`, null, { durationMs, incomingLength, syncType });
    } catch (timelineErr) {
      logger.error(logger.categories.SYNC, `Timeline logging failed: ${timelineErr.message}`, timelineErr);
    }

    // 6. Broadcast Sync Completed Event over WebSockets
    try {
      broadcast('sync:completed', { lastSync: lastSyncStr, liveRowsCount: incoming.length, dbRowsCount: currentTotal });
    } catch (wsErr) {
      logger.error(logger.categories.SYNC, `WebSocket broadcast failed: ${wsErr.message}`, wsErr);
    }

    logger.info(logger.categories.SYNC, `[SyncWorker] Completed job ${job.id}. Live: ${incoming.length} | DB: ${currentTotal} (+${saved} upserted) | Duration: ${durationMs}ms`);

    return {
      success: true,
      liveTotal: incoming.length,
      total: currentTotal,
      newRows: saved,
      lastSync: lastSyncStr,
      durationMs
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error(logger.categories.SYNC, `[SyncWorker] Failed job ${job.id}: ${err.message}`, err);
    await logSync(syncType, incomingLength, 'failed', durationMs, 0, incomingLength, err.message);
    
    // Broadcast WebSocket notification for Google Sheet Sync Failure (allowed under Popup Rules)
    try {
      broadcast('sync:failed', { error: err.message, syncType });
    } catch (wsErr) {
      logger.error(logger.categories.SYNC, `Failed to broadcast sync:failed over WS: ${wsErr.message}`, wsErr);
    }
    
    throw err;
  }
};

if (!isMock) {
  syncWorker = new Worker('syncQueue', workerHandler, { connection });

  syncWorker.on('completed', (job) => {
    logger.info(logger.categories.SYNC, `[SyncWorker] Job ${job.id} completed`);
  });

  syncWorker.on('failed', (job, err) => {
    logger.error(logger.categories.SYNC, `[SyncWorker] Job ${job.id} failed: ${err.message}`, err);
  });

  syncWorker.on('error', (err) => {
    logger.error(logger.categories.QUEUE, `[SyncWorker] Worker error: ${err.message}`, err);
  });

  syncWorker.on('stalled', (jobId) => {
    logger.warn(logger.categories.QUEUE, `[SyncWorker] Job ${jobId} has stalled!`);
  });
} else {
  syncWorker = new MockWorker('syncQueue', workerHandler);
}

module.exports = syncWorker;
