const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { EXECUTIVE_WAR_ROOM_QUERY } = require('../db/queries/executive');
const { workingDaysBetween } = require('../../utils/calculationUtils.cjs');

const getTodayStr = () => new Date().toISOString().split('T')[0];

router.get('/war-room', requireAuth(), async (req, res) => {
  try {
    const { rows } = await pool.query(EXECUTIVE_WAR_ROOM_QUERY);
    const todayStr = getTodayStr();

    const stageCounts = {};
    const posAtStage = {};
    const operationalRisks = [];

    // Process rows
    rows.forEach(r => {
      // 1. Critical Issues tracking (queues)
      if (!stageCounts[r.stage]) {
        stageCounts[r.stage] = 0;
        posAtStage[r.stage] = new Set();
      }
      stageCounts[r.stage]++;
      posAtStage[r.stage].add(r.po);

      // 2. Operational Risks tracking (age vs expected completion)
      // Expected completion is 21 days
      if (r.po_date) {
        const age = workingDaysBetween(r.po_date, todayStr);
        if (age !== null && age > (21 - 7)) { // current > expected - 7 days
          let riskLevel = 'Medium';
          if (age > 21) riskLevel = 'Critical';
          else if (age > 14) riskLevel = 'High';

          operationalRisks.push({
            po: r.po,
            sc: r.sc,
            stage: r.stage,
            age,
            riskLevel,
            vendor: r.inhouse === 'VENDOR' ? (r.stage.endsWith('V') ? r.stage.slice(0, -1) : 'EXT') : null
          });
        }
      }
    });

    // Format Critical Issues (threshold > 20)
    const THRESHOLD = 20;
    const criticalIssues = Object.entries(stageCounts)
      .filter(([stage, count]) => count >= THRESHOLD)
      .map(([stage, count]) => ({
        stage,
        queueSize: count,
        affectedPOs: posAtStage[stage].size,
        delayRiskDays: Math.round(count / 10) // heuristic
      }))
      .sort((a,b) => b.queueSize - a.queueSize);

    // Group Operational Risks
    const riskGroups = {
      Critical: operationalRisks.filter(r => r.riskLevel === 'Critical').length,
      High: operationalRisks.filter(r => r.riskLevel === 'High').length,
      Medium: operationalRisks.filter(r => r.riskLevel === 'Medium').length,
      items: operationalRisks.sort((a,b) => b.age - a.age).slice(0, 50)
    };

    // 3. Priority Actions (Automated recommendations)
    const priorityActions = [];

    if (criticalIssues.length > 0) {
      const topIssue = criticalIssues[0];
      priorityActions.push({
        action: `Expedite ${topIssue.stage}`,
        description: `Unblock ${topIssue.queueSize} items causing cascading delays.`,
        affectedPOs: topIssue.affectedPOs,
        riskDays: topIssue.delayRiskDays,
        priority: 'Critical'
      });
    }

    const delayedVendors = operationalRisks.filter(r => r.vendor && r.riskLevel === 'Critical');
    if (delayedVendors.length > 0) {
      // Find top delayed vendor
      const vCounts = {};
      delayedVendors.forEach(v => {
        vCounts[v.vendor] = (vCounts[v.vendor] || 0) + 1;
      });
      const topVendor = Object.entries(vCounts).sort((a,b) => b[1] - a[1])[0];
      if (topVendor) {
        priorityActions.push({
          action: `Review SLA with Vendor ${topVendor[0]}`,
          description: `${topVendor[1]} items are critically delayed at this vendor.`,
          affectedPOs: topVendor[1],
          riskDays: 14,
          priority: 'High'
        });
      }
    }

    if (riskGroups.High > 10) {
      priorityActions.push({
        action: `Clear High Risk Backlog`,
        description: `There are ${riskGroups.High} items dangerously close to SLA breach.`,
        affectedPOs: riskGroups.High,
        riskDays: 7,
        priority: 'High'
      });
    }

    res.json({
      criticalIssues,
      operationalRisks: riskGroups,
      priorityActions
    });

  } catch (err) {
    console.error('[Executive War Room Error]', err);
    res.status(500).json({ error: 'Failed to fetch executive data' });
  }
});

module.exports = router;
