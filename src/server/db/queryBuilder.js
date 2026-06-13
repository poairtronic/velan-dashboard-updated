const { pool, isMock } = require('./pool');

// Helper to build the base unified dataset query
function getBaseUnifiedQuery() {
  return `
    WITH combined AS (
      SELECT row_key, data, TRUE as is_live, added_at FROM velan_live_rows
      UNION ALL
      SELECT row_key, data, FALSE as is_live, added_at FROM velan_rows
    ),
    deduped AS (
      SELECT DISTINCT ON (
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', '')
      ) data, is_live, added_at
      FROM combined
      ORDER BY 
        COALESCE(data->>'sc', ''), 
        COALESCE(data->>'po', ''), 
        COALESCE(data->>'product', ''), 
        COALESCE(data->>'currentStage', data->>'op', data->>'OP', ''),
        is_live DESC,
        added_at DESC
    )
  `;
}

function buildFilterWhereClause(filters, paramOffset = 1) {
  const whereClauses = [];
  const params = [];
  let idx = paramOffset;

  if (filters.search) {
    whereClauses.push(`(data->>'sc' ILIKE $${idx} OR data->>'po' ILIKE $${idx} OR data->>'product' ILIKE $${idx} OR data->>'currentStage' ILIKE $${idx} OR data->>'op' ILIKE $${idx} OR data->>'vendor' ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  if (filters.stage) {
    whereClauses.push(`(data->>'currentStage' = $${idx} OR data->>'op' = $${idx} OR data->>'OP' = $${idx})`);
    params.push(filters.stage);
    idx++;
  }

  if (filters.vendor) {
    whereClauses.push(`data->>'vendor' = $${idx}`);
    params.push(filters.vendor);
    idx++;
  }

  if (filters.status) {
    whereClauses.push(`(data->>'status1' = $${idx} OR data->>'status2' = $${idx})`);
    params.push(filters.status);
    idx++;
  }

  if (filters.dateFrom) {
    whereClauses.push(`(data->>'timestamp') >= $${idx}`);
    params.push(filters.dateFrom);
    idx++;
  }

  if (filters.dateTo) {
    whereClauses.push(`(data->>'timestamp') <= $${idx}`);
    params.push(filters.dateTo);
    idx++;
  }

  if (filters.poDateStart) {
    whereClauses.push(`(data->>'poDate') >= $${idx}`);
    params.push(filters.poDateStart);
    idx++;
  }

  if (filters.poDateEnd) {
    whereClauses.push(`(data->>'poDate') <= $${idx}`);
    params.push(filters.poDateEnd);
    idx++;
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  return { whereSql, params, nextIdx: idx };
}

async function getPaginatedData(filters, page = 1, limit = 100) {
  if (isMock) {
    // Basic mock handling if needed
    const res = await pool.query('SELECT data FROM velan_rows LIMIT $1 OFFSET $2', [limit, (page - 1) * limit]);
    return { rows: res.rows.map(r => r.data), total: res.rows.length };
  }

  const offset = (page - 1) * limit;
  const { whereSql, params, nextIdx } = buildFilterWhereClause(filters, 1);
  
  const querySql = `
    ${getBaseUnifiedQuery()}
    SELECT data, is_live
    FROM deduped
    ${whereSql}
    ORDER BY added_at DESC
    LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
  `;

  const countSql = `
    ${getBaseUnifiedQuery()}
    SELECT COUNT(*) as total
    FROM deduped
    ${whereSql}
  `;

  const client = await pool.connect();
  try {
    const queryParams = [...params, limit, offset];
    const [dataRes, countRes] = await Promise.all([
      client.query(querySql, queryParams),
      client.query(countSql, params)
    ]);

    const rows = dataRes.rows.map(r => ({ ...r.data, _isLive: r.is_live }));
    const total = parseInt(countRes.rows[0].total, 10);

    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  } finally {
    client.release();
  }
}

// KPI Queries
async function getDashboardKPIs(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      COUNT(*) as "totalRows",
      COUNT(DISTINCT data->>'po') as "totalPOs",
      SUM(CASE WHEN (data->>'currentStage' IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')) THEN 1 ELSE 0 END) as "ready",
      SUM(CASE WHEN (data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')) THEN 1 ELSE 0 END) as "wip",
      SUM(CASE WHEN (data->>'inhouse' = 'INHOUSE') THEN 1 ELSE 0 END) as "inhouseCount",
      SUM(CASE WHEN (data->>'inhouse' = 'VENDOR') THEN 1 ELSE 0 END) as "vendorCount",
      SUM(CASE WHEN (EXTRACT(DAY FROM NOW() - CAST(NULLIF(data->>'poDate', '') AS TIMESTAMP)) > 21) THEN 1 ELSE 0 END) as "delayed"
    FROM deduped
    ${whereSql}
  `;

  const chartsSql = `
    ${getBaseUnifiedQuery()}
    SELECT data->>'currentStage' as stage, COUNT(*) as count FROM deduped ${whereSql} GROUP BY stage;
  `;

  if (isMock) {
    return { totalRows: 0, totalPOs: 0, ready: 0, wip: 0, inhouseCount: 0, vendorCount: 0, delayed: 0, stageCounts: {} };
  }

  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    const chartsRes = await client.query(chartsSql, params);

    const stats = res.rows[0];
    const stageCounts = {};
    chartsRes.rows.forEach(r => {
      if(r.stage) stageCounts[r.stage] = parseInt(r.count, 10);
    });

    return {
      totalRows: parseInt(stats.totalRows || 0, 10),
      totalPOs: parseInt(stats.totalPOs || 0, 10),
      ready: parseInt(stats.ready || 0, 10),
      wip: parseInt(stats.wip || 0, 10),
      inhouseCount: parseInt(stats.inhouseCount || 0, 10),
      vendorCount: parseInt(stats.vendorCount || 0, 10),
      delayed: parseInt(stats.delayed || 0, 10),
      stageCounts
    };
  } finally {
    client.release();
  }
}

async function getBottlenecks(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      COALESCE(data->>'currentStage', data->>'op', data->>'OP', 'Unknown') as stage,
      COUNT(*) as queue_size,
      AVG(EXTRACT(DAY FROM NOW() - CAST(NULLIF(data->>'timestamp', '') AS TIMESTAMP))) as avg_days
    FROM deduped
    ${whereSql}
    GROUP BY stage
    ORDER BY queue_size DESC
    LIMIT 10
  `;

  if (isMock) return [];

  const res = await pool.query(sql, params);
  return res.rows.map(r => ({
    stage: r.stage,
    queueSize: parseInt(r.queue_size, 10),
    avgDays: parseFloat(r.avg_days || 0).toFixed(1)
  }));
}

async function getVendorStats(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      COALESCE(data->>'vendor', 'Unknown') as vendor,
      COUNT(*) as row_count,
      SUM(CAST(NULLIF(data->>'qty', '') AS NUMERIC)) as total_qty
    FROM deduped
    ${whereSql}
    GROUP BY vendor
    ORDER BY row_count DESC
    LIMIT 20
  `;

  if (isMock) return [];

  const res = await pool.query(sql, params);
  return res.rows.map(r => ({
    vendor: r.vendor,
    rowCount: parseInt(r.row_count, 10),
    totalQty: parseFloat(r.total_qty || 0)
  }));
}

async function getCycleTimeStats(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  
  // Fetch required fields for all deduped rows matching filters
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      data->>'sc' as sc,
      data->>'poDate' as "poDate",
      data->>'timestamp' as "timestamp",
      data->>'currentStage' as "currentStage"
    FROM deduped
    ${whereSql}
  `;

  if (isMock) return { stageCycleTimes: [], avgOverallCycle: 0 };

  const res = await pool.query(sql, params);
  const rows = res.rows;

  const scRecordMap = {};
  rows.forEach((r) => {
    if (!r.sc) return;
    if (!scRecordMap[r.sc]) scRecordMap[r.sc] = [];
    scRecordMap[r.sc].push(r);
  });

  const stageDurations = {};
  Object.values(scRecordMap).forEach((records) => {
    const sorted = records.sort((a, b) => {
      const tA = new Date(a.timestamp || 0);
      const tB = new Date(b.timestamp || 0);
      return tA - tB;
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.currentStage || !current.timestamp || !next.timestamp) continue;
      
      const t1 = new Date(current.timestamp).getTime();
      const t2 = new Date(next.timestamp).getTime();
      const daysDiff = (t2 - t1) / (1000 * 60 * 60 * 24);
      
      if (daysDiff >= 0) {
        const stage = current.currentStage;
        if (!stageDurations[stage]) stageDurations[stage] = [];
        stageDurations[stage].push(daysDiff);
      }
    }
  });

  const stageAvgDuration = {};
  Object.entries(stageDurations).forEach(([stage, durations]) => {
    const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    stageAvgDuration[stage] = Math.round(avg);
  });

  const stageAccum = {};
  rows.forEach((r) => {
    if (!r.timestamp || !r.poDate || !r.currentStage) return;
    const t1 = new Date(r.poDate).getTime();
    const t2 = new Date(r.timestamp).getTime();
    const days = (t2 - t1) / (1000 * 60 * 60 * 24);
    if (days >= 0) {
      if (!stageAccum[r.currentStage]) stageAccum[r.currentStage] = [];
      stageAccum[r.currentStage].push(days);
    }
  });

  const stageAvgToReach = {};
  Object.entries(stageAccum).forEach(([stage, vals]) => {
    stageAvgToReach[stage] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  const stageCycleTimes = Object.entries(stageAvgDuration)
    .map(([stage, duration]) => {
      const avgToReach = stageAvgToReach[stage] || 0;
      const count = stageDurations[stage] ? stageDurations[stage].length : 0;
      return { stage, avgToReach, duration, count };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => a.avgToReach - b.avgToReach);

  const itemCycleDays = rows
    .filter(r => r.poDate && r.timestamp)
    .map((r) => {
      const t1 = new Date(r.poDate).getTime();
      const t2 = new Date(r.timestamp).getTime();
      return (t2 - t1) / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0);

  const avgOverallCycle = itemCycleDays.length > 0
    ? Math.round(itemCycleDays.reduce((a, b) => a + b, 0) / itemCycleDays.length)
    : null;

  return { stageCycleTimes, avgOverallCycle };
}

async function getScGroups(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      data->>'sc' as sc,
      MAX(data->>'po') as po,
      MAX(data->>'poDate') as "poDate",
      COUNT(*) as itemCount,
      MAX(data->>'timestamp') as "lastTs",
      SUM(CASE WHEN data->>'currentStage' IN ('READY', 'STORES', 'STOCK', 'EXSTOCK') THEN 1 ELSE 0 END) as "doneCount"
    FROM deduped
    ${whereSql}
    GROUP BY data->>'sc'
    ORDER BY "lastTs" DESC NULLS LAST
  `;
  if (isMock) return [];
  const res = await pool.query(sql, params);
  return res.rows.map(r => ({
    sc: r.sc,
    po: r.po,
    poDate: r.poDate,
    itemsLength: parseInt(r.itemCount, 10),
    lastTs: r.lastTs,
    done: parseInt(r.doneCount, 10) === parseInt(r.itemCount, 10)
  }));
}

async function getPoGroups(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT 
      data->>'po' as po,
      MAX(data->>'poDate') as "poDate",
      COUNT(*) as itemCount,
      COUNT(DISTINCT data->>'sc') as scCount,
      MAX(data->>'timestamp') as "lastTs",
      SUM(CASE WHEN data->>'currentStage' IN ('READY', 'STORES', 'STOCK', 'EXSTOCK') THEN 1 ELSE 0 END) as "doneCount"
    FROM deduped
    ${whereSql}
    GROUP BY data->>'po'
    ORDER BY "lastTs" DESC NULLS LAST
  `;
  if (isMock) return [];
  const res = await pool.query(sql, params);
  return res.rows.map(r => ({
    po: r.po,
    poDate: r.poDate,
    itemsLength: parseInt(r.itemCount, 10),
    scCount: parseInt(r.scCount, 10),
    lastTs: r.lastTs,
    done: parseInt(r.doneCount, 10) === parseInt(r.itemCount, 10)
  }));
}

async function getDatabaseKPIs(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  const sql = `
    ${getBaseUnifiedQuery()}
    ,
    sc_stats AS (
      SELECT 
        data->>'sc' as sc,
        COUNT(*) as total_items,
        SUM(CASE WHEN data->>'currentStage' IN ('READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK') THEN 1 ELSE 0 END) as done_items,
        SUM(CASE WHEN data->>'currentStage' IN ('READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK', 'VA') THEN 1 ELSE 0 END) as done_or_va_items
      FROM deduped
      ${whereSql}
      GROUP BY data->>'sc'
    )
    SELECT 
      (SELECT COUNT(*) FROM deduped ${whereSql}) as "totalRows",
      (SELECT COUNT(DISTINCT data->>'po') FROM deduped ${whereSql}) as "uniquePO",
      (SELECT COUNT(DISTINCT sc) FROM sc_stats) as "uniqueSC",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'currentStage' IN ('READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK')) as "readyItemsCount",
      (SELECT COUNT(*) FROM sc_stats WHERE done_items = total_items) as "scCompleted",
      (SELECT COUNT(*) FROM sc_stats WHERE done_or_va_items = total_items) as "scCompletedPlusVA",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'currentStage' = 'VA') as "vaCount"
  `;
  if (isMock) return { totalRows: 0, uniquePO: 0, uniqueSC: 0, readyItemsCount: 0, scCompleted: 0, scCompletedPlusVA: 0, vaBreakdown: {} };
  
  const res = await pool.query(sql, params);
  const row = res.rows[0] || {};
  
  return {
    total: parseInt(row.totalRows || 0, 10),
    uniquePO: parseInt(row.uniquePO || 0, 10),
    uniqueSC: parseInt(row.uniqueSC || 0, 10),
    readyItemsCount: parseInt(row.readyItemsCount || 0, 10),
    scCompleted: parseInt(row.scCompleted || 0, 10),
    scCompletedPlusVA: parseInt(row.scCompletedPlusVA || 0, 10),
    vaBreakdown: {
      READY: 0, STOCK: 0, STORES: 0, EXSTOCK: 0, VA: parseInt(row.vaCount || 0, 10)
    },
    // Adding dummy counts for others to prevent frontend errors
    scReceived: 0, scReady: 0, scSetsReceived: 0, scSetsCompleted: 0, scSetsCompletedTotal: 0
  };
}

module.exports = {
  getPaginatedData,
  getDashboardKPIs,
  getBottlenecks,
  getVendorStats,
  getCycleTimeStats,
  getScGroups,
  getDatabaseKPIs,
  getProductionKPIs,
  getFilterOptions
};

async function getProductionKPIs(filters) {
  const { whereSql, params } = buildFilterWhereClause(filters, 1);
  const sql = `
    ${getBaseUnifiedQuery()}
    ,
    sc_stats AS (
      SELECT 
        data->>'sc' as sc,
        MAX(data->>'po') as po,
        MAX(data->>'poDate') as "poDate",
        COUNT(*) as total_items,
        SUM(CASE WHEN data->>'currentStage' = 'READY' THEN 1 ELSE 0 END) as ready_items,
        SUM(CASE WHEN data->>'currentStage' IN ('STORES', 'STORE') THEN 1 ELSE 0 END) as store_items,
        SUM(CASE WHEN data->>'currentStage' IN ('READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK') THEN 1 ELSE 0 END) as done_items,
        MAX(data->>'timestamp') as "lastTs"
      FROM deduped
      ${whereSql}
      GROUP BY data->>'sc'
    ),
    date_series AS (
      SELECT 
        SUBSTRING(data->>'timestamp' FOR 10) as "date",
        SUM(CASE WHEN data->>'currentStage' = 'READY' THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN data->>'currentStage' IN ('STORES', 'STORE') THEN 1 ELSE 0 END) as stores,
        SUM(CASE WHEN data->>'currentStage' NOT IN ('READY', 'STORES', 'STORE') THEN 1 ELSE 0 END) as wip
      FROM deduped
      ${whereSql}
      GROUP BY SUBSTRING(data->>'timestamp' FOR 10)
    )
    SELECT
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'currentStage' = 'READY') as "readyCount",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'currentStage' IN ('STORES', 'STORE')) as "storeCount",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'type' IN ('APG', 'ARG') AND data->>'currentStage' IN ('READY', 'STORES', 'STORE')) as "airplugOutputCount",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'type' IN ('SRG', 'SP') AND data->>'currentStage' IN ('READY', 'STORES', 'STORE')) as "masterOutputCount",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'type' IN ('APG', 'ARG')) as "airplugTotal",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'type' IN ('SRG', 'SP')) as "masterTotal",
      (SELECT COUNT(*) FROM deduped ${whereSql} WHERE data->>'type' NOT IN ('APG', 'ARG', 'SRG', 'SP')) as "accessoryTotal",
      (SELECT json_agg(row_to_json(sc_stats)) FROM sc_stats WHERE ready_items = total_items) as "readySets",
      (SELECT json_agg(row_to_json(sc_stats)) FROM sc_stats WHERE store_items > 0 AND done_items = total_items) as "storeSets",
      (SELECT json_agg(row_to_json(date_series)) FROM date_series WHERE date IS NOT NULL) as "dateSeries"
  `;
  if (isMock) return null;
  
  const res = await pool.query(sql, params);
  const row = res.rows[0] || {};
  
  const readySets = row.readySets || [];
  const storeSets = row.storeSets || [];
  
  // Compute scDailyOutput
  const scDailyMap = {};
  readySets.forEach(s => {
    const d = (s.lastTs || '').substring(0, 10);
    if (!d) return;
    if (!scDailyMap[d]) scDailyMap[d] = { date: d, readySets: 0, storeSets: 0 };
    scDailyMap[d].readySets++;
  });
  storeSets.forEach(s => {
    const d = (s.lastTs || '').substring(0, 10);
    if (!d) return;
    if (!scDailyMap[d]) scDailyMap[d] = { date: d, readySets: 0, storeSets: 0 };
    scDailyMap[d].storeSets++;
  });
  const scDailyOutput = Object.values(scDailyMap).sort((a,b) => a.date.localeCompare(b.date));

  const cats = {
    AIRPLUG: parseInt(row.airplugTotal || 0, 10),
    MASTER: parseInt(row.masterTotal || 0, 10),
    ACCESSORY: parseInt(row.accessoryTotal || 0, 10)
  };

  return {
    ready: parseInt(row.readyCount || 0, 10),
    stores: parseInt(row.storeCount || 0, 10),
    airplugOutputCount: parseInt(row.airplugOutputCount || 0, 10),
    masterOutputCount: parseInt(row.masterOutputCount || 0, 10),
    cats,
    readySets,
    storeSets,
    scDailyOutput,
    dateSeries: (row.dateSeries || []).sort((a,b) => a.date.localeCompare(b.date))
  };
}

async function getFilterOptions() {
  const sql = `
    ${getBaseUnifiedQuery()}
    SELECT
      (SELECT json_agg(DISTINCT data->>'po') FROM deduped WHERE data->>'po' IS NOT NULL) as pos,
      (SELECT json_agg(DISTINCT data->>'currentStage') FROM deduped WHERE data->>'currentStage' IS NOT NULL) as stages,
      (SELECT json_agg(DISTINCT data->>'type') FROM deduped WHERE data->>'type' IS NOT NULL) as types
  `;
  if (isMock) return { uniquePOs: [], uniqueStages: [], uniqueTypes: [] };
  const res = await pool.query(sql);
  const row = res.rows[0] || {};
  return {
    uniquePOs: (row.pos || []).sort(),
    uniqueStages: (row.stages || []).sort(),
    uniqueTypes: (row.types || []).sort()
  };
}
