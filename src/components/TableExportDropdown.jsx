import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { extractTableFromDOM, exportTableToExcel, exportTableToPdf } from '../utils/tableExportUtils';

export default function TableExportDropdown({
  title = 'Table Data',
  tableRef,
  headers,
  rows,
  filename,
  buttonStyle = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getData = () => {
    if (headers && rows) {
      return { headers, rows };
    }
    if (tableRef?.current) {
      return extractTableFromDOM(tableRef.current);
    }
    // Fallback: search closest table in parent card
    if (dropdownRef.current) {
      const card = dropdownRef.current.closest('.table-card, .table-wrap, .db-table-container, div');
      const table = card?.querySelector('table');
      if (table) {
        return extractTableFromDOM(table);
      }
    }
    return { headers: [], rows: [] };
  };

  const handleExport = async (type) => {
    setIsOpen(false);
    setIsExporting(true);

    try {
      const { headers: h, rows: r } = getData();
      if (!h.length && !r.length) {
        toast.error('No table data available to export');
        setIsExporting(false);
        return;
      }

      if (type === 'excel') {
        toast.loading('Generating Excel file...', { id: 'export-toast' });
        await exportTableToExcel({ title, headers: h, rows: r, filename });
        toast.success('Excel exported successfully!', { id: 'export-toast' });
      } else if (type === 'pdf') {
        toast.loading('Generating PDF document...', { id: 'export-toast' });
        await exportTableToPdf({ title, headers: h, rows: r, filename });
        toast.success('PDF exported successfully!', { id: 'export-toast' });
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast.error(`Export failed: ${err.message || 'Unknown error'}`, { id: 'export-toast' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', ...buttonStyle }}>
      <button
        type="button"
        className="filter-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          fontSize: 11,
          fontFamily: 'inherit',
          cursor: isExporting ? 'wait' : 'pointer',
          borderRadius: 6,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent1)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        title="Export table data as Excel or PDF"
      >
        <Download size={13} style={{ color: 'var(--accent1)' }} />
        <span>{isExporting ? 'Exporting...' : 'Export'}</span>
        <ChevronDown size={11} style={{ opacity: 0.7 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 155,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            zIndex: 150,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => handleExport('excel')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 11,
              textAlign: 'left',
              cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileSpreadsheet size={14} style={{ color: '#10b981' }} />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('pdf')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 11,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileText size={14} style={{ color: '#ef4444' }} />
            <span>PDF (.pdf)</span>
          </button>
        </div>
      )}
    </div>
  );
}
