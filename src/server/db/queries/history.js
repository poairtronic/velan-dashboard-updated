// SQL queries for KPI Historical Trends

const HISTORICAL_OUTPUT_QUERY = `
  SELECT 
    DATE(data->>'timestamp') AS date,
    COUNT(*) AS value
  FROM velan_rows
  WHERE data->>'currentStage' IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
    AND data->>'timestamp' IS NOT NULL
    AND CAST(data->>'timestamp' AS TIMESTAMP) >= CURRENT_DATE - INTERVAL '$1 days'
  GROUP BY DATE(data->>'timestamp')
  ORDER BY date ASC
`;

// Note: OTD, Plant Health, Vendor SLA, Cycle Time require complex processing
// We will query raw data for the last $1 days and process in JS.
const RAW_HISTORICAL_ROWS_QUERY = `
  SELECT data 
  FROM velan_rows
  WHERE added_at >= CURRENT_DATE - INTERVAL '$1 days'
`;

module.exports = {
  HISTORICAL_OUTPUT_QUERY,
  RAW_HISTORICAL_ROWS_QUERY
};
