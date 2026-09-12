const {
  workingDaysBetween,
  parseDateTime,
  dateDiff,
  isSCComplete,
  getSCLastTimestamp,
  PROCESS_TEMPLATES_SUMMARY
} = require('../../utils/calculationUtils.cjs');

function calculateCycleTimes({ filtered, scGroups, todayStr }) {
  const currentIso = todayStr || new Date().toISOString().substring(0, 10);

  const scRecordMap = {};
  const stageCounts = {};
  filtered.forEach((r) => {
    if (r.currentStage) {
      stageCounts[r.currentStage] = (stageCounts[r.currentStage] || 0) + 1;
    }
    if (!r.sc) return;
    if (!scRecordMap[r.sc]) scRecordMap[r.sc] = [];
    scRecordMap[r.sc].push(r);
  });

  const stageDurations = {};
  Object.values(scRecordMap).forEach((records) => {
    const sorted = records
      .filter((r) => r.timestamp)
      .sort((a, b) => {
        const tA = parseDateTime(a.timestamp) || new Date(0);
        const tB = parseDateTime(b.timestamp) || new Date(0);
        return tA - tB;
      });

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.currentStage || !current.timestamp || !next.timestamp) continue;
      const daysDiff = workingDaysBetween(
        current.timestamp.substring(0, 10),
        next.timestamp.substring(0, 10)
      );
      if (daysDiff >= 0) {
        const stage = current.currentStage;
        if (!stageDurations[stage]) stageDurations[stage] = [];
        stageDurations[stage].push(daysDiff);
      }
    }
  });

  const stageAccum = {};
  filtered.forEach((r) => {
    if (!r.currentStage || !r.poDate) return;
    const stage = r.currentStage;
    const effectiveTs = r.timestamp ? r.timestamp.substring(0, 10) : currentIso;
    const days = dateDiff(r.poDate, effectiveTs);
    if (days !== null && days >= 0) {
      if (!stageAccum[stage]) stageAccum[stage] = [];
      stageAccum[stage].push(days);
    }
  });

  const stageAvgToReach = {};
  Object.entries(stageAccum).forEach(([stage, vals]) => {
    stageAvgToReach[stage] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  const stageAvgDuration = {};
  Object.keys(stageCounts).forEach((stage) => {
    if (stageDurations[stage] && stageDurations[stage].length > 0) {
      const avg = stageDurations[stage].reduce((a, b) => a + b, 0) / stageDurations[stage].length;
      stageAvgDuration[stage] = Math.max(1, Math.round(avg));
    } else {
      const matchingItems = filtered.filter((r) => r.currentStage === stage);
      let avgDays = 3;
      if (matchingItems.length > 0) {
        const itemTemplates = matchingItems
          .map((it) => it.template && PROCESS_TEMPLATES_SUMMARY[it.template])
          .filter(Boolean);
        if (itemTemplates.length > 0) {
          avgDays = Math.round(
            itemTemplates.reduce((sum, t) => sum + (t.daysPerProcess || 3), 0) / itemTemplates.length
          );
        }
      }
      stageAvgDuration[stage] = Math.max(1, avgDays);
    }
  });

  const stageCycleTimes = Object.entries(stageAvgDuration)
    .map(([stage, duration]) => {
      const avgToReach = stageAvgToReach[stage] !== undefined ? stageAvgToReach[stage] : duration;
      const count = stageCounts[stage] || 0;
      return { stage, avgToReach, duration, count };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => a.avgToReach - b.avgToReach);

  const itemCycleDays = filtered
    .map((r) => {
      if (!r.poDate) return null;
      const done = ['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA'].includes(r.currentStage);
      const targetTs = r.timestamp
        ? r.timestamp.substring(0, 10)
        : done
          ? r.projectedDate || currentIso
          : currentIso;
      return dateDiff(r.poDate, targetTs);
    })
    .filter((d) => d !== null && d >= 0);

  const avgOverallCycle =
    itemCycleDays.length > 0
      ? Math.round(itemCycleDays.reduce((a, b) => a + b, 0) / itemCycleDays.length)
      : null;

  const scCompletion = (scGroups || []).map((sg) => {
    const done = isSCComplete(sg.items);
    const lastTs = getSCLastTimestamp(sg.items);
    const days = dateDiff(sg.poDate, lastTs || currentIso);
    return { ...sg, done, lastTs, days };
  });

  return {
    stageCycleTimes,
    stageAvgToReach,
    avgOverallCycle,
    scCompletion,
  };
}

module.exports = { calculateCycleTimes };
