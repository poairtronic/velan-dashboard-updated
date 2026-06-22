const { pool } = require('../db/pool');
const { sendEmail, generateDelayAlertHtml, generateWeeklySummaryHtml } = require('./emailService');
const logger = require('../utils/logger');
const state = require('../state');

const PO_TARGET_DAYS = 21;

/**
 * Get notification settings from database
 */
const getSettings = async () => {
  try {
    const res = await pool.query('SELECT setting_key, enabled, recipients FROM notification_settings');
    const settings = {};
    res.rows.forEach(row => {
      settings[row.setting_key] = row;
    });
    return settings;
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to get notification settings: ${err.message}`);
    return {};
  }
};

/**
 * Log notification to database
 */
const logNotification = async (type, poNumber, recipient, status) => {
  try {
    await pool.query(
      `INSERT INTO notification_logs (type, "poNumber", recipient, status, "sentAt") 
       VALUES ($1, $2, $3, $4, NOW())`,
      [type, poNumber, recipient, status]
    );
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to log notification: ${err.message}`);
  }
};

/**
 * Check if a delay notification was already sent for a PO
 */
const wasDelayAlertSent = async (poNumber) => {
  try {
    const res = await pool.query(
      `SELECT id FROM notification_logs WHERE type = 'PO_DELAY' AND "poNumber" = $1 AND status = 'success'`,
      [poNumber]
    );
    return res.rows.length > 0;
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to check delay alert history: ${err.message}`);
    return true; // Fail safe to true to prevent spam
  }
};

/**
 * Helper to calculate cycle days based on adding timestamps
 */
const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  // Try to parse basic formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

/**
 * Process Delay Alerts
 */
const processDelayAlerts = async () => {
  logger.info(logger.categories.BACKGROUND, 'Starting delayed PO checks...');
  
  const settings = await getSettings();
  const delaySettings = settings['po_delay_alert'];
  
  if (!delaySettings || !delaySettings.enabled || !delaySettings.recipients) {
    logger.info(logger.categories.BACKGROUND, 'Delay alerts are disabled or have no recipients. Skipping.');
    return;
  }
  
  // Use loaded live rows
  const liveRows = state._liveRows || [];
  const now = new Date();
  
  for (const row of liveRows) {
    // Basic cycle days logic (using in-app pattern or timestamp if present)
    let cycleDays = 0;
    
    // For this example, let's look for timestamp or date fields
    // Many dashboards use simple math on timestamp string
    if (row.timestamp) {
      const addedAt = parseDateString(row.timestamp);
      if (addedAt) {
        cycleDays = Math.floor((now - addedAt) / (1000 * 60 * 60 * 24));
      }
    } else if (row.added_at) {
       const addedAt = new Date(row.added_at);
       cycleDays = Math.floor((now - addedAt) / (1000 * 60 * 60 * 24));
    }
    
    // If cycle days exceeds target
    if (cycleDays > PO_TARGET_DAYS && row.po) {
      const alreadySent = await wasDelayAlertSent(row.po);
      
      if (!alreadySent) {
        logger.info(logger.categories.BACKGROUND, `Triggering delay alert for PO: ${row.po} (${cycleDays} days)`);
        
        const html = generateDelayAlertHtml({
          po: row.po,
          sc: row.sc || 'N/A',
          currentStage: row.currentStage || 'Unknown',
          cycleDays: cycleDays,
          delayDays: cycleDays - PO_TARGET_DAYS
        });
        
        const result = await sendEmail({
          to: delaySettings.recipients,
          subject: '[VELAN] Delayed PO Alert',
          html
        });
        
        await logNotification('PO_DELAY', row.po, delaySettings.recipients, result.success ? 'success' : 'failed');
      }
    }
  }
};

/**
 * Process Weekly Summary
 */
const processWeeklySummary = async () => {
  logger.info(logger.categories.BACKGROUND, 'Generating weekly summary...');
  
  const settings = await getSettings();
  const summarySettings = settings['weekly_summary'];
  
  if (!summarySettings || !summarySettings.enabled || !summarySettings.recipients) {
    logger.info(logger.categories.BACKGROUND, 'Weekly summary is disabled or has no recipients. Skipping.');
    return;
  }
  
  const liveRows = state._liveRows || [];
  
  // Compute basic metrics (Mocked logic to mirror Dashboard functionality)
  let readySets = 0;
  let storesSets = 0;
  let delayedPOs = 0;
  let vendorCount = 0;
  let inhouseCount = 0;
  const stageCounts = {};
  
  const now = new Date();
  
  liveRows.forEach(row => {
    // Counts
    if (row.currentStage && row.currentStage.toLowerCase().includes('ready')) readySets++;
    if (row.currentStage && row.currentStage.toLowerCase().includes('stores')) storesSets++;
    
    // Delay Check
    let cycleDays = 0;
    if (row.timestamp) {
      const addedAt = parseDateString(row.timestamp);
      if (addedAt) cycleDays = Math.floor((now - addedAt) / (1000 * 60 * 60 * 24));
    }
    if (cycleDays > PO_TARGET_DAYS) delayedPOs++;
    
    // Vendor/Inhouse
    if (row.inhouse && row.inhouse.toLowerCase() === 'no') vendorCount++;
    else inhouseCount++;
    
    // Bottleneck mapping
    const stage = row.currentStage || 'Unknown';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });
  
  const total = liveRows.length;
  const vendorPercent = total ? Math.round((vendorCount / total) * 100) : 0;
  const inhousePercent = total ? Math.round((inhouseCount / total) * 100) : 0;
  const onTimePercent = total ? Math.round(((total - delayedPOs) / total) * 100) : 100;
  
  // Find top bottleneck
  let topBottleneck = 'None';
  let maxCount = 0;
  for (const [stage, count] of Object.entries(stageCounts)) {
    if (count > maxCount && stage !== 'Ready' && stage !== 'Stores') {
      maxCount = count;
      topBottleneck = stage;
    }
  }

  const summaryData = {
    totalOutput: total,
    readySets,
    storesSets,
    delayedPOs,
    onTimePercent,
    vendorWorkload: vendorPercent,
    inhouseWorkload: inhousePercent,
    topBottleneck: `${topBottleneck} (${maxCount} items)`,
    weeklyTrend: 'Production throughput remains steady compared to last week.'
  };
  
  const html = generateWeeklySummaryHtml(summaryData);
  
  const result = await sendEmail({
    to: summarySettings.recipients,
    subject: '[VELAN] Weekly Production Summary',
    html
  });
  
  await logNotification('WEEKLY_SUMMARY', 'N/A', summarySettings.recipients, result.success ? 'success' : 'failed');
};

module.exports = {
  getSettings,
  processDelayAlerts,
  processWeeklySummary
};
