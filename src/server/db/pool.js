const { Pool } = require('pg');


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

  pool.on('error', (err) => {
    try {
      const logger = require('../utils/logger');
      logger.error(logger.categories.DATABASE, 'Unexpected error on idle database client', err);
      
      // Broadcast database connection failure (allowed under Popup Rules)
      const { broadcast } = require('../utils/websocket');
      broadcast('system:error', { type: 'DATABASE_FAILURE', message: 'Unexpected idle database connection error.' });
    } catch (_) {
      console.error('[DATABASE Pool Error]', err);
    }
  });

  pool.on('connect', () => {
    try {
      const logger = require('../utils/logger');
      logger.info(logger.categories.DATABASE, 'New client connected to Neon pool');
    } catch (_) {
      // Ignore if logger is not available
    }
  });
} else {
  console.error('DATABASE_URL is not set or set to mock. Mock database is no longer supported.');
  process.exit(1);
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

    // 2.1 Create pg_trgm extension and indices for ILIKE performance (Issue 2)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_velan_rows_sc ON velan_rows USING GIN ((data->>'sc') gin_trgm_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_velan_rows_po ON velan_rows USING GIN ((data->>'po') gin_trgm_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_velan_rows_prod ON velan_rows USING GIN ((data->>'product') gin_trgm_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_velan_rows_stage ON velan_rows USING GIN ((data->>'currentStage') gin_trgm_ops)`);
    } catch (idxErr) {
      console.error('[DB] Note: Could not create pg_trgm extension/indexes. Search will fallback to standard scanning.', idxErr.message);
    }

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

    // Ensure metadata columns exist in sync_logs table
    await client.query(`
      ALTER TABLE sync_logs 
      ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
      ADD COLUMN IF NOT EXISTS rows_updated INTEGER,
      ADD COLUMN IF NOT EXISTS rows_skipped INTEGER,
      ADD COLUMN IF NOT EXISTS error_message TEXT
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

    // 4.1 Create alert_rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id              SERIAL PRIMARY KEY,
        rule_key        VARCHAR(50) UNIQUE NOT NULL,
        rule_name       VARCHAR(100) NOT NULL,
        category        VARCHAR(50) NOT NULL,
        severity        VARCHAR(20) NOT NULL,
        threshold_value INTEGER NOT NULL,
        enabled         BOOLEAN DEFAULT TRUE NOT NULL,
        recipients      TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default alert rules
    await client.query(`
      INSERT INTO alert_rules (rule_key, rule_name, category, severity, threshold_value, enabled, recipients)
      VALUES 
        ('po_delay_warning', 'PO Delay Warning', 'PO_DELAY', 'INFO', 15, true, 'admin@velanmetrology.com'),
        ('po_delay_danger', 'PO Delay Danger', 'PO_DELAY', 'WARNING', 21, true, 'admin@velanmetrology.com'),
        ('po_delay_critical', 'PO Delay Critical', 'PO_DELAY', 'CRITICAL', 30, true, 'admin@velanmetrology.com'),
        ('vendor_sla_violation', 'Vendor SLA Violation', 'VENDOR_DELAY', 'CRITICAL', 2, true, 'admin@velanmetrology.com'),
        ('vendor_delay_warning', 'Vendor Delay Warning', 'VENDOR_DELAY', 'WARNING', 5, true, 'admin@velanmetrology.com'),
        ('stage_backlog_warning', 'Stage Queue Backlog', 'PRODUCTION', 'WARNING', 20, true, 'admin@velanmetrology.com'),
        ('stage_backlog_critical', 'Stage Queue Critical', 'PRODUCTION', 'CRITICAL', 50, true, 'admin@velanmetrology.com')
      ON CONFLICT (rule_key) DO NOTHING
    `);

    // 4.2 Create alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id          SERIAL PRIMARY KEY,
        rule_key    VARCHAR(50) NOT NULL,
        severity    VARCHAR(20) NOT NULL,
        category    VARCHAR(50) NOT NULL,
        message     TEXT NOT NULL,
        item_key    VARCHAR(100),
        status      VARCHAR(20) DEFAULT 'unread' NOT NULL,
        resolved_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4.3 Create operational_timeline table
    await client.query(`
      CREATE TABLE IF NOT EXISTS operational_timeline (
        id          SERIAL PRIMARY KEY,
        event_type  VARCHAR(50) NOT NULL,
        title       VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        item_key    VARCHAR(100),
        meta_data   JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4.4 Create data_quality_issues table removed

    // 4.5 Create audit_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER,
        user_email  VARCHAR(255),
        action      VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   VARCHAR(100),
        metadata    JSONB,
        ip_address  VARCHAR(45),
        timestamp   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 5. Create indices for speed optimization
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_key ON velan_rows (row_key)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_velan_live_rows_key ON velan_live_rows (row_key)'
    );
    await client.query('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON operational_timeline (created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action)');

    // Scalability Indices for fast searching, filtering, and sorting
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_stage ON velan_rows ((data->>'currentStage'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_sc ON velan_rows ((data->>'sc'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_po ON velan_rows ((data->>'po'))");
    await client.query("CREATE INDEX IF NOT EXISTS idx_velan_rows_product ON velan_rows ((data->>'product'))");
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_added_at ON velan_rows (added_at DESC)');
    
    // Additional GIN index on jsonb data for unstructured searches if needed
    await client.query('CREATE INDEX IF NOT EXISTS idx_velan_rows_data_gin ON velan_rows USING GIN (data)');

    // 6. Create Cutting Inventory Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS long_bars (
        id SERIAL PRIMARY KEY,
        bar_type VARCHAR(50) NOT NULL,
        original_length NUMERIC(10,2) NOT NULL,
        current_length NUMERIC(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cut_pieces (
        id SERIAL PRIMARY KEY,
        cut_piece_name VARCHAR(100) UNIQUE NOT NULL,
        parent_bar_type VARCHAR(50) NOT NULL,
        cut_dimension NUMERIC(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT 'mm'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cut_piece_inventory (
        id SERIAL PRIMARY KEY,
        cut_piece_id INT REFERENCES cut_pieces(id) ON DELETE CASCADE,
        quantity_available NUMERIC(10,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(cut_piece_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS production_log (
        id SERIAL PRIMARY KEY,
        long_bar_id INT REFERENCES long_bars(id) ON DELETE CASCADE,
        cut_piece_id INT REFERENCES cut_pieces(id) ON DELETE CASCADE,
        cut_dimension NUMERIC(10,2) NOT NULL,
        bar_length_before NUMERIC(10,2) NOT NULL,
        bar_length_after NUMERIC(10,2) NOT NULL,
        created_by VARCHAR(100) DEFAULT 'System',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Migration for existing tables to support decimals
    await client.query(`
      ALTER TABLE long_bars 
        ALTER COLUMN original_length TYPE NUMERIC(10,2),
        ALTER COLUMN current_length TYPE NUMERIC(10,2);
      
      ALTER TABLE cut_pieces 
        ALTER COLUMN cut_dimension TYPE NUMERIC(10,2);
        
      ALTER TABLE cut_piece_inventory
        ALTER COLUMN quantity_available TYPE NUMERIC(10,2);
        
      ALTER TABLE production_log 
        ALTER COLUMN cut_dimension TYPE NUMERIC(10,2),
        ALTER COLUMN bar_length_before TYPE NUMERIC(10,2),
        ALTER COLUMN bar_length_after TYPE NUMERIC(10,2);
    `);

    // 7. Create Fine Blank Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS fine_blanks (
        id SERIAL PRIMARY KEY,
        fine_blank_name VARCHAR(100) UNIQUE NOT NULL,
        parent_cut_piece_type VARCHAR(100) NOT NULL,
        dimension NUMERIC(10,2) NOT NULL,
        material VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fine_blank_inventory (
        id SERIAL PRIMARY KEY,
        fine_blank_id INT REFERENCES fine_blanks(id) ON DELETE CASCADE,
        quantity_available NUMERIC(10,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(fine_blank_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fine_blank_production_log (
        id SERIAL PRIMARY KEY,
        cut_piece_id INT REFERENCES cut_pieces(id) ON DELETE CASCADE,
        fine_blank_id INT REFERENCES fine_blanks(id) ON DELETE CASCADE,
        consumed_qty NUMERIC(10,2) NOT NULL,
        produced_qty NUMERIC(10,2) NOT NULL,
        remarks TEXT,
        created_by VARCHAR(50) DEFAULT 'System',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

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
async function logSync(syncType, rowCount, status, durationMs = null, rowsUpdated = null, rowsSkipped = null, errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO sync_logs (sync_type, row_count, status, duration_ms, rows_updated, rows_skipped, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [syncType, rowCount, status, durationMs, rowsUpdated, rowsSkipped, errorMessage]
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
