import { toIsoDateString } from '../utils/dateUtils';
// ─── DATA NORMALIZATION SERVICES ─────────────────────────────────────────────

const STAGE_CORRECTIONS = {
  BLACKENEING: 'BLACKENING',
  BLACKNING: 'BLACKENING',
  BLACKENNING: 'BLACKENING',
  BLACING: 'PLACING',
  BRASING: 'BRAZING',
  'PLATING ': 'PLATING',
  READDY: 'READY',
  REAADY: 'READY',
  STORE: 'STORES',
  STORRES: 'STORES',
  STOERS: 'STORES',
  CALIBARTION: 'CALIBRATION',
  CALLIBRATION: 'CALIBRATION',
};

function inferType(productName) {
  if (!productName) return 'ACCESSORY';
  const p = String(productName).toUpperCase().trim();
  if (p.startsWith('APG') || p.startsWith('2 PAIR APG')) return 'APG';
  if (p.startsWith('ARG')) return 'ARG';
  if (p.startsWith('SRG')) return 'SRG';
  if (p.startsWith('SP ') || p.startsWith('SP\t') || p === 'SP' || /^SP DIA/.test(p)) return 'SP';
  if (p.startsWith('SPG')) return 'SPG';
  return 'ACCESSORY';
}

function normalizeStage(stage) {
  if (!stage) return '';
  const s = String(stage)
    .trim()
    .toUpperCase()
    .replace(/[.\s]/g, '');
  if (!s) return '';
  const aliases = {
    STORE: 'STORES',
    STORRES: 'STORES',
    STOERS: 'STORES',
    READDY: 'READY',
    REAADY: 'READY',
    BLACKENEING: 'BLACKENING',
    BLACKNING: 'BLACKENING',
    BLACKENNING: 'BLACKENING',
    DCPL: 'DCPLI',
    HOV: 'HOV',
    HOVE: 'HOV',
    SDV: 'SDV',
    BLV: 'BLV',
    FBV: 'FBV',
    HTV: 'HTV',
    HCV: 'HCV',
  };
  const corrected = aliases[s] || s;
  if (corrected === 'STOCK' || corrected === 'STOCKK') return 'STOCK';
  if (corrected === 'READY' || corrected.includes('READY')) return 'READY';
  if (corrected === 'STORES' || corrected.includes('STORE')) return 'STORES';
  return corrected.replace(/\s+/g, '');
}

function normalizeInhouse(val) {
  const s = String(val || '')
    .trim()
    .toUpperCase();
  if (!s) return 'INHOUSE';
  return s.includes('VENDOR') ? 'VENDOR' : 'INHOUSE';
}

function correctStageName(stage) {
  if (!stage) return stage;
  const up = stage.trim().toUpperCase();
  return STAGE_CORRECTIONS[up] || up;
}

function getStageColor(stage) {
  if (!stage) return '#3d6080';
  const s = stage.toUpperCase();
  if (s === 'READY') return '#00e676';
  if (s === 'STORES') return '#00c9ff';
  if (s.includes('LATHE')) return '#ff3d5a';
  if (s.includes('VA')) return '#ff6b35';
  if (s.includes('CG')) return '#ffd60a';
  if (s.includes('SG')) return '#0fa8e0';
  if (s.includes('HT')) return '#ff6b35';
  if (s.includes('QC')) return '#b24bff';
  if (s.includes('M1')) return '#ff3d5a';
  if (s.includes('FB')) return '#ffd60a';
  if (['SDV', 'SDV', 'BLV', 'FBV', 'HTV', 'HOV', 'HCV'].some((v) => s.includes(v.replace('V', ''))))
    return '#b24bff';
  if (s === 'STOCK') return '#00c9ff';
  return '#7ba7cc';
}

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') return '';

  // 1. Native Date object (e.g. from SheetJS XLSX parsing with cellDates: true)
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    const ss = String(value.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  // 2. Excel numeric serial date (e.g. 46148 or 46148.52083)
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!isNaN(num) && num > 20000 && num < 80000) {
    const epochMs = Math.round((num - 25569) * 86400 * 1000);
    const dateObj = new Date(epochMs);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      const hh = String(dateObj.getUTCHours()).padStart(2, '0');
      const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
      const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
  }

  // 3. String representation
  const s = String(value).trim();
  if (!s || s === '—' || s === '-' || s === 'null' || s === 'undefined' || s === 'NaN') return '';

  const date = toIsoDateString(s);
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (date && timeMatch) {
    let hh = parseInt(timeMatch[1], 10);
    const mm = String(timeMatch[2]).padStart(2, '0');
    const ss = String(timeMatch[3] || '00').padStart(2, '0');
    const ampm = (timeMatch[4] || '').toLowerCase();
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    const hhStr = String(hh).padStart(2, '0');
    return `${date} ${hhStr}:${mm}:${ss}`;
  }

  if (date) {
    return `${date} 00:00:00`;
  }

  return s.substring(0, 19);
}

export {
  inferType,
  normalizeStage,
  normalizeInhouse,
  correctStageName,
  getStageColor,
  normalizeTimestamp,
};
