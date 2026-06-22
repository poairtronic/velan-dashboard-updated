const express = require('express');
const { pool } = require('../db/pool');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const { z } = require('zod');

const router = express.Router();

/**
 * GET /api/notifications/logs
 * Returns notification history
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT id, type, "poNumber", recipient, status, "sentAt", "createdAt" 
       FROM notification_logs 
       ORDER BY "createdAt" DESC 
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );
    
    const countRes = await pool.query(`SELECT COUNT(*) FROM notification_logs`);
    const total = parseInt(countRes.rows[0].count, 10);
    
    res.json({ logs: result.rows, total });
  } catch (error) {
    logger.error(logger.categories.API, `Error fetching notification logs: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/notifications/settings
 * Returns email notification settings
 */
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(`SELECT setting_key, enabled, recipients FROM notification_settings`);
    res.json(result.rows);
  } catch (error) {
    logger.error(logger.categories.API, `Error fetching notification settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/notifications/settings
 * Updates email notification settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body; // Expects array [{ setting_key, enabled, recipients }]
    
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const setting of settings) {
        await client.query(
          `INSERT INTO notification_settings (setting_key, enabled, recipients, "updatedAt") 
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (setting_key) 
           DO UPDATE SET enabled = EXCLUDED.enabled, recipients = EXCLUDED.recipients, "updatedAt" = NOW()`,
          [setting.setting_key, setting.enabled, setting.recipients]
        );
      }
      
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(logger.categories.API, `Error updating notification settings: ${error.message}`);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/notifications/test
 * Sends a test email
 */
router.post('/test', async (req, res) => {
  try {
    const schema = z.object({
      to: z.string().email(),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const result = await sendEmail({
      to: parsed.data.to,
      subject: '[VELAN] Test Email Notification',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #0ea5e9;">Test Email Successful</h2>
          <p>Your enterprise email notification system is working correctly.</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Velan Dashboard Settings</p>
        </div>
      `
    });
    
    if (result.success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email. Check logs.' });
    }
  } catch (error) {
    logger.error(logger.categories.API, `Error sending test email: ${error.message}`);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

module.exports = router;
