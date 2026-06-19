/**
 * Advanced Queue Forecast V3 — Phase 9.6
 * Uses percentile throughput rates from the last 30 working days.
 * Key tracking: SC + PO + Product.
 *
 * SECTION 2 — Confidence Score V3
 *   Final Confidence = Activity(40%) + Consistency(30%) + Volume(30%)
 *
 * SECTION 3 — Queue Forecast Messaging V2
 *   Replaces "N/A" with descriptive messages:
 *   - Insufficient Throughput History
 *   - No Stage Exits Detected
 *   - Low Confidence Forecast
 *   - Historical Data Not Available
 *   Also displays: Confidence %, Reason, Data Coverage, Sample Size
 */
const { workingDaysBetween5Day, addWorkingDays5Day } = require('../../utils/calculationUtils.cjs');

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_WORKING_DAYS = 30;
const TARGET_EVENT_COUNT = 100;

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

    let totalTransitionEvents = 0;

    Object.values(itemHistory).forEach(history => {
      history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      for (let i = 0; i < history.length - 1; i++) {
        if (history[i].stage === targetStage && history[i + 1].stage !== targetStage) {
          totalTransitionEvents++;
          const exitDate = history[i + 1].dateStr;
          if (dailyThroughput[exitDate] !== undefined) {
            dailyThroughput[exitDate]++;
          }
        }
      }
    });

    const throughputValues = Object.values(dailyThroughput).sort((a, b) => a - b);
    const activeDaysCount = throughputValues.filter(v => v > 0).length;
    const totalEventsInWindow = throughputValues.reduce((s, v) => s + v, 0);

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
      : null;

    // ═══════════════════════════════════════════════
    // SECTION 2 — Confidence Score V3
    // ═══════════════════════════════════════════════

    // Activity Score (40%) = Days With Events / Total Window Days × 100
    const activityScore = (activeDaysCount / ANALYSIS_WORKING_DAYS) * 100;

    // Consistency Score (30%) = 100 - Normalized CV
    const meanThroughput = throughputValues.reduce((s, v) => s + v, 0) / ANALYSIS_WORKING_DAYS;
    let consistencyScore = 0;
    let cv = 0;
    if (meanThroughput > 0) {
      const variance = throughputValues.reduce((s, v) => s + Math.pow(v - meanThroughput, 2), 0) / ANALYSIS_WORKING_DAYS;
      const stdDev = Math.sqrt(variance);
      cv = stdDev / meanThroughput;
      const normalizedCV = Math.min(cv, 2) * 50;
      consistencyScore = Math.max(0, 100 - normalizedCV);
    }

    // Volume Score (30%) = MIN(100, (Total Events / Target Event Count) × 100)
    const volumeScore = Math.min(100, (totalEventsInWindow / TARGET_EVENT_COUNT) * 100);

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

    // ═══════════════════════════════════════════════
    // SECTION 3 — Queue Forecast Messaging V2
    // ═══════════════════════════════════════════════

    let forecastStatus = 'available';
    let forecastMessage = null;
    let forecastReason = null;
    const dataCoverage = Math.round((activeDaysCount / ANALYSIS_WORKING_DAYS) * 100);

    if (totalEventsInWindow === 0) {
      // No exits detected at all
      forecastStatus = 'unavailable';
      forecastMessage = 'No Stage Exits Detected';
      forecastReason = `No transition events found for ${targetStage} during the ${ANALYSIS_WORKING_DAYS}-day analysis window.`;
    } else if (activeDaysCount < 3) {
      // Insufficient throughput history
      forecastStatus = 'unavailable';
      forecastMessage = 'Insufficient Throughput History';
      forecastReason = `Only ${totalEventsInWindow} transition event${totalEventsInWindow > 1 ? 's' : ''} found across ${activeDaysCount} day${activeDaysCount > 1 ? 's' : ''} during analysis window.`;
    } else if (finalConfidence < 30) {
      // Low confidence warning
      forecastStatus = 'low_confidence';
      forecastMessage = 'Low Confidence Forecast';
      forecastReason = `Data coverage is ${dataCoverage}% with high variability (CV: ${cv.toFixed(2)}). Results should be treated as estimates.`;
    } else if (med === 0 && p90 === 0) {
      // Historical data insufficient for median/p90
      forecastStatus = 'unavailable';
      forecastMessage = 'Historical Data Not Available';
      forecastReason = `Throughput data is sparse — median and P90 throughput are both 0 for ${targetStage}.`;
    }

    results.push({
      stage: targetStage,
      currentQueue,
      bestDays,
      expectedDays,
      worstDays,
      expectedClearanceDate: expectedClearanceDate || null,
      p90Throughput: Math.round(p90 * 10) / 10,
      medianThroughput: Math.round(med * 10) / 10,
      p10Throughput: Math.round(p10 * 10) / 10,

      // V3 Confidence (Section 2)
      confidence: finalConfidence,
      confidenceLabel,
      confidenceGrade,
      confidenceBreakdown: {
        activityScore: Math.round(activityScore),
        consistencyScore: Math.round(consistencyScore),
        volumeScore: Math.round(volumeScore),
        activeDays: activeDaysCount,
        totalDays: ANALYSIS_WORKING_DAYS,
        totalEvents: totalEventsInWindow,
        cv: Math.round(cv * 100) / 100
      },

      // V2 Messaging (Section 3)
      forecastStatus,
      forecastMessage,
      forecastReason,
      dataCoverage,
      sampleSize: totalEventsInWindow,

      // Backward compat
      basedOnDays: ANALYSIS_WORKING_DAYS,
      daysWithData: activeDaysCount
    });
  }

  results.sort((a, b) => b.currentQueue - a.currentQueue);

  return {
    forecasts: results,
    metadata: {
      basedOnDays: ANALYSIS_WORKING_DAYS,
      stagesAnalyzed: results.length,
      confidenceModel: 'V3 — Activity(40%) + Consistency(30%) + Volume(30%)'
    }
  };
}

module.exports = { calculateQueueForecast };
