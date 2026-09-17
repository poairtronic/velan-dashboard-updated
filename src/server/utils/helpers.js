const http = require('http');
const https = require('https');
const state = require('../state');

const CACHE_TTL = Number(process.env.CACHE_TTL) || 60;

function requireApiKey(req, res) {
  if (!process.env.API_SECRET) return true;
  const key = req.headers['x-api-key'];
  if (key === process.env.API_SECRET) return true;

  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid API Key' }));
  return false;
}

function validateSheetsUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Whitelist docs.google.com and docs.googleusercontent.com
    const isWhitelisted =
      hostname === 'docs.google.com' || hostname === 'docs.googleusercontent.com';
    if (!isWhitelisted) return false;

    // Explicit SSRF protection against loopbacks
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return false;

    return true;
  } catch (e) {
    return false;
  }
}

const rateLimitStore = new Map();

function rateLimiter(req, res, maxRequests = 10, windowMs = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
  const now = Date.now();
  if (!rateLimitStore.has(ip)) rateLimitStore.set(ip, []);

  const timestamps = rateLimitStore.get(ip);
  const activeTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (activeTimestamps.length >= maxRequests) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': Math.round(windowMs / 1000),
    });
    res.end(JSON.stringify({ success: false, error: 'Too Many Requests. Rate limit exceeded.' }));
    return false;
  }

  activeTimestamps.push(now);
  rateLimitStore.set(ip, activeTimestamps);
  return true;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.logrocket.io https://cdn.logrocket.com https://cdn.logr-in.com https://cdn.lr-in.com https://cdn.lr-in-est.com https://cdn.lr-ingest.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' https://docs.google.com https://docs.googleusercontent.com https://*.logrocket.io https://*.logrocket.com https://*.logr-in.com https://*.lr-in.com https://*.lr-in-est.com https://*.lr-ingest.com; " +
      "worker-src 'self' blob:; " +
      "img-src 'self' data:; " +
      "frame-ancestors 'none';"
  );
}

const MAX_BODY = 50 * 1024 * 1024; // 50 MB limit

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLen = 0;
    req.on('data', (chunk) => {
      totalLen += chunk.length;
      if (totalLen > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large (max 50 MB)'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function normalizeTimestampString(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '-' || s === '—') return '';
  const dmyTime = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (dmyTime) {
    const day = dmyTime[1].padStart(2, '0');
    const month = dmyTime[2].padStart(2, '0');
    const year = dmyTime[3];
    let hours = parseInt(dmyTime[4] || '0', 10);
    const minutes = String(dmyTime[5] || '00').padStart(2, '0');
    const seconds = String(dmyTime[6] || '00').padStart(2, '0');
    const ampm = dmyTime[7] ? dmyTime[7].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const hStr = String(hours).padStart(2, '0');
    return `${year}-${month}-${day} ${hStr}:${minutes}:${seconds}`;
  }
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    const hours = String(ymd[4] || '00').padStart(2, '0');
    const minutes = String(ymd[5] || '00').padStart(2, '0');
    const seconds = String(ymd[6] || '00').padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  return s;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  function parseLine(line) {
    const fields = [];
    let cur = '',
      inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        fields.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  const normKey = (h) =>
    String(h)
      .trim()
      .toLowerCase()
      .replace(/[\s/-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  let hIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (!lines[i].trim()) continue;
    const candidate = parseLine(lines[i]).map(normKey);
    const hasSC = candidate.some((h) => ['sc', 'sc_no', 'sc_number', 'scno'].includes(h));
    const hasPO = candidate.some((h) => ['po', 'po_no', 'po_number', 'pono', 'purchase_order'].includes(h));
    const hasProduct = candidate.some((h) =>
      ['product', 'product_name', 'item', 'description', 'item_description'].includes(h)
    );
    const hasStage = candidate.some((h) => ['op', 'currentstage', 'current_stage', 'stage'].includes(h));
    if ((hasSC || hasPO) && (hasProduct || hasStage)) {
      hIdx = i;
      headers = candidate;
      break;
    }
  }

  if (hIdx === -1) {
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length) {
      hIdx = i;
      headers = parseLine(lines[hIdx]).map(normKey);
    } else return [];
  }

  let tsIdx = headers.findIndex((h) =>
    [
      'op_updated_date',
      'op_update_date',
      'op_updated',
      'op_date',
      'timestamp',
      'time_stamp',
      'last_updated',
      'last_update',
      'last_updated_date',
      'updated_date',
      'update_date',
      'updated_at',
      'updated_on',
      'op_time',
      'date_time',
      'datetime',
      'stage_date',
      'status_date',
      'entry_date',
      'time',
    ].includes(h)
  );

  if (tsIdx === -1) {
    const opIdx = headers.findIndex((h) =>
      ['op', 'currentstage', 'current_stage', 'stage', 'operation_stage'].includes(h)
    );
    if (opIdx !== -1 && opIdx + 1 < headers.length) {
      tsIdx = opIdx + 1;
    } else if (headers.length > 11) {
      tsIdx = 11;
    }
  }

  const pick = (obj, ...aliases) => {
    for (const a of aliases) {
      const v = obj[a];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const rows = [];
  let currentPO = '',
    currentPODate = '';
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });

    let sc = pick(obj, 'sc', 'sc_no', 'sc_number', 'scno');
    if (sc) {
      if (sc.toUpperCase().includes('SET') || /^\d{2}[-/]\d{2}[-/]\d{2,4}$/.test(sc)) {
        sc = '';
      } else {
        sc = sc.replace(/\s+/g, '');
      }
    } else {
      sc = '';
    }

    let po = pick(obj, 'po_no', 'po', 'po_number', 'pono', 'purchase_order');
    if (po && !po.includes('SETS') && !po.match(/^\d{4}$/)) currentPO = po;
    else if (!po && currentPO) po = currentPO;

    let poDate = pick(obj, 'po_recd_date', 'po_date', 'podate', 'date_received', 'date');
    if (poDate) currentPODate = poDate;
    else if (!poDate && currentPODate) poDate = currentPODate;

    const product = pick(obj, 'product_name', 'product', 'item', 'description', 'item_description');
    const status1 = pick(obj, 'status_1', 'status1', 'current_operation', 'operation');
    const status2 = pick(obj, 'status_2', 'status2', 'next_operation');
    const currentStage = pick(
      obj,
      'op',
      'currentstage',
      'current_stage',
      'stage',
      'operation_stage'
    );
    const inhouse = pick(
      obj,
      'inhouse__vendor',
      'inhouse_vendor',
      'inhouse',
      'location',
      'vendor_status'
    );
    const qty = pick(obj, 'qty', '_qty', 'quantity');
    let rawTimestamp = pick(
      obj,
      'timestamp',
      'time_stamp',
      'op_updated_date',
      'op_update_date',
      'op_updated',
      'op_date',
      'last_updated',
      'last_update',
      'last_updated_date',
      'updated_date',
      'update_date',
      'updated_at',
      'updated_on',
      'op_time',
      'date_time',
      'datetime',
      'stage_date',
      'status_date',
      'entry_date',
      'time'
    );
    if (!rawTimestamp && tsIdx !== -1 && cols[tsIdx]) {
      rawTimestamp = cols[tsIdx].trim();
    }
    const timestamp = normalizeTimestampString(rawTimestamp);

    if (!sc && !po) continue;
    rows.push({ sc, po, poDate, product, status1, status2, currentStage, inhouse, qty, timestamp });
  }
  return rows;
}

function fetchRemote(targetUrl) {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    function doFetch(fetchUrl) {
      if (redirectCount > 10) return reject(new Error('Too many redirects'));
      let parsedUrl;
      try {
        parsedUrl = new URL(fetchUrl);
      } catch (e) {
        return reject(new Error('Invalid URL: ' + fetchUrl));
      }
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      const reqObj = mod
        .get(
          fetchUrl,
          { headers: { 'User-Agent': 'VelanDashboard/2.0' }, timeout: 25000 },
          (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              redirectCount++;
              let nextUrl = res.headers.location;
              if (nextUrl.startsWith('/')) {
                nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
              }
              return doFetch(nextUrl);
            }
            if (res.statusCode !== 200) {
              return reject(new Error(`HTTP ${res.statusCode} from ${fetchUrl}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
          }
        )
        .on('error', reject);
      reqObj.on('timeout', () => {
        reqObj.destroy();
        reject(new Error('Request timed out after 25s'));
      });
    }
    doFetch(targetUrl);
  });
}

async function getSheetData(sheetUrl) {
  const now = Date.now();
  if (
    state._cache.data &&
    state._cache.url === sheetUrl &&
    now - state._cache.ts < CACHE_TTL * 1000
  ) {
    return {
      data: state._cache.data,
      cached: true,
      age: Math.round((now - state._cache.ts) / 1000),
    };
  }
  const raw = await fetchRemote(sheetUrl);
  state._cache = { data: raw, ts: now, url: sheetUrl };
  return { data: raw, cached: false, age: 0 };
}

module.exports = {
  requireApiKey,
  validateSheetsUrl,
  rateLimiter,
  applySecurityHeaders,
  readBody,
  parseCSV,
  fetchRemote,
  getSheetData,
};
