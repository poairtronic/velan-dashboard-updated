import { useMemo } from 'react';
import {
  workingDaysBetween,
  daysBetween,
  isSCComplete,
  getSCLastTimestamp,
  TARGET_DAYS,
  parseDateTime,
} from '../utils/calculationUtils';

export function useKPIs(filtered, scGroups, poGroups, liveData, todayStr) {
  return useMemo(() => {
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

    const today = todayStr;

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
        const elapsed = daysBetween(pg.poDate, today);
        if (elapsed !== null && elapsed > TARGET_DAYS) {
          delayed++;
          delayedPOs.push({ ...pg, days: elapsed, inProgress: true });
        }
      }
    });
    const totalPOs = poGroups.length;
    const onTimePct = completedPOCount > 0 ? Math.round((onTime / completedPOCount) * 100) : 0;

    const stageWIP = {};
    filtered.forEach((row) => {
      const stage = row.currentStage;
      if (!stageWIP[stage]) stageWIP[stage] = 0;
      stageWIP[stage]++;
    });

    const stageCounts = {};
    filtered.forEach((r) => {
      stageCounts[r.currentStage] = (stageCounts[r.currentStage] || 0) + 1;
    });

    const bottleneck = [...poGroups]
      .map((pg) => {
        const lastTs = getSCLastTimestamp(pg.items);
        const done = pg.items.every((i) =>
          ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage)
        );
        const days = done ? daysBetween(pg.poDate, lastTs) : daysBetween(pg.poDate, today);
        return { ...pg, days, done };
      })
      .sort((a, b) => (b.days || 0) - (a.days || 0));

    const dateDiff = (poDate, tsStr) => {
      if (!poDate || !tsStr) return null;
      const d = workingDaysBetween(poDate, tsStr);
      return d !== null && d >= 0 ? d : null;
    };

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

    const vendorStageData = [];
    filtered.forEach((r) => {
      if (r.inhouse !== 'VENDOR' || !r.timestamp) return;
      const daysFromPO = r.poDate ? dateDiff(r.poDate, r.timestamp) : null;
      const pendingDays = dateDiff(r.timestamp, today);
      if (pendingDays !== null)
        vendorStageData.push({
          vendor: r.currentStage || 'UNKNOWN',
          stage: r.currentStage,
          daysFromPO,
          pendingDays,
          po: r.po,
          sc: r.sc,
          product: r.product,
          timestamp: r.timestamp,
          item: r,
        });
    });

    const vendorStats = {};
    vendorStageData.forEach((s) => {
      if (!vendorStats[s.vendor]) {
        vendorStats[s.vendor] = {
          code: s.vendor,
          vendor: s.vendor,
          totalPending: 0,
          count: 0,
          pendingDays: [],
          totalFromPO: 0,
          fromPODays: [],
          items: [],
        };
      }
      vendorStats[s.vendor].totalPending += s.pendingDays;
      vendorStats[s.vendor].count++;
      vendorStats[s.vendor].pendingDays.push(s.pendingDays);
      if (s.daysFromPO !== null) {
        vendorStats[s.vendor].totalFromPO += s.daysFromPO;
        vendorStats[s.vendor].fromPODays.push(s.daysFromPO);
      }
      vendorStats[s.vendor].items.push(s.item);
    });

    Object.keys(vendorStats).forEach((v) => {
      const stats = vendorStats[v];
      stats.avgPending = stats.count > 0 ? Math.round(stats.totalPending / stats.count) : 0;
      stats.maxPending = stats.pendingDays.length > 0 ? Math.max(...stats.pendingDays) : 0;
      stats.minPending = stats.pendingDays.length > 0 ? Math.min(...stats.pendingDays) : 0;
      stats.stale = stats.pendingDays.filter((d) => d > TARGET_DAYS).length;
      stats.avgFromPO =
        stats.fromPODays.length > 0
          ? Math.round(stats.totalFromPO / stats.fromPODays.length)
          : null;

      stats.slaViolations = stats.pendingDays.filter((d) => d > 2).length;
      stats.slaViolationRate =
        stats.count > 0 ? Math.round((stats.slaViolations / stats.count) * 100) : 0;

      const completedItems = stats.items.filter((i) =>
        ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.stage)
      ).length;
      stats.processEfficiency =
        stats.count > 0 ? Math.round((completedItems / stats.count) * 100) : 0;

      stats.avgActiveTime = stats.avgPending;
    });

    const vendorBottlenecks = Object.values(vendorStats)
      .map((v) => ({
        vendor: v.vendor,
        count: v.count,
        avgPending: v.avgPending,
        maxPending: v.maxPending,
        slaViolations: v.slaViolations,
        efficiency: v.processEfficiency,
      }))
      .sort(
        (a, b) =>
          b.slaViolations - a.slaViolations || b.avgPending - a.avgPending || b.count - a.count
      );

    const topVendorBottleneck = vendorBottlenecks[0] || null;

    const bottleneckStages = Object.entries(stageCounts)
      .filter(([s]) => !['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(s))
      .map(([stage, count]) => {
        let duration;
        const vs = vendorStats[stage];
        if (vs && vs.avgPending !== undefined) {
          duration = vs.avgPending || 1;
        } else {
          const ct = stageCycleTimes.find((c) => c.stage === stage);
          duration = ct ? ct.duration : 1;
        }
        const score = count * duration;
        return { stage, count, duration, score };
      })
      .sort((a, b) => b.score - a.score);

    const topBottleneckCorrected = bottleneckStages[0] || null;

    const vendorTotal = Object.values(vendorStats).reduce((s, v) => s + v.count, 0);
    const vendors = Object.values(vendorStats)
      .sort((a, b) => b.count - a.count)
      .map((v) => {
        const delayed = v.items.filter((i) => {
          const d = dateDiff(i.timestamp, today);
          return d !== null && d > TARGET_DAYS;
        }).length;
        return {
          ...v,
          pct: Math.round((v.count / Math.max(vendorTotal, 1)) * 100),
          avgDays: v.avgPending,
          maxDays: v.maxPending,
          delayed,
          avgFromPO: v.avgFromPO || null,
          slaViolations: v.slaViolations || 0,
          slaViolationRate: v.slaViolationRate || 0,
          processEfficiency: v.processEfficiency || 0,
          avgActiveTime: v.avgActiveTime || 0,
          days: v.pendingDays,
        };
      });

    const scCompletion = scGroups.map((sg) => {
      const done = isSCComplete(sg.items);
      const lastTs = getSCLastTimestamp(sg.items);
      const days = dateDiff(sg.poDate, lastTs);
      return { ...sg, done, lastTs, days };
    });

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
      stageCounts,
      stageWIP,
      bottleneck,
      bottleneckStages,
      topBottleneck: topBottleneckCorrected,
      vendors,
      vendorTotal,
      vendorStats,
      topVendorBottleneck,
      stageCycleTimes,
      stageAvgToReach,
      avgOverallCycle,
      scCompletion,
      scDailyOutput,
      completeSets,
      storeSets,
      readySets,
      delayedPOs,
      onTimePOs,
      dailyOutput,
      dailyOutputArray,
    };
  }, [filtered, scGroups, poGroups, todayStr]);
}
