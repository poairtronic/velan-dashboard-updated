const express = require('express');
const { calculateKPIs } = require('../services/kpiService');
const { calculateStages } = require('../services/stageService');
const { calculateCycleTimes } = require('../services/cycleTimeService');
const { calculateVendors } = require('../services/vendorService');
const { calculateBottlenecks } = require('../services/bottleneckService');
const { getFilteredData, computeGroups } = require('../services/dataQueryService');
const cacheKeys = require('../cache/cacheKeys');
const { getOrSetCache, TTL } = require('../cache/cacheService');

const router = express.Router();

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper to determine trend based on heuristics
function getTrend(currentValue, targetValue, invert = false) {
  if (currentValue === targetValue) return 'Stable';
  const isBetter = currentValue > targetValue;
  if (invert) return isBetter ? 'Declining' : 'Improving';
  return isBetter ? 'Improving' : 'Declining';
}

router.get('/', async (req, res) => {
  try {
    const filters = req.query;
    const cacheKey = `executive_intelligence:${JSON.stringify(filters)}`;
    
    const intelligence = await getOrSetCache(cacheKey, 300, async () => {
      const todayStr = getTodayStr();
      const filtered = await getFilteredData(filters, todayStr);
      const { scGroups, poGroups } = computeGroups(filtered);

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

      // --- Executive Intelligence Derivations ---

      // 1. KPI Trend Analytics
      const kpiTrends = {
        onTimePct: {
          value: kpis.onTimePct,
          trend: getTrend(kpis.onTimePct, 75), // Target 75%
          label: 'On-Time Delivery %'
        },
        delayedPOs: {
          value: kpis.delayed,
          trend: getTrend(kpis.delayed, 10, true), // Lower is better
          label: 'Delayed POs'
        },
        wip: {
          value: kpis.wip,
          trend: getTrend(kpis.wip, 50, true),
          label: 'WIP Count'
        }
      };

      // 2. Bottleneck Intelligence
      // Map bottlenecks and determine risks
      const bottleneckTrends = (bottlenecks.bottleneckStages || []).map(b => ({
        stage: b.stage,
        bottleneckScore: b.score,
        avgCycleTime: b.duration,
        trend: getTrend(b.score, 50, true), // Higher score = worse
        riskLevel: b.score > 70 ? 'High' : (b.score > 40 ? 'Medium' : 'Low')
      })).sort((a, b) => b.bottleneckScore - a.bottleneckScore).slice(0, 5);

      // 3. Vendor Intelligence
      const vendorTrends = (vendors.vendors || []).map(v => ({
        vendor: v.code || v.vendor || 'UNKNOWN',
        totalItems: v.count || 0,
        inProgress: v.count || 0,
        avgCycleTime: v.avgDays || 0,
        trend: getTrend(v.avgDays || 0, 14, true), // Less than 14 days is good
        slaRisk: (v.avgDays || 0) > 21 ? 'High' : ((v.avgDays || 0) > 14 ? 'Medium' : 'Low')
      })).sort((a, b) => b.avgCycleTime - a.avgCycleTime).slice(0, 5);

      // 4. Production Risk Analysis
      const totalDelayed = kpis.delayed;
      const totalInProgress = kpis.overviewStats?.inProgressItemsCount || 0;
      const delayedRisk = totalDelayed > 20 ? 'CRITICAL' : (totalDelayed > 5 ? 'ELEVATED' : 'NORMAL');
      
      const productionRisks = {
        delayRisk: delayedRisk,
        backlogRisk: kpis.wip > 100 ? 'HIGH' : 'NORMAL',
        vendorRisk: vendorTrends.some(v => v.slaRisk === 'High') ? 'ELEVATED' : 'NORMAL'
      };

      // 5. Management Summaries
      const managementSummary = `Currently tracking ${kpis.totalItems} items across ${kpis.totalPOs} POs. On-time delivery sits at ${kpis.onTimePct}%. The primary operational bottleneck is at ${bottleneckTrends[0]?.stage || 'None'}, with a risk level of ${bottleneckTrends[0]?.riskLevel || 'Low'}. Vendor performance indicates ${vendorTrends.filter(v => v.slaRisk === 'High').length} vendors are currently at High SLA Risk.`;

      return {
        timestamp: todayStr,
        kpiTrends,
        bottleneckTrends,
        vendorTrends,
        productionRisks,
        managementSummary,
        rawMetrics: {
          totalItems: kpis.totalItems,
          totalPOs: kpis.totalPOs,
          completedPOs: kpis.onTime + kpis.delayed
        }
      };
    });

    res.json(intelligence);
  } catch (error) {
    console.error('Intelligence calculation error:', error);
    res.status(500).json({ error: 'Intelligence calculation failed', details: error.message });
  }
});

module.exports = router;
