const { dateDiff, TARGET_DAYS } = require('../../utils/calculationUtils.cjs');

function calculateVendors({ filtered, todayStr }) {
  const vendorStageData = [];
  filtered.forEach((r) => {
    if (r.inhouse !== 'VENDOR' || !r.timestamp) return;
    const daysFromPO = r.poDate ? dateDiff(r.poDate, r.timestamp) : null;
    const pendingDays = dateDiff(r.timestamp, todayStr);
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
      });
  });

  const vendorStats = {};
  vendorStageData.forEach((s) => {
    if (!vendorStats[s.vendor]) {
      vendorStats[s.vendor] = {
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
    vendorStats[s.vendor].items.push(s);
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

  const vendorTimeMap = {};
  filtered.forEach((r) => {
    if (r.inhouse !== 'VENDOR') return;
    const vcode = r.currentStage || 'UNKNOWN';
    if (!vendorTimeMap[vcode])
      vendorTimeMap[vcode] = { code: vcode, count: 0, items: [], days: [] };
    vendorTimeMap[vcode].count++;
    vendorTimeMap[vcode].items.push(r);
    const d = dateDiff(r.timestamp, todayStr);
    if (d !== null) vendorTimeMap[vcode].days.push(d);
  });
  const vendorTotal = Object.values(vendorTimeMap).reduce((s, v) => s + v.count, 0);
  const vendors = Object.values(vendorTimeMap)
    .sort((a, b) => b.count - a.count)
    .map((v) => {
      const avgDays =
        v.days.length > 0 ? Math.round(v.days.reduce((a, b) => a + b, 0) / v.days.length) : null;
      const maxDays = v.days.length > 0 ? Math.max(...v.days) : null;
      const delayed = v.items.filter((i) => {
        const d = dateDiff(i.timestamp, todayStr);
        return d !== null && d > TARGET_DAYS;
      }).length;
      const stats = vendorStats[v.code] || {};
      return {
        ...v,
        pct: Math.round((v.count / Math.max(vendorTotal, 1)) * 100),
        avgDays,
        maxDays,
        delayed,
        avgFromPO: stats.avgFromPO || null,
        slaViolations: stats.slaViolations || 0,
        slaViolationRate: stats.slaViolationRate || 0,
        processEfficiency: stats.processEfficiency || 0,
        avgActiveTime: stats.avgActiveTime || 0,
      };
    });

  return {
    vendorStats,
    topVendorBottleneck,
    vendors,
    vendorTotal
  };
}

module.exports = { calculateVendors };
