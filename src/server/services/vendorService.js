const { dateDiff, TARGET_DAYS, getVendorInfo, VENDOR_MAP } = require('../../utils/calculationUtils.cjs');

function calculateVendors({ filtered, todayStr }) {
  const currentIso = todayStr || new Date().toISOString().substring(0, 10);
  const vendorItemMap = {};

  (filtered || []).forEach((r) => {
    const vInfo = getVendorInfo(r);
    if (!vInfo || !vInfo.isVendor) return;

    const vendorKey = vInfo.code;
    if (!vendorItemMap[vendorKey]) {
      vendorItemMap[vendorKey] = {
        code: vInfo.code,
        name: vInfo.name,
        fullName: `${vInfo.name} (${vInfo.code})`,
        operation: vInfo.operation || r.currentStage || 'EXT',
        items: [],
        pendingDays: [],
        fromPODays: [],
      };
    }

    const effectiveTs = r.timestamp ? r.timestamp.substring(0, 10) : currentIso;
    const daysFromPO = r.poDate ? dateDiff(r.poDate, effectiveTs) : null;
    const pending = r.timestamp
      ? dateDiff(r.timestamp.substring(0, 10), currentIso)
      : (r.poDate ? dateDiff(r.poDate, currentIso) : 0);

    const pendingVal = pending !== null && pending >= 0 ? pending : 0;

    vendorItemMap[vendorKey].items.push(r);
    vendorItemMap[vendorKey].pendingDays.push(pendingVal);
    if (daysFromPO !== null && daysFromPO >= 0) {
      vendorItemMap[vendorKey].fromPODays.push(daysFromPO);
    }
  });

  const vendorTotal = Object.values(vendorItemMap).reduce((s, v) => s + v.items.length, 0);

  const vendorStats = {};
  const vendors = Object.values(vendorItemMap)
    .sort((a, b) => b.items.length - a.items.length)
    .map((v) => {
      const count = v.items.length;
      const totalPending = v.pendingDays.reduce((a, b) => a + b, 0);
      const avgDays = count > 0 ? Math.round(totalPending / count) : 0;
      const maxDays = v.pendingDays.length > 0 ? Math.max(...v.pendingDays) : 0;
      const minDays = v.pendingDays.length > 0 ? Math.min(...v.pendingDays) : 0;
      const delayed = v.pendingDays.filter((d) => d > TARGET_DAYS).length;
      const slaViolations = v.pendingDays.filter((d) => d > 2).length;
      const slaViolationRate = count > 0 ? Math.round((slaViolations / count) * 100) : 0;

      const completedItems = v.items.filter((i) =>
        ['READY', 'STORES', 'STOCK', 'EXSTOCK', 'VA'].includes(i.currentStage)
      ).length;
      const processEfficiency = count > 0 ? Math.round((completedItems / count) * 100) : 0;

      const totalFromPO = v.fromPODays.reduce((a, b) => a + b, 0);
      const avgFromPO = v.fromPODays.length > 0 ? Math.round(totalFromPO / v.fromPODays.length) : avgDays;

      const statObj = {
        code: v.code,
        name: v.name,
        fullName: v.fullName,
        vendor: v.fullName,
        vendorName: v.name,
        operation: v.operation,
        count,
        pct: Math.round((count / Math.max(vendorTotal, 1)) * 100),
        avgDays,
        maxDays,
        minDays,
        delayed,
        avgFromPO,
        slaViolations,
        slaViolationRate,
        processEfficiency,
        avgActiveTime: avgDays,
        items: v.items,
      };

      vendorStats[v.code] = statObj;
      vendorStats[v.fullName] = statObj;
      vendorStats[v.name] = statObj;

      return statObj;
    });

  const vendorBottlenecks = [...vendors].sort(
    (a, b) =>
      b.slaViolations - a.slaViolations || b.avgDays - a.avgDays || b.count - a.count
  );

  const topVendorBottleneck = vendorBottlenecks[0] || null;

  return {
    vendorStats,
    topVendorBottleneck,
    vendors,
    vendorTotal,
  };
}

module.exports = { calculateVendors };
