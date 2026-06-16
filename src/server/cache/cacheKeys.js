const crypto = require('crypto');

function hashFilters(filters) {
  if (!filters || Object.keys(filters).length === 0) return 'all';
  const str = JSON.stringify(filters, Object.keys(filters).sort());
  return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = {
  DASHBOARD_DATA: (page, limit, search) => `dashboard:data:${page}:${limit}:${search || 'all'}`,
  DASHBOARD_LIVE: 'dashboard:live',
  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_KPIS: (filters) => `dashboard:kpis:${hashFilters(filters)}`,
  DASHBOARD_BOTTLENECKS: (filters) => `dashboard:bottlenecks:${hashFilters(filters)}`,
  DASHBOARD_VENDORS: (filters) => `dashboard:vendors:${hashFilters(filters)}`,
  DASHBOARD_CYCLE_TIME: (filters) => `dashboard:cycleTime:${hashFilters(filters)}`,
  DASHBOARD_OVERVIEW: (filters) => `dashboard:overview:${hashFilters(filters)}`,
  USERS_LIST: 'users:list',
  USER_PROFILE: (userId) => `users:profile:${userId}`,
  REPORTS_STATUS: (jobId) => `reports:status:${jobId}`,
  SYNC_LOGS: 'sync:logs'
};
