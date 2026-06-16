const { Queue, QueueEvents } = require('bullmq');
const { MockQueue, MockQueueEvents } = require('./mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let emailQueue;
let EmailQueueEvents;

if (!isMock) {
  emailQueue = new Queue('emailQueue', { connection });
  EmailQueueEvents = QueueEvents;
} else {
  emailQueue = new MockQueue('emailQueue');
  EmailQueueEvents = MockQueueEvents;
}

module.exports = {
  emailQueue,
  QueueEvents: EmailQueueEvents
};
