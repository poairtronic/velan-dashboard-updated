const { Pool } = require('pg');
const bcrypt = require('bcrypt');

let pool;
const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL === 'mock';

if (!isMock) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20, // Increased for 10k+ users handling
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  class MockPool {
    constructor() {
      this.rows = [];
      this.liveRows = [];
      this.syncLogs = [];
      this.users = [
        {
          id: 1,
          username: 'admin',
          password_hash: bcrypt.hashSync('admin123', 10),
          role: 'admin',
          status: 'approved',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          username: 'user',
          password_hash: bcrypt.hashSync('user123', 10),
          role: 'user',
          status: 'approved',
          created_at: new Date().toISOString(),
        },
      ];
    }
    async connect() {
      return {
        query: async (sql, params) => this.query(sql, params),
        release: () => {},
      };
    }
    async query(sql, params) {
      const cleanSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();
      if (
        cleanSql.includes('CREATE TABLE') ||
        cleanSql.includes('CREATE INDEX') ||
        cleanSql.includes('BEGIN') ||
        cleanSql.includes('COMMIT') ||
        cleanSql.includes('DROP TABLE')
      ) {
        return { rowCount: 0, rows: [] };
      }
      if (cleanSql.includes('SELECT COUNT(*) FROM VELAN_ROWS WHERE ROW_KEY')) {
        return { rows: [{ count: 0 }] };
      }
      if (cleanSql.includes('SELECT CREATED_AT FROM SYNC_LOGS')) {
        return { rows: this.syncLogs.slice(0, 1) };
      }
      if (cleanSql.includes('SELECT DATA FROM VELAN_ROWS')) {
        return { rows: this.rows };
      }
      if (cleanSql.includes('SELECT DATA FROM VELAN_LIVE_ROWS')) {
        return { rows: this.liveRows };
      }
      if (cleanSql.includes('SELECT SYNC_TYPE')) {
        return { rows: this.syncLogs };
      }
      if (cleanSql.includes('SELECT COUNT(*) FROM VELAN_ROWS') || cleanSql.includes('SELECT COUNT(*) AS COUNT FROM VELAN_ROWS')) {
        return { rows: [{ count: this.rows.length }] };
      }
      if (
        cleanSql.includes('TRUNCATE VELAN_LIVE_ROWS') ||
        cleanSql.includes('DELETE FROM VELAN_LIVE_ROWS')
      ) {
        this.liveRows = [];
        return { rowCount: 0, rows: [] };
      }
      if (cleanSql.includes('DELETE FROM VELAN_ROWS')) {
        this.rows = [];
        return { rowCount: 0, rows: [] };
      }
      if (
        cleanSql.includes('INSERT INTO VELAN_LIVE_ROWS') ||
        cleanSql.includes('INSERT INTO VELAN_ROWS')
      ) {
        if (params) {
          for (let i = 0; i < params.length; i += 2) {
            const key = params[i];
            if (!params[i + 1]) continue;
            const data = JSON.parse(params[i + 1]);
            const rowObj = { row_key: key, data };
            if (cleanSql.includes('VELAN_LIVE_ROWS')) {
              const idx = this.liveRows.findIndex((r) => r.row_key === key);
              if (idx >= 0) this.liveRows[idx] = rowObj;
              else this.liveRows.push(rowObj);
            } else {
              const idx = this.rows.findIndex((r) => r.row_key === key);
              if (idx >= 0) this.rows[idx] = rowObj;
              else this.rows.push(rowObj);
            }
          }
        }
        return { rowCount: params ? params.length / 2 : 0, rows: [] };
      }
      if (cleanSql.includes('INSERT INTO SYNC_LOGS')) {
        const [sync_type, row_count, status] = params;
        const log = { sync_type, row_count, status, created_at: new Date().toISOString() };
        this.syncLogs.unshift(log);
        return { rowCount: 1, rows: [] };
      }
      if (cleanSql.includes("SELECT COUNT(*) FROM USERS WHERE STATUS = 'PENDING'")) {
        const count = this.users.filter((u) => u.status === 'pending').length;
        return { rows: [{ count }] };
      }
      if (cleanSql.includes('SELECT * FROM USERS WHERE USERNAME = $1')) {
        const user = this.users.find((u) => u.username === params[0]);
        return { rows: user ? [user] : [] };
      }
      if (cleanSql.includes('INSERT INTO USERS')) {
        const username = params[0];
        const password_hash = params[1];
        const role = params[2];
        const status = params[3] || 'approved';
        const newUser = {
          id: this.users.length + 1,
          username,
          password_hash,
          role,
          status,
          created_at: new Date().toISOString(),
        };
        this.users.push(newUser);
        return { rows: [newUser], rowCount: 1 };
      }
      if (cleanSql.includes('UPDATE USERS SET STATUS = $1 WHERE ID = $2')) {
        const status = params[0];
        const id = parseInt(params[1], 10);
        const user = this.users.find((u) => u.id === id);
        if (user) {
          user.status = status;
          return { rows: [user], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (cleanSql.includes('DELETE FROM USERS WHERE ID = $1')) {
        const id = parseInt(params[0], 10);
        const idx = this.users.findIndex((u) => u.id === id);
        if (idx >= 0) {
          const deleted = this.users.splice(idx, 1);
          return { rows: deleted, rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (cleanSql.includes('FROM USERS')) {
        return {
          rows: [...this.users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
        };
      }
      return { rows: [] };
    }
    async end() {}
  }
  pool = new MockPool();
}

// ── Create tables and indices if they don't exist ─────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create velan_rows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS velan_rows (
        id       SERIAL PRIMARY KEY,
        row_key  TEXT UNIQUE NOT NULL,
        data     JSONB NOT NULL,
        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Create velan_live_rows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS velan_live_rows (
        id       SERIAL PRIMARY KEY,
        row_key  TEXT UNIQUE NOT NULL,
        data     JSONB NOT NULL,
        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Create sync_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id         SERIAL PRIMARY KEY,
        sync_type  TEXT NOT NULL,
        row_count  INTEGER NOT NULL,
        status     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4. Create users table (separate from production data)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          VARCHAR(10) NOT NULL DEFAULT 'user',
        status        VARCHAR(15) NOT NULL DEFAULT 'approved',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Ensure status column exists for users migrating from older versions
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(15) NOT NULL DEFAULT 'approved'
    `);

    // 5. Create indices for speed optimization
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_key ON velan_rows (row_key)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_velan_live_rows_key ON velan_live_rows (row_key)'
    );

    // Scalability Indices for fast searching, filtering, and sorting
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_stage ON velan_rows ((data->>'currentStage'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_sc ON velan_rows ((data->>'sc'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_po ON velan_rows ((data->>'po'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_product ON velan_rows ((data->>'product'))");
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_added_at ON velan_rows (added_at DESC)');
    
    // Additional GIN index on jsonb data for unstructured searches if needed
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_data_gin ON velan_rows USING GIN (data)');

    await client.query('COMMIT');
    console.log('[DB] Neon tables and indices initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Neon initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Migration: Converts old row keys and deduplicates data ──────────────────
async function runKeyMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create temporary table with deduplicated latest entries
    await client.query(`
      CREATE TEMP TABLE temp_latest_rows AS
      SELECT DISTINCT ON (
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', '')
      ) id, data, added_at
      FROM velan_rows
      ORDER BY 
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', ''), 
        added_at DESC
    `);

    // Truncate existing rows
    await client.query('TRUNCATE velan_rows');

    // Re-insert deduplicated rows with the new key format
    await client.query(`
      INSERT INTO velan_rows (row_key, data, added_at)
      SELECT 
        COALESCE(data->>'sc', '') || '||' || 
        COALESCE(data->>'po', '') || '||' || 
        COALESCE(data->>'product', '') || '||' || 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', ''),
        data,
        added_at
      FROM temp_latest_rows
    `);

    await client.query('DROP TABLE temp_latest_rows');
    await client.query('COMMIT');
    console.log('[DB] Key migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Key migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}


// ── Paginated Query ───────────────────────────────────────────────────────────
async function queryRowsPaginated({ limit = 500, offset = 0, search = '' }) {
  let queryText = 'SELECT data FROM velan_rows';
  const queryParams = [];

  if (search) {
    queryText += ` WHERE data->>'sc' ILIKE $1 OR data->>'po' ILIKE $1 OR data->>'product' ILIKE $1 OR data->>'currentStage' ILIKE $1`;
    queryParams.push(`%${search}%`);
  }

  queryText += ` ORDER BY added_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  queryParams.push(limit, offset);

  const res = await pool.query(queryText, queryParams);
  
  return res.rows.map((r) => {
    const d = r.data;
    if (!d.currentStage && d.op) d.currentStage = String(d.op).trim();
    if (!d.currentStage && d.OP) d.currentStage = String(d.OP).trim();
    return d;
  });
}

// Get Total Count
async function getTotalCount() {
  const res = await pool.query('SELECT COUNT(*) as count FROM velan_rows');
  return parseInt(res.rows[0].count, 10);
}

// ── Load all live operational rows from Neon ─────────────────────────
async function loadLiveDB() {
  const res = await pool.query('SELECT data FROM velan_live_rows ORDER BY id');
  return res.rows.map((r) => {
    const d = r.data;
    if (!d.currentStage && d.op) d.currentStage = String(d.op).trim();
    if (!d.currentStage && d.OP) d.currentStage = String(d.OP).trim();
    return d;
  });
}

// ── Insert Sync Log ───────────────────────────────────────────────────────────
async function logSync(syncType, rowCount, status) {
  try {
    await pool.query(
      `INSERT INTO sync_logs (sync_type, row_count, status)
       VALUES ($1, $2, $3)`,
      [syncType, rowCount, status]
    );
  } catch (err) {
    console.error('[logSync] Failed to log sync:', err.message);
  }
}

const crypto = require('crypto');

// ── Refactored Row Key Generator ──────────────────────────────────────────────
const makeKey = (r) => {
  const content = `${r.sc || ''}||${r.po || ''}||${r.product || ''}||${r.currentStage || ''}||${r.status1 || ''}||${r.status2 || ''}||${r.inhouse || ''}||${r.timestamp || ''}||${r.qty || ''}`;
  return crypto.createHash('md5').update(content).digest('hex');
};

// ── Bulk Upsert archive rows into Neon ─────────────────────────────────────────
async function insertRows(rows) {
  if (!rows.length) return 0;

  const uniqueMap = new Map();
  rows.forEach((r) => {
    const key = makeKey(r);
    const existing = uniqueMap.get(key);
    if (!existing || (r.timestamp && (!existing.timestamp || r.timestamp > existing.timestamp))) {
      uniqueMap.set(key, r);
    }
  });
  const uniqueRows = Array.from(uniqueMap.values());

  const client = await pool.connect();
  let upserted = 0;
  try {
    await client.query('BEGIN');
    const chunkSize = 500;
    for (let i = 0; i < uniqueRows.length; i += chunkSize) {
      const chunk = uniqueRows.slice(i, i + chunkSize);
      const valueStrings = [];
      const values = [];

      chunk.forEach((row, idx) => {
        const valIdx1 = idx * 2 + 1;
        const valIdx2 = idx * 2 + 2;
        valueStrings.push(`($${valIdx1}, $${valIdx2})`);
        values.push(makeKey(row), JSON.stringify(row));
      });

      const queryText = `
        INSERT INTO velan_rows (row_key, data)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (row_key) DO UPDATE SET data = EXCLUDED.data, added_at = NOW()
      `;
      const res = await client.query(queryText, values);
      upserted += res.rowCount;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return upserted;
}

// ── Bulk Replace/Upsert operational live snapshot rows in Neon ────────────────
async function saveLiveRows(rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE velan_live_rows');

    if (rows.length > 0) {
      const uniqueMap = new Map();
      rows.forEach((r) => {
        const key = makeKey(r);
        const existing = uniqueMap.get(key);
        if (
          !existing ||
          (r.timestamp && (!existing.timestamp || r.timestamp > existing.timestamp))
        ) {
          uniqueMap.set(key, r);
        }
      });
      const uniqueRows = Array.from(uniqueMap.values());

      const chunkSize = 500;
      for (let i = 0; i < uniqueRows.length; i += chunkSize) {
        const chunk = uniqueRows.slice(i, i + chunkSize);
        const valueStrings = [];
        const values = [];
        chunk.forEach((row, idx) => {
          const valIdx1 = idx * 2 + 1;
          const valIdx2 = idx * 2 + 2;
          valueStrings.push(`($${valIdx1}, $${valIdx2})`);
          values.push(makeKey(row), JSON.stringify(row));
        });
        const queryText = `
          INSERT INTO velan_live_rows (row_key, data)
          VALUES ${valueStrings.join(', ')}
          ON CONFLICT (row_key) DO UPDATE SET data = EXCLUDED.data, added_at = NOW()
        `;
        await client.query(queryText, values);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  isMock,
  initDB,
  runKeyMigration,
  loadLiveDB,
  queryRowsPaginated,
  getTotalCount,
  logSync,
  insertRows,
  saveLiveRows,
};
