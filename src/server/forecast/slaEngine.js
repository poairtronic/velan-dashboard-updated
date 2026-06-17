/**
 * SLA Forecast Engine
 * Projects PO completion dates using historical velocity per type/vendor category.
 * Confidence is derived from the number of historical samples — never hardcoded.
 */
const { workingDaysBetween, TARGET_DAYS } = require('../utils/calculationUtils');

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addWorkingDays(fromDateStr, daysToAdd) {
  const parts = fromDateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  let added = 0;
  while (added < daysToAdd) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++; // Skip Sundays
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function calculateSLAForecast({ liveRows, dbRows }) {
  const todayStr = getTodayStr();

  // 1. Build historical velocity map: type+inhouse → avg days to completion
  const velocityMap = {}; // key: `${type}|${inhouse}` → { totalDays, count }
  const poCompletionMap = {}; // po → { poDate, lastTimestamp, type, inhouse }

  dbRows.forEach(row => {
    if (!row.po || !row.poDate || !row.timestamp) return;
    const key = row.po;
    if (!poCompletionMap[key]) {
      poCompletionMap[key] = {
        poDate: row.poDate,
        type: row.type || 'UNKNOWN',
        inhouse: row.inhouse || 'UNKNOWN',
        timestamps: [],
        stages: []
      };
    }
    poCompletionMap[key].timestamps.push(row.timestamp);
    poCompletionMap[key].stages.push(row.currentStage || '');
  });

  // Calculate velocity from completed POs in history
  Object.values(poCompletionMap).forEach(po => {
    const isComplete = po.stages.some(s => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s));
    if (!isComplete || !po.poDate) return;

    const lastTs = po.timestamps.sort().pop();
    const days = workingDaysBetween(po.poDate, lastTs);
    if (days === null || days <= 0) return;

    const vKey = `${po.type}|${po.inhouse}`;
    if (!velocityMap[vKey]) velocityMap[vKey] = { totalDays: 0, count: 0 };
    velocityMap[vKey].totalDays += days;
    velocityMap[vKey].count++;
  });

  // Calculate averages
  const velocityAvg = {};
  Object.entries(velocityMap).forEach(([key, val]) => {
    velocityAvg[key] = {
      avgDays: Math.round(val.totalDays / val.count),
      sampleCount: val.count
    };
  });

  // Global average fallback
  const allVelocities = Object.values(velocityMap);
  const globalAvgDays = allVelocities.length > 0
    ? Math.round(allVelocities.reduce((s, v) => s + v.totalDays, 0) / allVelocities.reduce((s, v) => s + v.count, 0))
    : TARGET_DAYS;
  const globalSampleCount = allVelocities.reduce((s, v) => s + v.count, 0);

  // 2. For each open PO in live data, project completion
  const openPOs = {};
  liveRows.forEach(row => {
    if (!row.po) return;
    const isTerminal = ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(row.currentStage);
    if (!openPOs[row.po]) {
      openPOs[row.po] = {
        po: row.po,
        poDate: row.poDate,
        type: row.type || 'UNKNOWN',
        inhouse: row.inhouse || 'UNKNOWN',
        items: [],
        hasOpenItems: false,
        stages: new Set()
      };
    }
    openPOs[row.po].items.push(row);
    openPOs[row.po].stages.add(row.currentStage || '');
    if (!isTerminal) openPOs[row.po].hasOpenItems = true;
  });

  const forecasts = [];

  Object.values(openPOs).forEach(po => {
    if (!po.hasOpenItems || !po.poDate) return;

    const elapsedDays = workingDaysBetween(po.poDate, todayStr);
    if (elapsedDays === null) return;

    // Look up velocity
    const vKey = `${po.type}|${po.inhouse}`;
    const velocity = velocityAvg[vKey];
    const projectedTotalDays = velocity ? velocity.avgDays : globalAvgDays;
    const sampleCount = velocity ? velocity.sampleCount : globalSampleCount;

    const remainingDays = Math.max(0, projectedTotalDays - elapsedDays);
    const projectedCompletionDate = addWorkingDays(todayStr, remainingDays);

    // SLA date = poDate + TARGET_DAYS working days
    const slaDate = addWorkingDays(po.poDate, TARGET_DAYS);

    // Risk assessment
    const projectedVsSla = workingDaysBetween(projectedCompletionDate, slaDate);
    let riskLevel = 'low';
    if (projectedVsSla !== null) {
      if (projectedVsSla < 0) riskLevel = 'high';       // projected AFTER sla
      else if (projectedVsSla <= 3) riskLevel = 'medium'; // within 3 days of SLA
    }
    // If already past SLA
    if (elapsedDays > TARGET_DAYS) riskLevel = 'high';

    // Confidence: based on sample count (more data = higher confidence)
    const confidence = Math.min(100, Math.max(10, sampleCount * 5));

    // Current stage = most common non-terminal stage
    const stageArr = [...po.stages].filter(s => !['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s));
    const currentStage = stageArr[0] || 'UNKNOWN';

    forecasts.push({
      poNumber: po.po,
      currentStage,
      elapsedDays,
      projectedTotalDays,
      projectedCompletionDate,
      slaDate,
      riskLevel,
      confidence,
      itemCount: po.items.length
    });
  });

  // Sort by risk (high first)
  const riskOrder = { high: 0, medium: 1, low: 2 };
  forecasts.sort((a, b) => (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2));

  return {
    forecasts,
    metadata: {
      totalOpenPOs: forecasts.length,
      highRisk: forecasts.filter(f => f.riskLevel === 'high').length,
      mediumRisk: forecasts.filter(f => f.riskLevel === 'medium').length,
      lowRisk: forecasts.filter(f => f.riskLevel === 'low').length,
      basedOnDays: 30,
      historicalSamples: globalSampleCount
    }
  };
}

module.exports = { calculateSLAForecast };
