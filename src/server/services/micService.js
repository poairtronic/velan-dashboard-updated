const { getSCLastTimestamp, daysBetween, workingDaysBetween, isSCComplete, TARGET_DAYS } = require('../utils/calculationUtils');
const { calculateKPIs } = require('./kpiService');
const { calculateStages } = require('./stageService');
const { calculateCycleTimes } = require('./cycleTimeService');
const { calculateVendors } = require('./vendorService');
const { calculateBottlenecks } = require('./bottleneckService');

// Helper for aging classification
function classifyAging(days) {
  if (days > 30) return 'Dead';
  if (days > 10) return 'Slow';
  return 'Fast';
}

function calculateMIC({ filtered, scGroups, poGroups, todayStr }) {
  // Leverage existing calculations to ensure consistency
  const kpis = calculateKPIs({ filtered, scGroups, poGroups, todayStr });
  const stages = calculateStages({ filtered, poGroups, todayStr });
  const cycleTimes = calculateCycleTimes({ filtered, scGroups });
  const vendors = calculateVendors({ filtered, todayStr });
  const bottlenecks = calculateBottlenecks({
    poGroups,
    todayStr,
    stageCounts: stages.stageCounts,
    stageCycleTimes: cycleTimes.stageCycleTimes,
    vendorStats: vendors.vendorStats,
  });

  // --- 1. Plant Health Score ---
  // Efficiency (40%), SLA (20%), Vendor (20%), Bottleneck (20%)
  const efficiencyScore = Math.min(kpis.onTimePct || 0, 100);
  
  // SLA Performance: % of WIP not delayed
  const wipCount = kpis.overviewStats?.inProgressItemsCount || 0;
  const delayedPOItemsCount = kpis.overviewStats?.delayedPOItemsCount || 0;
  const slaScore = wipCount > 0 ? Math.max(0, 100 - (delayedPOItemsCount / wipCount) * 100) : 100;

  // Vendor Performance: % of vendor items not delayed
  let highRiskVendors = 0;
  const vendorScores = (vendors.vendors || []).map(v => {
    if (v.avgDays > 21) highRiskVendors++;
    return v.avgDays > 21 ? 0 : (v.avgDays > 14 ? 50 : 100);
  });
  const avgVendorScore = vendorScores.length > 0 ? vendorScores.reduce((a, b) => a + b, 0) / vendorScores.length : 100;
  
  // Bottleneck Severity: 100 - top bottleneck score
  const topBottleneck = bottlenecks.bottleneckStages && bottlenecks.bottleneckStages.length > 0 ? bottlenecks.bottleneckStages[0].score : 0;
  const bottleneckScore = Math.max(0, 100 - topBottleneck);

  const plantHealthScore = Math.round(
    (efficiencyScore * 0.4) +
    (slaScore * 0.2) +
    (avgVendorScore * 0.2) +
    (bottleneckScore * 0.2)
  );

  const healthIndicator = plantHealthScore >= 80 ? 'Green' : (plantHealthScore >= 60 ? 'Yellow' : 'Red');

  // --- 2. Production Efficiency Intelligence ---
  const plannedOutput = Math.round(poGroups.length * 0.85); // Dummy baseline if 100% is too idealistic, using 85% as 'planned'
  const actualOutput = kpis.onTime + kpis.delayed;
  const gapAnalysis = {
    planned: plannedOutput,
    actual: actualOutput,
    efficiencyPct: plannedOutput > 0 ? Math.round((actualOutput / plannedOutput) * 100) : 100,
    gap: Math.max(0, plannedOutput - actualOutput)
  };

  // --- 3. Predictive Delay Engine ---
  const predictions = [];
  poGroups.forEach(pg => {
    const elapsed = daysBetween(pg.poDate, todayStr);
    const allDone = pg.items.every(i => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage));
    if (!allDone && elapsed !== null && elapsed > 15 && elapsed <= 21) {
      // At risk of delay
      const expectedDelay = (elapsed + 7) - 21; // Naive projection based on elapsed
      predictions.push({
        po: pg.po,
        currentAge: elapsed,
        expectedDelay: expectedDelay > 0 ? expectedDelay : 2,
        expectedCompletion: new Date(new Date().setDate(new Date().getDate() + (21 - elapsed + 4))).toISOString().split('T')[0]
      });
    }
  });

  // --- 4. Root Cause Analytics ---
  const rootCauses = {
    Vendor: 0,
    Inspection: 0,
    Processing: 0,
    Inventory: 0
  };
  
  filtered.forEach(item => {
    if (!item.poDate) return;
    const age = workingDaysBetween(item.poDate, todayStr);
    if (age > 21 && !['STOCK', 'EXSTOCK'].includes(item.currentStage)) {
      if (item.currentStage.endsWith('V')) rootCauses.Vendor++;
      else if (item.currentStage === 'I' || item.currentStage === 'FI') rootCauses.Inspection++;
      else if (['READY', 'STORES'].includes(item.currentStage)) rootCauses.Inventory++;
      else rootCauses.Processing++;
    }
  });

  const totalDelays = Object.values(rootCauses).reduce((a, b) => a + b, 0);
  const rootCauseAnalytics = Object.entries(rootCauses).map(([cause, count]) => ({
    cause,
    count,
    contribution: totalDelays > 0 ? Math.round((count / totalDelays) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // --- 5. Capacity Planning Engine ---
  const capacityPlanning = Object.entries(stages.stageCounts).map(([stage, count]) => {
    // Estimate historical max capacity as a static 50 for simplicity if not available, or use current count + 20
    const historicalMax = Math.max(50, count * 1.5); 
    const utilization = Math.round((count / historicalMax) * 100);
    return {
      stage,
      queue: count,
      capacity: Math.round(historicalMax),
      utilization,
      riskLevel: utilization > 80 ? 'High' : (utilization > 50 ? 'Medium' : 'Low')
    };
  }).sort((a, b) => b.utilization - a.utilization);

  // --- 6. Vendor Risk Intelligence ---
  const vendorRisk = (vendors.vendors || []).map(v => {
    return {
      vendor: v.code || v.vendor,
      count: v.count,
      avgDays: v.avgDays,
      delayProbability: v.avgDays > 14 ? Math.min(100, Math.round((v.avgDays / 21) * 100)) : 10,
      trend: v.avgDays > 18 ? 'Declining' : (v.avgDays < 10 ? 'Improving' : 'Stable'),
      slaRisk: v.avgDays > 21 ? 'High' : (v.avgDays > 14 ? 'Medium' : 'Low')
    };
  }).sort((a, b) => b.delayProbability - a.delayProbability);

  // --- 7. Inventory Intelligence ---
  const inventoryCounts = { Dead: 0, Slow: 0, Fast: 0 };
  const inventoryItems = filtered.filter(i => ['READY', 'STORES'].includes(i.currentStage));
  
  inventoryItems.forEach(item => {
    const age = item.timestamp ? workingDaysBetween(item.timestamp, todayStr) : 0;
    const cat = classifyAging(age || 0);
    inventoryCounts[cat]++;
  });

  const inventoryIntelligence = {
    total: inventoryItems.length,
    breakdown: [
      { category: 'Dead (>30d)', count: inventoryCounts.Dead, risk: 'High' },
      { category: 'Slow (10-30d)', count: inventoryCounts.Slow, risk: 'Medium' },
      { category: 'Fast (<10d)', count: inventoryCounts.Fast, risk: 'Low' }
    ]
  };

  // --- 8. Executive Action Center ---
  const recommendedActions = [];
  
  if (topBottleneck > 70 && bottlenecks.bottleneckStages[0]) {
    recommendedActions.push({
      priority: 'High',
      action: `Relieve Bottleneck at ${bottlenecks.bottleneckStages[0].stage}`,
      reason: `Severity score is ${Math.round(topBottleneck)}. This is the primary plant bottleneck.`,
      impact: 'Will improve overall plant efficiency and reduce downstream starvation.',
      area: 'Production'
    });
  }

  if (highRiskVendors > 0) {
    recommendedActions.push({
      priority: 'High',
      action: `Review High-Risk Vendors`,
      reason: `${highRiskVendors} vendors are currently averaging >21 days processing time.`,
      impact: 'Mitigates SLA breaches for outsourced components.',
      area: 'Vendor Management'
    });
  }

  if (inventoryCounts.Dead > 0) {
    recommendedActions.push({
      priority: 'Medium',
      action: `Clear Dead Inventory`,
      reason: `${inventoryCounts.Dead} items have been sitting in READY/STORES for over 30 days.`,
      impact: 'Frees up warehouse space and unlocks tied-up capital.',
      area: 'Inventory'
    });
  }

  if (predictions.length > 0) {
    recommendedActions.push({
      priority: 'High',
      action: `Expedite ${predictions.length} At-Risk POs`,
      reason: 'These POs are between 15-21 days old and risk breaching SLA soon.',
      impact: 'Protects On-Time Delivery KPI and Plant Health Score.',
      area: 'Operations'
    });
  }
  
  if (recommendedActions.length === 0) {
    recommendedActions.push({
      priority: 'Low',
      action: 'Maintain Current Operations',
      reason: 'All critical metrics are within healthy bounds.',
      impact: 'Sustains current efficiency levels.',
      area: 'General'
    });
  }

  return {
    plantHealth: {
      score: plantHealthScore,
      indicator: healthIndicator,
      components: {
        efficiency: efficiencyScore,
        sla: Math.round(slaScore),
        vendor: Math.round(avgVendorScore),
        bottleneck: Math.round(bottleneckScore)
      }
    },
    efficiency: gapAnalysis,
    predictions: predictions.slice(0, 10), // Top 10
    rootCause: rootCauseAnalytics,
    capacity: capacityPlanning,
    vendorRisk: vendorRisk.slice(0, 10), // Top 10
    inventory: inventoryIntelligence,
    actions: recommendedActions.slice(0, 10)
  };
}

module.exports = { calculateMIC };
