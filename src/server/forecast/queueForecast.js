/**
 * Advanced Queue Forecast V2 (Best/Expected/Worst Case)
 * Uses percentile throughput rates from the last 30 working days.
 * Key tracking: SC + PO + Product.
 */
const { workingDaysBetween5Day, addWorkingDays5Day } = require('../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_WORKING_DAYS = 30;

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function calculateQueueForecast({ liveRows, dbRows, stage }) {
  const todayStr = getTodayStr();

  // 1. Generate list of last 30 working days
  const workingDays = [];
  let d = new Date();
  while (workingDays.length < ANALYSIS_WORKING_DAYS) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (workingDaysBetween5Day(ds, ds) === 1) {
      workingDays.push(ds);
    }
    d.setDate(d.getDate() - 1);
  }

  // 2. Determine target stages
  const targetStages = stage
    ? [stage]
    : [...new Set(liveRows.map(r => r.currentStage).filter(s => s && !TERMINAL_STAGES.includes(s)))];

  const results = [];

  // Group historical dbRows by SC + PO + Product transition key
  const itemHistory = {};
  dbRows.forEach(row => {
    if (!row.sc || !row.po || !row.timestamp) return;
    const key = `${row.sc}|${row.po}|${(row.product || '').trim()}`;
    if (!itemHistory[key]) itemHistory[key] = [];
    itemHistory[key].push({
      stage: row.currentStage || '',
      timestamp: row.timestamp,
      dateStr: row.timestamp.substring(0, 10)
    });
  });

  for (const targetStage of targetStages) {
    const currentQueue = liveRows.filter(r => r.currentStage === targetStage).length;

    // Count daily exit transitions (throughput) specifically for the 30 working days
    const dailyThroughput = {};
    workingDays.forEach(ds => {
      dailyThroughput[ds] = 0;
    });

    Object.values(itemHistory).forEach(history => {
      history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      for (let i = 0; i < history.length - 1; i++) {
        if (history[i].stage === targetStage && history[i + 1].stage !== targetStage) {
          const exitDate = history[i + 1].dateStr;
          if (dailyThroughput[exitDate] !== undefined) {
            dailyThroughput[exitDate]++;
          }
        }
      }
    });

    const throughputValues = Object.values(dailyThroughput).sort((a, b) => a - b);
    const activeDaysCount = throughputValues.filter(v => v > 0).length;

    // 3. Percentiles on working days
    const p90 = percentile(throughputValues, 90);
    const med = percentile(throughputValues, 50);
    const p10 = percentile(throughputValues, 10);

    // 4. Days to clear queue
    const bestDays = p90 > 0 ? Math.round(currentQueue / p90) : null;
    const expectedDays = med > 0 ? Math.round(currentQueue / med) : null;
    const worstDays = p10 > 0 ? Math.round(currentQueue / p10) : null;

    // Expected clearance date based on working days calendar
    const expectedClearanceDate = expectedDays !== null
      ? addWorkingDays5Day(todayStr, expectedDays)
      : 'N/A';

    // 5. Confidence Score V2
    // Activity Score (60%)
    const activityScore = activeDaysCount / ANALYSIS_WORKING_DAYS;

    // Consistency Score (40%) using CV
    const meanThroughput = throughputValues.reduce((s, v) => s + v, 0) / ANALYSIS_WORKING_DAYS;
    let consistencyScore = 0;
    let cv = 0;
    if (meanThroughput > 0) {
      const variance = throughputValues.reduce((s, v) => s + Math.pow(v - meanThroughput, 2), 0) / ANALYSIS_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanThroughput;
      consistencyScore = Math.max(0, 1 - cv);
    } else {
      consistencyScore = 0;
    }

    const finalConfidence = Math.min(100, Math.max(10, Math.round(((activityScore * 0.6) + (consistencyScore * 0.4)) * 100)));

    results.push({
      stage: targetStage,
      currentQueue,
      bestDays,
      expectedDays,
      worstDays,
      expectedClearanceDate,
      p90Throughput: Math.round(p90 * 10) / 10,
      medianThroughput: Math.round(med * 10) / 10,
      p10Throughput: Math.round(p10 * 10) / 10,
      confidence: finalConfidence,
      basedOnDays: ANALYSIS_WORKING_DAYS,
      daysWithData: activeDaysCount
    });
  }

  results.sort((a, b) => b.currentQueue - a.currentQueue);

  return {
    forecasts: results,
    metadata: {
      basedOnDays: ANALYSIS_WORKING_DAYS,
      stagesAnalyzed: results.length
    }
  };
}

module.exports = { calculateQueueForecast };
