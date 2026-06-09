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
    .replace(/[\.\s]/g, '');
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
  const s = String(value).trim().replace('T', ' ');
  if (!s) return '';

  const date = toIsoDateString(s);
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (date && timeMatch) {
    const hh = String(timeMatch[1]).padStart(2, '0');
    const mm = String(timeMatch[2]).padStart(2, '0');
    const ss = String(timeMatch[3] || '00').padStart(2, '0');
    return `${date} ${hh}:${mm}:${ss}`;
  }
  return date || s.substring(0, 19);
}

export {
  inferType,
  normalizeStage,
  normalizeInhouse,
  correctStageName,
  getStageColor,
  normalizeTimestamp,
};
