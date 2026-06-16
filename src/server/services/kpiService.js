const { getSCLastTimestamp, daysBetween, isSCComplete, TARGET_DAYS } = require('../utils/calculationUtils');

function calculateKPIs({ filtered, scGroups, poGroups, todayStr }) {
  const totalItems = filtered.length;

  const filteredScGroupsMap = {};
  filtered.forEach((row) => {
    if (!row.sc) return;
    if (!filteredScGroupsMap[row.sc]) {
      filteredScGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, items: [] };
    }
    filteredScGroupsMap[row.sc].items.push(row);
  });
  const filteredScGroups = Object.values(filteredScGroupsMap);

  const readySets = filteredScGroups.filter((sg) =>
    sg.items.every((i) => i.currentStage === 'READY')
  );
  const ready = readySets.length;

  const storeSets = filteredScGroups.filter((sg) =>
    sg.items.every((i) => i.currentStage === 'STORES')
  );
  const stores = storeSets.length;

  const wip = filtered.filter(
    (r) => !['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(r.currentStage)
  ).length;
  const inhouse = filtered.filter((r) => r.inhouse === 'INHOUSE').length;
  const vendor = filtered.filter((r) => r.inhouse === 'VENDOR').length;

  let onTime = 0,
    delayed = 0,
    onTimePOs = [],
    delayedPOs = [],
    completedPOCount = 0;

  poGroups.forEach((pg) => {
    const lastTs = getSCLastTimestamp(pg.items);
    const allDone = pg.items.every((i) =>
      ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)
    );
    if (allDone) {
      completedPOCount++;
      const days = daysBetween(pg.poDate, lastTs);
      if (days !== null && days <= TARGET_DAYS) {
        onTime++;
        onTimePOs.push({ ...pg, days });
      } else {
        delayed++;
        delayedPOs.push({ ...pg, days });
      }
    } else {
      const elapsed = daysBetween(pg.poDate, todayStr);
      if (elapsed !== null && elapsed > TARGET_DAYS) {
        delayed++;
        delayedPOs.push({ ...pg, days: elapsed, inProgress: true });
      }
    }
  });

  const totalPOs = poGroups.length;
  const onTimePct = completedPOCount > 0 ? Math.round((onTime / completedPOCount) * 100) : 0;

  const dailyOutput = {};
  filtered.forEach((row) => {
    if (!row.timestamp) return;
    const date = row.timestamp.substring(0, 10);
    if (!dailyOutput[date]) dailyOutput[date] = { date, ready: 0, stores: 0 };
    if (row.currentStage === 'READY') dailyOutput[date].ready++;
    if (row.currentStage === 'STORES') dailyOutput[date].stores++;
  });
  const dailyOutputArray = Object.values(dailyOutput).sort((a, b) => (a.date > b.date ? 1 : -1));

  const scByDate = {};
  scGroups.forEach((sg) => {
    const done = isSCComplete(sg.items);
    const lastTs = getSCLastTimestamp(sg.items);
    if (!lastTs) return;
    const d = lastTs.substring(0, 10);
    if (!scByDate[d]) scByDate[d] = { date: d, readySets: 0, storeSets: 0 };
    if (done) {
      const hasStores = sg.items.some((i) => i.currentStage === 'STORES');
      if (hasStores) scByDate[d].storeSets++;
      else scByDate[d].readySets++;
    }
  });
  const scDailyOutput = Object.values(scByDate).sort((a, b) => (a.date > b.date ? 1 : -1));

  const completeSets = filteredScGroups.filter((sg) =>
    sg.items.every((i) => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage))
  );

  return {
    totalItems,
    ready,
    stores,
    wip,
    inhouse,
    vendor,
    onTime,
    delayed,
    onTimePct,
    totalPOs,
    dailyOutput,
    dailyOutputArray,
    scDailyOutput,
    completeSets,
    storeSets,
    readySets,
    delayedPOs,
    onTimePOs,
  };
}

module.exports = { calculateKPIs };
