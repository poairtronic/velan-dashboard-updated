const { pool } = require('../db/pool');
const { getOrSetCache, TTL } = require('../cache/cacheService');
const {
  workingDaysBetween,
  normalizeProductsInGroup,
  getProductCategory,
  calculateEstimatedDelivery,
  formatEstimatedDelivery,
  calculateSCProductionDate,
  getProductionDateStatus,
  getVendorInfo,
} = require('../../utils/calculationUtils.cjs');
const { getMachineForRow } = require('../../utils/machineUtils.cjs');

function sanitizeRowSC(row) {
  if (!row) return row;
  if ((row.sc === '2234' || row.sc === '2233') && row.po && !String(row.po).startsWith('AGIPLPO1080')) {
    return { ...row, sc: '' };
  }
  return row;
}

async function getAllRawData() {
  // We fetch both live and history from Neon. 
  // Cache for 60s so we don't pound the DB for every KPI endpoint call.
  return getOrSetCache('all_merged_db_data', TTL.SHORT, async () => {
    const liveRes = await pool.query('SELECT data FROM velan_live_rows');
    const histRes = await pool.query('SELECT data FROM velan_rows');
    return {
      liveRows: liveRes.rows.map(r => sanitizeRowSC(r.data)),
      dbRows: histRes.rows.map(r => sanitizeRowSC(r.data))
    };
  });
}

const pendingMerges = {};

async function getMergedData(todayStr) {
  const cacheKey = 'merged_data_' + todayStr;
  if (pendingMerges[cacheKey]) {
    return pendingMerges[cacheKey];
  }

  const mergePromise = getOrSetCache(cacheKey, TTL.SHORT, async () => {
    const { liveRows, dbRows } = await getAllRawData();

  const seen = new Set();
  const liveProcessed = liveRows.map((row) => {
    const cleanRow = sanitizeRowSC(row);
    return {
      ...cleanRow,
      currentStage: cleanRow.currentStage || cleanRow.op || cleanRow.OP || '',
      machine: getMachineForRow(cleanRow),
      _isLive: true,
      pendingDays: cleanRow.timestamp ? workingDaysBetween(cleanRow.timestamp, todayStr) : null,
      cycleTime: cleanRow.timestamp && cleanRow.poDate ? workingDaysBetween(cleanRow.poDate, cleanRow.timestamp) : null,
    };
  });
  const dbProcessed = dbRows.map((row) => {
    const cleanRow = sanitizeRowSC(row);
    return {
      ...cleanRow,
      currentStage: cleanRow.currentStage || cleanRow.op || cleanRow.OP || '',
      machine: getMachineForRow(cleanRow),
      _isLive: false,
      pendingDays: cleanRow.timestamp ? workingDaysBetween(cleanRow.timestamp, todayStr) : null,
      cycleTime: cleanRow.timestamp && cleanRow.poDate ? workingDaysBetween(cleanRow.poDate, cleanRow.timestamp) : null,
    };
  });

  return [...liveProcessed, ...dbProcessed].filter((r) => {
    const key =
      (r.sc || '') +
      '||' +
      (r.po || '') +
      '||' +
      (r.product || '') +
      '||' +
      (r.currentStage || '') +
      '||' +
      (r.timestamp || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  });

  pendingMerges[cacheKey] = mergePromise;
  try {
    const result = await mergePromise;
    return result;
  } finally {
    delete pendingMerges[cacheKey];
  }
}



function dateInRange(val, fromDate, toDate) {
  if (!val) return true;
  const d = val.slice(0, 10);
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

async function getFilteredData(filters, todayStr) {
  const { source = 'live' } = filters;
  const { liveRows, dbRows } = await getAllRawData();
  
  let data;
  if (source === 'database') {
    data = await getMergedData(todayStr);
  } else {
    // source === 'live'
    // Fallback to dbRows if liveRows is empty (just like old logic)
    const rawTarget = liveRows.length > 0 ? liveRows : dbRows;
    const processed = rawTarget.map((row) => {
      const cleanRow = sanitizeRowSC(row);
      return {
        ...cleanRow,
        currentStage: cleanRow.currentStage || cleanRow.op || cleanRow.OP || '',
        machine: getMachineForRow(cleanRow),
        pendingDays: cleanRow.timestamp ? workingDaysBetween(cleanRow.timestamp, todayStr) : null,
        cycleTime: cleanRow.timestamp && cleanRow.poDate ? workingDaysBetween(cleanRow.poDate, cleanRow.timestamp) : null,
      };
    });
    data = processed; // For live, we don't use the complex merged getActiveData logic
  }

  const { po, stage, type, inhouse, category, search, fromDate, toDate, dateType = 'poDate', vendor, machine } = filters;
  
  let stageList = [];
  if (stage) {
    stageList = stage.split(',').map(s => s.trim()).filter(Boolean);
  }

  const filtered = data.filter((row) => {
    const dateVal = dateType === 'poDate' ? row.poDate : row.timestamp;
    if (!dateInRange(dateVal, fromDate, toDate)) return false;
    if (po && row.po !== po) return false;
    if (stageList.length > 0 && !stageList.includes((row.currentStage || '').trim())) return false;
    if (type && row.type !== type) return false;
    if (machine && (row.machine || getMachineForRow(row)) !== machine) return false;
    if (category && getProductCategory(row.type) !== category) return false;
    if (inhouse) {
      const isVen = getVendorInfo(row) !== null || row.inhouse === 'VENDOR';
      if (inhouse === 'VENDOR' && !isVen) return false;
      if (inhouse === 'INHOUSE' && isVen) return false;
    }
    if (vendor) {
      const vInfo = getVendorInfo(row);
      const target = vendor.trim().toUpperCase();
      if (!vInfo || (vInfo.code.toUpperCase() !== target && vInfo.name.toUpperCase() !== target && vInfo.fullName.toUpperCase() !== target)) {
        return false;
      }
    }
    if (search) {
      const s = search.trim().toLowerCase();
      const scStr = String(row.sc || '').toLowerCase();
      const poStr = String(row.po || '').toLowerCase();
      const prodStr = String(row.product || '').toLowerCase();
      const scMatch = scStr === s || scStr.startsWith(s) || scStr.includes(s);
      const poMatch = poStr.includes(s);
      const prodMatch = prodStr.includes(s);
      if (!scMatch && !prodMatch && !poMatch) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const dateA = a.poDate ? new Date(a.poDate).getTime() : 0;
    const dateB = b.poDate ? new Date(b.poDate).getTime() : 0;
    return dateA - dateB;
  });
}

function computeGroups(filtered, allData) {
  const scGroupsMap = {};
  const activeSCs = new Set(filtered.map(r => r.sc).filter(Boolean));
  
  const sourceData = (allData && allData.length > 0) ? allData : filtered;

  sourceData.forEach((row) => {
    if (row.sc && activeSCs.has(row.sc)) {
      if (!scGroupsMap[row.sc]) scGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, _all: [] };
      scGroupsMap[row.sc]._all.push(row);
    }
  });
  
  const scGroups = Object.values(scGroupsMap).map((sg) => {
    const latestMap = {};
    const normalizedRows = normalizeProductsInGroup(sg._all);
    normalizedRows.forEach((r) => {
      const key = (r.product || '__none__').trim();
      const ex = latestMap[key];
      if (!ex) {
        latestMap[key] = r;
        return;
      }
      if (r._isLive && !ex._isLive) {
        latestMap[key] = r;
        return;
      }
      if (!r._isLive && ex._isLive) return;
      if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
    });
    const items = Object.values(latestMap);
    const scProductionDate = calculateSCProductionDate(items);

    const has8Week = items.some((i) => {
      const fam = String(i.family || i.type || '').toUpperCase();
      return (
        fam.includes('ARG') ||
        fam.includes('SPG') ||
        fam.includes('ACG') ||
        fam.includes('CARBIDE') ||
        fam.includes('SD') ||
        fam.includes('SETTING DISK')
      );
    });
    const scFamily = has8Week ? 'ARG' : items[0]?.family || items[0]?.type || 'APG';
    const directDelivery = items.map((i) => i.estimatedDelivery).filter(Boolean).sort().pop();
    const calculatedEstDelivery = calculateEstimatedDelivery(sg.poDate, scFamily);
    const estimatedDelivery = directDelivery
      ? { date: directDelivery, formatted: formatEstimatedDelivery(directDelivery) }
      : calculatedEstDelivery;

    return {
      sc: sg.sc,
      po: sg.po,
      poDate: sg.poDate,
      scProductionDate,
      productionDateStatus: getProductionDateStatus(scProductionDate).code,
      estimatedDelivery,
      items,
    };
  });

  const poGroupsMap = {};
  filtered.forEach((row) => {
    if (!poGroupsMap[row.po]) {
      poGroupsMap[row.po] = {
        po: row.po,
        poDate: row.poDate,
        items: [],
      };
    }
    poGroupsMap[row.po].items.push(row);
  });
  const poGroups = Object.values(poGroupsMap).map((pg) => {
    const has8Week = pg.items.some((i) => {
      const fam = String(i.family || i.type || '').toUpperCase();
      return (
        fam.includes('ARG') ||
        fam.includes('SPG') ||
        fam.includes('ACG') ||
        fam.includes('CARBIDE') ||
        fam.includes('SD') ||
        fam.includes('SETTING DISK')
      );
    });
    const poFamily = has8Week ? 'ARG' : pg.items[0]?.family || pg.items[0]?.type || 'APG';
    const calculatedEstDelivery = calculateEstimatedDelivery(pg.poDate, poFamily);
    return {
      ...pg,
      estimatedDelivery: calculatedEstDelivery,
    };
  });

  return { scGroups, poGroups };
}

module.exports = {
  getFilteredData,
  computeGroups,
  getAllRawData,
  getMergedData
};
