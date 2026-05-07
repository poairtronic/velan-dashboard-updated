const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname)));

function ensureDataFolder() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { rows: [], lastSync: null };
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content || '{"rows":[],"lastSync":null}');
  } catch (err) {
    console.error('DB load error — return empty state:', err);
    return { rows: [], lastSync: null };
  }
}

function saveDb(db) {
  try {
    ensureDataFolder();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('DB save error — silent fail:', err);
  }
}

function normalizeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function toIsoDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const parts = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (parts) return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
  const dmY = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return text;
}

function normalizeRow(raw) {
  const row = {
    sc: normalizeString(raw.sc),
    po: normalizeString(raw.po),
    poDate: toIsoDate(normalizeString(raw.poDate)),
    product: normalizeString(raw.product),
    type: normalizeString(raw.type),
    status1: normalizeString(raw.status1),
    status2: normalizeString(raw.status2),
    inhouse: normalizeString(raw.inhouse),
    currentStage: normalizeString(raw.currentStage),
    timestamp: normalizeString(raw.timestamp),
    source: normalizeString(raw.source || ''),
  };

  if (row.inhouse) {
    const up = row.inhouse.toUpperCase();
    row.inhouse = up.includes('VENDOR') ? 'VENDOR' : 'INHOUSE';
  }

  if (!row.type && row.product) {
    const p = row.product.toUpperCase();
    if (p.startsWith('APG')) row.type = 'APG';
    else if (p.startsWith('ARG')) row.type = 'ARG';
    else if (p.startsWith('SRG')) row.type = 'SRG';
    else if (p.startsWith('SPG')) row.type = 'SPG';
    else if (p.startsWith('SP ')) row.type = 'SP';
    else row.type = 'ACCESSORY';
  }

  return row;
}
function makeId(row) {
  return [row.sc, row.po, row.product].map(v => String(v || '').trim()).join('_');
}
function rowKey(row) {
  return [row.sc, row.po, row.product, row.timestamp].map(v => String(v || '')).join('||');
}

function mergeRows(existingRows, incomingRows) {
  const normalizedIncoming = incomingRows.map(normalizeRow).filter(r => r.sc || r.po);
  const incomingKeys = new Set(normalizedIncoming.map(rowKey));

  // Build map from existing rows — preserve id if already set
  const existingMap = new Map(existingRows.map(row => [
    row._key || rowKey(row),
    { ...row, _key: row._key || rowKey(row), id: row.id || makeId(row) }
  ]));

  normalizedIncoming.forEach(row => {
    const key = rowKey(row);
    const id = makeId(row);
    if (existingMap.has(key)) {
      // Update existing row — keep original id
      const prev = existingMap.get(key);
      existingMap.set(key, {
        ...prev, ...row,
        id: prev.id || id,
        active: true,
        archived: false,
        lastSeen: new Date().toISOString(),
        _key: key,
      });
    } else {
      // New row — insert with id
      existingMap.set(key, {
        ...row,
        id,
        active: true,
        archived: false,
        insertedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        _key: key,
      });
    }
  });

  // Rows absent from incoming are KEPT PERMANENTLY — never deleted, never set inactive
  existingMap.forEach((row) => {
    if (!row.id) row.id = makeId(row);
    if (!row.insertedAt) row.insertedAt = new Date().toISOString();
    // Do NOT touch row.active — preserve whatever status it had
  });

  return Array.from(existingMap.values());
}
app.get('/api/data', (req, res) => {
  const db = loadDb();
  res.json(db);
});
// Add AFTER line 120:

// GET /api/stats — lightweight count endpoint
app.get('/api/stats', (req, res) => {
  const db = loadDb();
  res.json({ total: db.rows.length, lastSync: db.lastSync });
});

// GET /api/sync — Google Sheet sync (configure URL via env var SHEET_CSV_URL)
app.get('/api/sync', async (req, res) => {
  const sheetUrl = process.env.SHEET_CSV_URL || '';
  if (!sheetUrl) {
    return res.json({
      success: false,
      message: 'No SHEET_CSV_URL env var set. Upload data via POST /api/data or the UI upload feature.',
    });
  }
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const response = await fetch(sheetUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    // Parse CSV rows (simple split — frontend parsers handle full XLSX)
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    const db = loadDb();
    db.rows = mergeRows(db.rows, rows);
    db.lastSync = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, synced: rows.length, total: db.rows.length, lastSync: db.lastSync });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.post('/api/data', (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.rows)) {
    return res.status(400).json({ error: 'Payload must contain rows array.' });
  }

  const db = loadDb();
  db.rows = mergeRows(db.rows, payload.rows);
  db.lastSync = new Date().toISOString();
  saveDb(db);
  res.json({ success: true, saved: payload.rows.length, total: db.rows.length, lastSync: db.lastSync });
});

app.post('/api/clear', (req, res) => {
  const db = { rows: [], lastSync: new Date().toISOString() };
  saveDb(db);
  res.json({ success: true, cleared: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
