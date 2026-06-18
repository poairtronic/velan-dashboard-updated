/**
 * Dynamic Capacity Planner V2
 * Projects queue sizes using weighted inflow/outflow rates on working days.
 * Key tracking: SC + PO + Product.
 */
const { workingDaysBetween5Day, addWorkingDays5Day } = require('../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_WINDOW_WORKING_DAYS = 14;

async function calculateCapacityForecast({ liveRows, dbRows }) {
  // 1. Current queue per stage from live data
  const currentQueues = {};
  liveRows.forEach(row => {
    const stage = row.currentStage || '';
    if (TERMINAL_STAGES.includes(stage) || !stage) return;
    if (!currentQueues[stage]) currentQueues[stage] = 0;
    currentQueues[stage]++;
  });

  // 2. Generate list of last 14 working days (excluding Sat, Sun, and holidays)
  const workingDays = [];
  let d = new Date();
  while (workingDays.length < ANALYSIS_WINDOW_WORKING_DAYS) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (workingDaysBetween5Day(ds, ds) === 1) {
      workingDays.push(ds);
    }
    d.setDate(d.getDate() - 1);
  }

  // Split into recent 7 and previous 7 working days
  const recent7Days = workingDays.slice(0, 7);
  const previous7Days = workingDays.slice(7, 14);

  // 3. Track item stage transition histories using SC + PO + Product key
  const itemHistory = {}; // key: `${sc}|${po}|${product}`
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

  // Count daily inflow and outflow transitions
  const stageInflow = {};  // stage → { dateStr → count }
  const stageOutflow = {}; // stage → { dateStr → count }

  Object.values(itemHistory).forEach(history => {
    if (history.length < 2) return;
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const stage = entry.stage;
      if (!stage || TERMINAL_STAGES.includes(stage)) continue;

      // Inflow
      if (!stageInflow[stage]) stageInflow[stage] = {};
      if (!stageInflow[stage][entry.dateStr]) stageInflow[stage][entry.dateStr] = 0;
      stageInflow[stage][entry.dateStr]++;

      // Outflow (if next stage is different)
      if (i < history.length - 1 && history[i + 1].stage !== stage) {
        if (!stageOutflow[stage]) stageOutflow[stage] = {};
        const outDate = history[i + 1].dateStr;
        if (!stageOutflow[stage][outDate]) stageOutflow[stage][outDate] = 0;
        stageOutflow[stage][outDate]++;
      }
    }
  });

  // 4. Calculate weighted metrics per stage
  const results = [];
  const allStages = [...new Set([...Object.keys(currentQueues), ...Object.keys(stageInflow)])];

  allStages.forEach(stage => {
    if (TERMINAL_STAGES.includes(stage)) return;

    const queue = currentQueues[stage] || 0;
    const inflowDays = stageInflow[stage] || {};
    const outflowDays = stageOutflow[stage] || {};

    // Inflow sums
    const recentInflow = recent7Days.reduce((sum, ds) => sum + (inflowDays[ds] || 0), 0);
    const prevInflow = previous7Days.reduce((sum, ds) => sum + (inflowDays[ds] || 0), 0);

    // Outflow sums
    const recentOutflow = recent7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);
    const prevOutflow = previous7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);

    // Weighted formulas (over the 7-day periods)
    const weightedInflow7Day = (recentInflow * 0.7) + (prevInflow * 0.3);
    const weightedOutflow7Day = (recentOutflow * 0.7) + (prevOutflow * 0.3);

    // Daily weighted rates
    const weightedDailyInflow = weightedInflow7Day / 7;
    const weightedDailyOutflow = weightedOutflow7Day / 7;
    const netDailyChange = weightedDailyInflow - weightedDailyOutflow;

    // Projections forward
    const projected7d = Math.max(0, Math.round(queue + netDailyChange * 7));
    const projected14d = Math.max(0, Math.round(queue + netDailyChange * 14));
    const projected30d = Math.max(0, Math.round(queue + netDailyChange * 30));

    // Capacity Gap
    const capacityGapPercent = queue > 0
      ? Math.round(((projected30d - queue) / queue) * 100)
      : (projected30d > 0 ? 100 : 0);

    // Recommendation
    let recommendedAction = 'Monitor — Stable';
    if (capacityGapPercent > 50) recommendedAction = 'Increase capacity — Growing backlog';
    else if (capacityGapPercent > 20) recommendedAction = 'Plan capacity increase';
    else if (capacityGapPercent < -30) recommendedAction = 'Reduce allocation — Shrinking queue';
    else if (capacityGapPercent < -10) recommendedAction = 'Queue clearing — Good progress';

    // 5. Confidence Score V2
    // Activity Score (60%)
    let activeDaysCount = 0;
    workingDays.forEach(ds => {
      if ((inflowDays[ds] || 0) > 0 || (outflowDays[ds] || 0) > 0) {
        activeDaysCount++;
      }
    });
    const activityScore = activeDaysCount / ANALYSIS_WINDOW_WORKING_DAYS;

    // Consistency Score (40%) using Coefficient of Variation (CV) on daily throughput (outflow)
    const dailyOutflowValues = workingDays.map(ds => outflowDays[ds] || 0);
    const meanOutflow = dailyOutflowValues.reduce((s, v) => s + v, 0) / ANALYSIS_WINDOW_WORKING_DAYS;
    
    let consistencyScore = 0;
    let cv = 0;
    if (meanOutflow > 0) {
      const variance = dailyOutflowValues.reduce((s, v) => s + Math.pow(v - meanOutflow, 2), 0) / ANALYSIS_WINDOW_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanOutflow;
      consistencyScore = Math.max(0, 1 - cv);
    } else {
      consistencyScore = 0;
    }

    const finalConfidence = Math.min(100, Math.max(10, Math.round(((activityScore * 0.6) + (consistencyScore * 0.4)) * 100)));

    let confidenceLabel = 'Low';
    if (finalConfidence >= 80) confidenceLabel = 'Very High';
    else if (finalConfidence >= 60) confidenceLabel = 'High';
    else if (finalConfidence >= 40) confidenceLabel = 'Medium';

    results.push({
      stage,
      currentQueue: queue,
      weightedInflow: Math.round(weightedDailyInflow * 10) / 10,
      weightedOutflow: Math.round(weightedDailyOutflow * 10) / 10,
      netChange: Math.round(netDailyChange * 10) / 10,
      projectedQueue7d: projected7d,
      projectedQueue14d: projected14d,
      projectedQueue30d: projected30d,
      capacityGapPercent,
      recommendedAction,
      confidence: finalConfidence,
      confidencePercent: finalConfidence,
      confidenceLabel,
      // Backward compatibility:
      avgInflowPerDay: Math.round(weightedDailyInflow * 10) / 10,
      avgOutflowPerDay: Math.round(weightedDailyOutflow * 10) / 10,
      netDailyChange: Math.round(netDailyChange * 10) / 10
    });
  });

  results.sort((a, b) => b.currentQueue - a.currentQueue);

  return {
    stages: results,
    metadata: {
      analysisWindowDays: ANALYSIS_WINDOW_WORKING_DAYS,
      basedOnDays: ANALYSIS_WINDOW_WORKING_DAYS,
      stagesAnalyzed: results.length
    }
  };
}

module.exports = { calculateCapacityForecast };
