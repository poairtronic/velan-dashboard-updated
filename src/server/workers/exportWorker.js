const { Worker } = require('bullmq');
const { MockWorker } = require('../queues/mockQueueHelper');
const { getFilteredData, getAllRawData, getMergedData } = require('../services/dataQueryService');
const redisClient = require('../cache/redisClient');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const logger = require('../utils/logger');

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const isMock = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

// Date formatting helpers matching frontend dateUtils
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const s = String(isoStr).trim().substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}`;
  }
  return s || '—';
}

function fmtTs(tsStr) {
  if (!tsStr) return '—';
  const s = String(tsStr).trim();
  const datePart = s.substring(0, 10);
  const timePart = s.substring(11, 16);
  const d = fmtDate(datePart);
  return timePart ? `${d} ${timePart}` : d;
}

const isDoneStage = (s) => {
  if (!s) return false;
  const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
  return (
    ['READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK', 'VA'].includes(t) ||
    /^STOCK[K]?$/.test(t) ||
    /^READ{1,2}Y$/.test(t)
  );
};

const getLatestPerProduct = (rows) => {
  const latestMap = {};
  rows.forEach((r) => {
    const key = (r.product || '__none__').trim();
    const ex = latestMap[key];
    if (!ex) {
      latestMap[key] = r;
      return;
    }
    const rDone = isDoneStage(r.currentStage);
    const exDone = isDoneStage(ex.currentStage);
    if (rDone && !exDone) {
      latestMap[key] = r;
      return;
    }
    if (!rDone && exDone) return;
    if (r._isLive && !ex._isLive) {
      latestMap[key] = r;
      return;
    }
    if (!r._isLive && ex._isLive) return;
    if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) {
      latestMap[key] = r;
    }
  });
  return Object.values(latestMap);
};

const workerHandler = async (job) => {
  console.log(`[ExportWorker] Starting job ${job.id} of type ${job.name}`);
  const { type, filters = {}, search = '' } = job.data;
  
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Combine filters and search parameter
  const queryFilters = { ...filters };
  if (search) queryFilters.search = search;
  queryFilters.source = 'database'; // Archive source

  // 1. Get filtered rows from DB
  const filtered = await getFilteredData(queryFilters, todayStr);
  console.log(`[ExportWorker] Retrieved ${filtered.length} filtered rows for generation.`);

  let base64Data = '';
  let filename = `database_export_${job.id}`;

  if (type === 'json') {
    const jsonStr = JSON.stringify(filtered, null, 2);
    base64Data = Buffer.from(jsonStr).toString('base64');
    filename += '.json';
  } else if (type === 'csv') {
    const header = filtered.length > 0 
      ? Object.keys(filtered[0]) 
      : ['sc', 'po', 'poDate', 'product', 'currentStage', 'inhouse', 'timestamp'];
    
    const rows = filtered.map((r) =>
      header.map((h) => {
        let val = r[h];
        if (val === undefined || val === null) val = '';
        // Format dates if applicable
        if (h === 'poDate' && val) val = fmtDate(val);
        else if (h === 'timestamp' && val) val = fmtTs(val);
        return `"${val.toString().replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvStr = [header.join(','), ...rows].join('\n');
    base64Data = Buffer.from(csvStr).toString('base64');
    filename += '.csv';
  } else if (type === 'pdf') {
    // 2. Perform KPI calculations for PDF header
    const { liveRows, dbRows } = await getAllRawData();
    
    // We get all merged rows (unfiltered) to find allScItems
    const data = await getMergedData(todayStr);

    const uniquePO = new Set(filtered.map((r) => r.po).filter(Boolean)).size;
    const uniqueSC = new Set(filtered.map((r) => r.sc).filter(Boolean)).size;
    
    const scReceivedSet = new Set(
      filtered
        .filter((r) => r.poDate)
        .map((r) => r.sc)
        .filter(Boolean)
    );
    const scReceived = scReceivedSet.size;

    // Build allScItems Map
    const allScItems = {};
    data.forEach((r) => {
      if (!r.sc) return;
      if (!allScItems[r.sc]) allScItems[r.sc] = [];
      allScItems[r.sc].push(r);
    });

    const filteredScGroups = {};
    filtered.forEach((r) => {
      if (!r.sc) return;
      if (!filteredScGroups[r.sc]) filteredScGroups[r.sc] = [];
      filteredScGroups[r.sc].push(r);
    });

    const hasNonDateFilter = Object.keys(filters).some(
      (k) => !['fromDate', 'toDate', 'dateType', 'source', 'page', 'limit'].includes(k) && filters[k]
    ) || !!search;

    const scsToCheck = hasNonDateFilter ? Object.keys(filteredScGroups) : Object.keys(allScItems);

    const scCompletedSet = new Set(
      scsToCheck.filter((sc) => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProduct(allRowsForSC);
        if (!(latestRows.length > 0 && latestRows.every((r) => isDoneStage(r.currentStage)))) {
          return false;
        }
        if (filters.fromDate || filters.toDate) {
          const dateField = filters.dateType === 'poDate' ? 'poDate' : 'timestamp';
          return latestRows.some((r) => {
            const d = (r[dateField] || '').slice(0, 10);
            if (!d) return false;
            if (filters.fromDate && d < filters.fromDate) return false;
            if (filters.toDate && d > filters.toDate) return false;
            return true;
          });
        }
        return true;
      })
    );
    const scCompleted = scCompletedSet.size;
    const scReady = scCompleted;

    // Filter rows to export (READY / STORES / STOCK only)
    const exportRows = filtered.filter((r) => isDoneStage(r.currentStage));

    // Generate PDF using jsPDF and jsPDF-autotable
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    
    doc.setFontSize(14);
    doc.text('Velan Metrology – Database Export', 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    
    const dateRange =
      filters.fromDate || filters.toDate 
        ? ` | Date range: ${filters.fromDate || '-'} to ${filters.toDate || '-'}` 
        : '';
    
    doc.text(`Exported Rows: ${exportRows.length}  (READY / STORES / STOCK only)${dateRange}`, 40, 52);
    doc.text(
      `Unique POs: ${uniquePO}   SC Sets: ${uniqueSC}   SC Received: ${scReceived}   SC Completed: ${scCompleted}   SC Ready: ${scReady}`,
      40,
      66
    );

    const columns = [
      { header: 'SC', dataKey: 'sc' },
      { header: 'PO', dataKey: 'po' },
      { header: 'PO DATE', dataKey: 'poDate' },
      { header: 'PRODUCT', dataKey: 'product' },
      { header: 'STAGE', dataKey: 'currentStage' },
      { header: 'INHOUSE', dataKey: 'inhouse' },
      { header: 'TIMESTAMP', dataKey: 'timestamp' },
    ];

    const tableRows = exportRows.map((r) => ({
      sc: r.sc || '',
      po: r.po || '',
      poDate: r.poDate ? fmtDate(r.poDate) : '',
      product: r.product || '',
      currentStage: r.currentStage || '',
      inhouse: r.inhouse || '',
      timestamp: r.timestamp ? fmtTs(r.timestamp) : '',
    }));

    doc.autoTable({
      columns,
      body: tableRows,
      startY: 82,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 100, 180] },
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      bodyStyles: { textColor: 20 },
    });

    const pdfBuffer = doc.output('arraybuffer');
    base64Data = Buffer.from(pdfBuffer).toString('base64');
    filename += '.pdf';
  } else {
    throw new Error(`Unsupported export type: ${type}`);
  }

  // Save the generated document directly in Redis with a 1-hour expiration TTL (3600s)
  const fileKey = `export:${job.id}`;
  const fileMeta = {
    type,
    filename,
    base64: base64Data
  };
  await redisClient.set(fileKey, JSON.stringify(fileMeta), { ex: 3600 });

  const fileUrl = `/api/reports/download/${job.id}`;
  logger.info(logger.categories.EXPORT, `[ExportWorker] Completed job ${job.id}. Saved to Redis key: ${fileKey}`);

  // Log to operational timeline
  try {
    const { logTimelineEvent } = require('../services/alertEngine');
    await logTimelineEvent('EXPORT_GENERATED', 'Report Export Generated', `Exported ${type.toUpperCase()} report with ${filtered.length} rows.`, null, { jobId: job.id, type, filename, count: filtered.length });
  } catch (timelineErr) {
    logger.error(logger.categories.QUEUE, `Timeline logging failed: ${timelineErr.message}`, timelineErr);
  }

  return { url: fileUrl, totalExported: filtered.length };
};

let exportWorker;

if (!isMock) {
  exportWorker = new Worker('exportQueue', workerHandler, { connection });

  exportWorker.on('completed', (job) => {
    logger.info(logger.categories.EXPORT, `[ExportWorker] Job ${job.id} completed!`);
  });

  exportWorker.on('failed', (job, err) => {
    logger.error(logger.categories.EXPORT, `[ExportWorker] Job ${job.id} failed: ${err.message}`, err);
  });

  exportWorker.on('error', (err) => {
    logger.error(logger.categories.QUEUE, `[ExportWorker] Worker error: ${err.message}`, err);
  });

  exportWorker.on('stalled', (jobId) => {
    logger.warn(logger.categories.QUEUE, `[ExportWorker] Job ${jobId} has stalled!`);
  });
} else {
  exportWorker = new MockWorker('exportQueue', workerHandler);
}

module.exports = exportWorker;
