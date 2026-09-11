// ─── DATE UTILITIES ──────────────────────────────────────────────────────────

// Resolution rule for ambiguous A/B/YYYY or A/B/YY where A<=12 and B<=12:
//   → Default to DD/MM/YYYY (Indian / Velan Excel standard)
//   Date objects from XLSX (cellDates:true) are always correct and handled first.
function _resolveSlashDate(p0, p1, year) {
  if (year < 1900) return '';
  // Unambiguous: only one interpretation is valid
  if (p0 > 12 && p1 <= 12 && p0 <= 31 && p1 >= 1)
    return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`; // DD/MM
  if (p1 > 12 && p0 <= 12 && p1 <= 31 && p0 >= 1)
    return `${year}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`; // MM/DD
  // Both <= 12 — default DD/MM/YYYY (Velan/Indian standard) for ALL separators.
  if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12) {
    return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`; // DD/MM/YYYY default
  }
  return '';
}

function toIsoDateString(value) {
  if (value === undefined || value === null || value === '') return '';
  // Native Date object (produced by XLSX with cellDates:true) — always correct
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    if (y >= 1900 && y <= 9999) {
      return `${y}-${m}-${d}`;
    }
    return '';
  }
  const text = String(value).trim();
  if (
    !text ||
    text === '—' ||
    text === '-' ||
    text === 'null' ||
    text === 'undefined' ||
    text === 'nan' ||
    text === 'NaN' ||
    text === 'N/A' ||
    text === 'n/a' ||
    text === 'TBD' ||
    text === 'tbd' ||
    text === 'ASAP' ||
    text === 'asap' ||
    text === 'nil' ||
    text === 'NIL' ||
    text === 'INVALID' ||
    text === 'invalid'
  ) {
    return '';
  }

  // Already ISO YYYY-MM-DD — check valid month and day bounds
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return text;
    }
    return '';
  }

  // YYYY-MM-DD with time suffix — e.g. "2026-05-09 13:40:43" or "2026-05-09T13:40:43"
  const isoTime = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ]/);
  if (isoTime) {
    const y = parseInt(isoTime[1], 10);
    const m = parseInt(isoTime[2], 10);
    const d = parseInt(isoTime[3], 10);
    if (y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${isoTime[1]}-${isoTime[2]}-${isoTime[3]}`;
    }
    return '';
  }

  // YYYY/MM/DD or YYYY/MM/DD HH:MM:SS — e.g. "2026/05/09 13:40"
  const ySlash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ySlash) {
    const y = parseInt(ySlash[1], 10);
    const m = parseInt(ySlash[2], 10);
    const d = parseInt(ySlash[3], 10);
    if (y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  }

  // YYYY MM DD ... (space-separated, year first) — e.g. "2026 05 09 13:40:43"
  const ySpace = text.match(/^(\d{4})\s+(\d{1,2})\s+(\d{1,2})(?:\s|$)/);
  if (ySpace) {
    const y = parseInt(ySpace[1], 10);
    const m = parseInt(ySpace[2], 10);
    const d = parseInt(ySpace[3], 10);
    if (y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  }

  // DD/MM/YY — 2-digit year, Velan/Indian standard: day first
  const shortSlash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s|$|\/)/);
  if (shortSlash) {
    const p0 = parseInt(shortSlash[1], 10);
    const p1 = parseInt(shortSlash[2], 10);
    const yr = parseInt(shortSlash[3], 10) + 2000;
    if (p0 > 12 && p1 <= 12 && p0 <= 31 && p1 >= 1)
      return `${yr}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
    if (p1 > 12 && p0 <= 12 && p1 <= 31 && p0 >= 1)
      return `${yr}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12)
      return `${yr}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
  }

  // D/M/YYYY or DD/MM/YYYY with optional time — slash separator, 4-digit year
  const slashFull = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ]|$)/);
  if (slashFull) {
    const p0 = parseInt(slashFull[1], 10);
    const p1 = parseInt(slashFull[2], 10);
    const year = parseInt(slashFull[3], 10);
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 31 && year >= 1900)
      return _resolveSlashDate(p0, p1, year);
  }

  // DD-MM-YYYY (dash, 4-digit year, no time)
  const dashFull = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashFull) {
    const p0 = parseInt(dashFull[1], 10);
    const p1 = parseInt(dashFull[2], 10);
    const year = parseInt(dashFull[3], 10);
    if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 31 && year >= 1900)
      return _resolveSlashDate(p0, p1, year);
  }

  // DD-MM-YYYY or DD/MM/YYYY with time suffix — e.g. "09-05-2026 13:40:43"
  const dmyTime = text.match(/^(\d{1,2})[/ -](\d{1,2})[/ -](\d{4})[T ]/);
  if (dmyTime) {
    const p0 = parseInt(dmyTime[1], 10);
    const p1 = parseInt(dmyTime[2], 10);
    const year = parseInt(dmyTime[3], 10);
    return _resolveSlashDate(p0, p1, year);
  }

  // DD MM YYYY (space-separated) — e.g. "07 05 2026"
  const dSpace = text.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})(?:\s|$)/);
  if (dSpace) {
    const p0 = parseInt(dSpace[1], 10);
    const p1 = parseInt(dSpace[2], 10);
    const year = parseInt(dSpace[3], 10);
    return _resolveSlashDate(p0, p1, year);
  }

  // Excel serial number (e.g. 46148)
  const num = Number(text);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    const epoch = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(epoch.getTime())) {
      const y2 = epoch.getFullYear();
      const mo2 = String(epoch.getMonth() + 1).padStart(2, '0');
      const d2 = String(epoch.getDate()).padStart(2, '0');
      if (y2 >= 1900 && y2 <= 9999) {
        return `${y2}-${mo2}-${d2}`;
      }
    }
  }
  return '';
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr).trim().substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}`;
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
