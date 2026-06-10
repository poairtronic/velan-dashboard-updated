const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

let exportQueue;

if (!isMock) {
  exportQueue = new Queue('exportQueue', { connection });
} else {
  class MockQueue {
    constructor() {
      this.jobs = new Map();
      this.counter = 1;
      console.log('[Queue] Export Queue running in Mock Mode');
    }
    async add(name, data) {
      const jobId = `mock-job-${this.counter++}`;
      this.jobs.set(jobId, { id: jobId, name, data, state: 'waiting' });
      
      // Simulate processing asynchronously
      setTimeout(() => {
        const job = this.jobs.get(jobId);
        if (job) job.state = 'completed';
      }, 5000);
      
      return { id: jobId };
    }
    async getJob(id) {
      const job = this.jobs.get(id);
      if (!job) return null;
      return {
        id: job.id,
        isCompleted: async () => job.state === 'completed',
        isFailed: async () => job.state === 'failed',
        failedReason: job.failedReason,
        returnvalue: job.state === 'completed' ? { url: '/mock-download.pdf' } : null
      };
    }
  }
  exportQueue = new MockQueue();
}

module.exports = exportQueue;
