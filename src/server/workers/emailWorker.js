const { Worker } = require('bullmq');
const { MockWorker } = require('../queues/mockQueueHelper');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let emailWorker;

const workerHandler = async (job) => {
  console.log(`[EmailWorker] Starting job ${job.id} of type ${job.name}`);
  const { to, subject, body } = job.data;
  
  // Future SMTP or SendGrid implementation goes here
  console.log(`[EmailWorker] Sending email to ${to}: "${subject}"`);
  
  // Simulate minor delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  console.log(`[EmailWorker] Completed job ${job.id}`);
  return { success: true, sentTo: to };
};

const settings = {
  connection,
  settings: {
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 seconds initial delay
    }
  },
  limiter: {
    max: 5,
    duration: 1000 // limit to 5 emails per second
  }
};

if (!isMock) {
  emailWorker = new Worker('emailQueue', workerHandler, settings);

  emailWorker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job.id} failed: ${err.message}`);
  });
} else {
  emailWorker = new MockWorker('emailQueue', workerHandler);
}

module.exports = emailWorker;
