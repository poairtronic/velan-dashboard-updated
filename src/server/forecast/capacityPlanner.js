/**
 * Dynamic Capacity Planner
 * Projects queue sizes at +7/14/30 days using historical inflow/outflow rates.
 * All rates derived from velan_rows timestamps — zero hardcoded values.
 */
const { workingDaysBetween } = require('../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_WINDOW_DAYS = 14;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function calculateCapacityForecast({ liveRows, dbRows }) {
  const todayStr = getTodayStr();

  // 1. Current queue per stage from live data
  const currentQueues = {};
  liveRows.forEach(row => {
    const stage = row.currentStage || '';
    if (TERMINAL_STAGES.includes(stage) || !stage) return;
    if (!currentQueues[stage]) currentQueues[stage] = 0;
    currentQueues[stage]++;
  });

  // 2. Calculate inflow/outflow from historical data
  // Group historical rows by SC+product to track stage transitions
  const itemHistory = {}; // key: `${sc}|${product}` → [{stage, timestamp, dateStr}]

  dbRows.forEach(row => {
    if (!row.sc || !row.timestamp) return;
    const key = `${row.sc}|${(row.product || '').trim()}`;
    if (!itemHistory[key]) itemHistory[key] = [];
    const dateStr = row.timestamp.substring(0, 10);
    itemHistory[key].push({
      stage: row.currentStage || '',
      timestamp: row.timestamp,
      dateStr
    });
  });

  // Count daily inflow (items entering a stage) and outflow (items leaving)
  const stageInflow = {};  // stage → { dateStr → count }
  const stageOutflow = {}; // stage → { dateStr → count }

  Object.values(itemHistory).forEach(history => {
    if (history.length < 2) return;
    // Sort by timestamp
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const stage = entry.stage;
      if (!stage || TERMINAL_STAGES.includes(stage)) continue;

      // This is an inflow event for this stage
      if (!stageInflow[stage]) stageInflow[stage] = {};
      if (!stageInflow[stage][entry.dateStr]) stageInflow[stage][entry.dateStr] = 0;
      stageInflow[stage][entry.dateStr]++;

      // If there's a next entry with a different stage, this is an outflow event
      if (i < history.length - 1 && history[i + 1].stage !== stage) {
        if (!stageOutflow[stage]) stageOutflow[stage] = {};
        const outDate = history[i + 1].dateStr;
        if (!stageOutflow[stage][outDate]) stageOutflow[stage][outDate] = 0;
        stageOutflow[stage][outDate]++;
      }
    }
  });

  // 3. Calculate daily averages over the analysis window
  const results = [];
  const allStages = [...new Set([...Object.keys(currentQueues), ...Object.keys(stageInflow)])];

  allStages.forEach(stage => {
    if (TERMINAL_STAGES.includes(stage)) return;

    const queue = currentQueues[stage] || 0;
    const inflowDays = stageInflow[stage] || {};
    const outflowDays = stageOutflow[stage] || {};

    // Count data points within the analysis window
    let inflowTotal = 0, outflowTotal = 0, daysWithData = 0;
    const today = new Date();

    for (let i = 0; i < ANALYSIS_WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayInflow = inflowDays[ds] || 0;
      const dayOutflow = outflowDays[ds] || 0;

      inflowTotal += dayInflow;
      outflowTotal += dayOutflow;
      if (dayInflow > 0 || dayOutflow > 0) daysWithData++;
    }

    const avgInflowPerDay = ANALYSIS_WINDOW_DAYS > 0 ? inflowTotal / ANALYSIS_WINDOW_DAYS : 0;
    const avgOutflowPerDay = ANALYSIS_WINDOW_DAYS > 0 ? outflowTotal / ANALYSIS_WINDOW_DAYS : 0;
    const netDailyChange = avgInflowPerDay - avgOutflowPerDay;

    // Project forward
    const projected7d = Math.max(0, Math.round(queue + netDailyChange * 7));
    const projected14d = Math.max(0, Math.round(queue + netDailyChange * 14));
    const projected30d = Math.max(0, Math.round(queue + netDailyChange * 30));

    // Capacity gap
    const capacityGapPercent = queue > 0
      ? Math.round(((projected30d - queue) / queue) * 100)
      : (projected30d > 0 ? 100 : 0);

    // Recommended action
    let recommendedAction = 'Monitor — Stable';
    if (capacityGapPercent > 50) recommendedAction = 'Increase capacity — Growing backlog';
    else if (capacityGapPercent > 20) recommendedAction = 'Plan capacity increase';
    else if (capacityGapPercent < -30) recommendedAction = 'Reduce allocation — Shrinking queue';
    else if (capacityGapPercent < -10) recommendedAction = 'Queue clearing — Good progress';

    // Confidence based on data density
    const confidence = Math.min(100, Math.max(10, Math.round((daysWithData / ANALYSIS_WINDOW_DAYS) * 100)));

    results.push({
      stage,
      currentQueue: queue,
      avgInflowPerDay: Math.round(avgInflowPerDay * 10) / 10,
      avgOutflowPerDay: Math.round(avgOutflowPerDay * 10) / 10,
      netDailyChange: Math.round(netDailyChange * 10) / 10,
      projectedQueue7d: projected7d,
      projectedQueue14d: projected14d,
      projectedQueue30d: projected30d,
      capacityGapPercent,
      recommendedAction,
      confidence
    });
  });

  // Sort by current queue descending
  results.sort((a, b) => b.currentQueue - a.currentQueue);

  return {
    stages: results,
    metadata: {
      analysisWindowDays: ANALYSIS_WINDOW_DAYS,
      basedOnDays: ANALYSIS_WINDOW_DAYS,
      stagesAnalyzed: results.length
    }
  };
}

module.exports = { calculateCapacityForecast };
