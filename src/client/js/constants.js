const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── SAMPLE DATA (from PDF) ───────────────────────────────────────────────────
// ─── HELPERS ────────────────────────────────────────────────────────────────
const AIRPLUG_TYPES = ['APG','ARG'];
const MASTER_TYPES  = ['SPG','SRG','SP'];
const TARGET_DAYS   = 21;
// ─── HOLIDAY & LEAVE CALENDAR ─────────────────────────────────────────────────
// All public holidays from your company list (YYYY-MM-DD format)
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
    // parseLocalDate: uses same smart DD/MM vs MM/DD resolution as toIsoDateString
    function parseLocalDate(str) {
      if (!str) return null;
      const clean = String(str).trim().substring(0,10);
      let day, month, year;

      if (clean.includes('/')) {
        const parts = clean.split('/');
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let   p2 = parseInt(parts[2], 10);
        if (p2 < 100) p2 += 2000;
        year = p2;
        if (String(parts[2]).trim().length <= 2) {
          // Google Sheets M/D/YY → month first
          month = p0; day = p1;
        } else {
          // 4-digit year: apply smart resolution
          // If p0 > 12: must be day (DD/MM/YYYY)
          // If p1 > 12: must be month (MM/DD/YYYY — Google Sheets)
          // Both ≤ 12: default DD/MM/YYYY (Velan Excel standard)
          if (p0 > 12) { day = p0; month = p1; }
          else if (p1 > 12) { month = p0; day = p1; }
          else { day = p0; month = p1; } // DD/MM default
        }
      } else if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts[0].length === 4) {
          year  = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day   = parseInt(parts[2], 10);
        } else {
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          // Smart resolution for dash-separated too
          if (p0 > 12) { day = p0; month = p1; }
          else if (p1 > 12) { month = p0; day = p1; }
          else { day = p0; month = p1; }
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
    const cur = new Date(
  d1 < d2 ? d1.getTime() : d2.getTime()
);

const end = new Date(
  d1 > d2 ? d1.getTime() : d2.getTime()
);
    while (cur <= end) {
      const dow = cur.getDay();
      const ds =
  cur.getFullYear() + '-' +
  String(cur.getMonth() + 1).padStart(2, '0') + '-' +
  String(cur.getDate()).padStart(2, '0');
      if (dow !== 0 && !COMPANY_HOLIDAYS.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return d2 < d1 ? -count : count;
  } catch { return null; }
}


function getProductCategory(type) {
  if(['APG','ARG'].includes(type)) return 'AIRPLUG';
  if(['SPG','SRG','SP'].includes(type)) return 'MASTER';
  return 'ACCESSORY';
}
function daysBetween(d1Str, d2Str) {
  // Now counts only Mon–Sat working days, excluding company holidays
  return workingDaysBetween(d1Str, d2Str);
}
// ─── PROCESS TIME CALCULATION HELPERS ──────────────────────────────────────
// Calculate hours between two timestamps (YYYY-MM-DD HH:MM:SS format)


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
    // Smart resolution: if p0>12 → DD/MM; if p1>12 → MM/DD; else DD/MM default
    if (p0 > 12) { day = p0; month = p1; }
    else if (p1 > 12) { month = p0; day = p1; }
    else { day = p0; month = p1; }
  } else if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[0].length === 4) {
      year  = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day   = parseInt(parts[2], 10);
    } else {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (p0 > 12) { day = p0; month = p1; }
      else if (p1 > 12) { month = p0; day = p1; }
      else { day = p0; month = p1; }
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

    if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) {
      return null;
    }

    return Math.round(((d2 - d1) / (1000 * 60 * 60)) * 100) / 100;

  } catch {
    return null;
  }
}

// Calculate minutes between two timestamps
function minutesBetween(t1Str, t2Str) {

  if (!t1Str || !t2Str) return null;

  try {

    const d1 = parseDateTime(t1Str);
    const d2 = parseDateTime(t2Str);

    if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) {
      return null;
    }

    return Math.round((d2 - d1) / (1000 * 60));

  } catch {
    return null;
  }
}

// Calculate process cycle time (time from PO date to current timestamp)
function calculateProcessCycleTime(poDate, currentTs) {
  // Working days only (Mon–Sat, minus company holidays)
  return workingDaysBetween(poDate, currentTs);
}
// Calculate vendor aging (days since last timestamp to today)


// Check SLA violation (> 2 days pending)
function isSLAViolation(agingDays, threshold = 2) {
  return agingDays !== null && agingDays > threshold;
}

// Calculate vendor aging: working days from last timestamp to today
function calculateVendorAging(lastTs, today) {
  if (!lastTs) return null;
  // Accept either a Date object or a string for today
  const todayStr = (today instanceof Date)
    ? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    : String(today).substring(0, 10);
  const days = workingDaysBetween(lastTs, todayStr);
  return (days !== null && days >= 0) ? days : null;
}

// Calculate process efficiency: activeTime / totalTime
function calculateProcessEfficiency(activeTime, totalTime) {
  if(!totalTime || totalTime === 0) return 0;
  return Math.round((activeTime / totalTime) * 100);
}
// ── STAGE SPELL-CORRECTION MAP ───────────────────────────────────────────────
// Add or edit entries here whenever a new misspelling appears in the sheet
const STAGE_CORRECTIONS = {
  // Confirmed misspelling visible in screenshot
  'BLACKENEING'  : 'BLACKENING',
  'BLACKNING'    : 'BLACKENING',
  'BLACKENNING'  : 'BLACKENING',
  // Common typos for vendor stages
  'BLACING'      : 'PLACING',
  'BRASING'      : 'BRAZING',
  'PLATING '     : 'PLATING',   // trailing space
  // Ready/Stores variants
  'READDY'       : 'READY',
  'REAADY'       : 'READY',
  'STORE'        : 'STORES',
  'STORRES'      : 'STORES',
  'STOERS'       : 'STORES',
  // Calibration
  'CALIBARTION'  : 'CALIBRATION',
  'CALLIBRATION' : 'CALIBRATION',
  // Add your own misspellings below this line
};

function correctStageName(stage) {
  if (!stage) return stage;
  const up = stage.trim().toUpperCase();
  return STAGE_CORRECTIONS[up] || up;
}
function getStageColor(stage) {
  if(!stage) return '#3d6080';
  const s = stage.toUpperCase();
  if(s==='READY') return '#00e676';
  if(s==='STORES') return '#00c9ff';
  if(s.includes('LATHE')) return '#ff3d5a';
  if(s.includes('VA')) return '#ff6b35';
  if(s.includes('CG')) return '#ffd60a';
  if(s.includes('SG')) return '#0fa8e0';
  if(s.includes('HT')) return '#ff6b35';
  if(s.includes('QC')) return '#b24bff';
  if(s.includes('M1')) return '#ff3d5a';
  if(s.includes('FB')) return '#ffd60a';
  if(['SDV','SDV','BLV','FBV','HTV','HOV','HCV'].some(v=>s.includes(v.replace('V','')))) return '#b24bff';
  if(s==='STOCK') return '#00c9ff';
  return '#7ba7cc';
}

function getVendorCode(stage,inhouse) {
  if(inhouse==='VENDOR') {
    if(stage&&stage.endsWith('V')) return stage.slice(0,-1);
    return 'EXT';
  }
  return null;
}

// Determine SC completion: all items in SC are READY or STORES or EXSTOCK
function isSCComplete(items) {
  return items.every(i=>['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage));
}

function getSCLastTimestamp(items) {
  const ts = items.map(i=>i.timestamp).filter(Boolean).sort().pop();
  return ts;
}

// ─── CHART HELPERS ────────────────────────────────────────────────────────────
function useChart(ref, config, deps) {
  useEffect(() => {
    if(!ref.current) return;
    const existing = Chart.getChart(ref.current);
    if(existing) existing.destroy();
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, config);
    return () => { try { chart.destroy(); } catch(_) {} };
  }, deps);
}
