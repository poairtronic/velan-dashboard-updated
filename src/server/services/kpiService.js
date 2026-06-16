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

  const { getProductCategory, AIRPLUG_TYPES, MASTER_TYPES } = require('../utils/calculationUtils');

  const dailyOutput = {};
  const categoryCounts = { AIRPLUG: 0, MASTER: 0, ACCESSORY: 0 };
  let airplugOutputCount = 0;
  let masterOutputCount = 0;

  filtered.forEach((row) => {
    // Categories
    const cat = getProductCategory(row.type);
    categoryCounts[cat]++;

    // Airplug / Master output
    if (['READY', 'STORES'].includes(row.currentStage)) {
      if (AIRPLUG_TYPES.includes(row.type)) airplugOutputCount++;
      if (MASTER_TYPES.includes(row.type)) masterOutputCount++;
    }

    // Daily output
    if (!row.timestamp) return;
    const date = row.timestamp.substring(0, 10);
    if (!dailyOutput[date]) dailyOutput[date] = { date, ready: 0, stores: 0, wip: 0 };
    if (row.currentStage === 'READY') dailyOutput[date].ready++;
    else if (row.currentStage === 'STORES') dailyOutput[date].stores++;
    else dailyOutput[date].wip++;
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

  // Overview Stats Calculations
  const poGroupsLive = {};
  filtered.forEach((item) => {
    if (!item.po) return;
    if (!poGroupsLive[item.po]) poGroupsLive[item.po] = [];
    poGroupsLive[item.po].push(item);
  });

  function groupByPO(items) {
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.po]) grouped[item.po] = [];
      grouped[item.po].push(item);
    });
    return Object.entries(grouped).map(([po, poItems]) => ({
      po,
      scs: [...new Set(poItems.map((i) => i.sc))],
      items: poItems,
      count: poItems.length,
    }));
  }

  const dailySetPOsRaw = Object.entries(poGroupsLive).filter(([po, items]) => {
    const allDone = items.every((i) =>
      ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)
    );
    const completedToday = items.some(
      (i) => i.timestamp && i.timestamp.slice(0, 10) === todayStr
    );
    return allDone && completedToday;
  });
  const dailySetItems = dailySetPOsRaw.flatMap(([_, items]) => items);

  const delayedPOItems = filtered.filter((i) => {
    if (['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)) return false;
    if (!i.poDate) return false;
    const days = require('../utils/calculationUtils').workingDaysBetween(i.poDate, todayStr);
    return days !== null && days > 21;
  });

  const inProgressItems = filtered.filter((i) => {
    if (['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)) return false;
    const days = i.poDate ? require('../utils/calculationUtils').workingDaysBetween(i.poDate, todayStr) : null;
    return days === null || days <= 21;
  });

  const readyItemsRaw = filtered.filter((i) => i.currentStage === 'READY');

  const overviewStats = {
    dailySetItemsCount: dailySetItems.length,
    delayedPOItemsCount: delayedPOItems.length,
    inProgressItemsCount: inProgressItems.length,
    dailyPOs: groupByPO(dailySetItems),
    delayedPOsModal: groupByPO(delayedPOItems),
    inProgressPOs: groupByPO(inProgressItems),
    readyPOs: groupByPO(readyItemsRaw),
  };

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
    categoryCounts,
    airplugOutputCount,
    masterOutputCount,
    scDailyOutput,
    completeSets,
    storeSets,
    readySets,
    delayedPOs,
    onTimePOs,
    overviewStats,
  };
}

module.exports = { calculateKPIs };
