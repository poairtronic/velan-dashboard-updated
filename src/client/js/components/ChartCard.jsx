// ─── CHARTCARD UI COMPONENT ───────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ position: 'relative', height: 260, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}
