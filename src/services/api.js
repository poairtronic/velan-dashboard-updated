import * as XLSX from 'xlsx';
import { normalizeGoogleSheetsUrl } from './googleSheets';
import { parseRawCsv, parseRowsFromHeaderAoA, parseWorksheet } from './excelParser';
// ─── API SERVICES ────────────────────────────────────────────────────────────

const apiBase = import.meta.env.VITE_API_BASE || '';

async function apiFetchData() {
  const res = await fetch(`${apiBase}/api/data`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiSaveRows(rows, syncType = 'Manual Upload', apiKey = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  
  const res = await fetch(`${apiBase}/api/data?sync_type=${encodeURIComponent(syncType)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows }),
  });
  if (res.status === 401) {
    const err = new Error('Unauthorized: Invalid API Key');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiImportRows(rows, apiKey = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(`${apiBase}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows }),
  });
  if (res.status === 401) {
    const err = new Error('Unauthorized: Invalid API Key');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiResetDB(apiKey = '') {
  const headers = {};
  if (apiKey) headers['x-api-key'] = apiKey;

  const res = await fetch(`${apiBase}/api/data`, { 
    method: 'DELETE',
    headers
  });
  if (res.status === 401) {
    const err = new Error('Unauthorized: Invalid API Key');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiLoadConfig() {
  const res = await fetch(`${apiBase}/api/config`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function apiFetchDataUrl(sourceUrl) {
  const normalized = normalizeGoogleSheetsUrl(sourceUrl);
  const isGoogleSheets = normalized.includes('docs.google.com/spreadsheets');

  // Route Google Sheets through backend proxy (avoids CORS)
  const useProxy = isGoogleSheets;
  let fetchUrl = normalized;
  if (useProxy) {
    fetchUrl = `${apiBase}/api/sheets?url=${encodeURIComponent(normalized)}`;
  }

  const cleanPath = normalized.split('?')[0].toLowerCase();
  const queryText = normalized.toLowerCase();
  const isCsvUrl  = cleanPath.endsWith('.csv') || /[?&](output|format)=csv([&#]|$)/.test(queryText) || isGoogleSheets;
  const isJsonUrl = cleanPath.endsWith('.json') || /[?&](output|format)=json([&#]|$)/.test(queryText);
  const isExcelUrl = cleanPath.endsWith('.xlsx') || cleanPath.endsWith('.xls');

  if (isJsonUrl) {
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} from server`);
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed : [parsed];
  } else if (isCsvUrl) {
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — make sure the sheet is shared "Anyone with the link"`);
    const text = await res.text();
    // Raw CSV parsing to preserve Indian DD/MM date string format
    const rawAoA = parseRawCsv(text);
    return parseRowsFromHeaderAoA(rawAoA);
  } else if (isExcelUrl) {
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false });
    return parseWorksheet(wb.Sheets[wb.SheetNames[0]]);
  } else {
    throw new Error('Paste a Google Sheets URL, or a direct .xlsx/.csv/.json link.');
  }
}

export { apiFetchData, apiSaveRows, apiImportRows, apiResetDB, apiLoadConfig, apiFetchDataUrl };