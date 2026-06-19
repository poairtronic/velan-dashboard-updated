import { useMemo } from 'react';
import calculationUtils from '../utils/calculationUtils';
const { workingDaysBetween,
  daysBetween,
  isSCComplete,
  getSCLastTimestamp,
  TARGET_DAYS,
  parseDateTime,
 } = calculationUtils;

export function useKPIs(filtered, scGroups, poGroups, liveData, todayStr) {
  return useMemo(() => {
    const totalItems = filtered.length;

    // We will do a single unified pass over 'filtered' for all item-level stats
    const filteredScGroupsMap = {};
    const scRecordMap = {};
    const stageWIP = {};
    const stageCounts = {};
    const dailyOutput = {};
    const stageAccum = {};
    const poGroupsLive = {};

    let wipCount = 0;
    let inhouseCount = 0;
    let vendorCount = 0;

    const terminalStages = new Set(['READY', 'STORES', 'STOCK', 'EXSTOCK']);

    filtered.forEach((row) => {
      const stage = row.currentStage;
      const isTerminal = terminalStages.has(stage);

      // SC grouping (for readySets/storeSets/completeSets/stageDurations)
      if (row.sc) {
        if (!filteredScGroupsMap[row.sc]) {
          filteredScGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, items: [] };
        }
        filteredScGroupsMap[row.sc].items.push(row);

        if (!scRecordMap[row.sc]) scRecordMap[row.sc] = [];
        scRecordMap[row.sc].push(row);
      }

      // PO grouping (for Overview Stats)
      if (row.po) {
        if (!poGroupsLive[row.po]) poGroupsLive[row.po] = [];
        poGroupsLive[row.po].push(row);
      }

      // WIP / Inhouse / Vendor counts
      if (!isTerminal) wipCount++;
      if (row.inhouse === 'INHOUSE') inhouseCount++;
      if (row.inhouse === 'VENDOR') vendorCount++;

      // Stage WIP and Counts
      if (stage) {
        stageWIP[stage] = (stageWIP[stage] || 0) + 1;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      }

      // Daily Output
      if (row.timestamp) {
        const date = row.timestamp.substring(0, 10);
        if (!dailyOutput[date]) dailyOutput[date] = { date, ready: 0, stores: 0 };
        if (stage === 'READY') dailyOutput[date].ready++;
        if (stage === 'STORES') dailyOutput[date].stores++;
      }

      // Stage Accumulation
      if (row.timestamp && row.poDate && stage) {
        const poD = row.poDate;
        const tsS = row.timestamp;
        const d = workingDaysBetween(poD, tsS);
        if (d !== null && d >= 0) {
          if (!stageAccum[stage]) stageAccum[stage] = [];
          stageAccum[stage].push(d);
        }
      }
    });

    const filteredScGroups = Object.values(filteredScGroupsMap);
    let readyCount = 0;
    let storesCount = 0;
    const completeSets = [];
    const storeSetsArr = [];
    const readySetsArr = [];

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

    // poGroups single pass
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

    // scGroups single pass
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

    // Stage Durations & Cycle Times
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
      const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      stageAvgDuration[stage] = Math.round(avg);
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
      .map((r) => {
        if (!r.poDate || !r.timestamp) return null;
        const d = workingDaysBetween(r.poDate, r.timestamp);
        return d !== null && d >= 0 ? d : null;
      })
      .filter((d) => d !== null);

    const avgOverallCycle = itemCycleDays.length > 0
      ? Math.round(itemCycleDays.reduce((a, b) => a + b, 0) / itemCycleDays.length)
      : null;

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
      stageCounts,
      stageWIP,
      dailyOutputArray,
      scDailyOutput,
      completeSets,
      storeSets: storeSetsArr,
      readySets: readySetsArr,
      delayedPOs,
      onTimePOs,
      stageCycleTimes,
      avgOverallCycle,
    };
  }, [filtered, scGroups, poGroups, todayStr]);
}
