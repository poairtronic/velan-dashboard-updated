const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '30mb' }));

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
    console.error('Failed to load DB:', err);
    return { rows: [], lastSync: null };
  }
}

function saveDb(db) {
  try {
    ensureDataFolder();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save DB:', err);
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

function rowKey(row) {
  return [row.sc, row.po, row.product, row.timestamp].map(v => String(v || '')).join('||');
}

function mergeRows(existingRows, incomingRows) {
  const normalizedIncoming = incomingRows.map(normalizeRow).filter(r => r.sc || r.po);
  const incomingKeys = new Set(normalizedIncoming.map(rowKey));

  const existingMap = new Map(existingRows.map(row => [row._key || rowKey(row), { ...row, _key: row._key || rowKey(row) }]));

  normalizedIncoming.forEach(row => {
    const key = rowKey(row);
    if (existingMap.has(key)) {
      const prev = existingMap.get(key);
      existingMap.set(key, { ...prev, ...row, archived: false, active: true, lastSeen: new Date().toISOString(), _key: key });
    } else {
      existingMap.set(key, { ...row, archived: false, active: true, insertedAt: new Date().toISOString(), lastSeen: new Date().toISOString(), _key: key });
    }
  });

  existingMap.forEach((row, key) => {
    if (!incomingKeys.has(key)) {
      row.active = row.active === false ? false : row.active || false;
      if (!row.insertedAt) row.insertedAt = row.insertedAt || new Date().toISOString();
      row.archived = row.archived || false;
    }
  });

  return Array.from(existingMap.values());
}

app.get('/api/data', (req, res) => {
  const db = loadDb();
  res.json(db);
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

app.listen(PORT, () => {
  console.log(`Velan dashboard backend running on http://localhost:${PORT}`);
});
