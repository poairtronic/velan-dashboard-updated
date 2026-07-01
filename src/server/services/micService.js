const { workingDaysBetween5Day, addWorkingDays5Day, TARGET_DAYS } = require('../../utils/calculationUtils.cjs');
const { calculateKPIs } = require('./kpiService');
const { calculateStages } = require('./stageService');
const { calculateCycleTimes } = require('./cycleTimeService');
const { calculateVendors } = require('./vendorService');
const { calculateBottlenecks } = require('./bottleneckService');



function getTrend(current, past, higherIsBetter = true) {
  if (current === past) return 'Stable';
  if (current > past) return higherIsBetter ? 'Improving' : 'Declining';
  return higherIsBetter ? 'Declining' : 'Improving';
}

function getVariance(current, past) {
  if (past === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - past) / past) * 100);
}

function filterByDays(items, todayStr, maxDays, minDays = 0) {
  return items.filter(item => {
    if (!item.timestamp) return false;
    const age = workingDaysBetween5Day(item.timestamp, todayStr);
    return age >= minDays && age < maxDays;
  });
}

function calculateMIC({ filtered, scGroups, poGroups, todayStr }) {
  // Existing baseline logic to keep dashboard consistent
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

  // --- Historical Time Slices ---
  const currentWeekItems = filterByDays(filtered, todayStr, 7, 0);
  const lastWeekItems = filterByDays(filtered, todayStr, 14, 7);
  const currentMonthItems = filterByDays(filtered, todayStr, 30, 0);
  const lastMonthItems = filterByDays(filtered, todayStr, 60, 30);

  const isCompletedStage = (stage) => ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(stage);

  // --- 2. Throughput Intelligence ---
  const dailyThroughput = {};
  const stageThroughput = {};
  
  // Build Daily, Stage throughput based on currentMonthItems
  currentMonthItems.forEach(item => {
    if (isCompletedStage(item.currentStage) && item.timestamp) {
      const dateStr = item.timestamp.slice(0, 10);
      dailyThroughput[dateStr] = (dailyThroughput[dateStr] || 0) + 1;
    }
    
    // Track throughput velocity by stage (items moving THROUGH a stage)
    if (item.currentStage && item.timestamp) {
      stageThroughput[item.currentStage] = (stageThroughput[item.currentStage] || 0) + 1;
    }
  });

  const getThroughput = (items) => items.filter(i => isCompletedStage(i.currentStage)).length;
  
  const tpCurrentWeek = getThroughput(currentWeekItems);
  const tpLastWeek = getThroughput(lastWeekItems);
  const tpCurrentMonth = getThroughput(currentMonthItems);
  const tpLastMonth = getThroughput(lastMonthItems);

  // --- Vendor Intelligence V2 ---
  let totalVendorScore = 0;
  let validVendorsCount = 0;

  const vendorRisk = (vendors.vendors || []).map(v => {
    const throughput = stageThroughput[v.code] || stageThroughput[`${v.code}V`] || Math.max(1, v.count / 2);
    const delayFreq = v.avgDays > 14 ? Math.min(100, Math.round((v.avgDays / 21) * 100)) : 10;
    
    // Vendor Score V2 Calculation
    const vendorScore = 100 - Math.min(100, (v.avgDays / TARGET_DAYS) * 100);
    totalVendorScore += vendorScore;
    validVendorsCount++;

    return {
      vendor: v.code || v.vendor,
      count: v.count,
      throughput: Math.round(throughput),
      avgCycleTime: v.avgDays,
      delayFrequency: delayFreq,
      slaPerformance: Math.max(0, 100 - delayFreq),
      trend: v.avgDays > 18 ? 'Declining' : (v.avgDays < 10 ? 'Improving' : 'Stable'),
      riskScore: Math.round((v.avgDays * delayFreq) / 100),
      efficiencyScore: Math.round(vendorScore)
    };
  }).sort((a,b) => b.riskScore - a.riskScore);

  const vendorIntelligence = {
    vendors: vendorRisk.slice(0, 10),
    bestVendor: validVendorsCount > 0 ? [...vendorRisk].sort((a,b) => b.efficiencyScore - a.efficiencyScore)[0].vendor : 'N/A',
    worstVendor: validVendorsCount > 0 ? [...vendorRisk].sort((a,b) => a.efficiencyScore - b.efficiencyScore)[0].vendor : 'N/A',
    distribution: {
      excellent: vendorRisk.filter(v => v.efficiencyScore >= 80).length,
      average: vendorRisk.filter(v => v.efficiencyScore >= 50 && v.efficiencyScore < 80).length,
      poor: vendorRisk.filter(v => v.efficiencyScore < 50).length
    }
  };

  // --- 1. Plant Health Score V2 ---
  // Production Score: Throughput stability
  const prodScoreCurrent = Math.min(100, (tpCurrentWeek / Math.max(1, tpLastWeek)) * 100);
  const prodScorePast = Math.min(100, (tpLastWeek / Math.max(1, getThroughput(filterByDays(filtered, todayStr, 21, 14)))) * 100);

  // Use throughput delta to drive historical trends intelligently rather than static mocks
  const throughputDeltaPct = tpLastWeek > 0 
    ? ((tpCurrentWeek - tpLastWeek) / tpLastWeek) * 10 
    : 0;
  const clampedDelta = Math.max(-15, Math.min(15, throughputDeltaPct));

  // Delivery Score
  const delScoreCurrent = Math.min(kpis.onTimePct || 0, 100);
  const delScorePast = Math.max(0, Math.min(100, delScoreCurrent - clampedDelta));

  // Vendor Score (Aggregated)
  const vScoreCurrent = validVendorsCount > 0 ? totalVendorScore / validVendorsCount : 100;
  const vScorePast = Math.max(0, Math.min(100, vScoreCurrent - (clampedDelta * 0.8)));

  // Inventory Score
  const inventoryCounts = { Ready: 0, Stores: 0, Stock: 0 };
  const inventoryAges = { Ready: 0, Stores: 0, Stock: 0 };
  let deadCount = 0;
  let deadCountPast = 0;

  filtered.forEach(i => {
    if (['READY', 'STORES', 'STOCK'].includes(i.currentStage)) {
      const stage = i.currentStage === 'READY' ? 'Ready' : (i.currentStage === 'STORES' ? 'Stores' : 'Stock');
      const age = i.timestamp ? workingDaysBetween5Day(i.timestamp, todayStr) : 0;
      
      inventoryCounts[stage]++;
      inventoryAges[stage] += age;
      if (age > 30) deadCount++;
      // Estimate 7 days ago (5 working days)
      if (age - 5 > 30) deadCountPast++;
    }
  });

  const totalInv = inventoryCounts.Ready + inventoryCounts.Stores + inventoryCounts.Stock;
  const invScoreCurrent = Math.max(0, 100 - (deadCount / Math.max(1, totalInv)) * 100);
  const invScorePast = totalInv > 0 ? Math.max(0, 100 - (deadCountPast / totalInv) * 100) : 100;

  // Flow Score (Bottlenecks) V2
  const topBN = bottlenecks.bottleneckStages?.[0]?.score || 0;
  const flowScoreCurrent = Math.max(0, Math.min(100, 100 - topBN));
  const flowScorePast = Math.max(0, Math.min(100, flowScoreCurrent - clampedDelta));

  const getHealthMetric = (curr, past) => ({
    current: Math.round(curr),
    past: Math.round(past),
    trend: getTrend(curr, past),
    variance: getVariance(curr, past)
  });

  const overallCurrent = (prodScoreCurrent + delScoreCurrent + vScoreCurrent + invScoreCurrent + flowScoreCurrent) / 5;
  const overallPast = (prodScorePast + delScorePast + vScorePast + invScorePast + flowScorePast) / 5;

  const plantHealth = {
    overall: getHealthMetric(overallCurrent, overallPast),
    production: getHealthMetric(prodScoreCurrent, prodScorePast),
    delivery: getHealthMetric(delScoreCurrent, delScorePast),
    vendor: getHealthMetric(vScoreCurrent, vScorePast),
    inventory: getHealthMetric(invScoreCurrent, invScorePast),
    flow: getHealthMetric(flowScoreCurrent, flowScorePast)
  };

  const throughputIntelligence = {
    weekly: { current: tpCurrentWeek, past: tpLastWeek, trend: getTrend(tpCurrentWeek, tpLastWeek), variance: getVariance(tpCurrentWeek, tpLastWeek) },
    monthly: { current: tpCurrentMonth, past: tpLastMonth, trend: getTrend(tpCurrentMonth, tpLastMonth), variance: getVariance(tpCurrentMonth, tpLastMonth) },
    dailyTrend: Object.keys(dailyThroughput).sort().slice(-14).map(k => ({ date: k, count: dailyThroughput[k] })),
    bestStages: Object.entries(stageThroughput).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(x=>({ stage: x[0], count: x[1] })),
    worstStages: Object.entries(stageThroughput).sort((a,b)=>a[1]-b[1]).slice(0, 5).map(x=>({ stage: x[0], count: x[1] }))
  };

  // --- 3. Queue Clearance Forecast V2 ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
  const exactWorkingDays = Math.max(1, workingDaysBetween5Day(thirtyDaysAgoStr, todayStr) || 22);

  const queueClearance = Object.entries(stages.stageCounts).map(([stage, count]) => {
    const exitedCount = stageThroughput[stage] || 0;
    const avgDaily = exitedCount / exactWorkingDays;
    
    const daysToClear = avgDaily > 0 ? Math.round(count / avgDaily) : count; // fallback if 0
    const expectedCompletion = addWorkingDays5Day(todayStr, daysToClear);
    
    let risk = 'Low';
    if (daysToClear > 21) risk = 'Critical';
    else if (daysToClear > 14) risk = 'High';
    else if (daysToClear > 7) risk = 'Medium';

    return {
      stage,
      queueSize: count,
      avgDailyThroughput: avgDaily.toFixed(2),
      daysToClear,
      expectedCompletion,
      risk
    };
  }).sort((a,b) => b.daysToClear - a.daysToClear);

  // --- 4. Advanced Predictive Delay Engine ---
  const predictions = [];
  poGroups.forEach(pg => {
    const elapsed = workingDaysBetween5Day(pg.poDate, todayStr);
    const allDone = pg.items.every(i => isCompletedStage(i.currentStage));
    if (!allDone && elapsed !== null) {
      // Data-driven cycle time lookup
      const activeStage = pg.items.find(i => !isCompletedStage(i.currentStage))?.currentStage || 'Unknown';
      const histCycle = cycleTimes.stageCycleTimes[activeStage] || 15; 
      
      const expectedTotalCycle = histCycle + 10; 
      
      if (elapsed > expectedTotalCycle * 0.8) {
        const expectedDelay = elapsed - 21 > 0 ? elapsed - 21 + 5 : 5; 
        const prob = Math.min(99, Math.round((elapsed / expectedTotalCycle) * 100));
        
        const expectedCompletion = addWorkingDays5Day(todayStr, expectedDelay);

        let risk = 'Low';
        if (elapsed > 21) risk = 'Critical';
        else if (elapsed > 14) risk = 'High';
        else if (elapsed > 7) risk = 'Medium';

        predictions.push({
          po: pg.po,
          stage: activeStage,
          currentAge: elapsed,
          expectedDelay,
          expectedCompletion,
          probability: prob,
          confidence: Math.min(95, Math.max(50, prob - 5)),
          risk
        });
      }
    }
  });
  predictions.sort((a,b) => b.probability - a.probability);

  // --- 5. Root Cause Impact Analysis ---
  const rootCausesMap = {};
  filtered.forEach(item => {
    if (!item.poDate) return;
    const age = workingDaysBetween5Day(item.poDate, todayStr);
    if (age > 21 && !isCompletedStage(item.currentStage)) {
      let cause = 'Processing';
      if (item.currentStage.endsWith('V')) cause = 'Vendor';
      else if (item.currentStage === 'I' || item.currentStage === 'FI') cause = 'Inspection';
      else if (['READY', 'STORES'].includes(item.currentStage)) cause = 'Inventory';

      if (!rootCausesMap[cause]) rootCausesMap[cause] = { cause, count: 0, pos: new Set(), scs: new Set(), delayDays: 0 };
      
      rootCausesMap[cause].count++;
      rootCausesMap[cause].pos.add(item.po);
      rootCausesMap[cause].scs.add(item.sc);
      rootCausesMap[cause].delayDays += (age - 21);
    }
  });

  const rootCauseImpact = Object.values(rootCausesMap).map(r => ({
    cause: r.cause,
    count: r.count,
    affectedPOs: r.pos.size,
    affectedSCs: r.scs.size,
    totalDelayDays: r.delayDays,
    impactScore: Math.round((r.delayDays * r.pos.size) / 100),
    riskRating: r.delayDays > 500 ? 'Critical' : (r.delayDays > 200 ? 'High' : 'Medium')
  })).sort((a,b) => b.impactScore - a.impactScore);

  // --- 7. Inventory Intelligence V2 ---
  const inventoryInfo = {
    healthScore: invScoreCurrent,
    velocity: Math.round(tpCurrentMonth / 30),
    deadInventory: deadCount,
    dispatchRisk: deadCount > 50 ? 'High' : (deadCount > 20 ? 'Medium' : 'Low'),
    breakdown: [
      { stage: 'Ready', count: inventoryCounts.Ready, avgAge: Math.round(inventoryAges.Ready / Math.max(1, inventoryCounts.Ready)) },
      { stage: 'Stores', count: inventoryCounts.Stores, avgAge: Math.round(inventoryAges.Stores / Math.max(1, inventoryCounts.Stores)) },
      { stage: 'Stock', count: inventoryCounts.Stock, avgAge: Math.round(inventoryAges.Stock / Math.max(1, inventoryCounts.Stock)) }
    ]
  };

  // --- 8. Bottleneck Impact Analysis ---
  const bottleneckImpact = bottlenecks.bottleneckStages.map(b => {
    const affectedItems = filtered.filter(i => i.currentStage === b.stage);
    const pos = new Set(affectedItems.map(i => i.po));
    const scs = new Set(affectedItems.map(i => i.sc));
    const expectedDelay = Math.round(b.score / 10); 

    return {
      stage: b.stage,
      severityScore: b.score,
      affectedPOs: pos.size,
      affectedSCs: scs.size,
      expectedDelayDays: expectedDelay,
      queueSize: affectedItems.length,
      trend: b.score > 70 ? 'Declining' : 'Stable'
    };
  });

  // --- 9. Executive Action Center V2 ---
  const recommendedActions = [];

  if (bottleneckImpact[0] && bottleneckImpact[0].severityScore > 70) {
    recommendedActions.push({
      priority: 'Critical',
      action: `Deploy Buffer Capacity to ${bottleneckImpact[0].stage}`,
      reason: `Primary bottleneck is stalling ${bottleneckImpact[0].affectedPOs} POs.`,
      benefit: 'Unlock Plant Flow',
      area: 'Production',
      affectedPOs: bottleneckImpact[0].affectedPOs,
      affectedSCs: bottleneckImpact[0].affectedSCs,
      kpiImprovement: '+5% Efficiency',
      delayReduction: `-${bottleneckImpact[0].expectedDelayDays} Days`
    });
  }

  if (predictions.length > 0) {
    const atRiskPOs = predictions.length;
    const avgDelay = Math.round(predictions.reduce((a,b)=>a+b.expectedDelay,0)/atRiskPOs);
    recommendedActions.push({
      priority: 'High',
      action: `Expedite Top ${Math.min(5, atRiskPOs)} At-Risk POs`,
      reason: `${atRiskPOs} POs have >80% probability of missing SLA.`,
      benefit: 'Protect On-Time Delivery Rate',
      area: 'Operations',
      affectedPOs: atRiskPOs,
      affectedSCs: atRiskPOs * 2, // est
      kpiImprovement: '+2% OTD',
      delayReduction: `-${avgDelay} Days`
    });
  }

  if (vendorRisk[0] && vendorRisk[0].riskScore > 50) {
    recommendedActions.push({
      priority: 'High',
      action: `Review SLA with Vendor ${vendorRisk[0].vendor}`,
      reason: `Vendor is averaging ${vendorRisk[0].avgCycleTime} days per cycle causing cascading delays.`,
      benefit: 'Reduce External Bottlenecks',
      area: 'Vendor Management',
      affectedPOs: vendorRisk[0].count,
      affectedSCs: vendorRisk[0].count,
      kpiImprovement: '+10% Vendor Score',
      delayReduction: '-7 Days'
    });
  }

  if (inventoryInfo.deadInventory > 20) {
    recommendedActions.push({
      priority: 'Medium',
      action: 'Execute Dead Inventory Clearance',
      reason: `${inventoryInfo.deadInventory} items have aged >30 days in warehouse stages.`,
      benefit: 'Free up working capital and physical space',
      area: 'Inventory',
      affectedPOs: inventoryInfo.deadInventory,
      affectedSCs: inventoryInfo.deadInventory,
      kpiImprovement: '+15% Inv Velocity',
      delayReduction: 'N/A'
    });
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push({
      priority: 'Low',
      action: 'Maintain Current Operations',
      reason: 'All critical metrics are within healthy bounds.',
      benefit: 'Sustain Performance',
      area: 'General',
      affectedPOs: 0,
      affectedSCs: 0,
      kpiImprovement: 'Maintain',
      delayReduction: '0 Days'
    });
  }

  return {
    plantHealth,
    throughput: throughputIntelligence,
    queueClearance: queueClearance.slice(0, 10),
    predictions: predictions.slice(0, 10),
    rootCauseImpact: rootCauseImpact.slice(0, 10),
    vendorIntelligence, // Updated Payload
    inventory: inventoryInfo,
    bottleneckImpact: bottleneckImpact.slice(0, 10),
    actions: recommendedActions.slice(0, 10)
  };
}

module.exports = { calculateMIC };
