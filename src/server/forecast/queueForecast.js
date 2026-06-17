/**
 * Advanced Queue Forecast (Best/Expected/Worst Case)
 * Uses percentile throughput rates from the last 30 days.
 * All rates derived from historical timestamps — zero hardcoded assumptions.
 */

const TERMINAL_STAGES = ['READY', 'STORES', 'STOCK', 'EXSTOCK'];
const ANALYSIS_DAYS = 30;

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
}

function median(sortedArr) {
  return percentile(sortedArr, 50);
}

async function calculateQueueForecast({ liveRows, dbRows, stage }) {
  // 1. Get current queue size for the target stage (or all stages)
  const targetStages = stage
    ? [stage]
    : [...new Set(liveRows.map(r => r.currentStage).filter(s => s && !TERMINAL_STAGES.includes(s)))];

  const results = [];

  for (const targetStage of targetStages) {
    const currentQueue = liveRows.filter(r => r.currentStage === targetStage).length;

    // 2. Calculate daily throughput (items leaving this stage per day) from historical data
    // Track stage transitions: items that were at targetStage and then appeared at a different stage
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

    // Count items leaving this stage per day
    const dailyThroughput = {};
    const today = new Date();

    // Initialize all days in the window
    for (let i = 0; i < ANALYSIS_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyThroughput[ds] = 0;
    }

    Object.values(itemHistory).forEach(history => {
      history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      for (let i = 0; i < history.length - 1; i++) {
        if (history[i].stage === targetStage && history[i + 1].stage !== targetStage) {
          // Item left this stage on the date of the next entry
          const exitDate = history[i + 1].dateStr;
          if (dailyThroughput[exitDate] !== undefined) {
            dailyThroughput[exitDate]++;
          }
        }
      }
    });

    const throughputValues = Object.values(dailyThroughput).sort((a, b) => a - b);
    const daysWithData = throughputValues.filter(v => v > 0).length;

    // 3. Calculate percentile throughput rates
    const p90 = percentile(throughputValues, 90);  // Best case (high throughput)
    const med = median(throughputValues);            // Expected case
    const p10 = percentile(throughputValues, 10);    // Worst case (low throughput)

    // 4. Calculate days to clear queue
    const bestDays = p90 > 0 ? Math.round(currentQueue / p90) : null;
    const expectedDays = med > 0 ? Math.round(currentQueue / med) : null;
    const worstDays = p10 > 0 ? Math.round(currentQueue / p10) : null;

    // 5. Confidence based on data density
    const confidence = Math.min(100, Math.max(10, Math.round((daysWithData / ANALYSIS_DAYS) * 100)));

    results.push({
      stage: targetStage,
      currentQueue,
      bestDays,
      expectedDays,
      worstDays,
      p90Throughput: Math.round(p90 * 10) / 10,
      medianThroughput: Math.round(med * 10) / 10,
      p10Throughput: Math.round(p10 * 10) / 10,
      basedOnDays: ANALYSIS_DAYS,
      daysWithData,
      confidence
    });
  }

  // Sort by current queue descending
  results.sort((a, b) => b.currentQueue - a.currentQueue);

  return {
    forecasts: results,
    metadata: {
      basedOnDays: ANALYSIS_DAYS,
      stagesAnalyzed: results.length
    }
  };
}

module.exports = { calculateQueueForecast };
