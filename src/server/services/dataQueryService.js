const { pool } = require('../db/pool');
const { getOrSetCache, TTL } = require('../cache/cacheService');
const { workingDaysBetween, normalizeProductsInGroup, getProductCategory } = require('../utils/calculationUtils');

async function getAllRawData() {
  // We fetch both live and history from Neon. 
  // Cache for 60s so we don't pound the DB for every KPI endpoint call.
  return getOrSetCache('all_merged_db_data', TTL.SHORT, async () => {
    const liveRes = await pool.query('SELECT data FROM velan_live_rows');
    const histRes = await pool.query('SELECT data FROM velan_rows');
    return { liveRows: liveRes.rows.map(r => r.data), dbRows: histRes.rows.map(r => r.data) };
  });
}

async function getMergedData(todayStr) {
  const { liveRows, dbRows } = await getAllRawData();

  const seen = new Set();
  const liveProcessed = liveRows.map((row) => ({
    ...row,
    currentStage: row.currentStage || row.op || row.OP || '',
    _isLive: true,
    pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
    cycleTime: row.timestamp && row.poDate ? workingDaysBetween(row.poDate, row.timestamp) : null,
  }));
  const dbProcessed = dbRows.map((row) => ({
    ...row,
    currentStage: row.currentStage || row.op || row.OP || '',
    _isLive: false,
    pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
    cycleTime: row.timestamp && row.poDate ? workingDaysBetween(row.poDate, row.timestamp) : null,
  }));

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
}

function getActiveData(rawData) {
  if (!rawData) return [];
  const scGroups = {};
  rawData.forEach((r) => {
    if (!r.sc) return;
    if (!scGroups[r.sc]) scGroups[r.sc] = [];
    scGroups[r.sc].push(r);
  });
  
  const activeRows = [];
  rawData.forEach((r) => {
    if (!r.sc) {
      activeRows.push(r);
      return;
    }
    const group = scGroups[r.sc] || [];
    const liveRows = group.filter((row) => row._isLive);
    let activePOs = [];
    let activeProducts = [];
    
    if (liveRows.length > 0) {
      activePOs = [...new Set(liveRows.map((row) => row.po).filter(Boolean))];
      const normalizedLive = normalizeProductsInGroup(liveRows);
      activeProducts = [
        ...new Set(normalizedLive.map((row) => (row.product || '').trim()).filter(Boolean)),
      ];
    } else {
      const sorted = [...group].sort((a, b) => {
        const tA = a.timestamp || a.poDate || '';
        const tB = b.timestamp || b.poDate || '';
        return tB.localeCompare(tA);
      });
      if (sorted[0] && sorted[0].po) {
        activePOs = [sorted[0].po];
      }
    }
    
    if (!activePOs.includes(r.po)) return;
    
    if (liveRows.length > 0 && activeProducts.length > 0) {
      const cleanProduct = (r.product || '').trim();
      let productMatch = activeProducts.includes(cleanProduct);
      if (!productMatch) {
        if (cleanProduct.endsWith('...')) {
          const prefix = cleanProduct.slice(0, -3);
          productMatch = activeProducts.some((ap) => ap.startsWith(prefix));
        } else {
          productMatch = activeProducts.some(
            (ap) => ap.endsWith('...') && cleanProduct.startsWith(ap.slice(0, -3))
          );
        }
      }
      if (!productMatch) return;
    } else if (liveRows.length === 0) {
      const activeGroupRows = group.filter((row) => activePOs.includes(row.po));
      const scTimestamps = activeGroupRows.map((row) => row.timestamp).filter(Boolean);
      if (scTimestamps.length > 0) {
        const latestSCTime = new Date(scTimestamps.sort().pop()).getTime();
        const prodRows = activeGroupRows.filter(
          (row) => (row.product || '').trim() === (r.product || '').trim()
        );
        const prodTimestamps = prodRows.map((row) => row.timestamp).filter(Boolean);
        if (prodTimestamps.length > 0) {
          const latestProdTime = new Date(prodTimestamps.sort().pop()).getTime();
          const diffDays = (latestSCTime - latestProdTime) / (1000 * 60 * 60 * 24);
          if (diffDays > 3) {
            return;
          }
        } else {
          return;
        }
      }
    }
    activeRows.push(r);
  });
  return activeRows;
}

function dateInRange(val, fromDate, toDate) {
  if (!val) return true;
  const d = val.slice(0, 10);
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

async function getFilteredData(filters, todayStr) {
  const merged = await getMergedData(todayStr);
  const data = getActiveData(merged);

  const { po, stage, type, inhouse, category, search, fromDate, toDate, dateType = 'poDate' } = filters;

  const filtered = data.filter((row) => {
    const dateVal = dateType === 'poDate' ? row.poDate : row.timestamp;
    if (!dateInRange(dateVal, fromDate, toDate)) return false;
    if (po && row.po !== po) return false;
    if (stage && (row.currentStage || '').trim() !== stage) return false;
    if (type && row.type !== type) return false;
    if (inhouse && row.inhouse !== inhouse) return false;
    if (category && getProductCategory(row.type) !== category) return false;
    if (search) {
      const s = search.trim().toLowerCase();
      const scStr = String(row.sc || '').toLowerCase();
      const poStr = String(row.po || '').toLowerCase();
      const prodStr = String(row.product || '').toLowerCase();
      const scMatch = scStr === s || scStr.startsWith(s);
      const poMatch = poStr.includes(s);
      const prodMatch = prodStr.includes(s);
      if (!scMatch && !prodMatch && !poMatch) return false;
      if (!scMatch && !prodMatch && poMatch) {
        if (!scStr.startsWith(s)) return false;
      }
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const dateA = a.poDate ? new Date(a.poDate).getTime() : 0;
    const dateB = b.poDate ? new Date(b.poDate).getTime() : 0;
    return dateA - dateB;
  });
}

function computeGroups(filtered) {
  const scGroupsMap = {};
  filtered.forEach((row) => {
    if (!scGroupsMap[row.sc]) scGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, _all: [] };
    scGroupsMap[row.sc]._all.push(row);
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
    return { sc: sg.sc, po: sg.po, poDate: sg.poDate, items: Object.values(latestMap) };
  });

  const poGroupsMap = {};
  filtered.forEach((row) => {
    if (!poGroupsMap[row.po]) poGroupsMap[row.po] = { po: row.po, poDate: row.poDate, items: [] };
    poGroupsMap[row.po].items.push(row);
  });
  const poGroups = Object.values(poGroupsMap);

  return { scGroups, poGroups };
}

module.exports = {
  getFilteredData,
  computeGroups
};
