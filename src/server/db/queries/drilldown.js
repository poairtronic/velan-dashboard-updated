// SQL queries for KPI Drilldowns

const OTD_DRILLDOWN_QUERY = `
  SELECT 
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'inhouse' AS inhouse,
    data->>'currentStage' AS stage,
    data->>'poDate' AS po_date
  FROM velan_live_rows
  WHERE data->>'poDate' IS NOT NULL
    AND data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
`;

const BOTTLENECK_DRILLDOWN_QUERY = `
  SELECT 
    data->>'currentStage' AS stage,
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'inhouse' AS inhouse
  FROM velan_live_rows
  WHERE data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
`;

const BOTTLENECK_HISTORICAL_QUERY = `
  SELECT 
    data->>'currentStage' AS stage,
    DATE(added_at) AS added_date,
    COUNT(DISTINCT data->>'po') AS po_count
  FROM velan_rows
  WHERE data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
    AND added_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY data->>'currentStage', DATE(added_at)
`;

const VENDOR_DRILLDOWN_QUERY = `
  SELECT 
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'currentStage' AS stage,
    data->>'timestamp' AS timestamp,
    data->>'poDate' AS po_date
  FROM velan_live_rows
  WHERE data->>'inhouse' = 'VENDOR'
    AND data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
`;

const VENDOR_HISTORICAL_QUERY = `
  SELECT 
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'currentStage' AS stage,
    data->>'timestamp' AS timestamp,
    data->>'poDate' AS po_date
  FROM velan_rows
  WHERE data->>'inhouse' = 'VENDOR'
    AND data->>'currentStage' IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
`;

const INVENTORY_DRILLDOWN_QUERY = `
  SELECT 
    data->>'currentStage' AS stage,
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'timestamp' AS timestamp
  FROM velan_live_rows
  WHERE data->>'currentStage' IN ('READY', 'STORES', 'STOCK')
`;

module.exports = {
  OTD_DRILLDOWN_QUERY,
  BOTTLENECK_DRILLDOWN_QUERY,
  BOTTLENECK_HISTORICAL_QUERY,
  VENDOR_DRILLDOWN_QUERY,
  VENDOR_HISTORICAL_QUERY,
  INVENTORY_DRILLDOWN_QUERY
};
