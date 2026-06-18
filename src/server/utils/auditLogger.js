const { pool } = require('../db/pool');

async function logAudit({ req, userId, userEmail, action, entityType, entityId, metadata }) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : null;
    const uid = userId || (req && req.user ? req.user.id : null);
    const email = userEmail || (req && req.user ? req.user.email || req.user.username : null);
    
    await pool.query(
      `INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uid, email, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, ip]
    );
  } catch (err) {
    console.error('[logAudit] Failed to log audit event:', err.message);
  }
}

module.exports = { logAudit };
