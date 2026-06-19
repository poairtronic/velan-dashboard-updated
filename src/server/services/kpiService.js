const { getSCLastTimestamp, daysBetween, isSCComplete, TARGET_DAYS } = require('../utils/calculationUtils');

function calculateKPIs({ filtered, scGroups, poGroups, todayStr }) {
  const totalItems = filtered.length;

  const filteredScGroupsMap = {};
  const stageWIP = {};
  const stageCounts = {};
  const dailyOutput = {};
  const poGroupsLive = {};

  const categoryCounts = { AIRPLUG: 0, MASTER: 0, ACCESSORY: 0 };
  let airplugOutputCount = 0;
  let masterOutputCount = 0;

  let wipCount = 0;
  let inhouseCount = 0;
  let vendorCount = 0;

  const terminalStages = new Set(['READY', 'STORES', 'STOCK', 'EXSTOCK']);
  const { getProductCategory, AIRPLUG_TYPES, MASTER_TYPES } = require('../utils/calculationUtils');

  filtered.forEach((row) => {
    const stage = row.currentStage;
    const isTerminal = terminalStages.has(stage);

    // SC grouping
    if (row.sc) {
      if (!filteredScGroupsMap[row.sc]) {
        filteredScGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, items: [] };
      }
      filteredScGroupsMap[row.sc].items.push(row);
    }

    // PO grouping
    if (row.po) {
      if (!poGroupsLive[row.po]) poGroupsLive[row.po] = [];
      poGroupsLive[row.po].push(row);
    }

    // Categories
    const cat = getProductCategory(row.type);
    categoryCounts[cat]++;

    // WIP / Inhouse / Vendor
    if (!isTerminal) wipCount++;
    if (row.inhouse === 'INHOUSE') inhouseCount++;
    if (row.inhouse === 'VENDOR') vendorCount++;

    // Stage Counts
    if (stage) {
      stageWIP[stage] = (stageWIP[stage] || 0) + 1;
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }

    // Output Count
    if (stage === 'READY' || stage === 'STORES') {
      if (AIRPLUG_TYPES.includes(row.type)) airplugOutputCount++;
      if (MASTER_TYPES.includes(row.type)) masterOutputCount++;
    }

    // Daily Output
    if (row.timestamp) {
      const date = row.timestamp.substring(0, 10);
      if (!dailyOutput[date]) dailyOutput[date] = { date, ready: 0, stores: 0, wip: 0 };
      if (stage === 'READY') dailyOutput[date].ready++;
      else if (stage === 'STORES') dailyOutput[date].stores++;
      else dailyOutput[date].wip++;
    }
  });

  const filteredScGroups = Object.values(filteredScGroupsMap);
  let readyCount = 0;
  let storesCount = 0;
  const completeSets = [];
  const readySetsArr = [];
  const storeSetsArr = [];

  filteredScGroups.forEach((sg) => {
    const isReady = sg.items.every((i) => i.currentStage === 'READY');
    const isStore = sg.items.every((i) => i.currentStage === 'STORES');
    const isComplete = sg.items.every((i) => terminalStages.has(i.currentStage));

    if (isReady) {
      readyCount++;
      readySetsArr.push(sg);
    }
    if (isStore) {
      storesCount++;
      storeSetsArr.push(sg);
    }
    if (isComplete) completeSets.push(sg);
  });

  let onTime = 0, delayed = 0, completedPOCount = 0;
  const onTimePOs = [], delayedPOs = [];

  poGroups.forEach((pg) => {
    const lastTs = getSCLastTimestamp(pg.items);
    const allDone = pg.items.every((i) => terminalStages.has(i.currentStage));

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

  const onTimePct = completedPOCount > 0 ? Math.round((onTime / completedPOCount) * 100) : 0;
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
    const allDone = items.every((i) => terminalStages.has(i.currentStage));
    const completedToday = items.some((i) => i.timestamp && i.timestamp.slice(0, 10) === todayStr);
    return allDone && completedToday;
  });
  const dailySetItems = dailySetPOsRaw.flatMap(([_, items]) => items);

  const delayedPOItems = filtered.filter((i) => {
    if (terminalStages.has(i.currentStage)) return false;
    if (!i.poDate) return false;
    const days = require('../utils/calculationUtils').workingDaysBetween(i.poDate, todayStr);
    return days !== null && days > 21;
  });

  const inProgressItems = filtered.filter((i) => {
    if (terminalStages.has(i.currentStage)) return false;
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
    ready: readyCount,
    stores: storesCount,
    wip: wipCount,
    inhouse: inhouseCount,
    vendor: vendorCount,
    onTime,
    delayed,
    onTimePct,
    totalPOs: poGroups.length,
    dailyOutput,
    dailyOutputArray,
    categoryCounts,
    airplugOutputCount,
    masterOutputCount,
    scDailyOutput,
    completeSets,
    storeSets: storeSetsArr,
    readySets: readySetsArr,
    delayedPOs,
    onTimePOs,
    overviewStats,
  };
}

module.exports = { calculateKPIs };
