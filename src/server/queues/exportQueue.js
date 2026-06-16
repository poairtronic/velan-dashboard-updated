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

let exportQueue;
let ExportQueueEvents;

if (!isMock) {
  exportQueue = new Queue('exportQueue', { 
    connection,
    defaultJobOptions
  });
  ExportQueueEvents = QueueEvents;
} else {
  exportQueue = new MockQueue('exportQueue');
  ExportQueueEvents = MockQueueEvents;
}

module.exports = {
  exportQueue,
  QueueEvents: ExportQueueEvents
};
