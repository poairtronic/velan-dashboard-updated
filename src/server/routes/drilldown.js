const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const authMiddleware = require('../middleware/authMiddleware');
const { 
  OTD_DRILLDOWN_QUERY, 
  BOTTLENECK_DRILLDOWN_QUERY, 
  VENDOR_DRILLDOWN_QUERY, 
  INVENTORY_DRILLDOWN_QUERY 
} = require('../db/queries/drilldown');
const { workingDaysBetween } = require('../utils/calculationUtils');

// Helper to get date string
const getTodayStr = () => new Date().toISOString().split('T')[0];

router.get('/:kpiType', authMiddleware, async (req, res) => {
  const { kpiType } = req.params;
  const todayStr = getTodayStr();

  try {
    if (kpiType === 'otd') {
      const { rows } = await pool.query(OTD_DRILLDOWN_QUERY);
      
      const delayedPOs = new Set();
      const delayedSCs = new Set();
      const delayedVendors = new Set();
      const breakdown = { vendor: 0, inspection: 0, production: 0 };
      
      rows.forEach(r => {
        if (!r.po_date) return;
        const age = workingDaysBetween(r.po_date, todayStr);
        if (age > 21) {
          delayedPOs.add(r.po);
          delayedSCs.add(r.sc);
          if (r.inhouse === 'VENDOR' || r.stage.endsWith('V')) {
            delayedVendors.add(r.inhouse === 'VENDOR' ? r.stage.slice(0, -1) : r.stage);
            breakdown.vendor++;
          } else if (r.stage === 'I' || r.stage === 'FI') {
            breakdown.inspection++;
          } else {
            breakdown.production++;
          }
        }
      });

      return res.json({
        affectedPOs: delayedPOs.size,
        affectedSCs: delayedSCs.size,
        affectedVendors: delayedVendors.size,
        breakdown,
        posList: Array.from(delayedPOs)
      });
    }

    if (kpiType === 'bottleneck') {
      const { rows } = await pool.query(BOTTLENECK_DRILLDOWN_QUERY);
      
      const stageCounts = {};
      const stagePOs = {};
      
      rows.forEach(r => {
        if (!stageCounts[r.stage]) {
          stageCounts[r.stage] = 0;
          stagePOs[r.stage] = new Set();
        }
        stageCounts[r.stage]++;
        stagePOs[r.stage].add(r.po);
      });

      // Simple severity heuristic (queue size) for drilldown preview
      const topStageEntry = Object.entries(stageCounts).sort((a,b) => b[1] - a[1])[0];
      const topStage = topStageEntry ? topStageEntry[0] : 'N/A';
      const queueSize = topStageEntry ? topStageEntry[1] : 0;
      const affectedPOsCount = topStageEntry ? stagePOs[topStage].size : 0;

      return res.json({
        topStage,
        affectedPOCount: affectedPOsCount,
        currentQueueSize: queueSize,
        expectedDelayDays: Math.round(queueSize / 10), // mock heuristic for drilldown
        historicalTrend: [] // can fetch from history if needed
      });
    }

    if (kpiType === 'vendor') {
      const { rows } = await pool.query(VENDOR_DRILLDOWN_QUERY);
      const vendorsMap = {};
      
      rows.forEach(r => {
        let vCode = 'EXT';
        if (r.stage && r.stage.endsWith('V')) vCode = r.stage.slice(0, -1);
        
        if (!vendorsMap[vCode]) {
          vendorsMap[vCode] = { name: vCode, itemCount: 0, delayedItemCount: 0, totalAge: 0, ageCount: 0 };
        }
        
        vendorsMap[vCode].itemCount++;
        
        if (r.timestamp) {
          const age = workingDaysBetween(r.timestamp, todayStr);
          if (age > 14) vendorsMap[vCode].delayedItemCount++;
          vendorsMap[vCode].totalAge += age;
          vendorsMap[vCode].ageCount++;
        } else if (r.po_date) {
          const age = workingDaysBetween(r.po_date, todayStr);
          if (age > 21) vendorsMap[vCode].delayedItemCount++;
        }
      });

      const vendorList = Object.values(vendorsMap).map(v => {
        const avgCycleTime = v.ageCount > 0 ? Math.round(v.totalAge / v.ageCount) : 0;
        const slaPct = Math.max(0, 100 - Math.round((v.delayedItemCount / Math.max(1, v.itemCount)) * 100));
        return {
          vendorName: v.name,
          itemCount: v.itemCount,
          avgCycleTime,
          delayedItemCount: v.delayedItemCount,
          sla: slaPct
        };
      }).sort((a,b) => b.delayedItemCount - a.delayedItemCount);

      return res.json({ vendors: vendorList });
    }

    if (kpiType === 'inventory') {
      const { rows } = await pool.query(INVENTORY_DRILLDOWN_QUERY);
      
      const counts = { READY: 0, STORES: 0, STOCK: 0, deadInventory: 0 };
      
      rows.forEach(r => {
        if (r.stage === 'READY') counts.READY++;
        if (r.stage === 'STORES') counts.STORES++;
        if (r.stage === 'STOCK') counts.STOCK++;
        
        if (r.timestamp) {
          const age = workingDaysBetween(r.timestamp, todayStr);
          if (age > 30) counts.deadInventory++;
        }
      });

      return res.json(counts);
    }

    return res.status(400).json({ error: 'Unknown KPI type' });
  } catch (error) {
    console.error(`[Drilldown Error] ${kpiType}:`, error);
    res.status(500).json({ error: 'Failed to fetch drilldown data' });
  }
});

module.exports = router;
