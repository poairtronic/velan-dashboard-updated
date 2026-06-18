/**
 * SLA Forecast Engine V2
 * Projects PO completion dates using working-day velocities, stage queue delays, and weighted throughput.
 */
const { workingDaysBetween5Day, addWorkingDays5Day, TARGET_DAYS } = require('../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function calculateSLAForecast({ liveRows, dbRows }) {
  const todayStr = getTodayStr();

  // 1. Build historical velocity per PO type+inhouse category from completed POs
  const velocityMap = {}; // key: `${type}|${inhouse}` → { totalDays, count }
  const poHistoryMap = {}; // po → { poDate, lastTimestamp, type, inhouse, stages: [{stage, dateStr}] }
  
  dbRows.forEach(row => {
    if (!row.po || !row.poDate || !row.timestamp) return;
    const key = row.po;
    if (!poHistoryMap[key]) {
      poHistoryMap[key] = {
        poDate: row.poDate,
        type: row.type || 'UNKNOWN',
        inhouse: row.inhouse || 'UNKNOWN',
        timestamps: [],
        stages: []
      };
    }
    poHistoryMap[key].timestamps.push(row.timestamp);
    poHistoryMap[key].stages.push({
      stage: row.currentStage || '',
      dateStr: row.timestamp.substring(0, 10)
    });
  });

  // Calculate stage durations and overall PO completion velocities
  const stageDurations = {}; // stage → [days]
  Object.values(poHistoryMap).forEach(po => {
    const isComplete = po.stages.some(s => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s.stage));
    if (!isComplete || !po.poDate) return;

    // Po total working days
    const lastTs = po.timestamps.sort().pop();
    const days = workingDaysBetween5Day(po.poDate, lastTs);
    if (days === null || days <= 0) return;

    const vKey = `${po.type}|${po.inhouse}`;
    if (!velocityMap[vKey]) velocityMap[vKey] = { totalDays: 0, count: 0 };
    velocityMap[vKey].totalDays += days;
    velocityMap[vKey].count++;

    // Calculate stage durations from sorted transitions
    po.stages.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    for (let i = 0; i < po.stages.length - 1; i++) {
      const curr = po.stages[i];
      const next = po.stages[i + 1];
      if (curr.stage && curr.stage !== next.stage) {
        const stageDiff = workingDaysBetween5Day(curr.dateStr, next.dateStr);
        if (stageDiff !== null && stageDiff >= 0) {
          if (!stageDurations[curr.stage]) stageDurations[curr.stage] = [];
          stageDurations[curr.stage].push(stageDiff);
        }
      }
    }
  });

  // Averages for PO types
  const velocityAvg = {};
  Object.entries(velocityMap).forEach(([key, val]) => {
    velocityAvg[key] = {
      avgDays: Math.round(val.totalDays / val.count),
      sampleCount: val.count
    };
  });

  const allVelocities = Object.values(velocityMap);
  const globalAvgDays = allVelocities.length > 0
    ? Math.round(allVelocities.reduce((s, v) => s + v.totalDays, 0) / allVelocities.reduce((s, v) => s + v.count, 0))
    : TARGET_DAYS;
  const globalSampleCount = allVelocities.reduce((s, v) => s + v.count, 0);

  // Averages for stage durations
  const stageAvgDurations = {};
  Object.entries(stageDurations).forEach(([stage, list]) => {
    stageAvgDurations[stage] = list.reduce((s, v) => s + v, 0) / list.length;
  });

  // Calculate weighted daily throughput for each stage (from capacityPlanner logic)
  const workingDays = [];
  let wd = new Date();
  while (workingDays.length < 14) {
    const ds = `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-${String(wd.getDate()).padStart(2, '0')}`;
    if (workingDaysBetween5Day(ds, ds) === 1) {
      workingDays.push(ds);
    }
    wd.setDate(wd.getDate() - 1);
  }
  const recent7Days = workingDays.slice(0, 7);
  const previous7Days = workingDays.slice(7, 14);

  // Group by transition key: sc + po + product
  const transitionHistory = {};
  dbRows.forEach(row => {
    if (!row.sc || !row.po || !row.timestamp) return;
    const key = `${row.sc}|${row.po}|${(row.product || '').trim()}`;
    if (!transitionHistory[key]) transitionHistory[key] = [];
    transitionHistory[key].push({
      stage: row.currentStage || '',
      timestamp: row.timestamp,
      dateStr: row.timestamp.substring(0, 10)
    });
  });

  const stageOutflow = {};
  Object.values(transitionHistory).forEach(history => {
    if (history.length < 2) return;
    history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let i = 0; i < history.length - 1; i++) {
      const entry = history[i];
      if (entry.stage !== history[i + 1].stage && entry.stage) {
        if (!stageOutflow[entry.stage]) stageOutflow[entry.stage] = {};
        const outDate = history[i + 1].dateStr;
        if (!stageOutflow[entry.stage][outDate]) stageOutflow[entry.stage][outDate] = 0;
        stageOutflow[entry.stage][outDate]++;
      }
    }
  });

  const stageWeightedThroughput = {};
  Object.keys(stageOutflow).forEach(stage => {
    const outflowDays = stageOutflow[stage] || {};
    const recentOut = recent7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);
    const prevOut = previous7Days.reduce((sum, ds) => sum + (outflowDays[ds] || 0), 0);
    const weightedOutflow = (recentOut * 0.7) + (prevOut * 0.3);
    stageWeightedThroughput[stage] = Math.max(0.1, weightedOutflow / 7); // minimum throughput 0.1 items/day
  });

  // Calculate current stage queue sizes
  const stageQueueSizes = {};
  liveRows.forEach(row => {
    const stage = row.currentStage || '';
    if (stage && !TERMINAL_STAGES.includes(stage)) {
      stageQueueSizes[stage] = (stageQueueSizes[stage] || 0) + 1;
    }
  });

  // 2. Identify open POs in live data
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

    const elapsedDays = workingDaysBetween5Day(po.poDate, todayStr);
    if (elapsedDays === null) return;

    // Look up historical type velocity
    const vKey = `${po.type}|${po.inhouse}`;
    const velocity = velocityAvg[vKey];
    const projectedTotalDays = velocity ? velocity.avgDays : globalAvgDays;
    const sampleCount = velocity ? velocity.sampleCount : globalSampleCount;

    // Get current stage
    const stageArr = [...po.stages].filter(s => !TERMINAL_STAGES.includes(s));
    const currentStage = stageArr[0] || 'UNKNOWN';

    // Calculate Queue Delay Ahead
    const activeStageQueue = stageQueueSizes[currentStage] || 0;
    const activeStageThroughput = stageWeightedThroughput[currentStage] || 1; // default 1 item/day
    const queueDelay = activeStageQueue / activeStageThroughput;

    // Historical active stage remaining duration (default 3 days if no history)
    const stageDuration = stageAvgDurations[currentStage] !== undefined ? stageAvgDurations[currentStage] : 3;

    // --- OLD MODEL (Double Counting) ---
    const baseRemaining = Math.max(0, projectedTotalDays - elapsedDays);
    const oldRemainingDays = Math.round(Math.max(1, baseRemaining + queueDelay + stageDuration));
    const oldProjectedCompletionDate = addWorkingDays5Day(todayStr, oldRemainingDays);
    const oldTotalDuration = elapsedDays + oldRemainingDays;
    const oldExpectedDelay = Math.max(0, oldTotalDuration - TARGET_DAYS);
    let oldRiskLevel = 'low';
    if (oldTotalDuration > TARGET_DAYS) oldRiskLevel = 'high';
    else if (TARGET_DAYS - oldTotalDuration <= 3) oldRiskLevel = 'medium';

    const oldSlaRatio = oldTotalDuration / TARGET_DAYS;
    const oldDelayProbability = Math.min(99, Math.max(5, Math.round(Math.max(0, (oldSlaRatio - 0.6) * 200))));

    // --- NEW REFINED MODEL (No Double Counting) ---
    const queueImpact = Math.max(0.0, Math.min(0.5, projectedTotalDays > 0 ? (queueDelay / projectedTotalDays) : 0));
    const adjustedDuration = projectedTotalDays * (1 + queueImpact);
    const expectedRemainingDays = Math.max(1, Math.round(adjustedDuration - elapsedDays));

    const projectedCompletionDate = addWorkingDays5Day(todayStr, expectedRemainingDays);
    const slaDate = addWorkingDays5Day(po.poDate, TARGET_DAYS);

    const totalWorkingDaysEstimate = elapsedDays + expectedRemainingDays;
    const expectedDelay = Math.max(0, totalWorkingDaysEstimate - TARGET_DAYS);

    const slaRatio = totalWorkingDaysEstimate / TARGET_DAYS;
    const delayProbability = Math.min(99, Math.max(5, Math.round(Math.max(0, (slaRatio - 0.6) * 200))));

    let riskLevel = 'low';
    if (totalWorkingDaysEstimate > TARGET_DAYS) riskLevel = 'high';
    else if (TARGET_DAYS - totalWorkingDaysEstimate <= 3) riskLevel = 'medium';

    // Confidence: sample count + stage history stability
    const confidence = Math.min(100, Math.max(10, Math.round(Math.min(95, sampleCount * 4 + 20))));

    forecasts.push({
      poNumber: po.po,
      currentStage,
      elapsedDays, // current age
      projectedTotalDays,
      projectedCompletionDate, // expected completion (refined)
      expectedDelay, // expected delay in days (refined)
      delayProbability, // delay probability % (refined)
      slaDate,
      riskLevel, // refined
      confidence,
      itemCount: po.items.length,
      oldModel: {
        remainingDays: oldRemainingDays,
        projectedCompletionDate: oldProjectedCompletionDate,
        expectedDelay: oldExpectedDelay,
        riskLevel: oldRiskLevel,
        delayProbability: oldDelayProbability
      },
      newModel: {
        queueImpact: Math.round(queueImpact * 100) / 100,
        adjustedDuration: Math.round(adjustedDuration * 10) / 10,
        remainingDays: expectedRemainingDays,
        projectedCompletionDate,
        expectedDelay,
        riskLevel,
        delayProbability
      }
    });
  });

  // Sort by risk (high first)
  const riskOrder = { high: 0, medium: 1, low: 2 };
  forecasts.sort((a, b) => (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2) || b.delayProbability - a.delayProbability);

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
