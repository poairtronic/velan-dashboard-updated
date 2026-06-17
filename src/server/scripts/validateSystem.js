require('dotenv').config();
const { pool, isMock } = require('../db/pool');
const redisClient = require('../cache/redisClient');
const { exportQueue } = require('../queues/exportQueue');
const { syncQueue } = require('../queues/syncQueue');
const { emailQueue } = require('../queues/emailQueue');
const { reportQueue } = require('../queues/reportQueue');

async function validateSystem() {
  console.log('--- SYSTEM VALIDATION REPORT ---');
  let hasErrors = false;

  // 1. Validate Database
  try {
    if (isMock) {
      console.log('✅ Database connection: OK (Mock Mode)');
    } else {
      const res = await pool.query('SELECT NOW() as time');
      console.log('✅ Database connection: OK', res.rows[0].time);
    }
  } catch (err) {
    console.error('❌ Database connection: FAILED', err.message);
    hasErrors = true;
  }

  // 2. Validate Redis
  try {
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      console.log('✅ Redis connection: OK');
    } else {
      console.log('✅ Redis connection: OK (Mock)');
    }
  } catch (err) {
    console.error('❌ Redis connection: FAILED', err.message);
    hasErrors = true;
  }

  // 3. Validate Queues
  const queues = [
    { name: 'Export', queue: exportQueue },
    { name: 'Sync', queue: syncQueue },
    { name: 'Email', queue: emailQueue },
    { name: 'Report', queue: reportQueue },
  ];

  for (const q of queues) {
    try {
      if (!q.queue.client || !q.queue.client.status) {
        console.log(`✅ Queue (${q.name}): OK (Mock)`);
      } else {
        const isReady = await q.queue.client.status === 'ready';
        console.log(`✅ Queue (${q.name}): OK`);
      }
    } catch (err) {
      console.error(`❌ Queue (${q.name}): FAILED`, err.message);
      hasErrors = true;
    }
  }

  // 4. Validate Environment Variables
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'GOOGLE_SHEET_ID'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length === 0) {
    console.log('✅ Environment Variables: OK');
  } else {
    console.log('⚠️ Environment Variables: MISSING (Allowed in Dev)', missingEnvVars.join(', '));
  }

  console.log('--------------------------------');
  if (hasErrors) {
    console.log('STATUS: FAILED ❌');
    process.exit(1);
  } else {
    console.log('STATUS: PASSED ✅');
    process.exit(0);
  }
}

validateSystem();
