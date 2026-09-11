// ─── PROCESS & FORMULA CALCULATION HELPERS ───────────────────────────────────

const AIRPLUG_TYPES = ['APG', 'ARG'];
const MASTER_TYPES = ['SPG', 'SRG', 'SP'];
const TARGET_DAYS = 21;

// Company holidays calendar
const COMPANY_HOLIDAYS = new Set([
  '2026-01-01', // New Year's Day
  '2026-01-15', // Pongal
  '2026-01-16', // Thiruvallur Day
  '2026-01-17', // Kanum Pongal
  '2026-01-26', // Republic Day
  '2026-04-14', // Tamil New Year Day
  '2026-05-01', // May Day
  '2026-08-15', // Independence Day
  '2026-09-14', // Vinayagar Chaturthi
  '2026-10-02', // Gandhi Jayanthi
  '2026-10-19', // Ayudha Pooja
  '2026-11-09', // Diwali
]);

const workingDaysCache = new Map();

// Count only Mon–Sat, skipping Sundays and company holidays
function workingDaysBetween(d1Str, d2Str) {
  if (!d1Str || !d2Str) return null;
  const cacheKey = `${d1Str}|${d2Str}`;
  if (workingDaysCache.has(cacheKey)) return workingDaysCache.get(cacheKey);

  try {
    const parseLocalDate = (str) => {
      if (!str) return null;
      const clean = String(str).trim().substring(0, 10);
      let day, month, year;

      if (clean.includes('/')) {
        const parts = clean.split('/');
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);
        if (p2 < 100) p2 += 2000;
        year = p2;
        if (String(parts[2]).trim().length <= 2) {
          month = p0;
          day = p1; // Google Sheets M/D/YY
        } else {
          if (p0 > 12) {
            day = p0;
            month = p1;
          } else if (p1 > 12) {
            month = p0;
            day = p1;
          } else {
            day = p0;
            month = p1;
          } // DD/MM default
        }
      } else if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        } else {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          if (p0 > 12) {
            day = p0;
            month = p1;
          } else if (p1 > 12) {
            month = p0;
            day = p1;
          } else {
            day = p0;
            month = p1;
          }
        }
      } else {
        return null;
      }

      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      return new Date(year, month - 1, day);
    };
    const d1 = parseLocalDate(d1Str);
    const d2 = parseLocalDate(d2Str);
    if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return null;
    }
    let count = 0;
    const cur = new Date(d1 < d2 ? d1.getTime() : d2.getTime());
    const end = new Date(d1 > d2 ? d1.getTime() : d2.getTime());
    while (cur <= end) {
      const dow = cur.getDay();
      const ds =
        cur.getFullYear() +
        '-' +
        String(cur.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cur.getDate()).padStart(2, '0');
      if (dow !== 0 && !COMPANY_HOLIDAYS.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    const result = d2 < d1 ? -count : count;
    if (workingDaysCache.size >= 10000) {
      const firstKey = workingDaysCache.keys().next().value;
      workingDaysCache.delete(firstKey);
    }
    workingDaysCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

function daysBetween(d1Str, d2Str) {
  return workingDaysBetween(d1Str, d2Str);
}

function getProductCategory(type) {
  if (AIRPLUG_TYPES.includes(type)) return 'AIRPLUG';
  if (MASTER_TYPES.includes(type)) return 'MASTER';
  return 'ACCESSORY';
}

function parseDateTime(str) {
  if (!str) return null;
  const cleaned = String(str).trim();
  const [datePart, timePart = '00:00:00'] = cleaned.split(' ');

  let day, month, year;

  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (p0 > 12) {
      day = p0;
      month = p1;
    } else if (p1 > 12) {
      month = p0;
      day = p1;
    } else {
      day = p0;
      month = p1;
    }
  } else if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (p0 > 12) {
        day = p0;
        month = p1;
      } else if (p1 > 12) {
        month = p0;
        day = p1;
      } else {
        day = p0;
        month = p1;
      }
    }
  } else {
    return null;
  }

  const time = timePart.split(':');
  const hh = parseInt(time[0] || 0, 10);
  const mm = parseInt(time[1] || 0, 10);
  const ss = parseInt(time[2] || 0, 10);

  return new Date(year, month - 1, day, hh, mm, ss);
}

function hoursBetween(t1Str, t2Str) {
  if (!t1Str || !t2Str) return null;
  try {
    const d1 = parseDateTime(t1Str);
    const d2 = parseDateTime(t2Str);
    if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) return null;
    return Math.round(((d2 - d1) / (1000 * 60 * 60)) * 100) / 100;
  } catch {
    return null;
  }
}

function minutesBetween(t1Str, t2Str) {
  if (!t1Str || !t2Str) return null;
  try {
    const d1 = parseDateTime(t1Str);
    const d2 = parseDateTime(t2Str);
    if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / (1000 * 60));
  } catch {
    return null;
  }
}

function calculateProcessCycleTime(poDate, currentTs) {
  return workingDaysBetween(poDate, currentTs);
}

function isSLAViolation(agingDays, threshold = 2) {
  return agingDays !== null && agingDays > threshold;
}

function calculateVendorAging(lastTs, today) {
  if (!lastTs) return null;
  const todayStr =
    today instanceof Date
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : String(today).substring(0, 10);
  const days = workingDaysBetween(lastTs, todayStr);
  return days !== null && days >= 0 ? days : null;
}

function calculateProcessEfficiency(activeTime, totalTime) {
  if (!totalTime || totalTime === 0) return 0;
  return Math.round((activeTime / totalTime) * 100);
}

function getVendorCode(stage, inhouse) {
  if (inhouse === 'VENDOR') {
    if (stage && stage.endsWith('V')) return stage.slice(0, -1);
    return 'EXT';
  }
  return null;
}

function isSCComplete(items) {
  return items.every((i) => ['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA'].includes(i.currentStage));
}

/**
 * Calculates Estimated Delivery date window (6–8 weeks = 42–56 calendar days from PO date).
 * Commercial / Sales customer-facing delivery estimate.
 *
 * @param {string|Date} poDateStr - Canonical PO received date (e.g. YYYY-MM-DD or DD/MM/YYYY)
 * @param {number} [startWeeks=6] - Start of delivery window in weeks (default: 6 weeks = 42 days)
 * @param {number} [endWeeks=8] - End of delivery window in weeks (default: 8 weeks = 56 days)
 * @returns {{ startDate: string, endDate: string, formatted: string }|null}
 */
function calculateEstimatedDelivery(poDateStr, startWeeks = 6, endWeeks = 8) {
  if (!poDateStr) return null;
  const s = String(poDateStr).trim();
  if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined') return null;

  let day, month, year;
  const clean = s.substring(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const parts = clean.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    let p2 = parseInt(parts[2], 10);
    if (p2 < 100) p2 += 2000;
    year = p2;
    if (String(parts[2]).trim().length <= 2) {
      month = p0;
      day = p1;
    } else {
      if (p0 > 12) {
        day = p0;
        month = p1;
      } else if (p1 > 12) {
        month = p0;
        day = p1;
      } else {
        day = p0;
        month = p1;
      } // DD/MM default
    }
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);
      if (p2 < 100) p2 += 2000;
      year = p2;
      if (p0 > 12) {
        day = p0;
        month = p1;
      } else if (p1 > 12) {
        month = p0;
        day = p1;
      } else {
        day = p0;
        month = p1;
      }
    }
  } else {
    return null;
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Timezone-safe calendar day arithmetic using local date components
  const addDays = (numDays) => {
    const target = new Date(year, month - 1, day + numDays);
    const ty = target.getFullYear();
    const tm = String(target.getMonth() + 1).padStart(2, '0');
    const td = String(target.getDate()).padStart(2, '0');
    return `${ty}-${tm}-${td}`;
  };

  const startDate = addDays(startWeeks * 7);
  const endDate = addDays(endWeeks * 7);

  const formatDisplay = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const formatted = `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`;

  return {
    startDate,
    endDate,
    formatted,
  };
}

function formatEstimatedDelivery(estDelivery) {
  if (!estDelivery) return '—';
  if (typeof estDelivery === 'string') return estDelivery;
  if (estDelivery.formatted) return estDelivery.formatted;
  if (estDelivery.startDate && estDelivery.endDate) {
    const fmt = (iso) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };
    return `${fmt(estDelivery.startDate)} – ${fmt(estDelivery.endDate)}`;
  }
  return '—';
}

function calculateSCProductionDate(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const validIsoDates = [];
  for (const item of items) {
    if (!item) continue;
    const rawVal = item.projectedDate || item.projected_date;
    if (!rawVal) continue;
    const s = String(rawVal).trim();
    if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined') continue;

    // 1. Direct ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const parts = s.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        validIsoDates.push(s);
        continue;
      }
    }

    // 2. Parse DD/MM/YYYY or DD-MM-YYYY
    const clean = s.substring(0, 10);
    let day, month, year;
    if (clean.includes('/')) {
      const parts = clean.split('/');
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);
      if (p2 < 100) p2 += 2000;
      year = p2;
      if (String(parts[2]).trim().length <= 2) {
        month = p0;
        day = p1;
      } else {
        if (p0 > 12) {
          day = p0;
          month = p1;
        } else if (p1 > 12) {
          month = p0;
          day = p1;
        } else {
          day = p0;
          month = p1;
        }
      }
    } else if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);
        if (p2 < 100) p2 += 2000;
        year = p2;
        if (p0 > 12) {
          day = p0;
          month = p1;
        } else if (p1 > 12) {
          month = p0;
          day = p1;
        } else {
          day = p0;
          month = p1;
        }
      }
    }

    if (year && month && day && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
      if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        validIsoDates.push(iso);
      }
    }
  }

  if (validIsoDates.length === 0) return null;
  validIsoDates.sort();
  return validIsoDates[validIsoDates.length - 1];
}

function getSCLastTimestamp(items) {
  const ts = items
    .map((i) => i.timestamp)
    .filter(Boolean)
    .sort()
    .pop();
  return ts;
}

function normalizeProductsInGroup(rows) {
  if (!rows || rows.length === 0) return rows;
  const fullNames = [
    ...new Set(rows.map((r) => (r.product || '').trim()).filter((p) => p && !p.endsWith('...'))),
  ];
  return rows.map((r) => {
    const prod = (r.product || '').trim();
    if (prod.endsWith('...')) {
      const prefix = prod.slice(0, -3);
      const match = fullNames.find((f) => f.startsWith(prefix));
      if (match) {
        return { ...r, product: match };
      }
    }
    return r;
  });
}

const dateDiff = (poDate, tsStr) => {
  if (!poDate || !tsStr) return null;
  const d = workingDaysBetween(poDate, tsStr);
  return d !== null && d >= 0 ? d : null;
};

function workingDaysBetween5Day(d1Str, d2Str) {
  if (!d1Str || !d2Str) return null;
  try {
    const parseLocalDate = (str) => {
      if (!str) return null;
      const clean = String(str).trim().substring(0, 10);
      let day, month, year;

      if (clean.includes('/')) {
        const parts = clean.split('/');
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);
        if (p2 < 100) p2 += 2000;
        year = p2;
        if (String(parts[2]).trim().length <= 2) {
          month = p0;
          day = p1; // Google Sheets M/D/YY
        } else {
          if (p0 > 12) {
            day = p0;
            month = p1;
          } else if (p1 > 12) {
            month = p0;
            day = p1;
          } else {
            day = p0;
            month = p1;
          } // DD/MM default
        }
      } else if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        } else {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          if (p0 > 12) {
            day = p0;
            month = p1;
          } else if (p1 > 12) {
            month = p0;
            day = p1;
          } else {
            day = p0;
            month = p1;
          }
        }
      } else {
        return null;
      }

      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      return new Date(year, month - 1, day);
    };
    const d1 = parseLocalDate(d1Str);
    const d2 = parseLocalDate(d2Str);
    if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return null;
    }
    let count = 0;
    const cur = new Date(d1 < d2 ? d1.getTime() : d2.getTime());
    const end = new Date(d1 > d2 ? d1.getTime() : d2.getTime());
    while (cur <= end) {
      const dow = cur.getDay();
      const ds =
        cur.getFullYear() +
        '-' +
        String(cur.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cur.getDate()).padStart(2, '0');
      if (dow !== 0 && dow !== 6 && !COMPANY_HOLIDAYS.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return d2 < d1 ? -count : count;
  } catch {
    return null;
  }
}

function addWorkingDays5Day(fromDateStr, daysToAdd) {
  if (!fromDateStr) return '';
  const parts = fromDateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  let added = 0;
  while (added < daysToAdd) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    const ds =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0');
    if (dow !== 0 && dow !== 6 && !COMPANY_HOLIDAYS.has(ds)) added++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toIsoDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    if (y >= 1900 && y <= 9999) return `${y}-${m}-${d}`;
    return '';
  }
  const s = String(val).trim();
  if (
    !s ||
    s === '—' ||
    s === '-' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'NaN' ||
    s === 'nan' ||
    s === 'N/A' ||
    s === 'n/a' ||
    s === 'TBD' ||
    s === 'tbd' ||
    s === 'ASAP' ||
    s === 'asap' ||
    s === 'nil' ||
    s === 'NIL' ||
    s === 'INVALID' ||
    s === 'invalid'
  ) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return s;
    return '';
  }
  const slashMatch = s.match(/^(\d{1,2})[/ -](\d{1,2})[/ -](\d{4})(?:[T ]|$)/);
  if (slashMatch) {
    const p0 = parseInt(slashMatch[1], 10);
    const p1 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    if (year >= 1900 && year <= 9999) {
      if (p0 > 12 && p1 <= 12 && p0 <= 31 && p1 >= 1) {
        return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
      }
      if (p1 > 12 && p0 <= 12 && p1 <= 31 && p0 >= 1) {
        return `${year}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12) {
        return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
      }
    }
  }
  return '';
}

function getTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getProductionDateStatus(dateInput, currentDateInput) {
  const dateIso = toIsoDate(dateInput);
  if (!dateIso) {
    return {
      code: 'NO_DATE',
      label: 'NO DATE',
      color: '#7ba7cc',
    };
  }

  const currentIso = currentDateInput ? toIsoDate(currentDateInput) : getTodayIso();
  if (!currentIso) {
    return {
      code: 'NO_DATE',
      label: 'NO DATE',
      color: '#7ba7cc',
    };
  }

  if (dateIso < currentIso) {
    return {
      code: 'OVERDUE',
      label: 'OVERDUE',
      color: '#ff3d5a',
    };
  }
  if (dateIso === currentIso) {
    return {
      code: 'DUE_TODAY',
      label: 'DUE TODAY',
      color: '#ffd60a',
    };
  }
  return {
    code: 'UPCOMING',
    label: 'UPCOMING',
    color: '#00c9ff',
  };
}

function addCalendarDays(isoDateStr, days) {
  const iso = toIsoDate(isoDateStr);
  if (!iso) return '';
  const parts = iso.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function isDateInNextDays(dateInput, days, currentDateInput) {
  const dateIso = toIsoDate(dateInput);
  if (!dateIso) return false;
  const currentIso = currentDateInput ? toIsoDate(currentDateInput) : getTodayIso();
  if (!currentIso) return false;
  const maxDateIso = addCalendarDays(currentIso, days);
  return dateIso >= currentIso && dateIso <= maxDateIso;
}

const calculationUtils = {
  workingDaysBetween,
  workingDaysBetween5Day,
  addWorkingDays5Day,
  daysBetween,
  getProductCategory,
  parseDateTime,
  hoursBetween,
  minutesBetween,
  calculateProcessCycleTime,
  isSLAViolation,
  calculateVendorAging,
  calculateProcessEfficiency,
  getVendorCode,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  getSCLastTimestamp,
  normalizeProductsInGroup,
  dateDiff,
  toIsoDate,
  getTodayIso,
  getProductionDateStatus,
  addCalendarDays,
  isDateInNextDays,
  TARGET_DAYS,
  AIRPLUG_TYPES,
  MASTER_TYPES,
};

export default calculationUtils;
export {
  workingDaysBetween,
  workingDaysBetween5Day,
  addWorkingDays5Day,
  daysBetween,
  getProductCategory,
  parseDateTime,
  hoursBetween,
  minutesBetween,
  calculateProcessCycleTime,
  isSLAViolation,
  calculateVendorAging,
  calculateProcessEfficiency,
  getVendorCode,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  getSCLastTimestamp,
  normalizeProductsInGroup,
  dateDiff,
  toIsoDate,
  getTodayIso,
  getProductionDateStatus,
  addCalendarDays,
  isDateInNextDays,
  TARGET_DAYS,
  AIRPLUG_TYPES,
  MASTER_TYPES,
};
