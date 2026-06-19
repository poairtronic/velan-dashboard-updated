import React from 'react';

function DatabaseHistoryManager({
  isAdmin,
  historyRows,
  dataLength,
  historyConfig,
  setHistoryConfig,
  onSyncHistory,
  onResetDB,
  handleHistoryFileUpload,
  handleHistoryDragDrop,
  importState,
}) {
  if (!isAdmin) return null;

  return (
    <div
      className="chart-card"
      style={{
        marginBottom: 18,
        border: '1px solid var(--border-bright)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🗃</span>
          <div>
            <div className="chart-title" style={{ marginBottom: 0, color: 'var(--accent3)' }}>
              History Archive Import
            </div>
            <div className="chart-sub">
              IMPORT PAST RECORDS — PERMANENTLY STORED IN DATABASE
            </div>
          </div>
        </div>
        {(historyRows || []).length > 0 && (
          <span
            style={{
              background: 'var(--glow1)',
              border: '1px solid var(--border-bright)',
              color: 'var(--accent3)',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontFamily: 'Share Tech Mono,monospace',
            }}
          >
            🗂 {(historyRows || []).length} history rows in DB
            {(historyRows || []).length !== dataLength && (
              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                · {dataLength} total (incl. live)
              </span>
            )}
          </span>
        )}
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 16,
          background: 'var(--glow2)',
          border: '2px dashed var(--success)',
          borderRadius: 8,
          textAlign: 'center',
          cursor: 'pointer',
          opacity: 0.9,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.target.style.borderColor = 'rgba(0,230,118,0.8)';
        }}
        onDragLeave={(e) => {
          e.target.style.borderColor = 'rgba(0,230,118,0.4)';
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleHistoryDragDrop(e);
        }}
        onClick={() => document.getElementById('historyFileInput')?.click()}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>📤</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--success)',
            marginBottom: 4,
            letterSpacing: 1,
          }}
        >
          DRAG & DROP BACKUP FILE HERE
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          or click to browse — supports .xlsx, .xls, .csv, .json
        </div>
        <input
          id="historyFileInput"
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          style={{ display: 'none' }}
          onChange={(e) => handleHistoryFileUpload(e.target.files?.[0])}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 280 }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginBottom: 6,
              letterSpacing: 1,
            }}
          >
            OR PASTE GOOGLE SHEETS CSV URL
          </div>
          <input
            type="text"
            value={historyConfig?.url || ''}
            onChange={(e) => setHistoryConfig((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv"
            style={{
              width: '100%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-bright)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              padding: '9px 12px',
              fontSize: 11,
              fontFamily: 'Share Tech Mono,monospace',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="filter-btn"
            style={{
              padding: '10px 18px',
              background: importState?.loading ? 'var(--glow1)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-bright)',
              color: 'var(--accent3)',
              fontWeight: 700,
            }}
            onClick={onSyncHistory}
            disabled={importState?.loading}
          >
            {importState?.loading ? '⏳ Importing…' : '📥 Import from URL'}
          </button>
          <button
            className="filter-btn"
            style={{ padding: '10px' }}
            onClick={() => setHistoryConfig({ url: '' })}
          >
            🧹 Clear
          </button>
        </div>
      </div>

      {importState?.lastMsg && (
        <div
          style={{
            marginTop: 10,
            background: importState.lastMsg.startsWith('✅')
              ? 'rgba(0,230,118,0.07)'
              : importState.lastMsg.startsWith('❌')
                ? 'rgba(255,61,90,0.07)'
                : 'rgba(0,201,255,0.07)',
            border: `1px solid ${importState.lastMsg.startsWith('✅') ? 'rgba(0,230,118,0.3)' : importState.lastMsg.startsWith('❌') ? 'rgba(255,61,90,0.3)' : 'rgba(0,201,255,0.25)'}`,
            borderRadius: 7,
            padding: '9px 14px',
            color: importState.lastMsg.startsWith('✅')
              ? 'var(--success)'
              : importState.lastMsg.startsWith('❌')
                ? 'var(--danger)'
                : 'var(--accent1)',
            fontSize: 11,
            fontFamily: 'Share Tech Mono,monospace',
          }}
        >
          {importState.lastMsg}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          className="filter-btn"
          style={{
            padding: '10px 18px',
            background: 'rgba(255,61,90,0.12)',
            border: '1px solid rgba(255,61,90,0.5)',
            color: 'var(--danger)',
            fontWeight: 700,
          }}
          onClick={onResetDB}
          disabled={importState?.loading}
        >
          🗑 Reset Entire DB (WARNING)
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          padding: '8px 12px',
          background: 'var(--glow1)',
          border: '1px solid var(--border)',
          borderRadius: 7,
        }}
      >
        <strong style={{ color: 'var(--accent3)' }}>ℹ Database-only:</strong> Imported history
        rows are stored permanently in Neon PostgreSQL and visible{' '}
        <strong>only on this page</strong>. They do not appear in Production, Stage/WIP, or any
        other module. Duplicates are automatically skipped.
      </div>
    </div>
  );
}

export default React.memo(DatabaseHistoryManager);

