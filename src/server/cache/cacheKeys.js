module.exports = {
  DASHBOARD_DATA: (page, limit, search) => `dashboard:data:${page}:${limit}:${search || 'all'}`,
  DASHBOARD_LIVE: 'dashboard:live',
  DASHBOARD_STATS: 'dashboard:stats',
  USERS_LIST: 'users:list',
  USER_PROFILE: (userId) => `users:profile:${userId}`,
  REPORTS_STATUS: (jobId) => `reports:status:${jobId}`,
  SYNC_LOGS: 'sync:logs'
};
