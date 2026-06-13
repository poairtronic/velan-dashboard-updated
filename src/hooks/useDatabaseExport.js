import { fmtTs, fmtDate } from '../utils/dateUtils';
import { apiClient } from '../services/apiClient';
import { buildQueryString } from '../hooks/queries/useDashboardQueries';

export function useDatabaseExport(activeFilters, kpiStats) {
  
  async function fetchExportData() {
    const qs = buildQueryString({ ...activeFilters, limit: 10000 }); // Large limit for export
    const res = await apiClient(`/api/data?${qs}`);
    return res.data?.rows || [];
  }

  async function exportJSON() {
    const filtered = await fetchExportData();
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCSV() {
    const filtered = await fetchExportData();
    if (filtered.length === 0) return;
    const header = Object.keys(filtered[0] || {});
    const rows = filtered.map((r) =>
      header.map((h) => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const filtered = await fetchExportData();
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    const exportRows = filtered.filter((r) => kpiStats.isDoneStage(r.currentStage));

    const columns = [
      { header: 'SC', dataKey: 'sc' },
      { header: 'PO', dataKey: 'po' },
      { header: 'PO DATE', dataKey: 'poDate' },
      { header: 'PRODUCT', dataKey: 'product' },
      { header: 'STAGE', dataKey: 'currentStage' },
      { header: 'INHOUSE', dataKey: 'inhouse' },
      { header: 'TIMESTAMP', dataKey: 'timestamp' },
    ];

    const rows = exportRows.map((r) => ({
      sc: r.sc || '',
      po: r.po || '',
      poDate: r.poDate ? fmtDate(r.poDate) : '',
      product: r.product || '',
      currentStage: r.currentStage || '',
      inhouse: r.inhouse || '',
      timestamp: r.timestamp ? fmtTs(r.timestamp) : '',
    }));

    doc.setFontSize(14);
    doc.text('Velan Metrology \u2013 Database Export', 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const dateRange =
      activeFilters.dateFrom || activeFilters.dateTo ? ` | Date range: ${activeFilters.dateFrom || '-'} to ${activeFilters.dateTo || '-'}` : '';
    doc.text(`Exported Rows: ${rows.length}  (READY / STORES / STOCK only)${dateRange}`, 40, 52);
    doc.text(
      `Unique POs: ${kpiStats.uniquePO}   SC Sets: ${kpiStats.uniqueSC}   SC Completed: ${kpiStats.scCompleted}`,
      40,
      66
    );

    doc.autoTable({
      columns,
      body: rows,
      startY: 82,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 100, 180] },
      theme: 'grid',
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      bodyStyles: { textColor: 20 },
    });
    doc.save('database_export.pdf');
  }

  return { exportJSON, exportCSV, exportPDF };
}
