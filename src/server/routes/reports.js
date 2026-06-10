const exportQueue = require('../queues/exportQueue');

async function handleReportsRoutes(req, res, pathname, method) {
  // POST /api/reports/generate
  if (pathname === '/api/reports/generate' && method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { type, filters, search } = JSON.parse(body);

      if (!['pdf', 'csv', 'excel'].includes(type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid export type' }));
      }

      const job = await exportQueue.add('generate-report', { type, filters, search });
      
      res.writeHead(202, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, jobId: job.id, statusUrl: `/api/reports/status/${job.id}` }));
    } catch (err) {
      console.error('[POST /api/reports/generate]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to enqueue export job' }));
    }
  }

  // GET /api/reports/status/:jobId
  if (pathname.startsWith('/api/reports/status/') && method === 'GET') {
    try {
      const jobId = pathname.split('/').pop();
      const job = await exportQueue.getJob(jobId);

      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Job not found' }));
      }

      const isCompleted = await job.isCompleted();
      const isFailed = await job.isFailed();

      if (isCompleted) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'completed', result: job.returnvalue }));
      } else if (isFailed) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'failed', error: job.failedReason }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'processing' }));
      }
    } catch (err) {
      console.error('[GET /api/reports/status]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to retrieve job status' }));
    }
  }
}

module.exports = handleReportsRoutes;
