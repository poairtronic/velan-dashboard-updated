const { getSCLastTimestamp, daysBetween } = require('../utils/calculationUtils');

function calculateBottlenecks({ poGroups, todayStr, stageCounts, stageCycleTimes, vendorStats }) {
  const bottleneck = [...poGroups]
    .map((pg) => {
      const lastTs = getSCLastTimestamp(pg.items);
      const done = pg.items.every((i) =>
        ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)
      );
      const days = done ? daysBetween(pg.poDate, lastTs) : daysBetween(pg.poDate, todayStr);
      return { ...pg, days, done };
    })
    .sort((a, b) => (b.days || 0) - (a.days || 0));

  const bottleneckStages = Object.entries(stageCounts)
    .filter(([s]) => !['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s))
    .map(([stage, count]) => {
      const ct = stageCycleTimes.find((c) => c.stage === stage);
      const duration = ct ? ct.duration : 1;
      const score = count * duration;
      return { stage, count, duration, score };
    })
    .sort((a, b) => b.score - a.score);

  const vendorAvgPendingMap = {};
  Object.values(vendorStats || {}).forEach((s) => {
    if (s && s.vendor) vendorAvgPendingMap[s.vendor] = s.avgPending || 0;
  });

  const corrected = Object.entries(stageCounts)
    .filter(([s]) => !['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s))
    .map(([stage, count]) => {
      let duration;
      if (vendorAvgPendingMap[stage] !== undefined) {
        duration = vendorAvgPendingMap[stage] || 1;
      } else {
        const ct = stageCycleTimes.find((c) => c.stage === stage);
        duration = ct ? ct.duration : 1;
      }
      return { stage, count, duration, score: count * duration };
    })
    .sort((a, b) => b.score - a.score);

  bottleneckStages.length = 0;
  corrected.forEach((s) => bottleneckStages.push(s));
  
  const topBottleneckCorrected = bottleneckStages[0] || null;

  return {
    bottleneck,
    bottleneckStages,
    topBottleneck: topBottleneckCorrected
  };
}

module.exports = { calculateBottlenecks };
