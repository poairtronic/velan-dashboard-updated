/**
 * Plant Risk Aggregation V1 — Phase 9.6
 *
 * SECTION 4 — Plant Level Risk Aggregation
 *   Plant Risk = Bottleneck(30%) + Queue(25%) + Vendor(20%) + Delay(15%) + Inventory(10%)
 *   Bands: 0-25 Low, 26-50 Moderate, 51-75 High, 76-100 Critical
 *
 * SECTION 5 — Executive Risk Summary
 *   Top 5 risks per category with Score, Confidence, Affected POs, Affected SCs, Expected Impact
 */
const { calculateBottleneckForecast } = require('./bottleneckDetection');
const { calculateCapacityForecast } = require('./capacityPlanner');
const { calculateQueueForecast } = require('./queueForecast');
const { calculateVendorRiskForecast } = require('./vendorRisk');
const { calculateSLAForecast } = require('./slaEngine');

/**
 * Normalize a value to 0-100 risk scale
 */
function normalizeRisk(value, max) {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

async function calculatePlantRisk({ liveRows, dbRows }) {
  // Run all forecast engines in parallel
  const [bottleneckData, capacityData, queueData, vendorData, slaData] = await Promise.all([
    calculateBottleneckForecast({ liveRows, dbRows }),
    calculateCapacityForecast({ liveRows, dbRows }),
    calculateQueueForecast({ liveRows, dbRows, stage: null }),
    calculateVendorRiskForecast({ liveRows, dbRows }),
    calculateSLAForecast({ liveRows, dbRows })
  ]);

  // ═══════════════════════════════════════════════
  // Calculate individual risk dimensions (0-100)
  // ═══════════════════════════════════════════════

  // 1. Bottleneck Risk: based on current bottleneck queue growth and projected queue
  let bottleneckRisk = 0;
  if (bottleneckData && bottleneckData.currentBottleneck) {
    const bn = bottleneckData.currentBottleneck;
    const pn = bottleneckData.predictedNextBottleneck;
    // Growth rate > 0 = growing bottleneck = higher risk
    const growthFactor = Math.min(50, Math.max(0, (bn.growthRate || 0) * 10));
    // Queue size relative to all stages
    const totalItems = liveRows.length || 1;
    const queueConcentration = Math.min(50, ((bn.queue || 0) / totalItems) * 100);
    bottleneckRisk = Math.min(100, Math.round(growthFactor + queueConcentration));
  }

  // 2. Queue Risk: based on capacity gaps across stages
  let queueRisk = 0;
  if (capacityData && capacityData.stages && capacityData.stages.length > 0) {
    const gapValues = capacityData.stages.map(s => Math.max(0, s.capacityIncreasePercent || 0));
    const maxGap = Math.max(...gapValues, 0);
    const avgGap = gapValues.reduce((s, v) => s + v, 0) / gapValues.length;
    // Weighted: 60% max gap, 40% avg gap
    queueRisk = Math.min(100, Math.round((maxGap * 0.6 + avgGap * 0.4)));
  }

  // 3. Vendor Risk: based on vendor risk scores
  let vendorRisk = 0;
  if (vendorData && vendorData.vendors && vendorData.vendors.length > 0) {
    const vendorScores = vendorData.vendors.map(v => v.breachProbability || 0);
    const maxVendor = Math.max(...vendorScores, 0);
    const avgVendor = vendorScores.reduce((s, v) => s + v, 0) / vendorScores.length;
    vendorRisk = Math.min(100, Math.round(maxVendor * 0.5 + avgVendor * 0.5));
  }

  // 4. Delay Risk: based on SLA forecasts
  let delayRisk = 0;
  if (slaData && slaData.forecasts && slaData.forecasts.length > 0) {
    const highRiskPOs = slaData.forecasts.filter(f => f.riskLevel === 'high').length;
    const totalPOs = slaData.forecasts.length;
    const delayProbs = slaData.forecasts.map(f => f.delayProbability || 0);
    const avgDelayProb = delayProbs.reduce((s, v) => s + v, 0) / delayProbs.length;
    const highRiskRatio = totalPOs > 0 ? (highRiskPOs / totalPOs) * 100 : 0;
    delayRisk = Math.min(100, Math.round(avgDelayProb * 0.4 + highRiskRatio * 0.6));
  }

  // 5. Inventory Risk: based on queue forecast clearance days
  let inventoryRisk = 0;
  if (queueData && queueData.forecasts && queueData.forecasts.length > 0) {
    const clearanceDays = queueData.forecasts
      .map(f => f.expectedDays || 0)
      .filter(d => d > 0);
    if (clearanceDays.length > 0) {
      const maxClearance = Math.max(...clearanceDays);
      const avgClearance = clearanceDays.reduce((s, v) => s + v, 0) / clearanceDays.length;
      // More than 30 days to clear = high risk
      inventoryRisk = Math.min(100, Math.round((avgClearance / 30) * 60 + (maxClearance / 60) * 40));
    }
  }

  // ═══════════════════════════════════════════════
  // SECTION 4 — Weighted Plant Risk Score
  // ═══════════════════════════════════════════════

  const plantRiskScore = Math.min(100, Math.max(0, Math.round(
    (bottleneckRisk * 0.30) +
    (queueRisk * 0.25) +
    (vendorRisk * 0.20) +
    (delayRisk * 0.15) +
    (inventoryRisk * 0.10)
  )));

  // Risk Band
  let riskBand = 'Low';
  if (plantRiskScore >= 76) riskBand = 'Critical';
  else if (plantRiskScore >= 51) riskBand = 'High';
  else if (plantRiskScore >= 26) riskBand = 'Moderate';

  // Identify primary and secondary drivers
  const riskComponents = [
    { name: 'Bottleneck Risk', score: bottleneckRisk, weight: 0.30, contribution: Math.round(bottleneckRisk * 0.30) },
    { name: 'Queue Risk', score: queueRisk, weight: 0.25, contribution: Math.round(queueRisk * 0.25) },
    { name: 'Vendor Risk', score: vendorRisk, weight: 0.20, contribution: Math.round(vendorRisk * 0.20) },
    { name: 'Delay Risk', score: delayRisk, weight: 0.15, contribution: Math.round(delayRisk * 0.15) },
    { name: 'Inventory Risk', score: inventoryRisk, weight: 0.10, contribution: Math.round(inventoryRisk * 0.10) }
  ].sort((a, b) => b.contribution - a.contribution);

  const primaryDriver = riskComponents[0];
  const secondaryDriver = riskComponents[1];

  // ═══════════════════════════════════════════════
  // SECTION 5 — Executive Risk Summary
  // ═══════════════════════════════════════════════

  // Collect affected SCs/POs per category
  const scSet = new Set();
  const poSet = new Set();
  liveRows.forEach(r => {
    if (r.sc) scSet.add(r.sc);
    if (r.po) poSet.add(r.po);
  });

  // --- Top 5 Plant Risks ---
  const topPlantRisks = riskComponents.slice(0, 5).map(rc => ({
    riskName: rc.name,
    riskScore: rc.score,
    confidence: Math.round(
      rc.name === 'Bottleneck Risk' ? (bottleneckData?.metadata?.confidence || 50) :
      rc.name === 'Vendor Risk' ? (vendorData?.vendors?.length > 0 ? vendorData.vendors.reduce((s, v) => s + v.confidence, 0) / vendorData.vendors.length : 50) :
      rc.name === 'Queue Risk' ? (capacityData?.stages?.length > 0 ? capacityData.stages.reduce((s, st) => s + st.confidence, 0) / capacityData.stages.length : 50) :
      50
    ),
    affectedPOs: poSet.size,
    affectedSCs: scSet.size,
    expectedImpact: rc.score >= 75 ? 'Critical — Immediate action required' :
                    rc.score >= 50 ? 'High — Significant delays expected' :
                    rc.score >= 25 ? 'Moderate — Monitor closely' : 'Low — Within tolerance'
  }));

  // --- Top 5 Capacity Risks ---
  const topCapacityRisks = (capacityData?.stages || [])
    .filter(s => s.capacityIncreasePercent > 0)
    .sort((a, b) => b.capacityIncreasePercent - a.capacityIncreasePercent)
    .slice(0, 5)
    .map(s => {
      const affectedItems = liveRows.filter(r => r.currentStage === s.stage);
      const affPOs = new Set(affectedItems.map(r => r.po).filter(Boolean));
      const affSCs = new Set(affectedItems.map(r => r.sc).filter(Boolean));
      return {
        riskName: `${s.stage} — ${s.capacityIncreasePercent}% capacity gap`,
        riskScore: Math.min(100, s.capacityIncreasePercent),
        confidence: s.confidence,
        affectedPOs: affPOs.size,
        affectedSCs: affSCs.size,
        expectedImpact: s.priority === 'Critical' ? 'Critical — Queue growth unsustainable' :
                        s.priority === 'High' ? 'High — Capacity increase needed within 2 weeks' :
                        s.priority === 'Medium' ? 'Moderate — Schedule capacity review' : 'Low — Monitor'
      };
    });

  // --- Top 5 Delay Risks ---
  const topDelayRisks = (slaData?.forecasts || [])
    .filter(f => f.riskLevel === 'high' || f.riskLevel === 'medium')
    .sort((a, b) => b.delayProbability - a.delayProbability)
    .slice(0, 5)
    .map(f => {
      const affectedItems = liveRows.filter(r => r.po === f.poNumber);
      const affSCs = new Set(affectedItems.map(r => r.sc).filter(Boolean));
      return {
        riskName: `PO ${f.poNumber} — ${f.expectedDelay}d delay projected`,
        riskScore: f.delayProbability,
        confidence: f.confidence,
        affectedPOs: 1,
        affectedSCs: affSCs.size,
        expectedImpact: f.riskLevel === 'high' ? `Critical — ${f.expectedDelay} days beyond SLA` :
                        `Moderate — ${f.expectedDelay} days delay risk`
      };
    });

  // --- Top 5 Vendor Risks ---
  const topVendorRisks = (vendorData?.vendors || [])
    .sort((a, b) => b.breachProbability - a.breachProbability)
    .slice(0, 5)
    .map(v => {
      const affectedItems = liveRows.filter(r => r.currentStage === v.vendor && r.inhouse === 'VENDOR');
      const affPOs = new Set(affectedItems.map(r => r.po).filter(Boolean));
      const affSCs = new Set(affectedItems.map(r => r.sc).filter(Boolean));
      return {
        riskName: `${v.vendor} — ${v.riskLevel.toUpperCase()} risk (${v.breachProbability}%)`,
        riskScore: v.breachProbability,
        confidence: v.confidence,
        affectedPOs: affPOs.size,
        affectedSCs: affSCs.size,
        expectedImpact: v.riskLevel === 'critical' ? 'Critical — SLA breach imminent' :
                        v.riskLevel === 'high' ? 'High — Vendor escalation needed' :
                        v.riskLevel === 'medium' ? 'Moderate — Monitor vendor performance' : 'Low — Stable'
      };
    });

  return {
    // Section 4: Plant Risk Score
    plantRisk: {
      score: plantRiskScore,
      band: riskBand,
      primaryDriver: {
        name: primaryDriver.name,
        score: primaryDriver.score,
        contribution: primaryDriver.contribution
      },
      secondaryDriver: {
        name: secondaryDriver.name,
        score: secondaryDriver.score,
        contribution: secondaryDriver.contribution
      },
      components: riskComponents,
      breakdown: {
        bottleneckRisk,
        queueRisk,
        vendorRisk,
        delayRisk,
        inventoryRisk
      }
    },
    // Section 5: Executive Risk Summary
    executiveSummary: {
      topPlantRisks,
      topCapacityRisks,
      topDelayRisks,
      topVendorRisks
    },
    metadata: {
      totalPOs: poSet.size,
      totalSCs: scSet.size,
      totalItems: liveRows.length,
      calculatedAt: new Date().toISOString(),
      weightModel: 'Bottleneck(30%) + Queue(25%) + Vendor(20%) + Delay(15%) + Inventory(10%)'
    }
  };
}

module.exports = { calculatePlantRisk };
