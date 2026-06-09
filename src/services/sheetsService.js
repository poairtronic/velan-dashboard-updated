import { normalizeGoogleSheetsUrl } from './googleSheets';
import { parseRawCsv, parseRowsFromHeaderAoA, parseWorksheet } from './excelParser';
import { apiBase, apiClient } from './apiClient';

export async function fetchDataUrl(sourceUrl) {
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
    const res = await apiClient(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} from server`);
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed : [parsed];
  } else if (isCsvUrl) {
    const res = await apiClient(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — make sure the sheet is shared "Anyone with the link"`);
    const text = await res.text();
    // Raw CSV parsing to preserve Indian DD/MM date string format
    const rawAoA = parseRawCsv(text);
    return parseRowsFromHeaderAoA(rawAoA);
  } else if (isExcelUrl) {
    const res = await apiClient(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false });
    return await parseWorksheet(wb.Sheets[wb.SheetNames[0]]);
  } else {
    throw new Error('Paste a Google Sheets URL, or a direct .xlsx/.csv/.json link.');
  }
}
