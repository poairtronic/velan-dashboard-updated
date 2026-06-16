const { Worker } = require('bullmq');
const { MockWorker } = require('../queues/mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let reportWorker;

const workerHandler = async (job) => {
  console.log(`[ReportWorker] Starting job ${job.id} of type ${job.name}`);
  
  // Future scheduled or heavy recurring reports execution goes here
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  console.log(`[ReportWorker] Completed job ${job.id}`);
  return { success: true };
};

const settings = {
  connection,
  settings: {
    backoff: {
      type: 'exponential',
      delay: 10000
    }
  }
};

if (!isMock) {
  reportWorker = new Worker('reportQueue', workerHandler, settings);

  reportWorker.on('completed', (job) => {
    console.log(`[ReportWorker] Job ${job.id} completed`);
  });

  reportWorker.on('failed', (job, err) => {
    console.error(`[ReportWorker] Job ${job.id} failed: ${err.message}`);
  });
} else {
  reportWorker = new MockWorker('reportQueue', workerHandler);
}

module.exports = reportWorker;
