/**
 * Predictive Bottleneck Detection
 * Identifies current bottleneck and predicts the next one at +14 days
 * using historical inflow/outflow rates.
 * All rates derived from timestamps — zero hardcoded assumptions.
 */

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const PROJECTION_DAYS = 14;
const ANALYSIS_WINDOW = 14;

async function calculateBottleneckForecast({ liveRows, dbRows }) {
  // 1. Current queue per stage
  const currentQueues = {};
  liveRows.forEach(row => {
    const stage = row.currentStage || '';
    if (TERMINAL_STAGES.includes(stage) || !stage) return;
    if (!currentQueues[stage]) currentQueues[stage] = 0;
    currentQueues[stage]++;
  });

  // Current bottleneck = stage with highest queue
  const currentBottleneckStage = Object.entries(currentQueues)
    .sort(([, a], [, b]) => b - a)[0];

  const currentBottleneck = currentBottleneckStage
    ? { stage: currentBottleneckStage[0], queue: currentBottleneckStage[1] }
    : { stage: 'None', queue: 0 };

  // 2. Calculate net inflow rates from historical data
  const itemHistory = {};
  dbRows.forEach(row => {
    if (!row.sc || !row.timestamp) return;
    const key = `${row.sc}|${(row.product || '').trim()}`;
    if (!itemHistory[key]) itemHistory[key] = [];
    itemHistory[key].push({
      stage: row.currentStage || '',
      timestamp: row.timestamp,
      dateStr: row.timestamp.substring(0, 10)
    });
  });

  // Count daily inflow and outflow per stage
  const stageInflow = {};
  const stageOutflow = {};
  const today = new Date();

  // Initialize
  Object.keys(currentQueues).forEach(stage => {
    stageInflow[stage] = {};
    stageOutflow[stage] = {};
    for (let i = 0; i < ANALYSIS_WINDOW; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      stageInflow[stage][ds] = 0;
      stageOutflow[stage][ds] = 0;
    }
  });

  Object.values(itemHistory).forEach(history => {
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const stage = entry.stage;
      if (!stage || TERMINAL_STAGES.includes(stage)) continue;

      // Inflow: item arrived at this stage
      if (stageInflow[stage] && stageInflow[stage][entry.dateStr] !== undefined) {
        stageInflow[stage][entry.dateStr]++;
      }

      // Outflow: if next entry has different stage
      if (i < history.length - 1 && history[i + 1].stage !== stage) {
        const outDate = history[i + 1].dateStr;
        if (stageOutflow[stage] && stageOutflow[stage][outDate] !== undefined) {
          stageOutflow[stage][outDate]++;
        }
      }
    }
  });

  // 3. Calculate average net change per day and project
  const projections = {};
  let totalDataPoints = 0;
  let stagesWithData = 0;

  Object.keys(currentQueues).forEach(stage => {
    const inflowVals = Object.values(stageInflow[stage] || {});
    const outflowVals = Object.values(stageOutflow[stage] || {});

    const totalInflow = inflowVals.reduce((s, v) => s + v, 0);
    const totalOutflow = outflowVals.reduce((s, v) => s + v, 0);
    const daysWithActivity = inflowVals.filter((v, i) => v > 0 || outflowVals[i] > 0).length;

    const avgNetChange = ANALYSIS_WINDOW > 0 ? (totalInflow - totalOutflow) / ANALYSIS_WINDOW : 0;
    const projectedQueue = Math.max(0, Math.round(currentQueues[stage] + avgNetChange * PROJECTION_DAYS));

    projections[stage] = {
      currentQueue: currentQueues[stage],
      projectedQueue,
      avgNetChange: Math.round(avgNetChange * 10) / 10,
      daysWithActivity
    };

    totalDataPoints += daysWithActivity;
    if (daysWithActivity > 0) stagesWithData++;
  });

  // 4. Find predicted next bottleneck
  const predictedEntry = Object.entries(projections)
    .sort(([, a], [, b]) => b.projectedQueue - a.projectedQueue)[0];

  // Days until: estimate when projected stage will exceed current bottleneck
  let daysUntil = PROJECTION_DAYS;
  if (predictedEntry) {
    const [pStage, pData] = predictedEntry;
    if (pData.avgNetChange > 0 && currentBottleneck.queue > pData.currentQueue) {
      daysUntil = Math.round((currentBottleneck.queue - pData.currentQueue) / pData.avgNetChange);
    } else if (pStage === currentBottleneck.stage) {
      daysUntil = 0; // Same stage is still the bottleneck
    }
  }

  // Confidence based on overall data availability
  const avgDataDensity = stagesWithData > 0 ? totalDataPoints / (stagesWithData * ANALYSIS_WINDOW) : 0;
  const confidence = Math.min(100, Math.max(10, Math.round(avgDataDensity * 100)));

  const predictedNextBottleneck = predictedEntry
    ? {
        stage: predictedEntry[0],
        projectedQueue: predictedEntry[1].projectedQueue,
        currentQueue: predictedEntry[1].currentQueue,
        daysUntil: Math.max(0, daysUntil),
        confidence
      }
    : { stage: 'None', projectedQueue: 0, currentQueue: 0, daysUntil: 0, confidence: 10 };

  return {
    currentBottleneck,
    predictedNextBottleneck,
    stageProjections: Object.entries(projections).map(([stage, data]) => ({
      stage,
      ...data
    })).sort((a, b) => b.projectedQueue - a.projectedQueue),
    metadata: {
      projectionDays: PROJECTION_DAYS,
      analysisWindowDays: ANALYSIS_WINDOW,
      basedOnDays: ANALYSIS_WINDOW,
      confidence
    }
  };
}

module.exports = { calculateBottleneckForecast };
