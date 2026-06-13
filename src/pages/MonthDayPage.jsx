import React from 'react';
import { useDashboardDataQuery } from '../hooks/queries/useDashboardQueries';
import { useFilters } from '../context/FilterContext';
import { TARGET_DAYS } from '../utils/calculationUtils';
import { fmtDate } from '../utils/dateUtils';
import { getStageColor } from '../services/dataNormalizer';

// ─── MONTH / DAY TIMELINE VIEW PAGE COMPONENT ──────────────────────────────────

function MonthDayPage() {
  const { filters } = useFilters();
  const todayDate = new Date();
  const [viewMode, setViewMode] = React.useState('month');
  const [selMonth, setSelMonth] = React.useState(todayDate.getMonth());
  const [selYear] = React.useState(todayDate.getFullYear());
  const [selDay, setSelDay] = React.useState(
    `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
  );
  const [expandedPO, setExpandedPO] = React.useState(null);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Determine date ranges for queries
  const poDateStartMonth = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-01`;
  const poDateEndMonth = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-31`;
  
  const { data: monthRes, isLoading: monthLoading } = useDashboardDataQuery(
    { ...filters, poDateStart: poDateStartMonth, poDateEnd: poDateEndMonth },
    1, 
    5000,
    { enabled: viewMode === 'month' }
  );

  const { data: dayRes, isLoading: dayLoading } = useDashboardDataQuery(
    { ...filters, poDateStart: selDay, poDateEnd: selDay },
    1, 
    5000,
    { enabled: viewMode === 'day' }
  );

  const monthItems = monthRes?.data?.rows || [];
  const dayItems = dayRes?.data?.rows || [];

  const monthStats = React.useMemo(() => {
    const pos = new Set(monthItems.map((r) => r.po)).size;
    const scs = new Set(monthItems.map((r) => r.sc)).size;
    const delayed = monthItems.filter((r) => {
      const today = new Date().getTime();
      const t1 = new Date(r.poDate || 0).getTime();
      const days = (today - t1) / (1000 * 60 * 60 * 24);
      return days > TARGET_DAYS;
    }).length;
    const ready = monthItems.filter((r) => r.currentStage === 'READY').length;
    const stores = monthItems.filter((r) => r.currentStage === 'STORES').length;
    return { total: monthItems.length, pos, scs, delayed, ready, stores };
  }, [monthItems]);

  const groupByPO = (items) => {
    const map = {};
    items.forEach((r) => {
      if (!map[r.po]) map[r.po] = { po: r.po, poDate: r.poDate, scs: {} };
      if (!map[r.po].scs[r.sc]) map[r.po].scs[r.sc] = [];
      map[r.po].scs[r.sc].push(r);
    });
    return Object.values(map);
  };

  return (
    <div>
      <div className="section-title">
        Month / Day <span>View</span>
        <div className="section-line" />
      </div>
      <div className="tabs">
        <div
          className={`tab ${viewMode === 'month' ? 'active' : ''}`}
          onClick={() => setViewMode('month')}
        >
          📅 Month View
        </div>
        <div
          className={`tab ${viewMode === 'day' ? 'active' : ''}`}
          onClick={() => setViewMode('day')}
        >
          📆 Day View
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {MONTHS.map((m, i) => (
              <button
                key={i}
                className={`filter-btn ${selMonth === i ? 'active' : ''}`}
                onClick={() => setSelMonth(i)}
              >
                {m} {selYear}
              </button>
            ))}
          </div>
          {monthLoading ? (
            <div style={{ padding: 40, color: '#fff' }}>Loading Month Data...</div>
          ) : (
            <>
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-card">
                  <div className="kpi-label">TOTAL ITEMS</div>
                  <div className="kpi-value">{monthStats.total}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">DISTINCT POs</div>
                  <div className="kpi-value">{monthStats.pos}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">DISTINCT SCs</div>
                  <div className="kpi-value">{monthStats.scs}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">DELAYED</div>
                  <div className="kpi-value" style={{ color: 'var(--danger)' }}>
                    {monthStats.delayed}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">READY</div>
                  <div className="kpi-value" style={{ color: 'var(--success)' }}>
                    {monthStats.ready}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">IN STORES</div>
                  <div className="kpi-value" style={{ color: 'var(--accent1)' }}>
                    {monthStats.stores}
                  </div>
                </div>
              </div>
              <div className="table-card">
                <div className="table-header">
                  <span style={{ fontFamily: 'Rajdhani', fontWeight: 700 }}>
                    Items received in {MONTHS[selMonth]} {selYear}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {monthItems.length} items
                  </span>
                </div>
                <div className="table-wrap">
                  {monthItems.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                      No items received in {MONTHS[selMonth]} {selYear}
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>PO</th>
                          <th>SC</th>
                          <th>PRODUCT</th>
                          <th>PO DATE</th>
                          <th>STAGE</th>
                          <th>TIMESTAMP</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthItems.map((r, i) => (
                          <tr key={i}>
                            <td className="mono text-accent">{r.po || '—'}</td>
                            <td className="mono">{r.sc || '—'}</td>
                            <td
                              style={{
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r.product || '—'}
                            </td>
                            <td className="mono" style={{ fontSize: 10 }}>
                              {fmtDate(r.poDate)}
                            </td>
                            <td>
                              <span
                                className="status-pill"
                                style={{
                                  background: getStageColor(r.currentStage) + '22',
                                  color: getStageColor(r.currentStage),
                                }}
                              >
                                {r.currentStage || '—'}
                              </span>
                            </td>
                            <td className="mono" style={{ fontSize: 10 }}>
                              {(r.timestamp || '').substring(0, 16) || '—'}
                            </td>
                            <td>
                              <span
                                className={`status-pill ${['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(r.currentStage) ? 's-ready' : 's-wip'}`}
                              >
                                {['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(r.currentStage)
                                  ? 'DONE'
                                  : 'WIP'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {viewMode === 'day' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="date"
              className="filter-input"
              value={selDay}
              onChange={(e) => {
                setSelDay(e.target.value);
                setExpandedPO(null);
              }}
              style={{ maxWidth: 200 }}
            />
            {!dayLoading && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {dayItems.length} items with PO date = {selDay}
              </span>
            )}
          </div>
          
          {dayLoading ? (
            <div style={{ padding: 40, color: '#fff' }}>Loading Day Data...</div>
          ) : (
            <>
              {groupByPO(dayItems).length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                  No items received on {selDay}
                </div>
              )}
              {groupByPO(dayItems).map((pg) => (
                <div key={pg.po} className="chart-card" style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyStyle: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedPO(expandedPO === pg.po ? null : pg.po)}
                  >
                    <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15 }}>
                      PO: <span className="text-accent">{pg.po || '—'}</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {Object.keys(pg.scs).length} SCs · {Object.values(pg.scs).flat().length} items{' '}
                      {expandedPO === pg.po ? '▲' : '▼'}
                    </span>
                  </div>
                  {expandedPO === pg.po &&
                    Object.entries(pg.scs).map(([sc, items]) => (
                      <div
                        key={sc}
                        style={{
                          marginTop: 10,
                          paddingLeft: 16,
                          borderLeft: '2px solid var(--border-bright)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--accent1)',
                            fontFamily: 'Share Tech Mono,monospace',
                            marginBottom: 6,
                          }}
                        >
                          SC: {sc}
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>PRODUCT</th>
                              <th>STAGE</th>
                              <th>TIMESTAMP</th>
                              <th>INHOUSE</th>
                              <th>PENDING DAYS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((r, i) => {
                              const t1 = new Date(r.poDate || 0).getTime();
                              const today = new Date().getTime();
                              const pendingDays = Math.floor((today - t1) / (1000 * 60 * 60 * 24));
                              return (
                              <tr key={i}>
                                <td style={{ fontSize: 11 }}>{r.product || '—'}</td>
                                <td>
                                  <span
                                    className="status-pill"
                                    style={{
                                      background: getStageColor(r.currentStage) + '22',
                                      color: getStageColor(r.currentStage),
                                    }}
                                  >
                                    {r.currentStage || '—'}
                                  </span>
                                </td>
                                <td className="mono" style={{ fontSize: 10 }}>
                                  {(r.timestamp || '').substring(0, 16) || '—'}
                                </td>
                                <td>
                                  <span
                                    className={`status-pill ${r.inhouse === 'VENDOR' ? 's-vendor' : 'badge-blue'}`}
                                  >
                                    {r.inhouse}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    color: pendingDays > 21
                                        ? 'var(--danger)'
                                        : pendingDays > 7
                                          ? 'var(--warning)'
                                          : 'var(--success)',
                                  }}
                                >
                                  {pendingDays}d
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MonthDayPage;
