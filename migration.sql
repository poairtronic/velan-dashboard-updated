-- Phase 10C - Database Migration: Enterprise Governance & Production Excellence

-- 2. Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  metadata JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_email);

-- 3. Create perf_log table
CREATE TABLE IF NOT EXISTS perf_log (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  cache_hit BOOLEAN NOT NULL,
  db_query_time_ms INTEGER NOT NULL,
  total_response_time_ms INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_log_recorded ON perf_log (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_log_endpoint ON perf_log (endpoint);
