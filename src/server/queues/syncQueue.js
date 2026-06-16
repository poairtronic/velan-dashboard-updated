const { Queue, QueueEvents } = require('bullmq');
const { MockQueue, MockQueueEvents } = require('./mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let syncQueue;
let SyncQueueEvents;

if (!isMock) {
  syncQueue = new Queue('syncQueue', { connection });
  SyncQueueEvents = QueueEvents;
} else {
  syncQueue = new MockQueue('syncQueue');
  SyncQueueEvents = MockQueueEvents;
}

module.exports = {
  syncQueue,
  QueueEvents: SyncQueueEvents
};
