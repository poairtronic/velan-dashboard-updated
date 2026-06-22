const cron = require('node-cron');
const { processDelayAlerts, processWeeklySummary } = require('../services/notificationService');
const logger = require('../utils/logger');

// Run Delay Checks every day at 09:00 AM
// node-cron format: '0 9 * * *'
cron.schedule('0 9 * * *', async () => {
  try {
    logger.info(logger.categories.BACKGROUND, 'Running scheduled cron job: processDelayAlerts');
    await processDelayAlerts();
  } catch (err) {
    logger.error(logger.categories.BACKGROUND, `Error in delay alerts cron job: ${err.message}`, err);
  }
});

// Run Weekly Summary every Monday at 08:00 AM IST
// node-cron format: '0 8 * * 1'
cron.schedule('0 8 * * 1', async () => {
  try {
    logger.info(logger.categories.BACKGROUND, 'Running scheduled cron job: processWeeklySummary');
    await processWeeklySummary();
  } catch (err) {
    logger.error(logger.categories.BACKGROUND, `Error in weekly summary cron job: ${err.message}`, err);
  }
});

logger.info(logger.categories.BACKGROUND, 'Notification cron jobs initialized');
