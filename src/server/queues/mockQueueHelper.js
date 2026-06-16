const EventEmitter = require('events');
const mockEvents = new EventEmitter();

// Global registry for mock workers
global.mockWorkers = global.mockWorkers || {};

class MockJob {
  constructor(id, name, data, queueName) {
    this.id = id;
    this.name = name;
    this.data = data;
    this.queueName = queueName;
    this.state = 'waiting';
    this.progress = 0;
    this.returnvalue = null;
    this.failedReason = null;
  }

  async isCompleted() {
    return this.state === 'completed';
  }

  async isFailed() {
    return this.state === 'failed';
  }

  async waitUntilFinished(queueEvents) {
    return new Promise((resolve, reject) => {
      if (this.state === 'completed') {
        return resolve(this.returnvalue);
      }
      if (this.state === 'failed') {
        return reject(new Error(this.failedReason || 'Job failed'));
      }

      const onCompleted = ({ jobId, returnvalue }) => {
        if (jobId === this.id) {
          mockEvents.off(`${this.queueName}:completed`, onCompleted);
          mockEvents.off(`${this.queueName}:failed`, onFailed);
          resolve(returnvalue);
        }
      };

      const onFailed = ({ jobId, failedReason }) => {
        if (jobId === this.id) {
          mockEvents.off(`${this.queueName}:completed`, onCompleted);
          mockEvents.off(`${this.queueName}:failed`, onFailed);
          reject(new Error(failedReason || 'Job failed'));
        }
      };

      mockEvents.on(`${this.queueName}:completed`, onCompleted);
      mockEvents.on(`${this.queueName}:failed`, onFailed);
    });
  }
}

class MockQueue {
  constructor(name) {
    this.name = name;
    this.jobs = new Map();
    this.counter = 1;
    console.log(`[Queue] Mock Queue '${name}' initialized`);
  }

  async add(name, data) {
    const jobId = `mock-job-${this.name}-${this.counter++}`;
    const job = new MockJob(jobId, name, data, this.name);
    this.jobs.set(jobId, job);

    // Run processing asynchronously on next tick to simulate queue behavior
    setImmediate(async () => {
      job.state = 'active';
      try {
        const worker = global.mockWorkers[this.name];
        let result;
        if (worker) {
          result = await worker.handler(job);
        } else {
          // Default mock handler if worker isn't registered yet
          await new Promise((resolve) => setTimeout(resolve, 500));
          result = { success: true, mock: true };
        }
        job.state = 'completed';
        job.returnvalue = result;
        mockEvents.emit(`${this.name}:completed`, { jobId, returnvalue: result });
      } catch (err) {
        job.state = 'failed';
        job.failedReason = err.message;
        mockEvents.emit(`${this.name}:failed`, { jobId, failedReason: err.message });
      }
    });

    return job;
  }

  async getJob(id) {
    return this.jobs.get(id) || null;
  }

  async getJobCounts() {
    let waiting = 0, active = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      if (job.state === 'waiting') waiting++;
      else if (job.state === 'active') active++;
      else if (job.state === 'completed') completed++;
      else if (job.state === 'failed') failed++;
    }
    return { waiting, active, completed, failed };
  }
}

class MockWorker {
  constructor(name, handler) {
    this.name = name;
    this.handler = handler;
    global.mockWorkers[name] = this;
    console.log(`[MockWorker] Registered worker for queue: ${name}`);
  }

  on(event, callback) {
    // Mock event registration
    return this;
  }
}

class MockQueueEvents {
  constructor(name) {
    this.name = name;
  }
}

module.exports = {
  MockQueue,
  MockWorker,
  MockQueueEvents
};
