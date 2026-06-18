import { toast } from 'react-hot-toast';

export function useDatabaseExport(filtered, kpiStats, fromDate, toDate, filters = {}) {

  async function triggerExport(type) {
    const toastId = toast.loading(`Preparing ${type.toUpperCase()} export in background...`);
    try {
      // Combine all filters including date criteria
      const combinedFilters = {
        ...filters,
        fromDate,
        toDate,
        dateType: filters.dateType || 'poDate'
      };

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          filters: combinedFilters,
          search: filters.search || ''
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const { jobId } = await response.json();

      // Poll status every 1 second
      let status = 'processing';
      let attempts = 0;
      const maxAttempts = 60; // 1 minute timeout

      while (status === 'processing' && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        const pollRes = await fetch(`/api/reports/status/${jobId}`);
        if (!pollRes.ok) {
          throw new Error(`Polling status failed with status ${pollRes.status}`);
        }

        const statusData = await pollRes.json();
        status = statusData.status;

        if (status === 'completed') {
          toast.success(`${type.toUpperCase()} export ready! Downloading...`, { id: toastId });

          // Trigger file download
          const downloadUrl = `/api/reports/download/${jobId}`;
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.click();
          return;
        }

        if (status === 'failed') {
          throw new Error(statusData.error || 'Server-side report generation failed');
        }
      }

      if (status === 'processing') {
        throw new Error('Report generation timed out. Please try again.');
      }
    } catch (err) {
      console.error('Database export failed:', err);
      toast.error(`Export failed: ${err.message}`, { id: toastId });
    }
  }

  function exportJSON() {
    triggerExport('json');
  }

  function exportCSV() {
    triggerExport('csv');
  }

  function exportPDF() {
    triggerExport('pdf');
  }

  return { exportJSON, exportCSV, exportPDF };
}
