const { Worker } = require('bullmq');
const { MockWorker } = require('../queues/mockQueueHelper');
const { saveLiveRows, insertRows, getTotalCount, logSync } = require('../db/pool');
const { invalidatePattern } = require('../cache/cacheService');
const state = require('../state');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let syncWorker;

const workerHandler = async (job) => {
  console.log(`[SyncWorker] Starting job ${job.id} of type ${job.name}`);
  const { incoming, syncType } = job.data;
  const incomingLength = incoming ? incoming.length : 0;

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

    // Invalidate caches
    await invalidatePattern('dashboard:*');

    // 3. Log the successful sync
    await logSync(syncType, incomingLength, 'success');

    console.log(`[SyncWorker] Completed job ${job.id}. Live: ${incoming.length} | DB: ${currentTotal} (+${saved} upserted)`);

    return {
      success: true,
      liveTotal: incoming.length,
      total: currentTotal,
      newRows: saved,
      lastSync: lastSyncStr
    };
  } catch (err) {
    console.error(`[SyncWorker] Failed job ${job.id}:`, err.message);
    await logSync(syncType, incomingLength, 'failed');
    throw err;
  }
};

if (!isMock) {
  syncWorker = new Worker('syncQueue', workerHandler, { connection });

  syncWorker.on('completed', (job) => {
    console.log(`[SyncWorker] Job ${job.id} completed`);
  });

  syncWorker.on('failed', (job, err) => {
    console.error(`[SyncWorker] Job ${job.id} failed: ${err.message}`);
  });
} else {
  syncWorker = new MockWorker('syncQueue', workerHandler);
}

module.exports = syncWorker;
