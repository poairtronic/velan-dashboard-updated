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

// Count only Mon–Sat, skipping Sundays and company holidays
function workingDaysBetween(d1Str, d2Str) {
  if (!d1Str || !d2Str) return null;
  try {
    function parseLocalDate(str) {
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
    }
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
    return d2 < d1 ? -count : count;
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
    function parseLocalDate(str) {
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
    }
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

module.exports = {
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
  getSCLastTimestamp,
  normalizeProductsInGroup,
  dateDiff,
  TARGET_DAYS,
  AIRPLUG_TYPES,
  MASTER_TYPES,
};
