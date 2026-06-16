import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FilterContext';
import { useProductionDataQuery } from '../hooks/useProductionDataQuery';
import { useUI } from '../context/UIContext';
import {
  calculateProcessCycleTime,
  daysBetween,
} from '../utils/calculationUtils';
import { fmtTs } from '../utils/dateUtils';

// Modular Components
import VendorKPIs from '../components/vendor/VendorKPIs';
import VendorCharts from '../components/vendor/VendorCharts';
import VendorSplitBar from '../components/vendor/VendorSplitBar';
import VendorTimeRanking from '../components/vendor/VendorTimeRanking';
import VendorEfficiencyTable from '../components/vendor/VendorEfficiencyTable';
import VendorBottleneckAlert from '../components/vendor/VendorBottleneckAlert';
import VendorFullTable from '../components/vendor/VendorFullTable';
import VendorItemTable from '../components/vendor/VendorItemTable';

// ─── VENDOR EVALUATION PAGE COMPONENT ─────────────────────────────────────────

function VendorPage() {
  const { kpis } = useData();
  const { filters } = useFilters();
  const { rows: data } = useProductionDataQuery(filters, 1, 200);
  const { setActiveNav, setSelectedPONum } = useUI();
  const navigate = useNavigate();
  const [selectedSC, setSelectedSC] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const vendors = kpis.vendors || [];
  const maxDays = vendors.length > 0 ? Math.max(...vendors.map((v) => v.avgDays || 0)) : 1;

  const inhPct = Math.round((kpis.inhouse / Math.max(kpis.inhouse + kpis.vendor, 1)) * 100);
  const venPct = 100 - inhPct;
  const worstVendor = vendors.reduce(
    (a, b) => ((b.avgDays || 0) > (a.avgDays || 0) ? b : a),
    vendors[0] || {}
  );
  const mostDelayed = vendors.reduce(
    (a, b) => ((b.delayed || 0) > (a.delayed || 0) ? b : a),
    vendors[0] || {}
  );
  
  const now = new Date();
  const todayRef =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0');

  return (
    <div>
      <div className="section-title">
        🏭 Vendor <span>Evaluation</span>
        <div className="section-line" />
      </div>

      <VendorKPIs
        kpis={kpis}
        vendors={vendors}
        worstVendor={worstVendor}
        mostDelayed={mostDelayed}
        inhPct={inhPct}
        venPct={venPct}
      />

      <div
        style={{
          marginTop: -8,
          marginBottom: 14,
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: 'Share Tech Mono,monospace',
        }}
      >
        Aging reference date: {todayRef} (computed from last edit/update timestamp in sheet)
      </div>

      <VendorSplitBar
        inhPct={inhPct}
        venPct={venPct}
        inhouseCount={kpis.inhouse}
        vendorCount={kpis.vendor}
      />

      <VendorCharts vendors={vendors} />

      <VendorTimeRanking vendors={vendors} maxDays={maxDays} />

      <VendorEfficiencyTable vendors={vendors} />

      <VendorBottleneckAlert bottleneck={kpis.topVendorBottleneck} />

      <VendorFullTable vendors={vendors} />

      <VendorItemTable
        data={data}
        todayRef={todayRef}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        setSelectedSC={setSelectedSC}
      />

      {/* SC Detail Modal */}
      {selectedSC && (
        <div
          className="table-card"
          style={{
            marginTop: 20,
            border: '2px solid var(--accent1)',
            boxShadow: '0 0 20px rgba(0,201,255,0.15)',
          }}
        >
          <div
            className="table-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'rgba(0,201,255,0.05)',
            }}
          >
            <div>
              <div className="chart-title" style={{ color: 'var(--accent1)' }}>
                📦 SC {selectedSC} — Vendor Products & Processing Status
              </div>
              <div className="chart-sub">
                {data.filter((r) => r.sc === selectedSC && r.inhouse === 'VENDOR').length} vendor
                items in this SC set
              </div>
            </div>
            <button
              onClick={() => setSelectedSC(null)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              CLOSE
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>PRODUCT NAME</th>
                  <th>TYPE</th>
                  <th>PROCESS STAGE</th>
                  <th>LAST UPDATE</th>
                  <th>CYCLE TIME</th>
                  <th>PENDING DAYS</th>
                  <th>PROCESSING STATUS</th>
                  <th>SLA COMPLIANCE</th>
                  <th>OVERALL STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter((r) => r.sc === selectedSC && r.inhouse === 'VENDOR')
                  .map((item, idx) => {
                    const cycleTime = calculateProcessCycleTime(item.poDate, item.timestamp);
                    const pendingDays = daysBetween(item.timestamp, todayRef);
                    const isDelayed = pendingDays !== null && pendingDays > 2;
                    const isOnTime = cycleTime !== null && cycleTime <= 21;
                    const completionStatus = ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(
                      item.currentStage
                    );

                    return (
                      <tr
                        key={`${selectedSC}-${idx}`}
                        style={{
                          backgroundColor: isDelayed
                            ? 'rgba(255,61,90,0.08)'
                            : completionStatus
                              ? 'rgba(0,230,118,0.08)'
                              : 'transparent',
                        }}
                      >
                        <td className="mono" style={{ fontSize: 11 }}>
                          {item.po}
                        </td>
                        <td
                          style={{
                            fontSize: 11,
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.product}
                        </td>
                        <td>
                          <span className="status-pill badge-blue">{item.type}</span>
                        </td>
                        <td>
                          <span className="status-pill s-vendor" style={{ fontSize: 10 }}>
                            {item.currentStage}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {fmtTs(item.timestamp)}
                        </td>
                        <td
                          style={{
                            fontFamily: 'Rajdhani',
                            fontWeight: 700,
                            fontSize: 13,
                            color: 'var(--accent1)',
                          }}
                        >
                          {cycleTime !== null ? `${cycleTime}d` : '—'}
                        </td>
                        <td
                          style={{
                            fontFamily: 'Rajdhani',
                            fontWeight: 700,
                            fontSize: 13,
                            color: isDelayed ? 'var(--danger)' : 'var(--success)',
                          }}
                        >
                          {pendingDays !== null ? `${pendingDays}d` : '—'}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${completionStatus ? 'badge-green' : 'badge-yellow'}`}
                            style={{ fontSize: 10 }}
                          >
                            {completionStatus ? '✓ COMPLETED' : '⏳ PROCESSING'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${isDelayed ? 'badge-red' : 'badge-green'}`}
                            style={{ fontSize: 10 }}
                          >
                            {isDelayed ? '⚠ VIOLATION' : '✓ COMPLIANT'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${isOnTime && completionStatus ? 'badge-green' : isDelayed ? 'badge-red' : 'badge-yellow'}`}
                            style={{ fontSize: 10 }}
                          >
                            {isOnTime && completionStatus
                              ? '🟢 ON-TIME'
                              : isDelayed
                                ? '🔴 DELAYED'
                                : completionStatus
                                  ? '🟢 EARLY'
                                  : '🟡 IN-PROGRESS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '16px 18px',
              backgroundColor: 'rgba(0,201,255,0.02)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              {(() => {
                const scItems = data.filter((r) => r.sc === selectedSC && r.inhouse === 'VENDOR');
                const totalItems = scItems.length;
                const completedItems = scItems.filter((r) =>
                  ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(r.currentStage)
                ).length;
                const delayedItems = scItems.filter((r) => {
                  const pending = daysBetween(r.timestamp, todayRef);
                  return pending !== null && pending > 2;
                }).length;
                const avgCycleTime =
                  scItems.reduce((sum, r) => {
                    const cycle = calculateProcessCycleTime(r.poDate, r.timestamp);
                    return sum + (cycle !== null ? cycle : 0);
                  }, 0) / Math.max(totalItems, 1);

                return (
                  <>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Total Items in SC
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 24,
                          fontWeight: 700,
                          color: 'var(--accent1)',
                        }}
                      >
                        {totalItems}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Completed
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 24,
                          fontWeight: 700,
                          color: 'var(--success)',
                        }}
                      >
                        {completedItems}{' '}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {totalItems > 0
                            ? `(${Math.round((completedItems / totalItems) * 100)}%)`
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Delayed Items (2d+)
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 24,
                          fontWeight: 700,
                          color: delayedItems > 0 ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {delayedItems}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Avg Cycle Time
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 24,
                          fontWeight: 700,
                          color: avgCycleTime <= 21 ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {Math.round(avgCycleTime)}d
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          className="table-card"
          style={{
            marginTop: 20,
            border: '2px solid var(--accent4)',
            boxShadow: '0 0 30px rgba(255,107,53,0.2)',
          }}
        >
          <div
            className="table-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255,107,53,0.05)',
            }}
          >
            <div>
              <div className="chart-title" style={{ color: 'var(--accent4)' }}>
                📋 Item Details
              </div>
              <div className="chart-sub">Complete information for {selectedItem.sc}</div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              CLOSE
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 20,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  PO Number
                </div>
                <div
                  style={{
                    fontFamily: 'Share Tech Mono',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--accent1)',
                  }}
                >
                  {selectedItem.po}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  SC Number
                </div>
                <div
                  style={{
                    fontFamily: 'Share Tech Mono',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--accent1)',
                  }}
                >
                  {selectedItem.sc}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Product Type
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent2)' }}>
                  {selectedItem.type}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Product Name
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedItem.product}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 14,
                marginBottom: 20,
              }}
            >
              {(() => {
                const cycle = calculateProcessCycleTime(
                  selectedItem.poDate,
                  selectedItem.timestamp
                );
                const pending = daysBetween(selectedItem.timestamp, todayRef);
                const isDelayed = pending !== null && pending > 2;
                const isOnTime = cycle !== null && cycle <= 21;

                return (
                  <>
                    <div
                      style={{
                        background: 'rgba(0,201,255,0.1)',
                        border: '1px solid rgba(0,201,255,0.3)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Current Stage
                      </div>
                      <div
                        style={{
                          fontFamily: 'Share Tech Mono',
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--accent1)',
                        }}
                      >
                        {selectedItem.currentStage}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255,107,53,0.1)',
                        border: '1px solid rgba(255,107,53,0.3)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Cycle Time
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 16,
                          fontWeight: 700,
                          color: isOnTime ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {cycle !== null ? `${cycle} days` : '—'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: `rgba(${isDelayed ? '255,61,90' : '0,230,118'},0.1)`,
                        border: `1px solid rgba(${isDelayed ? '255,61,90' : '0,230,118'},0.3)`,
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Pending Days
                      </div>
                      <div
                        style={{
                          fontFamily: 'Rajdhani',
                          fontSize: 16,
                          fontWeight: 700,
                          color: isDelayed ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {pending !== null ? `${pending} days` : '—'}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Last Update
                      </div>
                      <div
                        style={{
                          fontFamily: 'Share Tech Mono',
                          fontSize: 10,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {fmtTs(selectedItem.timestamp)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 14,
                marginBottom: 20,
              }}
            >
              {(() => {
                const cycle = calculateProcessCycleTime(
                  selectedItem.poDate,
                  selectedItem.timestamp
                );
                const pending = daysBetween(selectedItem.timestamp, todayRef);
                const isDelayed = pending !== null && pending > 2;
                const isOnTime = cycle !== null && cycle <= 21;
                const isCompleted = ['READY', 'STORES', 'STOCK', 'EXSTOCK'].includes(
                  selectedItem.currentStage
                );

                return (
                  <>
                    <div>
                      <span
                        className={`status-pill ${isCompleted ? 'badge-green' : 'badge-yellow'}`}
                        style={{ fontSize: 11 }}
                      >
                        {isCompleted ? '✓ COMPLETED' : '⏳ PROCESSING'}
                      </span>
                    </div>
                    <div>
                      <span
                        className={`status-pill ${isDelayed ? 'badge-red' : 'badge-green'}`}
                        style={{ fontSize: 11 }}
                      >
                        {isDelayed ? '⚠ SLA VIOLATION' : '✓ COMPLIANT'}
                      </span>
                    </div>
                    <div>
                      <span
                        className={`status-pill ${isOnTime && isCompleted ? 'badge-green' : isDelayed ? 'badge-red' : 'badge-yellow'}`}
                        style={{ fontSize: 11 }}
                      >
                        {isOnTime && isCompleted
                          ? '🟢 ON-TIME'
                          : isDelayed
                            ? '🔴 DELAYED'
                            : isCompleted
                              ? '🟢 EARLY'
                              : '🟡 IN-PROGRESS'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div
              style={{
                background: 'rgba(0,201,255,0.05)',
                border: '1px dashed rgba(0,201,255,0.3)',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                📌 Quick Actions
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setSelectedSC(selectedItem.sc);
                  }}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  View SC {selectedItem.sc} Details
                </button>
                {setActiveNav && (
                  <button
                    onClick={() => {
                      if (setSelectedPONum) {
                        setSelectedPONum(selectedItem.po);
                      }
                      setSelectedItem(null);
                      setActiveNav('po');
                      navigate('/po');
                    }}
                    style={{
                      background: 'rgba(0,201,255,0.1)',
                      border: '1px solid rgba(0,201,255,0.3)',
                      color: 'var(--accent1)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    View in PO Analysis
                  </button>
                )}
                {setActiveNav && (
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setActiveNav('wip');
                      navigate('/wip');
                    }}
                    style={{
                      background: 'rgba(255,214,10,0.1)',
                      border: '1px solid rgba(255,214,10,0.3)',
                      color: 'var(--accent5)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    View in Stage / WIP
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 10,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorPage;
