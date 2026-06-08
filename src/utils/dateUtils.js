import * as XLSX from 'xlsx';
// ─── DATE UTILITIES ──────────────────────────────────────────────────────────

// Resolution rule for ambiguous A/B/YYYY or A/B/YY where A<=12 and B<=12:
//   → Default to DD/MM/YYYY (Indian / Velan Excel standard)
//   Date objects from XLSX (cellDates:true) are always correct and handled first.
function _resolveSlashDate(p0, p1, year, slashSep) {
  // Unambiguous: only one interpretation is valid
  if (p0 > 12 && p1 <= 12) return `${year}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;  // DD/MM
  if (p1 > 12 && p0 <= 12) return `${year}-${String(p0).padStart(2,'0')}-${String(p1).padStart(2,'0')}`;  // MM/DD
  // Both <= 12 — default DD/MM/YYYY (Velan/Indian standard) for ALL separators.
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
    // Both <= 12 — default DD/MM (Indian / Velan standard)
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12)
      return `${yr}-${String(p1).padStart(2,'0')}-${String(p0).padStart(2,'0')}`;
  }
  // D/M/YYYY or DD/MM/YYYY with optional time — slash separator, 4-digit year
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
    if (XLSX?.SSF?.parse_date_code) {
      const dc = XLSX.SSF.parse_date_code(num);
      if (dc && dc.y && dc.m && dc.d) {
        return `${dc.y}-${String(dc.m).padStart(2,'0')}-${String(dc.d).padStart(2,'0')}`;
      }
    }
    const epoch = new Date(Math.round((num - 25569) * 86400 * 1000));
    const y2  = epoch.getFullYear();
    const mo2 = String(epoch.getMonth() + 1).padStart(2, '0');
    const d2  = String(epoch.getDate()).padStart(2, '0');
    return `${y2}-${mo2}-${d2}`;
  }
  return '';
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr).trim().substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s.substring(8,10)}/${s.substring(5,7)}/${s.substring(0,4)}`;
  }
  return s || '—';
}

function fmtTs(tsStr) {
  if (!tsStr) return '—';
  const s = String(tsStr).trim();
  const datePart = s.substring(0, 10);
  const timePart = s.substring(11, 16);
  const d = fmtDate(datePart);
  return timePart ? `${d} ${timePart}` : d;
}

export { toIsoDateString, fmtDate, fmtTs };