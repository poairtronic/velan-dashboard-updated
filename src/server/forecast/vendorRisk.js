/**
 * Vendor Risk Forecast V2
 * Projects vendor risk and performance metrics using working days, weighted throughput, and stability scores.
 * Key tracking: SC + PO + Product.
 */
const { workingDaysBetween5Day, addWorkingDays5Day } = require('../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const VENDOR_SLA_DAYS = 2; // Target working days spent per vendor stage
const ANALYSIS_WORKING_DAYS = 30;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function calculateVendorRiskForecast({ liveRows, dbRows }) {
  const todayStr = getTodayStr();

  // 1. Generate list of last 30 working days and last 14 working days
  const workingDays = [];
  let d = new Date();
  while (workingDays.length < ANALYSIS_WORKING_DAYS) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (workingDaysBetween5Day(ds, ds) === 1) {
      workingDays.push(ds);
    }
    d.setDate(d.getDate() - 1);
  }
  const recent7Days = workingDays.slice(0, 7);
  const previous7Days = workingDays.slice(7, 14);

  // 2. Identify active vendor items from live data
  const vendorItems = {};
  liveRows.forEach(row => {
    if (row.inhouse !== 'VENDOR') return;
    const stage = row.currentStage || '';
    if (TERMINAL_STAGES.includes(stage) || !stage) return;

    const vendorCode = stage;
    if (!vendorItems[vendorCode]) {
      vendorItems[vendorCode] = {
        vendor: vendorCode,
        openItems: [],
        ages: []
      };
    }
    vendorItems[vendorCode].openItems.push(row);

    if (row.timestamp) {
      const age = workingDaysBetween5Day(row.timestamp, todayStr);
      if (age !== null && age >= 0) {
        vendorItems[vendorCode].ages.push(age);
      }
    }
  });

  // 3. Track historical stage entries and exit transitions using SC + PO + Product key
  const itemHistory = {};
  dbRows.forEach(row => {
    if (!row.sc || !row.po || !row.timestamp) return;
    const key = `${row.sc}|${row.po}|${(row.product || '').trim()}`;
    if (!itemHistory[key]) itemHistory[key] = [];
    itemHistory[key].push({
      stage: row.currentStage || '',
      timestamp: row.timestamp,
      dateStr: row.timestamp.substring(0, 10),
      inhouse: row.inhouse || ''
    });
  });

  // Calculate historical completed vendor stages, durations, and daily exit throughput
  const vendorCompletedCycles = {}; // vendorCode → [days]
  const vendorDailyOutflow = {};    // vendorCode → { dateStr → count }
  const vendorRecentCycles = {};    // vendorCode → [days]
  const vendorPrevCycles = {};      // vendorCode → [days]

  Object.values(itemHistory).forEach(history => {
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (let i = 0; i < history.length - 1; i++) {
      const curr = history[i];
      const next = history[i + 1];

      if (curr.inhouse === 'VENDOR' && !TERMINAL_STAGES.includes(curr.stage) && curr.stage !== next.stage) {
        const vendorCode = curr.stage;
        const days = workingDaysBetween5Day(curr.timestamp, next.timestamp);
        
        if (days !== null && days >= 0) {
          if (!vendorCompletedCycles[vendorCode]) vendorCompletedCycles[vendorCode] = [];
          vendorCompletedCycles[vendorCode].push(days);

          // Categorize by date for delay trends
          const exitDate = next.dateStr;
          const isRecent = recent7Days.includes(exitDate);
          const isPrev = previous7Days.includes(exitDate);
          if (isRecent) {
            if (!vendorRecentCycles[vendorCode]) vendorRecentCycles[vendorCode] = [];
            vendorRecentCycles[vendorCode].push(days);
          } else if (isPrev) {
            if (!vendorPrevCycles[vendorCode]) vendorPrevCycles[vendorCode] = [];
            vendorPrevCycles[vendorCode].push(days);
          }

          // Count daily exit throughput
          if (!vendorDailyOutflow[vendorCode]) vendorDailyOutflow[vendorCode] = {};
          if (!vendorDailyOutflow[vendorCode][exitDate]) vendorDailyOutflow[vendorCode][exitDate] = 0;
          vendorDailyOutflow[vendorCode][exitDate]++;
        }
      }
    }
  });

  // 4. Build forecast per vendor
  const results = [];
  const allVendorCycles = Object.values(vendorCompletedCycles).flat();
  const globalAvgCycle = allVendorCycles.length > 0
    ? allVendorCycles.reduce((s, d) => s + d, 0) / allVendorCycles.length
    : VENDOR_SLA_DAYS;

  Object.values(vendorItems).forEach(v => {
    const currentAvgDays = v.ages.length > 0
      ? Math.round((v.ages.reduce((s, d) => s + d, 0) / v.ages.length) * 10) / 10
      : 0;

    const historicalCycles = vendorCompletedCycles[v.vendor] || [];
    const historicalAvgDays = historicalCycles.length > 0
      ? Math.round((historicalCycles.reduce((s, d) => s + d, 0) / historicalCycles.length) * 10) / 10
      : Math.round(globalAvgCycle * 10) / 10;

    // Vendor Throughput Trend
    const dailyOut = vendorDailyOutflow[v.vendor] || {};
    const recentOut = recent7Days.reduce((sum, ds) => sum + (dailyOut[ds] || 0), 0);
    const prevOut = previous7Days.reduce((sum, ds) => sum + (dailyOut[ds] || 0), 0);

    const tRecent = recentOut / 7;
    const tPrev = prevOut / 7;
    const weightedThroughput = (tRecent * 0.7) + (tPrev * 0.3);
    const throughputDiff = tRecent - tPrev;
    const throughputTrend = `${weightedThroughput.toFixed(1)}/d (${throughputDiff >= 0 ? '+' : ''}${throughputDiff.toFixed(1)})`;

    // Vendor Delay Trend (Recent cycle times vs Prev cycle times)
    const recentAvg = (vendorRecentCycles[v.vendor] || []).reduce((s, c) => s + c, 0) / Math.max(1, (vendorRecentCycles[v.vendor] || []).length);
    const prevAvg = (vendorPrevCycles[v.vendor] || []).reduce((s, c) => s + c, 0) / Math.max(1, (vendorPrevCycles[v.vendor] || []).length);
    const delayDiff = recentAvg - prevAvg;
    const delayTrend = `${delayDiff >= 0 ? '+' : ''}${delayDiff.toFixed(1)}d`;

    // Vendor Stability Score (100 - CV * 100 on daily working-day throughput)
    const throughputValues = workingDays.map(ds => dailyOut[ds] || 0);
    const meanTP = throughputValues.reduce((s, v) => s + v, 0) / ANALYSIS_WORKING_DAYS;
    let stabilityScore = 50; // default stability
    let cv = 0;
    if (meanTP > 0) {
      const variance = throughputValues.reduce((s, v) => s + Math.pow(v - meanTP, 2), 0) / ANALYSIS_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanTP;
      stabilityScore = Math.min(100, Math.max(0, Math.round((1 - cv) * 100)));
    }

    // Breach probability
    const breachProbability = Math.min(100, Math.round((currentAvgDays / Math.max(VENDOR_SLA_DAYS, 0.1)) * 100));

    // Risk level
    let riskLevel = 'low';
    if (breachProbability > 75) riskLevel = 'high';
    else if (breachProbability >= 50) riskLevel = 'medium';

    // Confidence score V2
    const activeDaysCount = throughputValues.filter(v => v > 0).length;
    const activityScore = activeDaysCount / ANALYSIS_WORKING_DAYS;
    const consistencyScore = Math.max(0, 1 - cv);
    const finalConfidence = Math.min(100, Math.max(10, Math.round(((activityScore * 0.6) + (consistencyScore * 0.4)) * 100)));

    results.push({
      vendor: v.vendor,
      openItems: v.openItems.length,
      currentAvgDays,
      historicalAvgDays,
      throughputTrend,
      delayTrend,
      stabilityScore: `${stabilityScore}%`,
      breachProbability,
      riskLevel,
      confidence: finalConfidence,
      maxAge: v.ages.length > 0 ? Math.max(...v.ages) : 0
    });
  });

  results.sort((a, b) => b.breachProbability - a.breachProbability);

  return {
    vendors: results,
    metadata: {
      totalVendors: results.length,
      highRisk: results.filter(v => v.riskLevel === 'high').length,
      mediumRisk: results.filter(v => v.riskLevel === 'medium').length,
      lowRisk: results.filter(v => v.riskLevel === 'low').length,
      slaTargetDays: VENDOR_SLA_DAYS,
      basedOnDays: ANALYSIS_WORKING_DAYS
    }
  };
}

module.exports = { calculateVendorRiskForecast };
