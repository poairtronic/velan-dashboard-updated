
// ─── RAW CSV PARSER ────────────────────────────────────────────────────────────
// Parses CSV text → array-of-arrays WITHOUT any type coercion.
// All cell values are preserved as raw strings so date columns like
// "06/05/2026" (DD/MM/YYYY) are NOT auto-converted to US-format Date objects
// by SheetJS (which would silently flip day↔month for values where both parts ≤ 12).
function parseRawCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let inQuote = false, cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }  // escaped ""
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ─── SINGLE CANONICAL DATE PARSER — DD/MM/YYYY is the Velan/Indian standard ───
// ALL date parsing in the entire app MUST go through this one function.
// Supports: Date objects | ISO YYYY-MM-DD | DD/MM/YYYY | DD-MM-YYYY | Excel serial numbers
//
// ROOT-CAUSE FIX (May 2026):
//   SheetJS auto-detects "06/05/2026" in CSV as June 5 (US MM/DD format) and formats
//   it back as "6/5/26" (2-digit year). This caused May dates to appear in June.
//   Fix: All CSV/Google Sheets data is now parsed through parseRawCsv() which preserves
//   raw strings. "06/05/2026" therefore arrives here as-is and the DD/MM default gives
//   the correct ISO date 2026-05-06. Excel uploads still use cellDates:true → Date objects.
//
// Resolution rule for ambiguous A/B/YYYY or A/B/YY where A≤12 and B≤12:
//   → Default to DD/MM/YYYY (Indian / Velan Excel standard)
//   Date objects from XLSX (cellDates:true) are always correct and handled first.

// Sub-helper: given p0/p1/year (all integers, year is 4-digit), return ISO string.
// slashSep=true means original delimiter was '/'.
// Velan standard is DD/MM/YYYY (Indian format). Google Sheets CSV is fetched via
// parseRawCsv() which preserves the raw string, so "06/05/2026" arrives here as p0=6,
// p1=5 and the DD/MM default correctly returns 2026-05-06 (6 May).
function _resolveSlashDate(p0, p1, year, slashSep) {
  // Unambiguous: only one interpretation is valid
  if (p0 > 12 && p1 <= 12) return `${year}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;  // DD/MM
  if (p1 > 12 && p0 <= 12) return `${year}-${String(p0).padStart(2,'0')}-${String(p1).padStart(2,'0')}`;  // MM/DD
  // Both ≤ 12 — default DD/MM/YYYY (Velan/Indian standard) for ALL separators.
  return `${year}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;  // DD/MM/YYYY default
}

function toIsoDateString(value) {
  if (value === undefined || value === null || value === '') return '';
  // Native Date object (produced by XLSX with cellDates:true) — always correct
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  if (!text) return '';
  // Already ISO YYYY-MM-DD — pass through unchanged
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // YYYY-MM-DD with time suffix — e.g. "2026-05-09 13:40:43" or "2026-05-09T13:40:43"
  const isoTime = text.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (isoTime) return isoTime[1];
  // YYYY/MM/DD or YYYY/MM/DD HH:MM:SS — e.g. "2026/05/09 13:40"
  const ySlash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ySlash) return `${ySlash[1]}-${ySlash[2].padStart(2,'0')}-${ySlash[3].padStart(2,'0')}`;
  // YYYY MM DD ... (space-separated, year first) — e.g. "2026 05 09 13:40:43"
  const ySpace = text.match(/^(\d{4})\s+(\d{1,2})\s+(\d{1,2})(?:\s|$)/);
  if (ySpace) return `${ySpace[1]}-${ySpace[2].padStart(2,'0')}-${ySpace[3].padStart(2,'0')}`;
  // DD/MM/YY — 2-digit year, Velan/Indian standard: day first
  // (Even if SheetJS re-formats a date as M/D/YY the _resolveSlashDate DD/MM
  //  default below will reconstruct the correct Velan date.)
  const shortSlash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s|$|\/)/);
  if (shortSlash) {
    const p0 = parseInt(shortSlash[1], 10);
    const p1 = parseInt(shortSlash[2], 10);
    const yr  = parseInt(shortSlash[3], 10) + 2000;
    // Unambiguous: only one part can be a valid day (>12)
    if (p0 > 12 && p1 <= 12) // DD/MM
      return `${yr}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;
    if (p1 > 12 && p0 <= 12) // MM/DD
      return `${yr}-${String(p0).padStart(2,'0')}-${String(p1).padStart(2,'0')}`;
    // Both ≤ 12 — default DD/MM (Indian / Velan standard)
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12)
      return `${yr}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;
  }
  // D/M/YYYY or DD/MM/YYYY with optional time — slash separator, 4-digit year
  // ALSO catches Google Sheets M/D/YYYY — resolved by _resolveSlashDate
  const slashFull = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ]|$)/);
  if (slashFull) {
    const p0   = parseInt(slashFull[1], 10);
    const p1   = parseInt(slashFull[2], 10);
    const year = parseInt(slashFull[3], 10);
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 31 && year > 1900)
      return _resolveSlashDate(p0, p1, year, true);
  }
  // DD-MM-YYYY (dash, 4-digit year, no time)
  const dashFull = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashFull) {
    const p0   = parseInt(dashFull[1], 10);
    const p1   = parseInt(dashFull[2], 10);
    const year = parseInt(dashFull[3], 10);
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 31 && year > 1900)
      return _resolveSlashDate(p0, p1, year, false);
  }
  // DD-MM-YYYY or DD/MM/YYYY with time suffix — e.g. "09-05-2026 13:40:43"
  const dmyTime = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T ]/);
  if (dmyTime) {
    const p0   = parseInt(dmyTime[1], 10);
    const p1   = parseInt(dmyTime[2], 10);
    const year = parseInt(dmyTime[3], 10);
    return _resolveSlashDate(p0, p1, year, dmyTime[0].includes('/'));
  }
  // DD MM YYYY (space-separated) — e.g. "07 05 2026"
  const dSpace = text.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})(?:\s|$)/);
  if (dSpace) return `${dSpace[3]}-${dSpace[2].padStart(2,'0')}-${dSpace[1].padStart(2,'0')}`;
  // Excel serial number (e.g. 46148)
  const num = Number(text);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    if (window.XLSX?.SSF?.parse_date_code) {
      const dc = window.XLSX.SSF.parse_date_code(num);
      if (dc && dc.y && dc.m && dc.d) {
        return `${dc.y}-${String(dc.m).padStart(2,'0')}-${String(dc.d).padStart(2,'0')}`;
      }
    }
    // Fallback epoch math if SSF unavailable
    const epoch = new Date(Math.round((num - 25569) * 86400 * 1000));
    const y2  = epoch.getFullYear();
    const mo2 = String(epoch.getMonth() + 1).padStart(2, '0');
    const d2  = String(epoch.getDate()).padStart(2, '0');
    return `${y2}-${mo2}-${d2}`;
  }
  return '';
}
// ── Display helpers: convert stored ISO → DD/MM/YYYY ─────────────────────────
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr).trim().substring(0, 10); // "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s.substring(8,10)}/${s.substring(5,7)}/${s.substring(0,4)}`;
  }
  return s || '—';
}
function fmtTs(tsStr) {
  if (!tsStr) return '—';
  const s = String(tsStr).trim();
  const datePart = s.substring(0, 10); // "YYYY-MM-DD"
  const timePart = s.substring(11, 16); // "HH:MM"
  const d = fmtDate(datePart);
  return timePart ? `${d} ${timePart}` : d;
}
