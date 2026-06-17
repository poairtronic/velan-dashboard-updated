// SQL queries for Executive War Room

const EXECUTIVE_WAR_ROOM_QUERY = `
  SELECT 
    data->>'po' AS po,
    data->>'sc' AS sc,
    data->>'currentStage' AS stage,
    data->>'poDate' AS po_date,
    data->>'timestamp' AS timestamp,
    data->>'inhouse' AS inhouse
  FROM velan_live_rows
  WHERE data->>'currentStage' NOT IN ('READY', 'STORES', 'STOCK', 'EXSTOCK')
`;

module.exports = {
  EXECUTIVE_WAR_ROOM_QUERY
};
