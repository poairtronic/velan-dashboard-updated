const {
  workingDaysBetween,
  parseDateTime,
  dateDiff,
  isSCComplete,
  getSCLastTimestamp
} = require('../utils/calculationUtils');

function calculateCycleTimes({ filtered, scGroups }) {
  const scRecordMap = {};
  filtered.forEach((r) => {
    if (!r.sc) return;
    if (!scRecordMap[r.sc]) scRecordMap[r.sc] = [];
    scRecordMap[r.sc].push(r);
  });

  const stageDurations = {};
  Object.values(scRecordMap).forEach((records) => {
    const sorted = records.sort((a, b) => {
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

  const stageAvgDuration = {};
  Object.entries(stageDurations).forEach(([stage, durations]) => {
    const avg =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    stageAvgDuration[stage] = Math.round(avg);
  });

  const stageAccum = {};
  filtered.forEach((r) => {
    if (!r.timestamp || !r.poDate || !r.currentStage) return;
    const days = dateDiff(r.poDate, r.timestamp);
    if (days === null) return;
    if (!stageAccum[r.currentStage]) stageAccum[r.currentStage] = [];
    stageAccum[r.currentStage].push(days);
  });

  const stageAvgToReach = {};
  Object.entries(stageAccum).forEach(([stage, vals]) => {
    stageAvgToReach[stage] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  const stageCycleTimes = Object.entries(stageAvgDuration)
    .map(([stage, duration]) => {
      const avgToReach = stageAvgToReach[stage] || 0;
      const count = stageDurations[stage] ? stageDurations[stage].length : 0;
      return { stage, avgToReach, duration, count };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => a.avgToReach - b.avgToReach);

  const itemCycleDays = filtered
    .map((r) => dateDiff(r.poDate, r.timestamp))
    .filter((d) => d !== null && d >= 0);
  const avgOverallCycle =
    itemCycleDays.length > 0
      ? Math.round(itemCycleDays.reduce((a, b) => a + b, 0) / itemCycleDays.length)
      : null;

  const scCompletion = scGroups.map((sg) => {
    const done = isSCComplete(sg.items);
    const lastTs = getSCLastTimestamp(sg.items);
    const days = dateDiff(sg.poDate, lastTs);
    return { ...sg, done, lastTs, days };
  });

  return {
    stageCycleTimes,
    stageAvgToReach,
    avgOverallCycle,
    scCompletion
  };
}

module.exports = { calculateCycleTimes };
