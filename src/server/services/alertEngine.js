const { pool } = require('../db/pool');
const { broadcast } = require('../utils/websocket');
const { workingDaysBetween, calculateVendorAging } = require('../../utils/calculationUtils');
const logger = require('../utils/logger');

/**
 * Runs the alerting and timeline engine on an array of active operational rows.
 */
async function runAlertEngine(rows) {
  if (!rows || rows.length === 0) return;

  logger.info(logger.categories.SYNC, `Running Alert Engine on ${rows.length} rows...`);

  // Get current date string for calculations
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    // 1. Fetch enabled alert rules
    const rulesRes = await pool.query(
      'SELECT rule_key, rule_name, category, severity, threshold_value, enabled, recipients FROM alert_rules WHERE enabled = true'
    );
    const rules = rulesRes.rows;
    if (rules.length === 0) {
      logger.info(logger.categories.SYNC, 'No active alert rules found. Skipping alerts processing.');
      return;
    }

    // 2. Prep data groups
    // Group items by PO
    const poGroups = {};
    rows.forEach((row) => {
      if (!row.po) return;
      if (!poGroups[row.po]) {
        poGroups[row.po] = { po: row.po, poDate: row.poDate, items: [] };
      }
      poGroups[row.po].items.push(row);
    });

    // Group items by stage for backlogs
    const stageGroups = {};
    rows.forEach((row) => {
      const stage = row.currentStage || 'unknown';
      // Ignore completed stages for backlogs
      if (['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(stage.toUpperCase())) return;
      stageGroups[stage] = (stageGroups[stage] || 0) + 1;
    });

    // 3. Process Rules
    for (const rule of rules) {
      if (rule.category === 'PO_DELAY') {
        // Evaluate PO Delay warning, danger, critical
        for (const pg of Object.values(poGroups)) {
          const allDone = pg.items.every((i) =>
            ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(i.currentStage?.toUpperCase())
          );
          if (allDone) continue; // PO is complete, no delays can trigger

          const elapsed = workingDaysBetween(pg.poDate, todayStr);
          if (elapsed !== null && elapsed > rule.threshold_value) {
            const message = `PO ${pg.po} is delayed by ${elapsed} days (Threshold: ${rule.threshold_value} days).`;
            await createAlertIfNew({
              ruleKey: rule.rule_key,
              severity: rule.severity,
              category: rule.category,
              message,
              itemKey: pg.po,
              recipients: rule.recipients,
              ruleName: rule.rule_name,
              eventType: 'PO_DELAYED',
              eventTitle: `PO ${pg.po} Delayed`,
              eventDesc: message
            });
          }
        }
      } else if (rule.category === 'VENDOR_DELAY') {
        // Evaluate Vendor SLA or Vendor delay warnings
        for (const row of rows) {
          if (row.inhouse !== 'VENDOR') continue;
          
          const aging = calculateVendorAging(row.timestamp, todayStr);
          if (aging !== null && aging > rule.threshold_value) {
            const message = `SC ${row.sc} (PO ${row.po || 'N/A'}) in stage ${row.currentStage} has been at vendor for ${aging} days (Threshold: ${rule.threshold_value} days).`;
            const itemKey = `${row.sc}||${row.product || 'unknown'}||${row.currentStage}`;
            
            await createAlertIfNew({
              ruleKey: rule.rule_key,
              severity: rule.severity,
              category: rule.category,
              message,
              itemKey,
              recipients: rule.recipients,
              ruleName: rule.rule_name,
              eventType: 'VENDOR_ALERT',
              eventTitle: `Vendor SLA Alert - SC ${row.sc}`,
              eventDesc: message
            });
          }
        }
      } else if (rule.category === 'PRODUCTION') {
        // Evaluate Stage Queue Backlog warning and critical
        for (const [stage, count] of Object.entries(stageGroups)) {
          if (count > rule.threshold_value) {
            const message = `Production stage '${stage}' has a backlog of ${count} active items (Threshold: ${rule.threshold_value}).`;
            await createAlertIfNew({
              ruleKey: rule.rule_key,
              severity: rule.severity,
              category: rule.category,
              message,
              itemKey: stage,
              recipients: rule.recipients,
              ruleName: rule.rule_name,
              eventType: 'PRODUCTION_ALERT',
              eventTitle: `Production Backlog - Stage ${stage}`,
              eventDesc: message
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error(logger.categories.SYNC, 'Error running Alert Engine', err);
  }
}

/**
 * Creates an alert and logs a timeline event if a duplicate active/unread alert doesn't exist.
 */
async function createAlertIfNew(params) {
  const {
    ruleKey,
    severity,
    category,
    message,
    itemKey,
    recipients,
    ruleName,
    eventType,
    eventTitle,
    eventDesc
  } = params;

  try {
    // Check for duplicates (unread alert with same rule and item)
    const checkRes = await pool.query(
      "SELECT id FROM alerts WHERE rule_key = $1 AND item_key = $2 AND status = 'unread'",
      [ruleKey, itemKey]
    );

    if (checkRes.rows.length > 0) {
      // Unread alert already exists, skip duplicate
      return;
    }

    // Insert alert
    const alertRes = await pool.query(
      `INSERT INTO alerts (rule_key, severity, category, message, item_key, status)
       VALUES ($1, $2, $3, $4, $5, 'unread')
       RETURNING id, created_at`,
      [ruleKey, severity, category, message, itemKey]
    );
    const newAlert = alertRes.rows[0];

    logger.warn(logger.categories.SECURITY, `Triggered alert: [${severity}] ${message}`);

    // Log event to operational timeline
    const timelineRes = await pool.query(
      `INSERT INTO operational_timeline (event_type, title, description, item_key, meta_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [eventType, eventTitle, eventDesc, itemKey, JSON.stringify({ alertId: newAlert.id, severity, ruleKey })]
    );
    const newTimelineEvent = timelineRes.rows[0];

    // Send WebSocket notification
    broadcast('alert:created', {
      id: newAlert.id,
      rule_key: ruleKey,
      severity,
      category,
      message,
      item_key: itemKey,
      created_at: newAlert.created_at
    });

    broadcast('timeline:created', {
      id: newTimelineEvent.id,
      event_type: eventType,
      title: eventTitle,
      description: eventDesc,
      item_key: itemKey,
      created_at: newTimelineEvent.created_at
    });

    // Send Email Alert (Queue Job)
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to handle alert creation: ${err.message}`, err);
  }
}

/**
 * Utility to log standard timeline events directly
 */
async function logTimelineEvent(eventType, title, description, itemKey = null, metaData = null) {
  try {
    const res = await pool.query(
      `INSERT INTO operational_timeline (event_type, title, description, item_key, meta_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [eventType, title, description, itemKey, metaData ? JSON.stringify(metaData) : null]
    );
    const event = res.rows[0];

    broadcast('timeline:created', {
      id: event.id,
      event_type: eventType,
      title,
      description,
      item_key: itemKey,
      created_at: event.created_at
    });
  } catch (err) {
    logger.error(logger.categories.DATABASE, `Failed to log timeline event: ${err.message}`, err);
  }
}

module.exports = {
  runAlertEngine,
  logTimelineEvent
};
