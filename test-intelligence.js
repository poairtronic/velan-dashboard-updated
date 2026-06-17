require('dotenv').config();
const { pool } = require('./src/server/db/pool');

// insert mock data to ensure computeGroups has something
async function test() {
  await pool.query(`INSERT INTO velan_rows (row_key, data) VALUES ('123', '{"sc": "SC1", "po": "PO1", "product": "P1", "currentStage": "WIP", "inhouse": "VENDOR", "timestamp": "2026-06-17"}')`);
  
  const app = require('./src/server/app');
  const request = require('supertest');
  
  const res = await request(app).get('/api/intelligence');
  console.log("Status:", res.status);
  if (res.status !== 200) {
    console.error(res.body);
  } else {
    console.log("Success! Data keys:", Object.keys(res.body));
  }
  process.exit(0);
}

test();
