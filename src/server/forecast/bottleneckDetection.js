/**
 * Predictive Bottleneck Detection V2
 * Identifies current bottleneck and predicts next one at +14 days.
 * Key tracking: SC + PO + Product.
 */
const { workingDaysBetween5Day } = require('../../utils/calculationUtils.cjs');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const PROJECTION_DAYS = 14;
const ANALYSIS_WINDOW_WORKING_DAYS = 14;

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

  // 2. Generate list of last 14 working days
  const workingDays = [];
  let d = new Date();
  while (workingDays.length < ANALYSIS_WINDOW_WORKING_DAYS) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (workingDaysBetween5Day(ds, ds) === 1) {
      workingDays.push(ds);
    }
    d.setDate(d.getDate() - 1);
  }
  const recent7Days = workingDays.slice(0, 7);
  const previous7Days = workingDays.slice(7, 14);

  // Group by transition key: sc + po + product
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

  // Inflows and outflows
  const stageInflow = {};
  const stageOutflow = {};

  Object.keys(currentQueues).forEach(stage => {
    stageInflow[stage] = {};
    stageOutflow[stage] = {};
    workingDays.forEach(ds => {
      stageInflow[stage][ds] = 0;
      stageOutflow[stage][ds] = 0;
    });
  });

  Object.values(itemHistory).forEach(history => {
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const stage = entry.stage;
      if (!stage || TERMINAL_STAGES.includes(stage)) continue;

      // Inflow
      if (stageInflow[stage] && stageInflow[stage][entry.dateStr] !== undefined) {
        stageInflow[stage][entry.dateStr]++;
      }

      // Outflow
      if (i < history.length - 1 && history[i + 1].stage !== stage) {
        const outDate = history[i + 1].dateStr;
        if (stageOutflow[stage] && stageOutflow[stage][outDate] !== undefined) {
          stageOutflow[stage][outDate]++;
        }
      }
    }
  });

  // 3. Projections using weighted throughput
  const projections = {};
  let totalDataPoints = 0;
  let stagesWithData = 0;

  Object.keys(currentQueues).forEach(stage => {
    const inflowDays = stageInflow[stage] || {};
    const outflowDays = stageOutflow[stage] || {};

    const recentInflow = recent7Days.reduce((sum, ds) => sum + (inflowDays[ds] || 0), 0);
    const prevInflow = previous7Days.reduce((sum, ds) => sum + (inflowDays[ds] || 0), 0);

    const recentOutflow = recent7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);
    const prevOutflow = previous7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);

    const weightedInflow = (recentInflow * 0.7) + (prevInflow * 0.3);
    const weightedOutflow = (recentOutflow * 0.7) + (prevOutflow * 0.3);

    const avgInflow = weightedInflow / 7;
    const avgOutflow = weightedOutflow / 7;
    const growthRate = avgInflow - avgOutflow; // Queue Growth Rate

    const projectedQueue = Math.max(0, Math.round(currentQueues[stage] + growthRate * PROJECTION_DAYS));
    const activeDaysCount = workingDays.filter(ds => (inflowDays[ds] || 0) > 0 || (outflowDays[ds] || 0) > 0).length;

    // Consistency Score using CV on daily outflow
    const dailyOutflows = workingDays.map(ds => outflowDays[ds] || 0);
    const meanOutflow = dailyOutflows.reduce((s, v) => s + v, 0) / ANALYSIS_WINDOW_WORKING_DAYS;
    let cv = 0;
    let consistencyScore = 0;
    if (meanOutflow > 0) {
      const variance = dailyOutflows.reduce((s, v) => s + Math.pow(v - meanOutflow, 2), 0) / ANALYSIS_WINDOW_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanOutflow;
      consistencyScore = Math.max(0, 1 - cv);
    }

    const activityScore = activeDaysCount / ANALYSIS_WINDOW_WORKING_DAYS;
    const confidence = Math.min(100, Math.max(10, Math.round(((activityScore * 0.6) + (consistencyScore * 0.4)) * 100)));

    const expectedDelay = Math.round(projectedQueue / Math.max(0.1, avgOutflow));

    projections[stage] = {
      currentQueue: currentQueues[stage],
      projectedQueue,
      growthRate: Math.round(growthRate * 10) / 10,
      throughputTrend: `${avgOutflow.toFixed(1)}/d`,
      projectedDelay: expectedDelay,
      daysWithActivity: activeDaysCount,
      confidence
    };

    totalDataPoints += activeDaysCount;
    if (activeDaysCount > 0) stagesWithData++;
  });

  // Find predicted next bottleneck (highest projected queue that is NOT the current bottleneck)
  const currentBottleneckName = currentBottleneckStage ? currentBottleneckStage[0] : null;
  const predictedEntry = Object.entries(projections)
    .filter(([stage]) => stage !== currentBottleneckName)
    .sort(([, a], [, b]) => b.projectedQueue - a.projectedQueue)[0];

  // Days until
  const currentBottleneckQueue = currentBottleneckStage ? currentBottleneckStage[1] : 0;
  const currentBottleneckGrowth = currentBottleneckName && projections[currentBottleneckName] ? projections[currentBottleneckName].growthRate : 0;
  
  let daysUntil = PROJECTION_DAYS;
  if (predictedEntry) {
    const [pStage, pData] = predictedEntry;
    const relativeGrowth = pData.growthRate - currentBottleneckGrowth;
    
    if (pData.currentQueue >= currentBottleneckQueue) {
      daysUntil = 0;
    } else if (relativeGrowth > 0) {
      daysUntil = Math.round((currentBottleneckQueue - pData.currentQueue) / relativeGrowth);
    }
  }

  // Confidence based on overall data availability
  const avgDataDensity = stagesWithData > 0 ? totalDataPoints / (stagesWithData * ANALYSIS_WINDOW_WORKING_DAYS) : 0;
  const overallConfidence = Math.min(100, Math.max(10, Math.round(avgDataDensity * 100)));

  const currentBottleneckData = currentBottleneckStage
    ? {
        stage: currentBottleneckStage[0],
        queue: currentBottleneckStage[1],
        growthRate: projections[currentBottleneckStage[0]]?.growthRate || 0,
        throughputTrend: projections[currentBottleneckStage[0]]?.throughputTrend || '0.0/d'
      }
    : { stage: 'None', queue: 0, growthRate: 0, throughputTrend: '0.0/d' };

  const predictedNextBottleneck = predictedEntry
    ? {
        stage: predictedEntry[0],
        projectedQueue: predictedEntry[1].projectedQueue,
        currentQueue: predictedEntry[1].currentQueue,
        projectedDelay: predictedEntry[1].projectedDelay,
        daysUntil: Math.max(0, daysUntil),
        confidence: predictedEntry[1].confidence
      }
    : { stage: 'None', projectedQueue: 0, currentQueue: 0, projectedDelay: 0, daysUntil: 0, confidence: 10 };

  return {
    currentBottleneck: currentBottleneckData,
    predictedNextBottleneck,
    stageProjections: Object.entries(projections).map(([stage, data]) => ({
      stage,
      ...data
    })).sort((a, b) => b.projectedQueue - a.projectedQueue),
    metadata: {
      projectionDays: PROJECTION_DAYS,
      analysisWindowDays: ANALYSIS_WINDOW_WORKING_DAYS,
      basedOnDays: ANALYSIS_WINDOW_WORKING_DAYS,
      confidence: overallConfidence
    }
  };
}

module.exports = { calculateBottleneckForecast };
