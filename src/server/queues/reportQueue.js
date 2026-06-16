const { Queue, QueueEvents } = require('bullmq');
const { MockQueue, MockQueueEvents } = require('./mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let reportQueue;
let ReportQueueEvents;

if (!isMock) {
  reportQueue = new Queue('reportQueue', { connection });
  ReportQueueEvents = QueueEvents;
} else {
  reportQueue = new MockQueue('reportQueue');
  ReportQueueEvents = MockQueueEvents;
}

module.exports = {
  reportQueue,
  QueueEvents: ReportQueueEvents
};
