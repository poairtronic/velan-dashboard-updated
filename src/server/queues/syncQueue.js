const { Queue, QueueEvents } = require('bullmq');
const { MockQueue, MockQueueEvents } = require('./mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    count: 100
  },
  removeOnFail: {
    count: 50
  }
};

let syncQueue;
let SyncQueueEvents;

if (!isMock) {
  syncQueue = new Queue('syncQueue', { 
    connection,
    defaultJobOptions
  });
  SyncQueueEvents = QueueEvents;
} else {
  syncQueue = new MockQueue('syncQueue');
  SyncQueueEvents = MockQueueEvents;
}

module.exports = {
  syncQueue,
  QueueEvents: SyncQueueEvents
};
