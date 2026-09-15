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

const VENDOR_MAP = {
  'V1': { code: 'V1', name: 'Abi', fullName: 'Abi (V1)' },
  'V2': { code: 'V2', name: 'RK Engg', fullName: 'RK Engg (V2)' },
  'V3': { code: 'V3', name: 'Shiva Shakthi', fullName: 'Shiva Shakthi (V3)' },
  'V4': { code: 'V4', name: 'Fine Turn', fullName: 'Fine Turn (V4)' },
  'V6': { code: 'V6', name: 'NVCNC', fullName: 'NVCNC (V6)' },
  'V7': { code: 'V7', name: 'Micro Mac', fullName: 'Micro Mac (V7)' },
  'V8': { code: 'V8', name: 'Skyline', fullName: 'Skyline (V8)' },
  'V10': { code: 'V10', name: 'Std Engg', fullName: 'Std Engg (V10)' },
  'V11': { code: 'V11', name: 'Flame Tech / HTV', fullName: 'Flame Tech (V11)' },
  'V12': { code: 'V12', name: 'Mech Tools', fullName: 'Mech Tools (V12)' },
  'V13': { code: 'V13', name: 'VS Engg', fullName: 'VS Engg (V13)' },
  'V14': { code: 'V14', name: 'RKV Metal', fullName: 'RKV Metal (V14)' },
  'V15': { code: 'V15', name: 'Metal Form', fullName: 'Metal Form (V15)' },
  'V16': { code: 'V16', name: 'Export', fullName: 'Export (V16)' },
  'V17': { code: 'V17', name: 'Sivam', fullName: 'Sivam (V17)' },
  'V18': { code: 'V18', name: 'JMC / Pre Tooling', fullName: 'JMC (V18)' },
  'V19': { code: 'V19', name: 'PS Coating', fullName: 'PS Coating (V19)' },
  'V24': { code: 'V24', name: 'Nisha Tools', fullName: 'Nisha Tools (V24)' },
  'V26': { code: 'V26', name: 'GA Tools', fullName: 'GA Tools (V26)' },
  'V27': { code: 'V27', name: 'JV Tools', fullName: 'JV Tools (V27)' },
  'V35': { code: 'V35', name: 'GSM', fullName: 'GSM (V35)' },
  'V38': { code: 'V38', name: 'SMV Engg', fullName: 'SMV Engg (V38)' },
};

function getVendorInfo(rowOrStage) {
  if (!rowOrStage) return null;
  const stage = typeof rowOrStage === 'string'
    ? rowOrStage.trim().toUpperCase()
    : String(rowOrStage.currentStage || rowOrStage.op || rowOrStage.vendor || '').trim().toUpperCase();
  
  if (!stage) return null;

  // Special alias handling (FBV-VQ / FBV_ABI -> V1 - Abi)
  if (stage.includes('-VQ') || stage.includes('_ABI') || stage === 'FBV_ABI' || stage === 'ABI') {
    return { ...VENDOR_MAP['V1'], operation: 'FBV', isVendor: true };
  }

  // Regex match for V-codes like -V13, -V2, -V01, V38, etc.
  const vMatch = stage.match(/[-_]?V0*(\d+)/i);
  if (vMatch) {
    const vCode = 'V' + parseInt(vMatch[1], 10);
    if (VENDOR_MAP[vCode]) {
      const op = stage.replace(/[-_]?V0*\d+.*$/i, '').trim() || stage;
      return { ...VENDOR_MAP[vCode], operation: op, isVendor: true };
    }
  }

  // Match by vendor name if stage contains it
  for (const info of Object.values(VENDOR_MAP)) {
    if (stage.includes(info.name.toUpperCase())) {
      return { ...info, operation: stage, isVendor: true };
    }
  }

  // If inhouse === 'VENDOR' and no specific vendor code was resolved
  if (typeof rowOrStage === 'object' && rowOrStage.inhouse === 'VENDOR') {
    return { code: 'EXT', name: stage || 'External Vendor', fullName: stage || 'External Vendor', operation: stage, isVendor: true };
  }

  return null;
}

function getVendorCode(rowOrStage, inhouse) {
  const info = getVendorInfo(typeof rowOrStage === 'object' ? rowOrStage : { currentStage: rowOrStage, inhouse });
  return info ? info.code : null;
}

function getVendorName(rowOrStage, inhouse) {
  const info = getVendorInfo(typeof rowOrStage === 'object' ? rowOrStage : { currentStage: rowOrStage, inhouse });
  return info ? info.name : null;
}

function isSCComplete(items) {
  return items.every((i) => ['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA'].includes(i.currentStage));
}

const PROCESS_TEMPLATES_SUMMARY = {
  'ACG': {
    family: 'ACG',
    totalProcesses: 10,
    totalDays: 26,
    weeks: 8,
    daysPerProcess: 2.6,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 2 },
      { name: 'PRE TOOLING', days: 6 },
      { name: 'HT', days: 2 },
      { name: 'BRAZZING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 1 },
      { name: 'SD', days: 3 },
      { name: 'JR/AE', days: 2 },
      { name: 'ASSEMBLE', days: 1 },
    ],
  },
  'APG 10 TO 15 OUTSOURCE': {
    family: 'APG',
    totalProcesses: 12,
    totalDays: 27,
    weeks: 6,
    daysPerProcess: 2.25,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG 15 TO 20 SD': {
    family: 'APG',
    totalProcesses: 12,
    totalDays: 27,
    weeks: 6,
    daysPerProcess: 2.25,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG 20 TO 35 SD': {
    family: 'APG',
    totalProcesses: 12,
    totalDays: 28,
    weeks: 6,
    daysPerProcess: 2.33,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'BLK', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG 35 TO 60 SD': {
    family: 'APG',
    totalProcesses: 12,
    totalDays: 28,
    weeks: 6,
    daysPerProcess: 2.33,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'BLK', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG 6 TO 10 OUTSOURCE': {
    family: 'APG',
    totalProcesses: 12,
    totalDays: 27,
    weeks: 6,
    daysPerProcess: 2.25,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG ABOVE 60 SD': {
    family: 'APG',
    totalProcesses: 13,
    totalDays: 31,
    weeks: 6,
    daysPerProcess: 2.38,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'WRV', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'BLK', days: 2 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG DIA 6 TO 10 INHOUSE': {
    family: 'APG',
    totalProcesses: 13,
    totalDays: 29,
    weeks: 6,
    daysPerProcess: 2.23,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 1 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 2 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG LESS THAN 6': {
    family: 'APG',
    totalProcesses: 6,
    totalDays: 18,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'SUPER DRILL', days: 3 },
      { name: 'CG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
    ],
  },
  'APG_10 TO 15_OUTSOURCE_SD_CARBIDE': {
    family: 'APG_CARBIDE',
    totalProcesses: 14,
    totalDays: 42,
    weeks: 8,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 5 },
      { name: 'RM', days: 5 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'JC-CARBIDE', days: 3 },
      { name: 'WC-CARBIDE', days: 3 },
      { name: 'CG-SUITING', days: 3 },
      { name: 'BRAZZING', days: 3 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'QC', days: 1 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_10_15 INHOUSE': {
    family: 'APG',
    totalProcesses: 13,
    totalDays: 29,
    weeks: 6,
    daysPerProcess: 2.23,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 1 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 2 },
      { name: 'CG', days: 2 },
      { name: 'SG JET RECESS', days: 2 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_15_20 JP': {
    family: 'APG',
    totalProcesses: 14,
    totalDays: 34,
    weeks: 6,
    daysPerProcess: 2.43,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 2 },
      { name: 'JP', days: 1 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_20-35 JP': {
    family: 'APG',
    totalProcesses: 14,
    totalDays: 31,
    weeks: 6,
    daysPerProcess: 2.21,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 1 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_35-60 JP': {
    family: 'APG',
    totalProcesses: 14,
    totalDays: 35,
    weeks: 6,
    daysPerProcess: 2.5,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 3 },
      { name: 'JP', days: 1 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_ABOVE 60 JP': {
    family: 'APG',
    totalProcesses: 15,
    totalDays: 38,
    weeks: 6,
    daysPerProcess: 2.53,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'WR', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 3 },
      { name: 'JP', days: 1 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_VBM_JP': {
    family: 'APG',
    totalProcesses: 15,
    totalDays: 38,
    weeks: 6,
    daysPerProcess: 2.53,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'BLK', days: 3 },
      { name: 'JP', days: 1 },
      { name: 'SPRK', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_VBM_SD': {
    family: 'APG',
    totalProcesses: 14,
    totalDays: 37,
    weeks: 6,
    daysPerProcess: 2.64,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JC', days: 2 },
      { name: 'BLK', days: 3 },
      { name: 'SD', days: 3 },
      { name: 'SPRK', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'SG JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'APG_VBM_SD_CARBIDE': {
    family: 'APG_CARBIDE',
    totalProcesses: 15,
    totalDays: 43,
    weeks: 8,
    daysPerProcess: 2.87,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'JC-CARBIDE', days: 3 },
      { name: 'WC-CARBIDE', days: 3 },
      { name: 'CG-SUITING', days: 3 },
      { name: 'BRAZZING', days: 3 },
      { name: 'SD', days: 3 },
      { name: 'SPRK', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_20_To_130_VBM_HBM': {
    family: 'ARG',
    totalProcesses: 17,
    totalDays: 45,
    weeks: 8,
    daysPerProcess: 2.65,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 4 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_6_To_20_VBM_HBM': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 47,
    weeks: 8,
    daysPerProcess: 2.61,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_ALUMINIM_HOSUING_TYPE': {
    family: 'ACCESSORIES',
    totalProcesses: 5,
    totalDays: 15,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1TR', days: 3 },
      { name: 'SUITING', days: 3 },
    ],
  },
  'ARG_CARBIDE': {
    family: 'ARG',
    totalProcesses: 16,
    totalDays: 47,
    weeks: 8,
    daysPerProcess: 2.94,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1TR', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'JC-CARBIDE', days: 3 },
      { name: 'WC-CARBIDE', days: 3 },
      { name: 'CG-SUITING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'SHRINK FIT', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'A/E SLOT', days: 3 },
      { name: 'JET RECESS', days: 3 },
    ],
  },
  'ARG_CARBIDE_002': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 50,
    weeks: 8,
    daysPerProcess: 2.78,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1TR', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'JC-CARBIDE', days: 3 },
      { name: 'WC-CARBIDE', days: 3 },
      { name: 'CG-SUITING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'SHRINK FIT', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'A/E SLOT', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_15 TO 20_JP': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 47,
    weeks: 8,
    daysPerProcess: 2.61,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_15 TO 20_SD': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 48,
    weeks: 8,
    daysPerProcess: 2.67,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_15 TO 25_HBM_SD': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 48,
    weeks: 8,
    daysPerProcess: 2.67,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_15_TO_20_SD_VBM': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 48,
    weeks: 8,
    daysPerProcess: 2.67,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_20 TO 130_HBM_JP': {
    family: 'ARG',
    totalProcesses: 17,
    totalDays: 44,
    weeks: 8,
    daysPerProcess: 2.59,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_20 TO 130_HBM_SD': {
    family: 'ARG',
    totalProcesses: 17,
    totalDays: 45,
    weeks: 8,
    daysPerProcess: 2.65,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 4 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_20 TO 130_JP': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 47,
    weeks: 8,
    daysPerProcess: 2.61,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_20 TO 130_SD': {
    family: 'ARG',
    totalProcesses: 17,
    totalDays: 45,
    weeks: 8,
    daysPerProcess: 2.65,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 4 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_20_TO_130_SD_VBM': {
    family: 'ARG',
    totalProcesses: 17,
    totalDays: 45,
    weeks: 8,
    daysPerProcess: 2.65,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 4 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_6 TO 20_HBM_JP': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 47,
    weeks: 8,
    daysPerProcess: 2.61,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_DIA_6 TO 20_HBM_SD': {
    family: 'ARG',
    totalProcesses: 18,
    totalDays: 48,
    weeks: 8,
    daysPerProcess: 2.67,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_HOUSING_TYPE_ADAPTER HANDLE_JP': {
    family: 'ARG',
    totalProcesses: 19,
    totalDays: 50,
    weeks: 8,
    daysPerProcess: 2.63,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'JP', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'ADAPTER', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'ARG_HOUSING_TYPE_ADAPTER HANDLE_SD': {
    family: 'ARG',
    totalProcesses: 20,
    totalDays: 55,
    weeks: 8,
    daysPerProcess: 2.75,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'BORING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SD', days: 3 },
      { name: 'CG', days: 3 },
      { name: 'HO', days: 3 },
      { name: 'JET RECESS', days: 3 },
      { name: 'VA', days: 3 },
      { name: 'JC', days: 2 },
      { name: 'SG', days: 3 },
      { name: 'QC', days: 3 },
      { name: 'ADAPTER', days: 4 },
      { name: 'HANDLE', days: 3 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'BASE_PLATE': {
    family: 'ACCESSORIES',
    totalProcesses: 5,
    totalDays: 15,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
    ],
  },
  'BUTTING STOPPER': {
    family: 'ACCESSORIES',
    totalProcesses: 8,
    totalDays: 23,
    weeks: 6,
    daysPerProcess: 2.88,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'MARKING', days: 3 },
    ],
  },
  'CARBIDE_BUSH': {
    family: 'ACCESSORIES',
    totalProcesses: 2,
    totalDays: 6,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'TURNING', days: 3 },
    ],
  },
  'DEPTH COLLAR': {
    family: 'ACCESSORIES',
    totalProcesses: 5,
    totalDays: 15,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
    ],
  },
  'EXTENION': {
    family: 'ACCESSORIES',
    totalProcesses: 4,
    totalDays: 12,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'SG', days: 3 },
    ],
  },
  'FEET PLATE': {
    family: 'ACCESSORIES',
    totalProcesses: 6,
    totalDays: 18,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 3 },
    ],
  },
  'HORIZONTAL BENCH MOUNT PLATE': {
    family: 'ACCESSORIES',
    totalProcesses: 6,
    totalDays: 18,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 3 },
    ],
  },
  'JIG - FEET': {
    family: 'ACCESSORIES',
    totalProcesses: 5,
    totalDays: 15,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
    ],
  },
  'SD': {
    family: 'SETTING DISK',
    totalProcesses: 8,
    totalDays: 21,
    weeks: 8,
    daysPerProcess: 2.63,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 4 },
      { name: 'MARKING', days: 2 },
    ],
  },
  'SPG_DIA_ABOVE _40': {
    family: 'SPG',
    totalProcesses: 10,
    totalDays: 26,
    weeks: 8,
    daysPerProcess: 2.6,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 3 },
      { name: 'VA', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SPG_DIA_BELOW 40': {
    family: 'SPG',
    totalProcesses: 11,
    totalDays: 29,
    weeks: 8,
    daysPerProcess: 2.64,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'CH', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 3 },
      { name: 'VA', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG 20 AND ABOVE DIRECT FINISH': {
    family: 'SRG',
    totalProcesses: 12,
    totalDays: 33,
    weeks: 6,
    daysPerProcess: 2.75,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 3 },
      { name: 'QC', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG 20 AND ABOVE DIRECT FINISH DC': {
    family: 'SRG',
    totalProcesses: 11,
    totalDays: 30,
    weeks: 6,
    daysPerProcess: 2.73,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG DIA 3 TO 6': {
    family: 'SRG',
    totalProcesses: 12,
    totalDays: 33,
    weeks: 6,
    daysPerProcess: 2.75,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 3 },
      { name: 'QC', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG DIA 3 TO 6 DC': {
    family: 'SRG',
    totalProcesses: 11,
    totalDays: 30,
    weeks: 6,
    daysPerProcess: 2.73,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG DIA 6 TO 20': {
    family: 'SRG',
    totalProcesses: 12,
    totalDays: 33,
    weeks: 6,
    daysPerProcess: 2.75,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 3 },
      { name: 'QC', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'SRG DIA 6 TO 20 DC': {
    family: 'SRG',
    totalProcesses: 11,
    totalDays: 30,
    weeks: 6,
    daysPerProcess: 2.73,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'M1', days: 3 },
      { name: 'HT', days: 2 },
      { name: 'SZ', days: 1 },
      { name: 'SG', days: 3 },
      { name: 'CG', days: 5 },
      { name: 'HO', days: 4 },
      { name: 'VA', days: 2 },
      { name: 'MARKING', days: 1 },
    ],
  },
  'VERTICAL BENCH MOUNT PLATE': {
    family: 'ACCESSORIES',
    totalProcesses: 6,
    totalDays: 18,
    weeks: 6,
    daysPerProcess: 3.0,
    stages: [
      { name: 'DESIGN', days: 3 },
      { name: 'RM', days: 3 },
      { name: 'TURNING', days: 3 },
      { name: 'MILLING', days: 3 },
      { name: 'SG', days: 3 },
      { name: 'MARKING', days: 3 },
    ],
  },
};

const PROCESS_TEMPLATES = PROCESS_TEMPLATES_SUMMARY;

function canonicalProcess(value) {
  if (value === null || value === undefined) return 'DESIGN';
  let code = String(value).trim().toUpperCase().replace(/\s+/g, ' ').replace(/_/g, ' ');
  code = code.replace(/^OP\s*\d+\s*/, '').replace(/^OP\s+/, '');

  if (['STORES', 'EXSTOCK', 'READY', 'STOCK', 'DONE'].includes(code)) return 'DONE';
  if (code === '') return 'DESIGN';
  if (code === 'M1TR' || code.startsWith('M1TR ')) return 'M1TR';
  if (['FB', 'FBI', 'FBV', 'LATHE', 'TUR', 'TURNING'].includes(code) || code.startsWith('TURNING ')) return 'TURNING';
  if (['M1', 'M1I', 'M1V'].includes(code) || code.startsWith('M1 ')) return 'M1';
  if (['CG', 'CGV', 'CGI'].includes(code) || code.startsWith('CG ')) return 'CG';
  if (code === 'SG JET RECESS' || code.startsWith('SG JET RECESS ')) return 'SG JET RECESS';
  if (['SG', 'SGI', 'SGV'].includes(code) || code.startsWith('SG ')) return 'SG';
  if (['SD', 'SDI', 'SDV'].includes(code) || code.startsWith('SD ')) return 'SD';
  if (['SZ', 'SZI', 'SZV'].includes(code) || code.startsWith('SZ ')) return 'SZ';
  if (['HT', 'HTI', 'HTV'].includes(code) || code.startsWith('HT ')) return 'HT';
  if (['PT', 'PTI', 'PTV', 'PRE TOOLING'].includes(code)) return 'PRE TOOLING';
  if (['WC', 'WCI', 'WCV'].includes(code) || code.startsWith('WC ')) return 'WC';
  if (['JC', 'JCI', 'JCV'].includes(code) || code.startsWith('JC ')) return 'JC';
  if (['JS', 'JP', 'JPI', 'JPV', 'JET PRESS'].includes(code) || code.startsWith('JET PRESS ')) return 'JET PRESS';
  if (['BR', 'BRI', 'BRV', 'BRASSING', 'BRAZZING'].includes(code) || code.startsWith('BRASSING ') || code.startsWith('BRAZZING ')) return 'BRASSING';
  if (['HO', 'HOI', 'HOV'].includes(code) || code.startsWith('HO ')) return 'HO';
  if (['CH', 'CHI', 'CHV'].includes(code) || code.startsWith('CH ')) return 'CH';
  if (['BLK', 'BLI', 'BLV'].includes(code) || code.startsWith('BLK ')) return 'BLK';
  if (['DESIGN', 'DSG'].includes(code) || code.startsWith('DESIGN ')) return 'DESIGN';
  if (code === 'RM' || code.startsWith('RM ')) return 'RM';
  if (['DCPL', 'DCPLI', 'DCPLV', 'DULL CHROME', 'DULLCHROME'].includes(code) || code.startsWith('DULL CHROME ')) return 'DULL CHROME';
  if (code === 'JET RECESS' || code.startsWith('JET RECESS ')) return 'JET RECESS';

  const simpleProcesses = [
    'VA', 'CA', 'QC', 'MARKING', 'BAZZING', 'MILLING', 'BORING',
    'SUPER DRILL', 'STRING FIT', 'TAPER SHANK GRINDING', 'TOP BOTTOM SG'
  ];
  for (const p of simpleProcesses) {
    if (code === p || code.startsWith(p + ' ')) return p;
  }

  // Sub-stage or sequence suffix stripping (e.g. M1-1 -> M1, HT-1 -> HT)
  const dashMatch = code.match(/^([A-Z0-9]+)[-_]\d+$/);
  if (dashMatch) {
    const base = canonicalProcess(dashMatch[1]);
    if (base) return base;
  }

  // Generic Vendor I / V suffix stripping (e.g. CGV-V8 -> CG, FBV-V2 -> TURNING, BRV-V13 -> BRASSING)
  const vendorMatch = code.match(/^([A-Z0-9]+)[VI](?:-[A-Z0-9]+)?$/);
  if (vendorMatch) {
    const base = canonicalProcess(vendorMatch[1]);
    if (base) return base;
  }

  return code;
}

const STANDARD_PROCESS_ORDER = [
  'DESIGN', 'RM', 'TURNING', 'M1', 'HT', 'CG', 'SG', 'BRASSING', 'SD', 'SZ',
  'JET PRESS', 'WC', 'JC', 'PRE TOOLING', 'HO', 'CH', 'BLK', 'DULL CHROME', 'QC', 'CA', 'MARKING', 'DONE'
];

/**
 * Calculates Estimated Delivery date based on PO Received Date and Product/Family rules from Google Apps Script.
 * 
 * Rules:
 * - APG, SRG, ACCESSORIES (and variants ACCESSORY, ACC) -> 6 WEEKS = 42 CALENDAR DAYS
 * - ARG, SPG, ACG, ARG CARBIDE, APG CARBIDE, SETTING DISK, SD -> 8 WEEKS = 56 CALENDAR DAYS
 * 
 * @param {string|Date} poDateStr - Canonical PO received date (e.g. YYYY-MM-DD or DD/MM/YYYY)
 * @param {string|number} [familyOrWeeks] - Family string (e.g. 'ARG', 'APG') or startWeeks number
 * @param {number} [endWeeks] - Optional endWeeks if called with numbers
 * @returns {{ date: string, startDate: string, endDate: string, formatted: string, days: number, weeks: number }|null}
 */
function calculateEstimatedDelivery(poDateStr, familyOrWeeks, endWeeks) {
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
  } else {
    return null;
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const addDays = (numDays) => {
    const target = new Date(year, month - 1, day + numDays);
    const ty = target.getFullYear();
    const tm = String(target.getMonth() + 1).padStart(2, '0');
    const td = String(target.getDate()).padStart(2, '0');
    return `${ty}-${tm}-${td}`;
  };

  const formatDisplay = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  if (typeof familyOrWeeks === 'number') {
    const startW = familyOrWeeks;
    const endW = typeof endWeeks === 'number' ? endWeeks : startW + 2;
    const startDate = addDays(startW * 7);
    const endDate = addDays(endW * 7);
    return {
      date: endDate,
      startDate,
      endDate,
      formatted: `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`,
      days: endW * 7,
      weeks: endW,
    };
  }

  let deliveryDays = 56;
  let weeks = 8;
  const fam = String(familyOrWeeks || '').trim().toUpperCase().replace(/[\s\-_]+/g, ' ');

  if (
    fam === 'APG' ||
    fam === 'SRG' ||
    fam === 'ACCESSORIES' ||
    fam === 'ACCESSORY' ||
    fam === 'ACC' ||
    fam.startsWith('APG ') ||
    fam.startsWith('SRG ') ||
    fam.startsWith('ACCESSORIES ')
  ) {
    if (fam.includes('CARBIDE')) {
      deliveryDays = 56;
      weeks = 8;
    } else {
      deliveryDays = 42;
      weeks = 6;
    }
  } else if (
    fam === 'ARG' ||
    fam === 'SPG' ||
    fam === 'ACG' ||
    fam.includes('CARBIDE') ||
    fam === 'SETTING DISK' ||
    fam === 'SD' ||
    fam.startsWith('ARG ') ||
    fam.startsWith('SPG ') ||
    fam.startsWith('ACG ')
  ) {
    deliveryDays = 56;
    weeks = 8;
  } else {
    deliveryDays = 56;
    weeks = 8;
  }

  const targetDate = addDays(deliveryDays);

  return {
    date: targetDate,
    startDate: targetDate,
    endDate: targetDate,
    formatted: formatDisplay(targetDate),
    days: deliveryDays,
    weeks,
  };
}

function formatEstimatedDelivery(estDelivery) {
  if (!estDelivery) return '—';
  if (typeof estDelivery === 'string') {
    const s = estDelivery.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    return s || '—';
  }
  if (estDelivery.formatted) return estDelivery.formatted;
  if (estDelivery.date) {
    const [y, m, d] = estDelivery.date.split('-');
    return `${d}/${m}/${y}`;
  }
  if (estDelivery.startDate && estDelivery.endDate) {
    const fmt = (iso) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };
    return estDelivery.startDate === estDelivery.endDate
      ? fmt(estDelivery.startDate)
      : `${fmt(estDelivery.startDate)} – ${fmt(estDelivery.endDate)}`;
  }
  return '—';
}

/**
 * Calculates dynamic Product-level Projected Date according to the Google Apps Script formula.
 */
function calculateProductProjectedDate(params) {
  if (!params || typeof params !== 'object') return null;
  const { type, family, template, currentStage, timestamp, poDate, todayStr } = params;
  if (!currentStage && !template && !timestamp && !poDate) return null;

  const normStage = canonicalProcess(currentStage);
  if (normStage === 'DONE' || ['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA'].includes(currentStage)) {
    const d = timestamp ? timestamp.slice(0, 10) : (todayStr || getTodayIso());
    const [y, m, day] = d.split('-');
    return { projectedDate: d, isDone: true, remainingDays: 0, formatted: `${day}/${m}/${y}` };
  }

  const effectiveFamily = family || (type ? String(type).trim().toUpperCase() : 'ARG');
  const templateInfo = (template && PROCESS_TEMPLATES_SUMMARY[template]) || null;
  const stages = templateInfo && templateInfo.stages && templateInfo.stages.length > 0 ? templateInfo.stages : null;

  let remainingPlannedDays = 0;
  let currentProcessDays = 3;

  if (stages) {
    let matchedIdx = -1;
    for (let i = 0; i < stages.length; i++) {
      const stageCanonical = canonicalProcess(stages[i].name);
      if (normStage === stageCanonical || normStage === stages[i].name.toUpperCase()) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx !== -1) {
      currentProcessDays = stages[matchedIdx].days || 3;
      remainingPlannedDays = stages.slice(matchedIdx).reduce((sum, s) => sum + (s.days || 0), 0);
    } else {
      let stdIdx = STANDARD_PROCESS_ORDER.indexOf(normStage);
      if (stdIdx === -1) stdIdx = Math.floor(stages.length * 0.4);
      const ratio = Math.max(0, (stages.length - Math.min(stdIdx, stages.length - 1)) / stages.length);
      remainingPlannedDays = Math.round(ratio * templateInfo.totalDays);
      currentProcessDays = Math.round(templateInfo.daysPerProcess || 3);
    }
  } else {

    const totalProcesses = templateInfo ? templateInfo.totalProcesses : (effectiveFamily.includes('ARG') ? 17 : (effectiveFamily.includes('APG') ? 13 : 12));
    const daysPerProcess = templateInfo ? templateInfo.daysPerProcess : 3;

    let currentIndex = STANDARD_PROCESS_ORDER.indexOf(normStage);
    if (currentIndex === -1) {
      currentIndex = Math.floor(totalProcesses * 0.4);
    }
    const remainingProcesses = Math.max(1, totalProcesses - Math.min(currentIndex, totalProcesses - 1));
    remainingPlannedDays = Math.round(remainingProcesses * daysPerProcess);
    currentProcessDays = Math.round(daysPerProcess);
  }

  const today = todayStr ? parseDateTime(todayStr + ' 00:00:00') : new Date();
  if (today) today.setHours(0, 0, 0, 0);

  const startDateStr = timestamp || poDate || todayStr;
  const startDate = startDateStr ? parseDateTime(startDateStr.substring(0, 10) + ' 00:00:00') : new Date(today);
  if (startDate) startDate.setHours(0, 0, 0, 0);

  let elapsedDays = (today && startDate) ? Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  if (elapsedDays < 0 || isNaN(elapsedDays)) elapsedDays = 0;

  let remainingFromToday;
  if (elapsedDays <= currentProcessDays) {
    remainingFromToday = remainingPlannedDays - elapsedDays;
  } else {
    remainingFromToday = remainingPlannedDays - currentProcessDays;
  }
  if (remainingFromToday < 0) remainingFromToday = 0;

  const target = new Date(today || new Date());
  target.setDate(target.getDate() + remainingFromToday);

  const ty = target.getFullYear();
  const tm = String(target.getMonth() + 1).padStart(2, '0');
  const td = String(target.getDate()).padStart(2, '0');
  const projectedDate = `${ty}-${tm}-${td}`;

  return {
    projectedDate,
    remainingDays: remainingFromToday,
    isDone: false,
    formatted: `${td}/${tm}/${ty}`,
  };
}

function calculateSCProductionDate(items, todayStr) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const validIsoDates = [];
  for (const item of items) {
    if (!item) continue;
    let rawVal = item.projectedDate !== undefined ? item.projectedDate : item.projected_date;
    if (rawVal === undefined && (item.currentStage || item.template || item.timestamp || item.poDate)) {
      const dynamic = calculateProductProjectedDate({
        product: item.product,
        type: item.type,
        family: item.family,
        template: item.template,
        currentStage: item.currentStage,
        timestamp: item.timestamp,
        poDate: item.poDate,
        todayStr,
      });
      if (dynamic && dynamic.projectedDate) rawVal = dynamic.projectedDate;
    }
    if (!rawVal) continue;
    const s = String(rawVal).trim();
    if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined' || s.toLowerCase() === 'invalid') continue;

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
      if (dow !== 0 && !COMPANY_HOLIDAYS.has(ds)) count++;
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
    if (dow !== 0 && !COMPANY_HOLIDAYS.has(ds)) added++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const workingDaysBetween6Day = workingDaysBetween5Day;
const addWorkingDays6Day = addWorkingDays5Day;

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
  workingDaysBetween6Day,
  addWorkingDays5Day,
  addWorkingDays6Day,
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
  getVendorName,
  getVendorInfo,
  VENDOR_MAP,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  calculateProductProjectedDate,
  canonicalProcess,
  PROCESS_TEMPLATES,
  PROCESS_TEMPLATES_SUMMARY,
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
  workingDaysBetween6Day,
  addWorkingDays5Day,
  addWorkingDays6Day,
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
  getVendorName,
  getVendorInfo,
  VENDOR_MAP,
  isSCComplete,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  calculateProductProjectedDate,
  canonicalProcess,
  PROCESS_TEMPLATES,
  PROCESS_TEMPLATES_SUMMARY,
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
