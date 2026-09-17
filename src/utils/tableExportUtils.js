/**
 * tableExportUtils.js
 * Universal utility for exporting table data to Excel (.xlsx) and PDF (.pdf)
 * Clean tabular format, pure white background, standard borders, and no theme styling.
 */

/**
 * Extract clean tabular headers and rows from a DOM <table> element
 */
export function extractTableFromDOM(tableElement) {
  if (!tableElement) return { headers: [], rows: [] };

  // 1. Extract headers from <thead> or first <tr>
  let headerCells = tableElement.querySelectorAll('thead th, thead td');
  if (headerCells.length === 0) {
    const firstRow = tableElement.querySelector('tr');
    if (firstRow) {
      headerCells = firstRow.querySelectorAll('th, td');
    }
  }

  const rawHeaders = Array.from(headerCells).map((th) => cleanCellText(th.innerText));

  // Determine indices of columns to ignore (e.g. action buttons, expand icons)
  const ignoreIndices = new Set();
  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (!lower || lower === 'action' || lower === 'actions' || lower === 'expand' || lower === '▼' || lower === '▲') {
      ignoreIndices.add(idx);
    }
  });

  const headers = rawHeaders.filter((_, idx) => !ignoreIndices.has(idx));

  // 2. Extract rows from <tbody> (or all subsequent <tr>)
  const rows = [];
  const bodyRows = tableElement.querySelectorAll('tbody tr');
  const trElements = bodyRows.length > 0 ? bodyRows : tableElement.querySelectorAll('tr');

  // If using generic tr elements, skip the first row if it was header
  const startIndex = bodyRows.length === 0 ? 1 : 0;

  for (let i = startIndex; i < trElements.length; i++) {
    const tr = trElements[i];

    // Skip nested/expanded accordion detail rows (rows with high colspan or details class)
    const tdCells = tr.querySelectorAll('td, th');
    if (tdCells.length === 0) continue;
    if (tdCells.length === 1 && (tdCells[0].getAttribute('colspan') > 2 || tr.classList.contains('expanded-detail'))) {
      continue;
    }

    const rowData = [];
    let colIdx = 0;
    tdCells.forEach((td) => {
      if (!ignoreIndices.has(colIdx)) {
        // Clone node without action buttons or SVGs to get clean text
        rowData.push(cleanCellText(td.innerText));
      }
      colIdx++;
    });

    if (rowData.some((cell) => cell !== '')) {
      rows.push(rowData);
    }
  }

  return { headers, rows };
}

function cleanCellText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Export table data to Excel (.xlsx)
 */
export async function exportTableToExcel({ title = 'TABLE DATA', headers = [], rows = [], filename }) {
  const XLSX = await import('xlsx');

  const cleanTitle = `VELAN METROLOGY - ${title.toUpperCase()}`;
  const nowStr = new Date().toLocaleString();

  // Check if headers already include SNO
  const hasSno = headers.some((h) => /^s\.?\s*no\.?$/i.test(h.trim()));
  const finalHeaders = hasSno ? headers : ['SNO', ...headers];

  const finalRows = rows.map((row, idx) => {
    const cells = Array.isArray(row) ? row : Object.values(row);
    return hasSno ? cells : [idx + 1, ...cells];
  });

  // Prepare worksheet data starting with Title and Metadata block
  const wsData = [
    [cleanTitle],
    [`Export Date: ${nowStr} | Total Records: ${finalRows.length}`],
    [], // Blank spacing row
    finalHeaders,
    ...finalRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-calculate column widths
  const colWidths = finalHeaders.map((h, colIndex) => {
    let maxLen = String(h).length;
    finalRows.forEach((r) => {
      const val = r[colIndex];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  const safeFilename = (filename || title.toLowerCase().replace(/[^a-z0-9]+/g, '_')) + '.xlsx';
  XLSX.writeFile(wb, safeFilename);
}

/**
 * Export table data to PDF (.pdf)
 */
export async function exportTableToPdf({ title = 'TABLE DATA', headers = [], rows = [], filename }) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const hasSno = headers.some((h) => /^s\.?\s*no\.?$/i.test(h.trim()));
  const finalHeaders = hasSno ? headers : ['SNO', ...headers];

  const finalRows = rows.map((row, idx) => {
    const cells = Array.isArray(row) ? row : Object.values(row);
    return hasSno ? cells : [idx + 1, ...cells];
  });

  // Choose orientation: landscape for tables with more than 5 columns
  const orientation = finalHeaders.length > 5 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  const cleanTitle = `VELAN METROLOGY - ${title.toUpperCase()}`;
  const nowStr = new Date().toLocaleString();

  // Document Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(cleanTitle, 40, 36);

  // Subtitle info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${nowStr}   |   Total Records: ${finalRows.length}`, 40, 50);

  // Generate Table on pure white background, no dark theme
  doc.autoTable({
    head: [finalHeaders],
    body: finalRows,
    startY: 62,
    theme: 'grid',
    styles: {
      fontSize: finalHeaders.length > 8 ? 7 : 8,
      cellPadding: 4,
      textColor: [30, 30, 30],
      fillColor: [255, 255, 255],
      lineColor: [210, 215, 220],
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [242, 244, 248],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
      lineColor: [180, 190, 200],
      lineWidth: 0.75,
    },
    alternateRowStyles: {
      fillColor: [250, 251, 253],
    },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      // Clean footer with page number
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
      doc.text(str, pageWidth - 60, pageHeight - 20);
    },
  });

  const safeFilename = (filename || title.toLowerCase().replace(/[^a-z0-9]+/g, '_')) + '.pdf';
  doc.save(safeFilename);
}
