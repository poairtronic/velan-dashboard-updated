/**
 * Dynamic Capacity Planner V3 — Phase 9.6
 * Projects queue sizes using weighted inflow/outflow rates on working days.
 * Key tracking: SC + PO + Product.
 *
 * SECTION 1 — Capacity Planner Recommendations V2
 *   Current Throughput  = Average Items Exiting Stage per Working Day
 *   Required Throughput = Projected Queue / Target Clearance Days
 *   Capacity Increase % = ((Required - Current) / Current) * 100
 *   Priority: >50% Critical, 20-50% High, 10-20% Medium, <10% Monitor
 *
 * SECTION 2 — Confidence Score V3
 *   Final Confidence = Activity(40%) + Consistency(30%) + Volume(30%)
 *   Activity  = Days With Events / Total Window Days * 100
 *   Consistency = 100 - Normalized CV
 *   Volume = MIN(100, (Total Events / 100) * 100)
 *   Bands: 90-100 Very High, 75-89 High, 50-74 Medium, <50 Low
 */
const { workingDaysBetween5Day, addWorkingDays5Day } = require('../../utils/calculationUtils');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_WINDOW_WORKING_DAYS = 14;
const TARGET_CLEARANCE_DAYS = 10;
const TARGET_EVENT_COUNT = 100;

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

    // Capacity Gap (unchanged — backward compat)
    const capacityGapPercent = queue > 0
      ? Math.round(((projected30d - queue) / queue) * 100)
      : (projected30d > 0 ? 100 : 0);

    // ═══════════════════════════════════════════════
    // SECTION 1 — Capacity Planner Recommendations V2
    // ═══════════════════════════════════════════════

    // Current Throughput = Average Items Exiting Stage per Working Day
    const currentThroughput = Math.round(weightedDailyOutflow * 10) / 10;

    // Use projected queue at +30 days as the basis for required throughput
    const projectedQueue = projected30d > 0 ? projected30d : queue;

    // Required Throughput = Projected Queue / Target Clearance Days
    const requiredThroughput = projectedQueue > 0
      ? Math.round((projectedQueue / TARGET_CLEARANCE_DAYS) * 10) / 10
      : 0;

    // Capacity Increase % = ((Required - Current) / Current) × 100
    let capacityIncreasePercent = 0;
    if (currentThroughput > 0 && requiredThroughput > currentThroughput) {
      capacityIncreasePercent = Math.round(((requiredThroughput - currentThroughput) / currentThroughput) * 100);
    } else if (currentThroughput === 0 && requiredThroughput > 0) {
      capacityIncreasePercent = 100; // Need to establish capacity
    }

    // Priority based on Capacity Increase %
    let priority = 'Monitor';
    let recommendedAction = 'Monitor — Stable';
    if (capacityIncreasePercent > 50) {
      priority = 'Critical';
      recommendedAction = 'Immediate capacity increase required — Critical backlog growth';
    } else if (capacityIncreasePercent > 20) {
      priority = 'High';
      recommendedAction = 'Plan capacity increase — Significant gap detected';
    } else if (capacityIncreasePercent > 10) {
      priority = 'Medium';
      recommendedAction = 'Schedule capacity review — Moderate gap';
    } else if (capacityIncreasePercent > 0) {
      priority = 'Monitor';
      recommendedAction = 'Monitor — Minor gap within tolerance';
    } else if (capacityGapPercent < -30) {
      priority = 'Monitor';
      recommendedAction = 'Reduce allocation — Shrinking queue';
    } else if (capacityGapPercent < -10) {
      priority = 'Monitor';
      recommendedAction = 'Queue clearing — Good progress';
    }

    // ═══════════════════════════════════════════════
    // SECTION 2 — Confidence Score V3
    // ═══════════════════════════════════════════════

    // Activity Score (40%) = Days With Events / Total Window Days × 100
    let activeDaysCount = 0;
    workingDays.forEach(ds => {
      if ((inflowDays[ds] || 0) > 0 || (outflowDays[ds] || 0) > 0) {
        activeDaysCount++;
      }
    });
    const activityScore = (activeDaysCount / ANALYSIS_WINDOW_WORKING_DAYS) * 100;

    // Consistency Score (30%) = 100 - Normalized CV
    const dailyOutflowValues = workingDays.map(ds => outflowDays[ds] || 0);
    const meanOutflow = dailyOutflowValues.reduce((s, v) => s + v, 0) / ANALYSIS_WINDOW_WORKING_DAYS;

    let consistencyScore = 0;
    let cv = 0;
    if (meanOutflow > 0) {
      const variance = dailyOutflowValues.reduce((s, v) => s + Math.pow(v - meanOutflow, 2), 0) / ANALYSIS_WINDOW_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanOutflow;
      // Normalize CV: cap at 2 so score doesn't go below 0
      const normalizedCV = Math.min(cv, 2) * 50; // Scale to 0-100 range
      consistencyScore = Math.max(0, 100 - normalizedCV);
    }

    // Volume Score (30%) = MIN(100, (Total Events / Target Event Count) × 100)
    const totalEvents = dailyOutflowValues.reduce((s, v) => s + v, 0);
    const volumeScore = Math.min(100, (totalEvents / TARGET_EVENT_COUNT) * 100);

    // Final Confidence = Activity(40%) + Consistency(30%) + Volume(30%)
    const finalConfidence = Math.min(100, Math.max(5, Math.round(
      (activityScore * 0.40) +
      (consistencyScore * 0.30) +
      (volumeScore * 0.30)
    )));

    // Confidence Bands (V3)
    let confidenceLabel = 'Low';
    let confidenceGrade = 'D';
    if (finalConfidence >= 90) { confidenceLabel = 'Very High'; confidenceGrade = 'A'; }
    else if (finalConfidence >= 75) { confidenceLabel = 'High'; confidenceGrade = 'B'; }
    else if (finalConfidence >= 50) { confidenceLabel = 'Medium'; confidenceGrade = 'C'; }

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

      // V2 Recommendations (Section 1)
      currentThroughput,
      requiredThroughput,
      capacityIncreasePercent,
      priority,
      recommendedAction,

      // V3 Confidence (Section 2)
      confidence: finalConfidence,
      confidencePercent: finalConfidence,
      confidenceLabel,
      confidenceGrade,
      confidenceBreakdown: {
        activityScore: Math.round(activityScore),
        consistencyScore: Math.round(consistencyScore),
        volumeScore: Math.round(volumeScore),
        activeDays: activeDaysCount,
        totalDays: ANALYSIS_WINDOW_WORKING_DAYS,
        totalEvents,
        cv: Math.round(cv * 100) / 100
      },

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
      stagesAnalyzed: results.length,
      targetClearanceDays: TARGET_CLEARANCE_DAYS,
      targetEventCount: TARGET_EVENT_COUNT,
      confidenceModel: 'V3 — Activity(40%) + Consistency(30%) + Volume(30%)'
    }
  };
}

module.exports = { calculateCapacityForecast };
