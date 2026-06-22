const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../utils/logger');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.EMAIL_USER || process.env.EMAIL_USER,
      pass: env.EMAIL_PASS || process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send an email with retry logic
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {number} retries - Number of retries left
 */
const sendEmail = async (options, retries = 3) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection configuration
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"Velan Dashboard" <${env.EMAIL_USER || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    logger.info(logger.categories.BACKGROUND, `Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(logger.categories.BACKGROUND, `Email sending failed (Retries left: ${retries}): ${error.message}`, error);
    
    if (retries > 0) {
      logger.info(logger.categories.BACKGROUND, `Retrying email to ${options.to} in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return sendEmail(options, retries - 1);
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Generate Delay Alert HTML
 */
const generateDelayAlertHtml = (poData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ff3d5a; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Delayed PO Alert</h2>
      </div>
      <div style="padding: 20px; background-color: #f9fafb; color: #333;">
        <p style="font-size: 16px;">The following PO has crossed the delay threshold of 21 days:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>PO:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${poData.po}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>SC:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${poData.sc}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Current Stage:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${poData.currentStage}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Cycle Time:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee; color: #e11d48; font-weight: bold;">${poData.cycleDays} Days</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Delay:</strong></td><td style="padding: 10px; border-bottom: 1px solid #eee;">${poData.delayDays} Days</td></tr>
          <tr><td style="padding: 10px;"><strong>Timestamp:</strong></td><td style="padding: 10px;">${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="margin-top: 20px; font-weight: bold; color: #d97706;">Action Required.</p>
      </div>
      <div style="background-color: #f1f5f9; padding: 10px; text-align: center; font-size: 12px; color: #64748b;">
        This is an automated message from Velan Dashboard Enterprise Notification System.
      </div>
    </div>
  `;
};

/**
 * Generate Weekly Summary HTML
 */
const generateWeeklySummaryHtml = (summaryData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0ea5e9; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Weekly Production Summary</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString()}</p>
      </div>
      <div style="padding: 20px; background-color: #f9fafb; color: #333;">
        <h3 style="color: #0284c7; border-bottom: 2px solid #e0f2fe; padding-bottom: 5px;">Production Output</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0;"><strong>Total Production Output:</strong></td><td style="text-align: right;">${summaryData.totalOutput}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Total Ready Sets:</strong></td><td style="text-align: right;">${summaryData.readySets}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Total Stores Sets:</strong></td><td style="text-align: right;">${summaryData.storesSets}</td></tr>
        </table>

        <h3 style="color: #0284c7; border-bottom: 2px solid #e0f2fe; padding-bottom: 5px;">Performance & Bottlenecks</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0;"><strong>Total Delayed POs (>21 days):</strong></td><td style="text-align: right; color: #e11d48; font-weight: bold;">${summaryData.delayedPOs}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>On-Time Completion:</strong></td><td style="text-align: right;">${summaryData.onTimePercent}%</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Vendor Workload:</strong></td><td style="text-align: right;">${summaryData.vendorWorkload}%</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Inhouse Workload:</strong></td><td style="text-align: right;">${summaryData.inhouseWorkload}%</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Top Bottleneck Stage:</strong></td><td style="text-align: right;">${summaryData.topBottleneck}</td></tr>
        </table>
        
        <h3 style="color: #0284c7; border-bottom: 2px solid #e0f2fe; padding-bottom: 5px;">Throughput Trend</h3>
        <p>${summaryData.weeklyTrend}</p>
      </div>
      <div style="background-color: #f1f5f9; padding: 10px; text-align: center; font-size: 12px; color: #64748b;">
        This is an automated message from Velan Dashboard Enterprise Notification System.
      </div>
    </div>
  `;
};

module.exports = {
  sendEmail,
  generateDelayAlertHtml,
  generateWeeklySummaryHtml,
};
