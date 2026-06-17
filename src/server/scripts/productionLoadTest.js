require('dotenv').config();
const { pool } = require('../db/pool');

async function runLoadTest(recordCount) {
  console.log(`\n--- LOAD TEST: Simulating ${recordCount} records ---`);
  
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  try {
    const res = await pool.query(`SELECT * FROM velan_rows LIMIT $1`, [recordCount]);
    
    const queryTime = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    
    const rowsRetrieved = res.rows ? res.rows.length : (res.rowCount || 0);
    console.log(`✅ Query Successful: Retrieved ${rowsRetrieved} rows`);
    console.log(`⏱️ Response Time: ${queryTime}ms`);
    console.log(`💾 Memory Usage (Heap Used Delta): ${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)} MB`);
    
    if (queryTime > 5000) {
      console.warn('⚠️ Warning: Query took longer than 5 seconds.');
    }
  } catch (err) {
    console.error(`❌ Query Failed:`, err.message);
  }
}

async function main() {
  console.log('--- PRODUCTION LOAD TEST START ---');
  
  const benchmarks = [10000, 50000, 100000, 250000];
  
  for (const count of benchmarks) {
    await runLoadTest(count);
  }

  console.log('\n--- PRODUCTION LOAD TEST COMPLETE ---');
  process.exit(0);
}

main();
